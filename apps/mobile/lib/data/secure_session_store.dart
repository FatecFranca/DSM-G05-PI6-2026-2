import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../domain/auth_models.dart';

class SecureSessionStore implements SessionStore {
  SecureSessionStore(Uri apiUri, {FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            iOptions: IOSOptions(
              accessibility: KeychainAccessibility.unlocked_this_device,
            ),
          ),
      _key = 'estoque_session_${base64Url.encode(utf8.encode(apiUri.origin))}';
  final FlutterSecureStorage _storage;
  final String _key;
  @override
  Future<AuthSession?> read() async {
    final value = await _storage.read(key: _key);
    if (value == null) return null;
    try {
      final json = jsonDecode(value) as Map<String, dynamic>;
      final token = json['token'] as String;
      final session = AuthSession(
        token,
        DateTime.parse(json['expiresAt'] as String),
      );
      if (!RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token) || session.expired) {
        await clear();
        return null;
      }
      return session;
    } on FormatException {
      await clear();
      return null;
    } on TypeError {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(AuthSession session) => _storage.write(
    key: _key,
    value: jsonEncode({
      'token': session.token,
      'expiresAt': session.expiresAt.toUtc().toIso8601String(),
    }),
  );
  @override
  Future<void> clear() => _storage.delete(key: _key);
}
