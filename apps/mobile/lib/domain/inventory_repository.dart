import 'models.dart';

abstract interface class InventoryRepository {
  Future<DashboardSummary> getDashboardSummary();

  Future<ForecastResult> getForecast({required int horizon});
  Future<DatasetInfo> getCurrentDataset();

  Future<List<ProductSummary>> getProducts({String? search, StockRisk? risk});

  void close();
}
