import 'package:flutter/material.dart';

import '../../domain/inventory_repository.dart';
import '../../domain/models.dart';
import '../widgets/product_risk_card.dart';
import '../widgets/state_views.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key, required this.repository});

  final InventoryRepository repository;

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  final _searchController = TextEditingController();
  List<ProductSummary> _products = [];
  StockRisk? _risk;
  String? _error;
  var _loading = true;
  var _requestId = 0;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final products = await widget.repository.getProducts(
        search: _searchController.text.trim(),
        risk: _risk,
      );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _products = products;
        _loading = false;
      });
    } on Exception catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  void _clearFilters() {
    _searchController.clear();
    setState(() => _risk = null);
    _loadProducts();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _products.isEmpty) {
      return LoadingView(label: 'Carregando produtos...');
    }
    if (_error != null && _products.isEmpty) {
      return ErrorView(message: _error!, onRetry: _loadProducts);
    }

    return RefreshIndicator(
      onRefresh: _loadProducts,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final padding = constraints.maxWidth >= 900 ? 30.0 : 16.0;
          final cardWidth = constraints.maxWidth >= 1180
              ? (constraints.maxWidth - padding * 2 - 24) / 3
              : constraints.maxWidth >= 700
              ? (constraints.maxWidth - padding * 2 - 12) / 2
              : constraints.maxWidth - padding * 2;
          return ListView(
            physics: AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(padding, 24, padding, 32),
            children: [
              Text(
                'Catálogo de produtos',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.6,
                ),
              ),
              SizedBox(height: 5),
              Text(
                'Consulte estoque, cobertura, classificação e risco.',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: mathMin(360, constraints.maxWidth - padding * 2),
                    child: TextField(
                      controller: _searchController,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _loadProducts(),
                      decoration: InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Buscar produto ou SKU',
                      ),
                    ),
                  ),
                  InputDecorator(
                    decoration: InputDecoration(
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 13,
                        vertical: 2,
                      ),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<StockRisk?>(
                        isExpanded: true,
                        value: _risk,
                        hint: Text('Todos os riscos'),
                        items: [
                          DropdownMenuItem(
                            value: null,
                            child: Text('Todos os riscos'),
                          ),
                          DropdownMenuItem(
                            value: StockRisk.critical,
                            child: Text('Crítico'),
                          ),
                          DropdownMenuItem(
                            value: StockRisk.attention,
                            child: Text('Atenção'),
                          ),
                          DropdownMenuItem(
                            value: StockRisk.healthy,
                            child: Text('Saudável'),
                          ),
                        ],
                        onChanged: (value) {
                          setState(() => _risk = value);
                          _loadProducts();
                        },
                      ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _loading ? null : _loadProducts,
                    icon: Icon(Icons.search_rounded),
                    label: Text('Filtrar'),
                  ),
                  TextButton(onPressed: _clearFilters, child: Text('Limpar')),
                ],
              ),
              if (_loading) ...[
                SizedBox(height: 14),
                LinearProgressIndicator(minHeight: 2),
              ],
              if (_error != null) ...[
                SizedBox(height: 14),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: 16,
                runSpacing: 8,
                children: [
                  Text(
                    'Resultados',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    '${_products.length} produtos',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              SizedBox(height: 10),
              if (_products.isEmpty)
                SizedBox(
                  height: 260,
                  child: EmptyView(
                    icon: Icons.search_off_rounded,
                    title: 'Nenhum produto encontrado',
                    description: 'Revise o termo ou os filtros selecionados.',
                  ),
                )
              else
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (final product in _products)
                      SizedBox(
                        width: cardWidth,
                        child: ProductRiskCard(product: product),
                      ),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

double mathMin(num a, num b) => a < b ? a.toDouble() : b.toDouble();
