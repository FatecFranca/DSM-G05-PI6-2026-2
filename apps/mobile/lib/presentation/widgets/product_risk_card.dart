import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../domain/models.dart';

class ProductRiskCard extends StatelessWidget {
  const ProductRiskCard({super.key, required this.product, this.dense = false});

  final ProductSummary product;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final color = switch (product.risk) {
      StockRisk.critical => AppColors.danger,
      StockRisk.attention => AppColors.warning,
      StockRisk.healthy => AppColors.brand,
    };

    return Card(
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
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${product.sku} · ${product.category}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                  if (!dense) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Estoque ${product.stock.toStringAsFixed(0)} · '
                      'Previsão ${product.forecast.toStringAsFixed(0)} · '
                      'Cobertura ${product.coverage.toStringAsFixed(0)} dias',
                      style: const TextStyle(fontSize: 11.5),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
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
    );
  }
}
