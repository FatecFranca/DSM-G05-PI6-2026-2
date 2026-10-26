import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../data/inventory_api_client.dart';

class StockMovementScreen extends StatefulWidget {
  const StockMovementScreen({super.key, required this.api, required this.userRole});

  final InventoryApiClient api;
  final String userRole;

  @override
  State<StockMovementScreen> createState() => _StockMovementScreenState();
}

class _StockMovementScreenState extends State<StockMovementScreen> {
  final _quantity = TextEditingController();
  final _reason = TextEditingController();
  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _warehouses = const [];
  String _type = 'entry';
  String? _productId;
  String? _warehouseId;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  bool get _isAdmin => widget.userRole == 'admin';

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  @override
  void dispose() {
    _quantity.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final json = await widget.api.getJson('/api/v1/inventory/options');
      if (!mounted) return;
      setState(() {
        _products = _list(json['products']);
        _warehouses = _list(json['warehouses']);
        _loading = false;
        _error = null;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() { _loading = false; _error = error.message; });
    }
  }

  List<Map<String, dynamic>> _list(Object? value) => value is List
      ? value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList()
      : <Map<String, dynamic>>[];

  void _readCode(String raw) {
    var code = raw.trim();
    try {
      final decoded = Uri.tryParse(code);
      if (decoded != null && decoded.queryParameters['sku'] != null) {
        code = decoded.queryParameters['sku']!;
      }
    } catch (_) {}
    final normalized = code.toLowerCase();
    Map<String, dynamic>? product;
    for (final item in _products) {
      if (item['id'].toString().toLowerCase() == normalized ||
          item['sku'].toString().toLowerCase() == normalized) {
        product = item;
        break;
      }
    }
    final selectedProduct = product;
    if (selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Produto não encontrado para “$code”.')),
      );
      return;
    }
    setState(() => _productId = selectedProduct['id'].toString());
  }

  Future<void> _scan() async {
    var locked = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ler QR Code do produto'),
        content: SizedBox(
          width: 320,
          height: 320,
          child: MobileScanner(
            onDetect: (capture) {
              if (locked || capture.barcodes.isEmpty) return;
              final value = capture.barcodes.first.rawValue;
              if (value == null || value.isEmpty) return;
              locked = true;
              _readCode(value);
              Navigator.of(dialogContext).pop();
            },
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancelar'))],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_isAdmin || _productId == null || _warehouseId == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.postJson('/api/v1/inventory/movements', {
        'type': _type,
        'productId': _productId,
        'warehouseId': _warehouseId,
        'quantity': _quantity.text.trim().replaceAll(',', '.'),
        'reason': _reason.text.trim(),
      });
      if (!mounted) return;
      _quantity.clear();
      _reason.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_type == 'entry' ? 'Entrada registrada.' : 'Saída registrada.')),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isAdmin) {
      return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Movimentações exigem acesso de administrador.', textAlign: TextAlign.center)));
    }
    if (_loading) return const Center(child: CircularProgressIndicator());
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      children: [
        Text('Movimentar estoque', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text('Leia o QR Code do produto e registre uma entrada ou saída com trilha auditável.', style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 22),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SegmentedButton<String>(
                segments: const [ButtonSegment(value: 'entry', label: Text('Entrada'), icon: Icon(Icons.arrow_downward_rounded)), ButtonSegment(value: 'exit', label: Text('Saída'), icon: Icon(Icons.arrow_upward_rounded))],
                selected: {_type},
                onSelectionChanged: (value) => setState(() => _type = value.first),
              ),
              const SizedBox(height: 18),
              Row(children: [
                Expanded(child: DropdownButtonFormField<String>(initialValue: _productId, decoration: const InputDecoration(labelText: 'Produto', border: OutlineInputBorder()), items: _products.map((item) => DropdownMenuItem(value: item['id'].toString(), child: Text('${item['sku']} · ${item['name']}', overflow: TextOverflow.ellipsis))).toList(), onChanged: (value) => setState(() => _productId = value))),
                const SizedBox(width: 10),
                IconButton.filledTonal(onPressed: _scan, tooltip: 'Ler QR Code', icon: const Icon(Icons.qr_code_scanner_rounded)),
              ]),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(initialValue: _warehouseId, decoration: const InputDecoration(labelText: 'Depósito', border: OutlineInputBorder()), items: _warehouses.map((item) => DropdownMenuItem(value: item['id'].toString(), child: Text(item['name'].toString()))).toList(), onChanged: (value) => setState(() => _warehouseId = value)),
              const SizedBox(height: 14),
              TextField(controller: _quantity, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Quantidade', hintText: '0,0000', border: OutlineInputBorder())),
              const SizedBox(height: 14),
              TextField(controller: _reason, maxLength: 500, decoration: const InputDecoration(labelText: 'Motivo / referência', hintText: 'Ex.: recebimento da NF 1234', border: OutlineInputBorder())),
              if (_error != null) ...[const SizedBox(height: 8), Text(_error!, style: TextStyle(color: Colors.red))],
              const SizedBox(height: 8),
              FilledButton.icon(onPressed: _busy || _productId == null || _warehouseId == null ? null : _submit, icon: _busy ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_rounded), label: Text(_busy ? 'Salvando…' : 'Confirmar ${_type == 'entry' ? 'entrada' : 'saída'}')),
            ]),
          ),
        ),
      ],
    );
  }
}
