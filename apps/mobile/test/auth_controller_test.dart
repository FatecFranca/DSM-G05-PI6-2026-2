import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:estoque_inteligente/application/auth_controller.dart';
import 'package:estoque_inteligente/data/inventory_api_client.dart';
import 'package:estoque_inteligente/data/secure_session_store.dart';
import 'package:estoque_inteligente/domain/auth_models.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const testUser = {
  'id': 'user-1',
  'name': 'Pessoa Teste',
  'email': 'pessoa@example.test',
  'role': 'viewer',
};
final testToken = 'a' * 43;
final testSession = AuthSession(
  testToken,
  DateTime.now().add(const Duration(days: 1)),
);
http.Response jsonResponse(
  Map<String, dynamic> data, [
  int status = 200,
  Map<String, String>? headers,
]) => http.Response(
  jsonEncode(data),
  status,
  headers: {'content-type': 'application/json', ...?headers},
);
http.Response loginResponse() => jsonResponse(
  {'user': testUser, 'expiresAt': testSession.expiresAt.toIso8601String()},
  200,
  {'set-cookie': 'estoque_session=$testToken; Path=/; HttpOnly; SameSite=Lax'},
);

class MemorySessionStore implements SessionStore {
  AuthSession? value;
  bool failWrite = false;
  bool failClear = false;
  @override
  Future<AuthSession?> read() async => value;
  @override
  Future<void> write(AuthSession session) async {
    if (failWrite) throw StateError('Cofre indisponível');
    value = session;
  }

