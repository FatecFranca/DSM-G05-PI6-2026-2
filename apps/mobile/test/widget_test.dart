import 'package:estoque_inteligente/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('mostra o resumo e navega para produtos', (tester) async {
    await tester.pumpWidget(const EstoqueInteligenteApp());

    expect(find.text('Olá, Grupo 05'), findsOneWidget);
    expect(find.text('18 itens'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.inventory_2_outlined).last);
    await tester.pumpAndSettle();

    expect(find.text('Catálogo de produtos'), findsOneWidget);
  });

  testWidgets('usa navegação lateral no desktop', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(const EstoqueInteligenteApp());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('Estoque Inteligente'), findsOneWidget);
  });
}
