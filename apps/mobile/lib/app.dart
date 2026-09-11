import 'package:flutter/material.dart';

import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'data/http_inventory_repository.dart';
import 'data/inventory_api_client.dart';
import 'domain/inventory_repository.dart';
import 'presentation/home/home_shell.dart';

class EstoqueInteligenteApp extends StatefulWidget {
  const EstoqueInteligenteApp({super.key, this.repository});

  final InventoryRepository? repository;

  @override
  State<EstoqueInteligenteApp> createState() => _EstoqueInteligenteAppState();
}

class _EstoqueInteligenteAppState extends State<EstoqueInteligenteApp> {
  late final InventoryRepository _repository;
  late final bool _ownsRepository;

  @override
  void initState() {
    super.initState();
    _ownsRepository = widget.repository == null;
    _repository =
        widget.repository ??
        HttpInventoryRepository(
          InventoryApiClient(baseUri: AppConfig.apiBaseUri),
        );
  }

  @override
  void dispose() {
    if (_ownsRepository) {
      _repository.close();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Estoque Inteligente',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: HomeShell(repository: _repository),
    );
  }
}
