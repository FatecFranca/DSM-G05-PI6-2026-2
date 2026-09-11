import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_theme.dart';
import '../../domain/inventory_repository.dart';
import '../../domain/models.dart';
import '../widgets/product_risk_card.dart';
import '../widgets/state_views.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.repository});

  final InventoryRepository repository;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardSummary? _summary;
  ForecastResult? _forecast;
  String? _error;
  var _loading = true;
  var _refreshingForecast = false;
  var _horizon = 7;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final summaryFuture = widget.repository.getDashboardSummary();
      final forecastFuture = widget.repository.getForecast(horizon: _horizon);
      final summary = await summaryFuture;
      final forecast = await forecastFuture;
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _forecast = forecast;
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

  Future<void> _changeHorizon(int horizon) async {
    setState(() {
      _horizon = horizon;
      _refreshingForecast = true;
      _error = null;
    });
    try {
      final forecast = await widget.repository.getForecast(horizon: horizon);
      if (!mounted) return;
      setState(() {
        _forecast = forecast;
        _refreshingForecast = false;
      });
    } on Exception catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _refreshingForecast = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _summary == null) {
      return const LoadingView(label: 'Consultando o estoque...');
    }
    if (_error != null && _summary == null) {
      return ErrorView(message: _error!, onRetry: _loadDashboard);
    }

    final summary = _summary!;
    final series = _forecast?.data.isNotEmpty == true
        ? _forecast!.data
        : summary.demandSeries;

    return RefreshIndicator(
      onRefresh: _loadDashboard,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final pagePadding = constraints.maxWidth >= 900 ? 30.0 : 16.0;
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(pagePadding, 24, pagePadding, 32),
            children: [
              _DashboardIntro(
                lastSyncAt: summary.meta.lastSyncAt,
                horizon: _horizon,
                refreshing: _refreshingForecast,
                onHorizonChanged: _changeHorizon,
                onRefresh: _loadDashboard,
              ),
              if (_error != null) ...[
                const SizedBox(height: 14),
                MaterialBanner(
                  content: Text(_error!),
                  leading: const Icon(Icons.warning_amber_rounded),
                  actions: [
                    TextButton(
                      onPressed: _loadDashboard,
                      child: const Text('Tentar novamente'),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              _MetricsGrid(kpis: summary.kpis),
              const SizedBox(height: 14),
              _AnalyticsSection(
                series: series,
                horizon: _horizon,
                classifications: summary.classifications,
              ),
              const SizedBox(height: 14),
              const _InsightCard(),
              const SizedBox(height: 20),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Produtos que exigem atenção',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    '${summary.riskProducts.length} itens',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (summary.riskProducts.isEmpty)
                const SizedBox(
                  height: 180,
                  child: EmptyView(
                    icon: Icons.verified_rounded,
                    title: 'Nenhum risco encontrado',
                    description:
                        'Os produtos monitorados estão com cobertura saudável.',
                  ),
                )
              else
                ...summary.riskProducts.map(
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

class _DashboardIntro extends StatelessWidget {
  const _DashboardIntro({
    required this.lastSyncAt,
    required this.horizon,
    required this.refreshing,
    required this.onHorizonChanged,
    required this.onRefresh,
  });

  final DateTime? lastSyncAt;
  final int horizon;
  final bool refreshing;
  final ValueChanged<int> onHorizonChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final syncLabel = lastSyncAt == null
        ? 'Sincronização ainda não registrada'
        : 'Atualizado em ${DateFormat('dd/MM · HH:mm').format(lastSyncAt!.toLocal())}';

    return Wrap(
      spacing: 18,
      runSpacing: 18,
      crossAxisAlignment: WrapCrossAlignment.end,
      alignment: WrapAlignment.spaceBetween,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 580),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'VISÃO GERAL',
                style: TextStyle(
                  color: AppColors.brand,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                'Decisões de estoque, mais claras.',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.7,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Dados operacionais e previsões em uma visão única. · $syncLabel',
                style: const TextStyle(color: AppColors.muted, height: 1.4),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            DropdownButton<int>(
              value: horizon,
              borderRadius: BorderRadius.circular(12),
              items: const [
                DropdownMenuItem(value: 7, child: Text('Próximos 7 dias')),
                DropdownMenuItem(value: 30, child: Text('Próximos 30 dias')),
                DropdownMenuItem(value: 90, child: Text('Próximos 90 dias')),
              ],
              onChanged: refreshing
                  ? null
                  : (value) {
                      if (value != null) onHorizonChanged(value);
                    },
            ),
            OutlinedButton.icon(
              onPressed: refreshing ? null : onRefresh,
              icon: refreshing
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh_rounded),
              label: const Text('Atualizar'),
            ),
          ],
        ),
      ],
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.kpis});

  final DashboardKpis kpis;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.compactCurrency(
      locale: 'pt_BR',
      symbol: 'R\$',
      decimalDigits: 1,
    );
    final metrics = [
      _MetricData(
        label: 'Valor em estoque',
        value: currency.format(kpis.stockValue),
        detail: 'posição atual',
        icon: Icons.warehouse_outlined,
        color: AppColors.brand,
      ),
      _MetricData(
        label: 'Produtos ativos',
        value: '${kpis.activeProducts}',
        detail: 'itens monitorados',
        icon: Icons.inventory_2_outlined,
        color: AppColors.blue,
      ),
      _MetricData(
        label: 'Risco de ruptura',
        value: '${kpis.stockoutRisk}',
        detail: 'reposição necessária',
        icon: Icons.warning_amber_rounded,
        color: AppColors.danger,
      ),
      _MetricData(
        label: 'Nível de serviço',
        value: '${kpis.serviceLevel.toStringAsFixed(1)}%',
        detail: 'últimos 30 dias',
        icon: Icons.verified_user_outlined,
        color: AppColors.warning,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1020
            ? 4
            : constraints.maxWidth >= 540
            ? 2
            : 1;
        const gap = 12.0;
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final metric in metrics)
              SizedBox(
                width: width,
                child: _MetricCard(metric: metric),
              ),
          ],
        );
      },
    );
  }
}

