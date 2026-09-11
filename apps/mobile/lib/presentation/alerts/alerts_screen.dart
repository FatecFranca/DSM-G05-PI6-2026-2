import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../domain/inventory_repository.dart';
import '../../domain/models.dart';
import '../widgets/product_risk_card.dart';
import '../widgets/state_views.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key, required this.repository});

  final InventoryRepository repository;

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<ProductSummary> _products = const [];
  String? _error;
  var _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final products = await widget.repository.getProducts();
      if (!mounted) return;
      setState(() {
        _products =
            products
                .where((product) => product.risk != StockRisk.healthy)
                .toList()
              ..sort((a, b) => a.risk.index.compareTo(b.risk.index));
        _loading = false;
      });
    } on Exception catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _products.isEmpty) {
      return const LoadingView(label: 'Consultando alertas...');
    }
    if (_error != null && _products.isEmpty) {
      return ErrorView(message: _error!, onRetry: _loadAlerts);
    }

    final critical = _products
        .where((product) => product.risk == StockRisk.critical)
        .length;
    final attention = _products
        .where((product) => product.risk == StockRisk.attention)
        .length;

    return RefreshIndicator(
      onRefresh: _loadAlerts,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final padding = constraints.maxWidth >= 900 ? 30.0 : 16.0;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(padding, 24, padding, 32),
            children: [
              Text(
                'Central de alertas',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.6,
                ),
              ),
              const SizedBox(height: 5),
              const Text(
                'Riscos de ruptura ordenados por prioridade operacional.',
                style: TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _AlertSummary(
                    label: 'Críticos',
                    value: critical,
                    icon: Icons.error_outline_rounded,
                    color: AppColors.danger,
                  ),
                  _AlertSummary(
                    label: 'Em atenção',
                    value: attention,
                    icon: Icons.warning_amber_rounded,
                    color: AppColors.warning,
                  ),
                ],
              ),
              if (_loading) ...[
                const SizedBox(height: 14),
                const LinearProgressIndicator(minHeight: 2),
              ],
              const SizedBox(height: 20),
              if (_products.isEmpty)
                const SizedBox(
                  height: 280,
                  child: EmptyView(
                    icon: Icons.notifications_none_rounded,
                    title: 'Tudo sob controle',
                    description: 'Nenhum alerta operacional está ativo agora.',
                  ),
                )
              else
                ..._products.map(
                  (product) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: ProductRiskCard(product: product),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _AlertSummary extends StatelessWidget {
  const _AlertSummary({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$value',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
