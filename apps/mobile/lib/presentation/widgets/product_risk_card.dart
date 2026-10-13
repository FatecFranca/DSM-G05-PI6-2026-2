import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../domain/models.dart';

class ProductRiskCard extends StatelessWidget {
  const ProductRiskCard({super.key, required this.product, this.dense = false});

  final ProductSummary product;
  final bool dense;

  void _showDetails(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      sheetAnimationStyle: MediaQuery.disableAnimationsOf(context)
          ? AnimationStyle.noAnimation
          : null,
      builder: (context) => FractionallySizedBox(
        heightFactor: .75,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          children: [
            Text(
              product.name,
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            for (final entry in {
              'SKU': product.sku,
              'Categoria': product.category,
              'Classe': product.classification,
              'Estoque': '${product.stock} unidades',
              'Previsão histórica de 30 dias': '${product.forecast} unidades',
              'Cobertura': product.coverage == 999
                  ? 'Sem referência de demanda recente'
                  : '${product.coverage} dias',
              'Situação': product.severity,
            }.entries)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.key),
                subtitle: SelectableText(entry.value),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Fechar detalhes'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = switch (product.risk) {
      StockRisk.critical => Theme.of(context).colorScheme.error,
      StockRisk.attention => AppColors.warning,
      StockRisk.healthy => Theme.of(context).colorScheme.primary,
    };

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showDetails(context),
        child: Padding(
          padding: EdgeInsets.all(dense ? 13 : 16),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.inventory_2_outlined, color: color, size: 21),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    SizedBox(height: 3),
                    Text(
                      '${product.sku} · ${product.category}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                      ),
                    ),
                    if (!dense) ...[
                      SizedBox(height: 8),
                      Text(
                        'Estoque ${product.stock.toStringAsFixed(0)} · '
                        'Previsão ${product.forecast.toStringAsFixed(0)} · '
                        '${product.coverage == 999 ? 'Cobertura sem referência' : 'Cobertura ${product.coverage.toStringAsFixed(0)} dias'}',
                        style: TextStyle(fontSize: 11.5),
                      ),
                    ],
                  ],
                ),
              ),
              SizedBox(width: 8),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  product.severity,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
