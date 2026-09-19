import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../domain/inventory_repository.dart';
import '../../domain/models.dart';
import '../widgets/state_views.dart';

class DataQualityScreen extends StatefulWidget {
  const DataQualityScreen({super.key, required this.repository});
  final InventoryRepository repository;
  @override
  State<DataQualityScreen> createState() => _DataQualityScreenState();
}

class _DataQualityScreenState extends State<DataQualityScreen> {
  DatasetInfo? _data;
  String? _error;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.repository.getCurrentDataset();
      if (mounted) setState(() => _data = data);
    } on Exception catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _date(DateTime? value) => value == null
      ? 'Não informado'
      : DateFormat('dd/MM/yyyy').format(value.toUtc());
  @override
  Widget build(BuildContext context) {
    if (_data == null) {
      return _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : const LoadingView(label: 'Consultando a qualidade dos dados…');
    }
    final data = _data!;
    final colors = Theme.of(context).colorScheme;
    final number = NumberFormat.decimalPattern('pt_BR');
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          Text(
            'TRANSPARÊNCIA E CONFIANÇA',
            style: TextStyle(
              color: colors.primary,
              fontSize: 11,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Conheça seus dados.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            'Origem, cobertura e critérios de preparação.',
            style: TextStyle(color: colors.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: TextStyle(color: colors.error)),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh),
              label: Text(_loading ? 'Atualizando…' : 'Atualizar'),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.dataset_outlined, color: colors.primary, size: 32),
                  const SizedBox(height: 14),
                  const Text(
                    'UCI Online Retail II',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${data.license} · ${_date(data.startedOn)} a ${_date(data.endedOn)}',
                  ),
                  const SizedBox(height: 20),
                  for (final entry in {
                    'Registros lidos': data.recordsRead,
                    'Vendas aceitas': data.recordsAccepted,
                    'Fora da demanda válida': data.recordsRejected,
                  }.entries)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Wrap(
                        spacing: 18,
                        runSpacing: 4,
                        children: [
                          Text(entry.key),
                          Text(
                            number.format(entry.value),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            color: colors.secondaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Text(
                'BASE HISTÓRICA\n\nSaldos, custos e prazos de reposição são simulados. Valores da fonte em GBP, sem conversão para reais. Dias sem venda não comprovam ausência de demanda. Customer ID não é armazenado.',
                style: TextStyle(
                  color: colors.onSecondaryContainer,
                  height: 1.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Qualidade da carga',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ocorrências podem se sobrepor; não some estas contagens.',
                  ),
                  const SizedBox(height: 12),
                  for (final entry in const {
                    'duplicate': 'Linhas duplicadas',
                    'cancellation': 'Cancelamentos',
                    'missing_description': 'Descrição ausente',
                    'nonpositive_price': 'Preço não positivo',
                    'nonpositive_quantity': 'Quantidade não positiva',
                    'non_product_code': 'Códigos não comerciais',
                    'malformed': 'Registros malformados',
                    'missing_customer': 'Cliente não identificado',
                  }.entries)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(entry.value),
                      trailing: Text(
                        data.quality.containsKey(entry.key)
                            ? number.format(data.quality[entry.key])
                            : '—',
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: ExpansionTile(
              title: const Text('Rastreabilidade da carga'),
              subtitle: Text(data.version),
              childrenPadding: const EdgeInsets.all(20),
              children: [
                const Text('SHA-256 do arquivo'),
                const SizedBox(height: 8),
                SelectableText(data.fingerprint),
                const SizedBox(height: 16),
                const Text(
                  'Chen, D. (2012). Online Retail II. UCI Machine Learning Repository.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
