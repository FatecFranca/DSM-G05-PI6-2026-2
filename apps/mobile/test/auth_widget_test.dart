import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:estoque_inteligente/app.dart';
import 'package:estoque_inteligente/application/auth_controller.dart';
import 'package:estoque_inteligente/data/inventory_api_client.dart';
import 'package:estoque_inteligente/presentation/auth/auth_screen.dart';
import 'auth_controller_test.dart' as fixtures;
import 'widget_test.dart' show FakeInventoryRepository;

void main() {
  testWidgets(
    'login é obrigatório antes de abrir estoque; logout remove telas privadas',
    (tester) async {
      final api = InventoryApiClient(
        baseUri: Uri.parse('http://localhost:3333'),
        httpClient: MockClient((r) async {
          if (r.url.path.endsWith('/login')) return fixtures.loginResponse();
          return fixtures.jsonResponse({
            'registrationEnabled': true,
            'message': 'OK',
          });
        }),
      );
      final auth = AuthController(api, fixtures.MemorySessionStore());
      addTearDown(() {
        auth.dispose();
        api.close();
      });
      await tester.pumpWidget(
        EstoqueInteligenteApp(
          repository: FakeInventoryRepository(),
          authController: auth,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Entrar na conta'), findsOneWidget);
      expect(find.text('Decisões de estoque, mais claras.'), findsNothing);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'E-mail'),
        'pessoa@example.test',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Senha'),
        'minha frase de senha segura',
      );
      await tester.ensureVisible(find.text('Entrar na conta'));
      await tester.tap(find.text('Entrar na conta'));
      await tester.pumpAndSettle();
      expect(find.text('Decisões de estoque, mais claras.'), findsOneWidget);
      await tester.tap(find.text('Conta').last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Sair da conta'));
      await tester.tap(find.text('Sair da conta'));
      await tester.pumpAndSettle();
      expect(find.text('Entrar na conta'), findsOneWidget);
      expect(find.text('Decisões de estoque, mais claras.'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('cadastro valida confirmação e troca de tela sem erro de chave', (
    tester,
  ) async {
    final api = InventoryApiClient(
      baseUri: Uri.parse('http://localhost:3333'),
      httpClient: MockClient((_) async => fixtures.jsonResponse({})),
    );
    final auth = AuthController(api, fixtures.MemorySessionStore())
      ..registrationEnabled = true;
    addTearDown(() {
      auth.dispose();
      api.close();
    });
    await tester.pumpWidget(MaterialApp(home: AuthScreen(controller: auth)));
    await tester.ensureVisible(find.text('Criar conta'));
    await tester.tap(find.text('Criar conta'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Seu nome'),
      'Pessoa',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-mail'),
      'pessoa@example.test',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nova senha'),
      'minha frase de senha segura',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Confirmar senha'),
      'outra frase de senha segura',
    );
    await tester.ensureVisible(find.text('Criar minha conta'));
    await tester.tap(find.text('Criar minha conta'));
    await tester.pumpAndSettle();
    expect(find.text('As senhas precisam ser iguais.'), findsOneWidget);
  });

  testWidgets('requisição lenta desabilita envio e exibe feedback', (
    tester,
  ) async {
    final pending = Completer<http.Response>();
    final api = InventoryApiClient(
      baseUri: Uri.parse('http://localhost:3333'),
      httpClient: MockClient((_) => pending.future),
    );
    final auth = AuthController(api, fixtures.MemorySessionStore());
    addTearDown(() {
      auth.dispose();
      api.close();
    });
    await tester.pumpWidget(
      MaterialApp(
        home: AuthScreen(controller: auth, initialMode: AuthMode.forgot),
      ),
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-mail'),
      'pessoa@example.test',
    );
    await tester.tap(find.text('Enviar link de recuperação'));
    await tester.pump();
    expect(find.text('Aguarde…'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    pending.complete(fixtures.jsonResponse({'message': 'Confira seu e-mail.'}));
    await tester.pumpAndSettle();
    expect(find.text('Confira seu e-mail.'), findsOneWidget);
  });
}
