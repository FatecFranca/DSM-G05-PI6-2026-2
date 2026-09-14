import 'package:flutter/material.dart';
import 'dart:async';
import 'application/auth_controller.dart';
import 'data/secure_session_store.dart';
import 'presentation/auth/auth_screen.dart';

import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'data/http_inventory_repository.dart';
import 'data/inventory_api_client.dart';
import 'domain/inventory_repository.dart';
import 'presentation/home/home_shell.dart';

class EstoqueInteligenteApp extends StatefulWidget {
  const EstoqueInteligenteApp({
    super.key,
    this.repository,
    this.authController,
  });

  final InventoryRepository? repository;
  final AuthController? authController;

  @override
  State<EstoqueInteligenteApp> createState() => _EstoqueInteligenteAppState();
}

class _EstoqueInteligenteAppState extends State<EstoqueInteligenteApp>
    with WidgetsBindingObserver {
  late final InventoryRepository _repository;
  late final InventoryApiClient _api;
  late final AuthController _auth;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _api =
        widget.authController?.api ??
        InventoryApiClient(baseUri: AppConfig.apiBaseUri);
    _auth =
        widget.authController ??
        AuthController(_api, SecureSessionStore(AppConfig.apiBaseUri));
    _repository = widget.repository ?? HttpInventoryRepository(_api);
    unawaited(_auth.restore());
    unawaited(_auth.loadConfiguration());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _auth.status == AuthStatus.signedIn) {
      unawaited(_auth.restore());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (widget.authController == null) {
      _auth.dispose();
      _api.close();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Estoque Inteligente',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: ListenableBuilder(
        listenable: _auth,
        builder: (context, _) {
          switch (_auth.status) {
            case AuthStatus.restoring:
              return const AuthLoadingScreen();
            case AuthStatus.signedOut:
              return AuthScreen(controller: _auth);
            case AuthStatus.signedIn:
              return HomeShell(
                key: ValueKey(_auth.user!.id),
                repository: _repository,
                userName: _auth.user!.name,
                userRole: _auth.user!.role,
                accountPage: AuthScreen(
                  controller: _auth,
                  initialMode: AuthMode.change,
                  embedded: true,
                ),
              );
            case AuthStatus.unavailable:
              return Scaffold(
                body: SafeArea(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.cloud_off_outlined, size: 44),
                          const SizedBox(height: 20),
                          Text(
                            _auth.notice ?? 'Serviço indisponível.',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _auth.restore,
                            child: const Text('Tentar novamente'),
                          ),
                          TextButton(
                            onPressed: () => _auth.signOutLocally(),
                            child: const Text(
                              'Remover sessão deste dispositivo',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
          }
        },
      ),
    );
  }
}
