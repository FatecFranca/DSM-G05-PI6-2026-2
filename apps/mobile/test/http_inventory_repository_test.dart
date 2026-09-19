import 'package:estoque_inteligente/data/http_inventory_repository.dart';
import 'package:estoque_inteligente/data/inventory_api_client.dart';
import 'package:estoque_inteligente/domain/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test(
    'consulta e converte a qualidade da base sem inventar contagens',
    () async {
      final repository = HttpInventoryRepository(
        InventoryApiClient(
          baseUri: Uri.parse('http://localhost:3333'),
          httpClient: MockClient((request) async {
            expect(request.url.path, '/api/v1/datasets/current');
            return http.Response(
              '{"license":"CC BY 4.0","version":"v1","fileSha256":"abc","recordsRead":100,"recordsAccepted":90,"recordsRejected":10,"periodStartedOn":"2009-12-01","periodEndedOn":"2011-12-09","qualitySummary":{"duplicate":10}}',
              200,
            );
          }),
        ),
      );
      addTearDown(repository.close);
      final data = await repository.getCurrentDataset();
      expect(data.recordsAccepted, 90);
      expect(data.quality['duplicate'], 10);
      expect(data.quality.containsKey('malformed'), isFalse);
      expect(data.license, 'CC BY 4.0');
      expect(data.endedOn, DateTime(2011, 12, 9));
    },
  );

  test('base ausente propaga mensagem da API para o estado de erro', () async {
    final repository = HttpInventoryRepository(
      InventoryApiClient(
        baseUri: Uri.parse('http://localhost:3333'),
        httpClient: MockClient(
          (_) async =>
              http.Response('{"message":"Nenhuma base foi carregada."}', 404),
        ),
      ),
    );
    addTearDown(repository.close);
    await expectLater(
      repository.getCurrentDataset(),
      throwsA(
        isA<ApiException>().having((error) => error.statusCode, 'status', 404),
      ),
    );
  });
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
    expect(summary.kpis.stockValueCurrency, 'GBP');
    expect(summary.meta.datasetPeriodEnd, DateTime(2011, 12, 9));
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
  "meta": {"source":"postgresql","lastSyncAt":"2026-09-10T12:00:00.000Z","datasetPeriodEnd":"2011-12-09"},
  "kpis": {"stockValue":184000,"stockValueCurrency":"GBP","activeProducts":3,"stockoutRisk":1,"serviceLevel":96.4},
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
