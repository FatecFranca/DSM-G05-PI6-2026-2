import 'dart:async';
import 'package:flutter/foundation.dart';
import '../data/inventory_api_client.dart';
import '../domain/auth_models.dart';

enum AuthStatus { restoring, signedOut, signedIn, unavailable }

class AuthController extends ChangeNotifier {
  AuthController(this.api, this.store) {
    api.onSessionExpired = _expire;
  }
  final InventoryApiClient api;
  final SessionStore store;
  AuthStatus status = AuthStatus.restoring;
  AuthUser? user;
  String? notice;
  bool registrationEnabled = false;
  bool _disposed = false;
  AuthSession? _session;
  Timer? _expiryTimer;
  int _generation = 0;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> loadConfiguration() async {
    try {
      registrationEnabled =
          (await api.getJson('/api/v1/auth/config'))['registrationEnabled'] ==
          true;
    } on ApiException {
      registrationEnabled = false;
    }
    _notify();
  }

  Future<void> restore() async {
    final generation = ++_generation;
    status = AuthStatus.restoring;
    _notify();
    try {
      final session = _session ?? await store.read();
      if (_disposed || generation != _generation) return;
      if (session == null || session.expired) {
        await _clear();
        status = AuthStatus.signedOut;
      } else {
        _session = session;
        api.sessionToken = session.token;
        final result = await api.getJson('/api/v1/auth/me');
        if (_disposed || generation != _generation) return;
        user = AuthUser.fromJson(result['user'] as Map<String, dynamic>);
        status = AuthStatus.signedIn;
        _scheduleExpiry(session);
      }
    } on Object {
      if (_disposed || generation != _generation) return;
      user = null;
      status = AuthStatus.unavailable;
      notice = 'Não foi possível verificar sua sessão. Tente novamente.';
    }
    _notify();
  }

  Future<void> login(String email, String password, bool remember) async {
    final result = await api.postJson('/api/v1/auth/login', {
      'email': email.trim(),
      'password': password,
      'remember': remember,
    });
    final cookie = result.headers['set-cookie'] ?? '';
    final token = RegExp(
      r'(?:^|[,;]\s*)estoque_session=([A-Za-z0-9_-]{43})(?:;|$)',
    ).firstMatch(cookie)?.group(1);
    if (token == null) {
      throw const ApiException('O servidor não enviou uma sessão válida.');
    }
    final session = AuthSession(
      token,
      DateTime.parse(result.data['expiresAt'] as String),
    );
    final signedUser = AuthUser.fromJson(
      result.data['user'] as Map<String, dynamic>,
    );
    try {
      if (remember) {
        await store.write(session);
      } else {
        await store.clear();
      }
    } on Object {
      api.sessionToken = token;
      try {
        await api.postJson('/api/v1/auth/logout', {});
      } on Object {
        /* Validade limitada no servidor. */
      }
      api.sessionToken = null;
      throw const ApiException(
        'Não foi possível acessar o armazenamento seguro. Tente novamente.',
      );
    }
    if (_disposed) return;
    ++_generation;
    _session = session;
    api.sessionToken = token;
    user = signedUser;
    notice = null;
    status = AuthStatus.signedIn;
    _scheduleExpiry(session);
    _notify();
  }

  Future<String> register(String name, String email, String password) async =>
      (await api.postJson('/api/v1/auth/register', {
            'name': name.trim(),
            'email': email.trim(),
            'password': password,
          })).data['message']
          as String;
  Future<String> forgotPassword(String email) async =>
      (await api.postJson('/api/v1/auth/forgot-password', {
            'email': email.trim(),
          })).data['message']
          as String;
  Future<String> resetPassword(String link, String password) async {
    final uri = Uri.tryParse(link.trim());
    String? token;
    if (uri != null && uri.path == '/redefinir-senha') {
      try {
        token = Uri.splitQueryString(uri.fragment)['token'];
      } on FormatException {
        /* Inválido. */
      }
    }
    if (token == null || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)) {
      throw const ApiException(
        'Cole o link completo recebido no e-mail de recuperação.',
      );
    }
    final result = await api.postJson('/api/v1/auth/reset-password', {
      'token': token,
      'password': password,
    });
    return result.data['message'] as String;
  }

  Future<void> changePassword(String current, String password) async {
    await api.postJson('/api/v1/auth/change-password', {
      'currentPassword': current,
      'password': password,
    });
    await signOutLocally('Senha alterada. Entre novamente.');
  }

  Future<void> logout() async {
    await api.postJson('/api/v1/auth/logout', {});
    await signOutLocally('Sessão encerrada.');
  }

  Future<void> signOutLocally([String? message]) async {
    ++_generation;
    user = null;
    status = AuthStatus.restoring;
    notice = message;
    _notify();
    try {
      await _clear();
      status = AuthStatus.signedOut;
    } on Object {
      status = AuthStatus.unavailable;
      notice = 'Não foi possível apagar a sessão salva. Tente sair novamente.';
    }
    _notify();
  }

  void _expire() {
    if (_disposed || status == AuthStatus.signedOut) return;
    unawaited(signOutLocally('Sua sessão expirou. Entre novamente.'));
  }

  Future<void> _clear() async {
    _expiryTimer?.cancel();
    _session = null;
    user = null;
    api.sessionToken = null;
    await store.clear();
  }

  void _scheduleExpiry(AuthSession session) {
    _expiryTimer?.cancel();
    _expiryTimer = Timer(session.expiresAt.difference(DateTime.now()), _expire);
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    _expiryTimer?.cancel();
    api.onSessionExpired = null;
    super.dispose();
  }
}
