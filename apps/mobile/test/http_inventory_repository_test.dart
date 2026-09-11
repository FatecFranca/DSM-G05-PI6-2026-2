import 'package:estoque_inteligente/data/http_inventory_repository.dart';
import 'package:estoque_inteligente/data/inventory_api_client.dart';
import 'package:estoque_inteligente/domain/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('converte o contrato do dashboard em objetos de domínio', () async {
    final httpClient = MockClient((request) async {
      expect(request.url.path, '/api/v1/dashboard/summary');
      return http.Response(
        _summaryJson,
        200,
        headers: {'content-type': 'application/json'},
      );
    });
    final repository = HttpInventoryRepository(
      InventoryApiClient(
        baseUri: Uri.parse('http://localhost:3333'),
        httpClient: httpClient,
      ),
    );

    final summary = await repository.getDashboardSummary();

    expect(summary.kpis.stockValue, 184000);
    expect(summary.kpis.stockoutRisk, 1);
    expect(summary.riskProducts.single.risk, StockRisk.critical);
    expect(summary.demandSeries.single.actual, 22);
    repository.close();
  });

  test('envia horizonte como parâmetro da previsão', () async {
    final httpClient = MockClient((request) async {
      expect(request.url.queryParameters['horizon'], '30');
      return http.Response(
        '{"horizon":30,"model":"baseline-v1","generatedAt":null,"data":[]}',
        200,
      );
    });
    final repository = HttpInventoryRepository(
      InventoryApiClient(
        baseUri: Uri.parse('http://localhost:3333'),
        httpClient: httpClient,
      ),
    );

    final forecast = await repository.getForecast(horizon: 30);

    expect(forecast.horizon, 30);
    expect(forecast.model, 'baseline-v1');
    repository.close();
  });
}

const _summaryJson = '''
{
  "meta": {"source":"postgresql","lastSyncAt":"2026-09-10T12:00:00.000Z"},
  "kpis": {"stockValue":184000,"activeProducts":3,"stockoutRisk":1,"serviceLevel":96.4},
  "demandSeries": [
    {"label":"08 set","date":"2026-09-08","actual":22,"forecast":null,"lower":null,"upper":null}
  ],
  "classifications": [
    {"name":"Classe A","products":2,"percent":67,"revenue":80,"color":"#0c7767"}
  ],
  "riskProducts": [
    {
      "id":"1","sku":"CAF-500-TD","name":"Café Torrado 500 g",
      "category":"Alimentos","stock":12,"forecast":52,"coverage":2,
      "classification":"AX","risk":"critical","severity":"Crítico"
    }
  ]
}
''';
