enum StockRisk {
  critical,
  attention,
  healthy;

  factory StockRisk.fromApi(String value) {
    return StockRisk.values.firstWhere(
      (risk) => risk.name == value,
      orElse: () => StockRisk.healthy,
    );
  }
}

class DashboardSummary {
  const DashboardSummary({
    required this.meta,
    required this.kpis,
    required this.demandSeries,
    required this.classifications,
    required this.riskProducts,
  });

  final DashboardMeta meta;
  final DashboardKpis kpis;
  final List<DemandPoint> demandSeries;
  final List<ClassificationSummary> classifications;
  final List<ProductSummary> riskProducts;
}

class DashboardMeta {
  const DashboardMeta({required this.source, required this.lastSyncAt});

  final String source;
  final DateTime? lastSyncAt;
}

class DashboardKpis {
  const DashboardKpis({
    required this.stockValue,
    required this.activeProducts,
    required this.stockoutRisk,
    required this.serviceLevel,
  });

  final double stockValue;
  final int activeProducts;
  final int stockoutRisk;
  final double serviceLevel;
}

class DemandPoint {
  const DemandPoint({
    required this.label,
    required this.date,
    this.actual,
    this.forecast,
    this.lower,
    this.upper,
  });

  final String label;
  final DateTime date;
  final double? actual;
  final double? forecast;
  final double? lower;
  final double? upper;
}

class ClassificationSummary {
  const ClassificationSummary({
    required this.name,
    required this.products,
    required this.percent,
    required this.revenue,
    required this.color,
  });

  final String name;
  final int products;
  final int percent;
  final int revenue;
  final String color;
}

class ProductSummary {
  const ProductSummary({
    required this.id,
    required this.sku,
    required this.name,
    required this.category,
    required this.stock,
    required this.forecast,
    required this.coverage,
    required this.classification,
    required this.risk,
    required this.severity,
  });

  final String id;
  final String sku;
  final String name;
  final String category;
  final double stock;
  final double forecast;
  final double coverage;
  final String classification;
  final StockRisk risk;
  final String severity;
}

class ForecastResult {
  const ForecastResult({
    required this.horizon,
    required this.model,
    required this.generatedAt,
    required this.data,
  });

  final int horizon;
  final String? model;
  final DateTime? generatedAt;
  final List<DemandPoint> data;
}
