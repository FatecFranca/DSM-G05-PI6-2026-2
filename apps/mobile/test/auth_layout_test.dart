import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:estoque_inteligente/application/auth_controller.dart';
import 'package:estoque_inteligente/core/theme/app_theme.dart';
import 'package:estoque_inteligente/data/inventory_api_client.dart';
import 'package:estoque_inteligente/presentation/auth/auth_screen.dart';
import 'auth_controller_test.dart' as fixtures;

void main() {
  for (final mode in [AuthMode.login, AuthMode.register, AuthMode.reset]) {
    testWidgets('layout ${mode.name} em celular com texto ampliado', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 844);
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
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
      final key = GlobalKey();
      await tester.pumpWidget(
        RepaintBoundary(
          key: key,
          child: MaterialApp(
            theme: AppTheme.light(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: const TextScaler.linear(1.25),
                disableAnimations: true,
              ),
              child: child!,
            ),
            home: AuthScreen(controller: auth, initialMode: mode),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      if (const bool.fromEnvironment('CAPTURE_AUTH')) {
        final boundary =
            key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await boundary.toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final file = File('../../.local/mobile-auth-${mode.name}.png');
          await file.parent.create(recursive: true);
          await file.writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
}