  @override
  Future<void> clear() async {
    if (failClear) throw StateError('Cofre indisponível');
    value = null;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MemorySessionStore store;
  late InventoryApiClient api;
  late AuthController auth;
  void setup(FutureOr<http.Response> Function(http.Request) handler) {
    store = MemorySessionStore();
    api = InventoryApiClient(
      baseUri: Uri.parse('http://localhost:3333'),
      httpClient: MockClient((request) async => handler(request)),
    );
    auth = AuthController(api, store);
    addTearDown(() {
      auth.dispose();
      api.close();
    });
  }

  test('sem sessão não consulta dados protegidos', () async {
    setup((_) => throw StateError('Não deveria acessar a rede'));
    await auth.restore();
    expect(auth.status, AuthStatus.signedOut);
    expect(auth.user, isNull);
  });
  test(
    'login usa contrato nativo, persiste somente token e envia cookie',
    () async {
      setup((request) {
        expect(request.headers['X-Requested-With'], 'EstoqueInteligente');
        if (request.url.path.endsWith('/login')) {
          expect(jsonDecode(request.body)['remember'], true);
          expect(request.followRedirects, false);
          return loginResponse();
        }
        expect(request.headers['Cookie'], 'estoque_session=$testToken');
        return jsonResponse({'user': testUser});
      });
      await auth.login(
        ' pessoa@example.test ',
        'minha frase de senha segura',
        true,
      );
      expect(store.value?.token, testToken);
      expect(auth.user?.name, 'Pessoa Teste');
      await api.getJson('/api/v1/auth/me');
    },
  );
  test('sem manter conectado a sessão fica somente em memória', () async {
    setup((_) => loginResponse());
    await auth.login(
      'pessoa@example.test',
      'minha frase de senha segura',
      false,
    );
    expect(store.value, isNull);
    expect(api.sessionToken, testToken);
  });
  test('restaura sessão somente após validar com a API', () async {
    setup((_) => jsonResponse({'user': testUser}));
    store.value = testSession;
    await auth.restore();
    expect(auth.status, AuthStatus.signedIn);
  });
  test('401 apaga sessão e protege o painel', () async {
    setup((_) => jsonResponse({'message': 'Sessão expirada'}, 401));
    store.value = testSession;
    await auth.restore();
    await Future<void>.delayed(Duration.zero);
    expect(auth.status, AuthStatus.signedOut);
    expect(store.value, isNull);
    expect(api.sessionToken, isNull);
  });
  test(
    'falha de rede na restauração não apaga o token nem libera painel',
    () async {
      setup((_) => throw http.ClientException('Offline'));
      store.value = testSession;
      await auth.restore();
      expect(auth.status, AuthStatus.unavailable);
      expect(store.value, testSession);
      expect(auth.user, isNull);
    },
  );
  test('sessão vencida localmente é descartada sem chamada HTTP', () async {
    setup((_) => throw StateError('Não deveria consultar'));
    store.value = AuthSession(
      testToken,
      DateTime.now().subtract(const Duration(seconds: 1)),
    );
    await auth.restore();
    expect(auth.status, AuthStatus.signedOut);
    expect(store.value, isNull);
  });
  test('logout revoga via API e limpa cofre e memória', () async {
    setup(
      (request) => request.url.path.endsWith('/login')
          ? loginResponse()
          : jsonResponse({'message': 'OK'}),
    );
    await auth.login(
      'pessoa@example.test',
      'minha frase de senha segura',
      true,
    );
    await auth.logout();
    expect(auth.status, AuthStatus.signedOut);
    expect(auth.user, isNull);
    expect(store.value, isNull);
  });
  test('falha ao salvar no cofre revoga login e não autentica', () async {
    var revoked = false;
    setup((request) {
      if (request.url.path.endsWith('/logout')) {
        revoked = true;
        return jsonResponse({});
      }
      return loginResponse();
    });
    store.failWrite = true;
    await expectLater(
      auth.login('pessoa@example.test', 'minha frase de senha segura', true),
      throwsA(isA<ApiException>()),
    );
    expect(auth.user, isNull);
    expect(api.sessionToken, isNull);
    expect(revoked, true);
  });
  test('falha ao apagar cofre bloqueia o painel', () async {
    setup((_) => jsonResponse({}));
    store.failClear = true;
    await auth.signOutLocally();
    expect(auth.status, AuthStatus.unavailable);
    expect(auth.user, isNull);
  });
  test(
    'redefinição extrai token do link e usa somente o servidor configurado',
    () async {
      setup((request) {
        expect(request.url.host, 'localhost');
        expect(jsonDecode(request.body)['token'], testToken);
        return jsonResponse({'message': 'Senha redefinida.'});
      });
      expect(
        await auth.resetPassword(
          'https://outro-dominio.test/redefinir-senha#token=$testToken',
          'minha frase de senha segura',
        ),
        'Senha redefinida.',
      );
      await expectLater(
        auth.resetPassword('link inválido', 'minha frase de senha segura'),
        throwsA(isA<ApiException>()),
      );
    },
  );
  test('troca de senha encerra sessão após confirmação da API', () async {
    setup(
      (request) => request.url.path.endsWith('/login')
          ? loginResponse()
          : jsonResponse({'message': 'OK'}),
    );
    await auth.login(
      'pessoa@example.test',
      'minha frase de senha segura',
      true,
    );
    await auth.changePassword(
      'minha frase de senha segura',
      'outra frase de senha segura',
    );
    expect(auth.status, AuthStatus.signedOut);
    expect(store.value, isNull);
  });
  test(
    '401 atrasado de uma sessão anterior não encerra a sessão atual',
    () async {
      final pending = Completer<http.Response>();
      setup((_) => pending.future);
      api.sessionToken = testToken;
      final request = api.getJson('/api/v1/products');
      final expectation = expectLater(request, throwsA(isA<ApiException>()));
      await Future<void>.delayed(Duration.zero);
      api.sessionToken = 'b' * 43;
      pending.complete(jsonResponse({'message': 'Expirada'}, 401));
      await expectation;
      expect(api.sessionToken, 'b' * 43);
    },
  );
  test(
    'cofre separa sessões por servidor e descarta conteúdo inválido',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final first = SecureSessionStore(Uri.parse('https://api.example.test'));
      final second = SecureSessionStore(
        Uri.parse('https://other.example.test'),
      );
      await first.write(testSession);
      expect((await first.read())?.token, testToken);
      expect(await second.read(), isNull);
      await first.write(AuthSession('token-invalido', testSession.expiresAt));
      expect(await first.read(), isNull);
    },
  );
}
