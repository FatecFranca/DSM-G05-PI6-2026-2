import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../domain/inventory_repository.dart';
import '../alerts/alerts_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../products/products_screen.dart';
import '../widgets/app_brand.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.repository,
    this.accountPage,
    this.userName = 'Minha conta',
    this.userRole = 'viewer',
  });

  final InventoryRepository repository;
  final Widget? accountPage;
  final String userName;
  final String userRole;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  var _currentIndex = 0;

  static const _titles = ['Visão geral', 'Produtos', 'Alertas', 'Minha conta'];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final desktop = width >= 900;
    final pages = [
      DashboardScreen(repository: widget.repository),
      ProductsScreen(repository: widget.repository),
      AlertsScreen(repository: widget.repository),
      widget.accountPage ?? const SizedBox.shrink(),
    ];
    final content = IndexedStack(index: _currentIndex, children: pages);

    if (desktop) {
      return Scaffold(
        body: Row(
          children: [
            _DesktopNavigation(
              extended: width >= 1120,
              selectedIndex: _currentIndex,
              onSelected: (index) => setState(() => _currentIndex = index),
              userName: widget.userName,
              userRole: widget.userRole,
            ),
            Expanded(
              child: Column(
                children: [
                  _TopBar(title: _titles[_currentIndex]),
                  Expanded(child: content),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            const AppBrandMark(size: 36),
            const SizedBox(width: 10),
            Text(
              _titles[_currentIndex],
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notificações',
            onPressed: () => setState(() => _currentIndex = 2),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: content,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'Resumo',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2_rounded),
            label: 'Produtos',
          ),
          NavigationDestination(
            icon: Icon(Icons.warning_amber_rounded),
            selectedIcon: Icon(Icons.warning_rounded),
            label: 'Alertas',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Conta',
          ),
        ],
      ),
    );
  }
}

class _DesktopNavigation extends StatelessWidget {
  const _DesktopNavigation({
    required this.extended,
    required this.selectedIndex,
    required this.onSelected,
    required this.userName,
    required this.userRole,
  });

  final bool extended;
  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final String userName;
  final String userRole;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: extended ? 244 : 84,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: AppColors.line)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 26),
              child: AppBrand(compact: !extended),
            ),
            Expanded(
              child: NavigationRail(
                backgroundColor: Colors.white,
                extended: extended,
                minExtendedWidth: 220,
                selectedIndex: selectedIndex,
                onDestinationSelected: onSelected,
                labelType: extended ? null : NavigationRailLabelType.selected,
                destinations: const [
                  NavigationRailDestination(
                    icon: Icon(Icons.dashboard_outlined),
                    selectedIcon: Icon(Icons.dashboard_rounded),
                    label: Text('Visão geral'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.inventory_2_outlined),
                    selectedIcon: Icon(Icons.inventory_2_rounded),
                    label: Text('Produtos'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.warning_amber_rounded),
                    selectedIcon: Icon(Icons.warning_rounded),
                    label: Text('Alertas'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.person_outline),
                    selectedIcon: Icon(Icons.person),
                    label: Text('Conta'),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: extended
                  ? ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        child: Icon(Icons.person_outline),
                      ),
                      title: Text(
                        userName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13),
                      ),
                      subtitle: Text(
                        userRole == 'admin' ? 'Administrador' : 'Consulta',
                        style: const TextStyle(fontSize: 11),
                      ),
                    )
                  : const CircleAvatar(child: Icon(Icons.person_outline)),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      padding: const EdgeInsets.symmetric(horizontal: 28),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const Spacer(),
          const Chip(
            avatar: Icon(Icons.storage_rounded, size: 16),
            label: Text('PostgreSQL'),
            side: BorderSide.none,
            visualDensity: VisualDensity.compact,
          ),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Notificações',
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
    );
  }
}
