import 'package:estoque_inteligente/presentation/home/home_shell.dart';
import 'package:estoque_inteligente/domain/inventory_repository.dart';
import 'package:estoque_inteligente/domain/models.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('mostra dados reais do repositório e navega para produtos', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: HomeShell(repository: FakeInventoryRepository())),
    );
    await tester.pumpAndSettle();

    expect(find.text('Decisões de estoque, mais claras.'), findsOneWidget);
    expect(find.text('3'), findsWidgets);

    await tester.tap(find.text('Produtos').last);
    await tester.pumpAndSettle();

    expect(find.text('Catálogo de produtos'), findsOneWidget);
    expect(find.text('3 produtos'), findsOneWidget);
  });

  testWidgets('usa navegação lateral no desktop', (tester) async {
    tester.view.physicalSize = const Size(1200, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(home: HomeShell(repository: FakeInventoryRepository())),
    );
    await tester.pumpAndSettle();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('Estoque Inteligente'), findsOneWidget);
    expect(find.text('PostgreSQL'), findsOneWidget);
  });
}

class FakeInventoryRepository implements InventoryRepository {
  final products = const [
    ProductSummary(
      id: '1',
      sku: 'CAF-500-TD',
      name: 'Café Torrado 500 g',
      category: 'Alimentos',
      stock: 12,
      forecast: 52,
      coverage: 2,
      classification: 'AX',
      risk: StockRisk.critical,
      severity: 'Crítico',
    ),
    ProductSummary(
      id: '2',
      sku: 'LEI-1L-IN',
      name: 'Leite Integral 1 L',
      category: 'Alimentos',
      stock: 28,
      forecast: 60,
      coverage: 4,
      classification: 'AY',
      risk: StockRisk.critical,
      severity: 'Crítico',
    ),
    ProductSummary(
      id: '3',
      sku: 'DET-500-N',
      name: 'Detergente Neutro 500 ml',
      category: 'Limpeza',
      stock: 80,
      forecast: 30,
      coverage: 18,
      classification: 'BZ',
      risk: StockRisk.attention,
      severity: 'Atenção',
    ),
  ];

  @override
  Future<DashboardSummary> getDashboardSummary() async => DashboardSummary(
    meta: DashboardMeta(
      source: 'postgresql',
      lastSyncAt: DateTime(2026, 9, 10),
    ),
    kpis: const DashboardKpis(
      stockValue: 184000,
      activeProducts: 3,
      stockoutRisk: 2,
      serviceLevel: 96.4,
    ),
    demandSeries: _series,
    classifications: const [
      ClassificationSummary(
        name: 'Classe A',
        products: 2,
        percent: 67,
        revenue: 80,
        color: '#0c7767',
      ),
      ClassificationSummary(
        name: 'Classe B',
        products: 1,
        percent: 33,
        revenue: 20,
        color: '#d69e2e',
      ),
    ],
    riskProducts: products,
  );

  @override
  Future<ForecastResult> getForecast({required int horizon}) async =>
      ForecastResult(
        horizon: horizon,
        model: 'baseline-v1',
        generatedAt: DateTime(2026, 9, 10),
        data: _series,
      );

  @override
  Future<List<ProductSummary>> getProducts({
    String? search,
    StockRisk? risk,
  }) async {
    return products.where((product) {
      final matchesRisk = risk == null || product.risk == risk;
      final term = search?.toLowerCase() ?? '';
      final matchesSearch =
          term.isEmpty ||
          product.name.toLowerCase().contains(term) ||
          product.sku.toLowerCase().contains(term);
      return matchesRisk && matchesSearch;
    }).toList();
  }

  @override
  void close() {}
}

final _series = [
  DemandPoint(label: '08 set', date: DateTime(2026, 9, 8), actual: 22),
  DemandPoint(label: '09 set', date: DateTime(2026, 9, 9), actual: 25),
  DemandPoint(label: '10 set', date: DateTime(2026, 9, 10), forecast: 27),
  DemandPoint(label: '11 set', date: DateTime(2026, 9, 11), forecast: 29),
];
