import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:estoque_inteligente/application/theme_controller.dart';
import 'package:estoque_inteligente/core/theme/app_theme.dart';
import 'package:estoque_inteligente/presentation/home/home_shell.dart';
import 'widget_test.dart' show FakeInventoryRepository;
import 'theme_controller_test.dart' show MemoryThemeStore;

Future<void> capture(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('CAPTURE_UX')) return;
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const ValueKey('ux-capture')),
  );
  await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 1);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await Directory('build/ux-previews').create(recursive: true);
    await File(
      'build/ux-previews/$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    if (!const bool.fromEnvironment('CAPTURE_UX')) return;
    const directory = String.fromEnvironment('PREVIEW_FONT_DIR');
    if (directory.isEmpty) {
      throw StateError(
        'Defina PREVIEW_FONT_DIR com o diretório material_fonts do SDK Flutter.',
      );
    }
    for (final entry in {
      'Roboto': 'roboto-regular.ttf',
      'MaterialIcons': 'materialicons-regular.otf',
    }.entries) {
      final loader = FontLoader(entry.key)
        ..addFont(
          File(
            '$directory/${entry.value}',
          ).readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
        );
      await loader.load();
    }
  });
  for (final mode in [ThemeMode.light, ThemeMode.dark]) {
    for (final width in [320.0, 390.0, 1200.0]) {
      testWidgets('layout $width ${mode.name}, navegação e qualidade', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });
        final controller = ThemeController(MemoryThemeStore());
        await controller.select(mode);
        addTearDown(controller.dispose);
        await tester.pumpWidget(
          ThemeScope(
            controller: controller,
            child: ListenableBuilder(
              listenable: controller,
              builder: (context, _) => MaterialApp(
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    textScaler: TextScaler.linear(width == 320 ? 1.3 : 1),
                    disableAnimations: width == 320,
                  ),
                  child: RepaintBoundary(
                    key: const ValueKey('ux-capture'),
                    child: child!,
                  ),
                ),
                theme: AppTheme.light(),
                darkTheme: AppTheme.dark(),
                themeMode: controller.mode,
                home: HomeShell(
                  repository: FakeInventoryRepository(
                    simulated: mode == ThemeMode.dark,
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await capture(tester, 'inicio-${width.toInt()}-${mode.name}');
        // O ListView constrói itens sob demanda. Não usar .first/.last no
        // alvo: a busca precisa aceitar zero resultados antes da rolagem.
        // Ancorar no valor evita confundir o KPI com o aviso de demonstração.
        final stockValue = find.textContaining(
          RegExp(mode == ThemeMode.dark ? r'^R\$\s' : r'^£\s'),
        );
        await tester.scrollUntilVisible(
          stockValue,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        expect(stockValue, findsOneWidget);
        expect(stockValue.hitTestable(), findsOneWidget);
        expect(tester.takeException(), isNull);
        expect(find.text('Nível de serviço'), findsNothing);
        await capture(tester, 'dashboard-${width.toInt()}-${mode.name}');
        await tester.tap(find.text('Dados').last);
        await tester.pumpAndSettle();
        expect(find.text('Conheça seus dados.'), findsOneWidget);
        expect(
          find.text(
            mode == ThemeMode.dark
                ? 'Demonstração brasileira — dados simulados'
                : 'UCI Online Retail II',
          ),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        await capture(tester, 'dados-${width.toInt()}-${mode.name}');
        await tester.tap(find.byTooltip('Tema da interface'));
        await tester.pumpAndSettle();
        await tester.tap(
          find.byWidgetPredicate(
            (widget) =>
                widget is CheckedPopupMenuItem<ThemeMode> &&
                widget.value ==
                    (mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          controller.mode,
          mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark,
        );
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Produtos').last);
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('Café Torrado 500 g'),
          180,
          scrollable: find.byType(Scrollable).first,
        );
        await capture(tester, 'produtos-${width.toInt()}-${mode.name}');
        await tester.tap(find.text('Café Torrado 500 g'));
        await tester.pumpAndSettle();
        expect(find.text('SKU'), findsOneWidget);
        await capture(tester, 'detalhes-${width.toInt()}-${mode.name}');
        await tester.scrollUntilVisible(
          find.text('Fechar detalhes'),
          200,
          scrollable: find
              .descendant(
                of: find.byType(BottomSheet),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.tap(find.text('Fechar detalhes'));
        await tester.pumpAndSettle();
        expect(find.byType(BottomSheet), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
}