class _MetricData {
  const _MetricData({
    required this.label,
    required this.value,
    required this.detail,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final String detail;
  final IconData icon;
  final Color color;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final _MetricData metric;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    metric.label,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ),
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: metric.color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(metric.icon, color: metric.color, size: 20),
                ),
              ],
            ),
            const SizedBox(height: 9),
            Text(
              metric.value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.8,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              metric.detail,
              style: const TextStyle(color: AppColors.muted, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnalyticsSection extends StatelessWidget {
  const _AnalyticsSection({
    required this.series,
    required this.horizon,
    required this.classifications,
  });

  final List<DemandPoint> series;
  final int horizon;
  final List<ClassificationSummary> classifications;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final chart = _DemandChart(series: series, horizon: horizon);
        final classes = _ClassificationCard(data: classifications);
        if (constraints.maxWidth >= 900) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 2, child: chart),
              const SizedBox(width: 14),
              Expanded(child: classes),
            ],
          );
        }
        return Column(children: [chart, const SizedBox(height: 14), classes]);
      },
    );
  }
}

class _DemandChart extends StatelessWidget {
  const _DemandChart({required this.series, required this.horizon});

  final List<DemandPoint> series;
  final int horizon;

  @override
  Widget build(BuildContext context) {
    final values = [
      for (final point in series) ...[
        if (point.actual != null) point.actual!,
        if (point.forecast != null) point.forecast!,
        if (point.upper != null) point.upper!,
      ],
    ];
    final maxY = values.isEmpty
        ? 10.0
        : math.max(10.0, values.reduce(math.max) * 1.2);
    final actual = <FlSpot>[];
    final forecast = <FlSpot>[];
    for (var index = 0; index < series.length; index++) {
      final point = series[index];
      if (point.actual != null) {
        actual.add(FlSpot(index.toDouble(), point.actual!));
      }
      if (point.forecast != null) {
        forecast.add(FlSpot(index.toDouble(), point.forecast!));
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Demanda real × prevista',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                Text(
                  '$horizon dias',
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Row(
              children: [
                _LegendDot(color: AppColors.ink),
                Text('Real', style: TextStyle(fontSize: 11)),
                SizedBox(width: 14),
                _LegendDot(color: AppColors.brand),
                Text('Prevista', style: TextStyle(fontSize: 11)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 245,
              child: series.isEmpty
                  ? const EmptyView(
                      icon: Icons.show_chart_rounded,
                      title: 'Previsão indisponível',
                      description: 'Ainda não existem pontos publicados.',
                    )
                  : LineChart(
                      LineChartData(
                        minX: 0,
                        maxX: math.max(1, series.length - 1).toDouble(),
                        minY: 0,
                        maxY: maxY,
                        gridData: FlGridData(
                          drawVerticalLine: false,
                          getDrawingHorizontalLine: (_) => const FlLine(
                            color: AppColors.line,
                            strokeWidth: 1,
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        titlesData: FlTitlesData(
                          topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          leftTitles: const AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 34,
                            ),
                          ),
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              reservedSize: 28,
                              interval: math
                                  .max(1, (series.length / 5).ceil())
                                  .toDouble(),
                              getTitlesWidget: (value, meta) {
                                final index = value.round();
                                if (index < 0 || index >= series.length) {
                                  return const SizedBox.shrink();
                                }
                                return Padding(
                                  padding: const EdgeInsets.only(top: 7),
                                  child: Text(
                                    series[index].label,
                                    style: const TextStyle(
                                      fontSize: 9,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                        lineBarsData: [
                          if (actual.isNotEmpty)
                            LineChartBarData(
                              spots: actual,
                              isCurved: true,
                              color: AppColors.ink,
                              barWidth: 2.5,
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(show: false),
                            ),
                          if (forecast.isNotEmpty)
                            LineChartBarData(
                              spots: forecast,
                              isCurved: true,
                              color: AppColors.brand,
                              barWidth: 2.5,
                              dashArray: [7, 4],
                              dotData: const FlDotData(show: false),
                              belowBarData: BarAreaData(
                                show: true,
                                color: AppColors.brand.withValues(alpha: 0.08),
                              ),
                            ),
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: 8,
    height: 8,
    margin: const EdgeInsets.only(right: 5),
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

class _ClassificationCard extends StatelessWidget {
  const _ClassificationCard({required this.data});

  final List<ClassificationSummary> data;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Classificação ABC',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            const Text(
              'Participação dos itens monitorados',
              style: TextStyle(color: AppColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 20),
            if (data.isEmpty)
              const SizedBox(
                height: 180,
                child: EmptyView(
                  icon: Icons.donut_large_rounded,
                  title: 'Sem classificação',
                  description:
                      'Execute a análise ABC para preencher esta visão.',
                ),
              )
            else
              for (final item in data) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text('${item.products} · ${item.percent}%'),
                  ],
                ),
                const SizedBox(height: 7),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: item.percent.clamp(0, 100) / 100,
                    minHeight: 8,
                    backgroundColor: AppColors.canvas,
                    color: _hexColor(item.color),
                  ),
                ),
                const SizedBox(height: 18),
              ],
          ],
        ),
      ),
    );
  }
}

class _InsightCard extends StatelessWidget {
  const _InsightCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.brandSoft,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.brand,
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(Icons.trending_up_rounded, color: Colors.white),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'INSIGHT DO DIA',
                    style: TextStyle(
                      color: AppColors.brandDark,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.7,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Priorize os itens críticos pela cobertura calculada com a demanda dos últimos 30 dias.',
                    style: TextStyle(height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Color _hexColor(String hex) {
  final normalized = hex.replaceFirst('#', '');
  final parsed = int.tryParse(normalized, radix: 16);
  return parsed == null ? AppColors.brand : Color(0xFF000000 | parsed);
}
