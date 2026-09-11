import '../domain/inventory_repository.dart';
import '../domain/models.dart';
import 'inventory_api_client.dart';

class HttpInventoryRepository implements InventoryRepository {
  const HttpInventoryRepository(this._client);

  final InventoryApiClient _client;

  @override
  Future<DashboardSummary> getDashboardSummary() async {
    final json = await _client.getJson('/api/v1/dashboard/summary');
    final meta = _map(json['meta']);
    final kpis = _map(json['kpis']);

    return DashboardSummary(
      meta: DashboardMeta(
        source: _string(meta['source'], fallback: 'postgresql'),
        lastSyncAt: _dateTime(meta['lastSyncAt']),
      ),
      kpis: DashboardKpis(
        stockValue: _double(kpis['stockValue']),
        activeProducts: _int(kpis['activeProducts']),
        stockoutRisk: _int(kpis['stockoutRisk']),
        serviceLevel: _double(kpis['serviceLevel']),
      ),
      demandSeries: _list(json['demandSeries']).map(_demandPoint).toList(),
      classifications: _list(
        json['classifications'],
      ).map(_classification).toList(),
      riskProducts: _list(json['riskProducts']).map(_product).toList(),
    );
  }

  @override
  Future<ForecastResult> getForecast({required int horizon}) async {
    final json = await _client.getJson(
      '/api/v1/forecasts',
      query: {'horizon': '$horizon'},
    );
    return ForecastResult(
      horizon: _int(json['horizon']),
      model: json['model'] as String?,
      generatedAt: _dateTime(json['generatedAt']),
      data: _list(json['data']).map(_demandPoint).toList(),
    );
  }

  @override
  Future<List<ProductSummary>> getProducts({
    String? search,
    StockRisk? risk,
  }) async {
    final json = await _client.getJson(
      '/api/v1/products',
      query: {'search': search, 'risk': risk?.name},
    );
    return _list(json['data']).map(_product).toList();
  }

  @override
  void close() => _client.close();
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  throw const ApiException('A API retornou campos obrigatórios inválidos.');
}

List<Map<String, dynamic>> _list(Object? value) {
  if (value is! List) {
    throw const ApiException('A API retornou uma lista inválida.');
  }
  return value.map(_map).toList();
}

String _string(Object? value, {String fallback = ''}) =>
    value is String ? value : fallback;

double _double(Object? value) => switch (value) {
  num number => number.toDouble(),
  String text => double.tryParse(text) ?? 0,
  _ => 0,
};

int _int(Object? value) => switch (value) {
  int number => number,
  num number => number.toInt(),
  String text => int.tryParse(text) ?? 0,
  _ => 0,
};

DateTime? _dateTime(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

DemandPoint _demandPoint(Map<String, dynamic> json) => DemandPoint(
  label: _string(json['label']),
  date: _dateTime(json['date']) ?? DateTime.fromMillisecondsSinceEpoch(0),
  actual: json['actual'] == null ? null : _double(json['actual']),
  forecast: json['forecast'] == null ? null : _double(json['forecast']),
  lower: json['lower'] == null ? null : _double(json['lower']),
  upper: json['upper'] == null ? null : _double(json['upper']),
);

ClassificationSummary _classification(Map<String, dynamic> json) =>
    ClassificationSummary(
      name: _string(json['name']),
      products: _int(json['products']),
      percent: _int(json['percent']),
      revenue: _int(json['revenue']),
      color: _string(json['color'], fallback: '#0C7767'),
    );

ProductSummary _product(Map<String, dynamic> json) => ProductSummary(
  id: _string(json['id']),
  sku: _string(json['sku']),
  name: _string(json['name']),
  category: _string(json['category']),
  stock: _double(json['stock']),
  forecast: _double(json['forecast']),
  coverage: _double(json['coverage']),
  classification: _string(json['classification'], fallback: 'N/D'),
  risk: StockRisk.fromApi(_string(json['risk'])),
  severity: _string(json['severity'], fallback: 'Saudável'),
);
