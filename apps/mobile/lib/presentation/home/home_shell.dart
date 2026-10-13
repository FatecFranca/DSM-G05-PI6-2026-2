import 'package:flutter/material.dart';

import '../../domain/inventory_repository.dart';
import '../alerts/alerts_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../data/data_quality_screen.dart';
import '../products/products_screen.dart';
import '../widgets/app_brand.dart';
import '../widgets/theme_picker.dart';

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

class _HomeShellState extends State<HomeShell>
    with SingleTickerProviderStateMixin {
  var _currentIndex = 0;
  late final AnimationController _transition = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: 180),
    value: 1,
  );

  void _select(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
    if (!MediaQuery.disableAnimationsOf(context)) _transition.forward(from: 0);
  }

  @override
  void dispose() {
    _transition.dispose();
    super.dispose();
  }

  static const _titles = [
    'Visão geral',
    'Produtos',
    'Alertas',
    'Qualidade dos dados',
    'Minha conta',
  ];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final desktop = width >= 900;
    final pages = [
      DashboardScreen(repository: widget.repository),
      ProductsScreen(repository: widget.repository),
      AlertsScreen(repository: widget.repository),
      DataQualityScreen(repository: widget.repository),
      widget.accountPage ?? SizedBox.shrink(),
    ];
    final content = FadeTransition(
      opacity: _transition,
      child: IndexedStack(index: _currentIndex, children: pages),
    );

    if (desktop) {
      return Scaffold(
        body: Row(
          children: [
            _DesktopNavigation(
              extended: width >= 1120,
              selectedIndex: _currentIndex,
              onSelected: _select,
              userName: widget.userName,
              userRole: widget.userRole,
            ),
            Expanded(
              child: Column(
                children: [
                  _TopBar(
                    title: _titles[_currentIndex],
                    onAlerts: () => _select(2),
                  ),
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
            AppBrandMark(size: 36),
            SizedBox(width: 10),
            Flexible(
              child: Text(
                _titles[_currentIndex],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
              ),
            ),
          ],
        ),
        actions: [
          ThemePicker(),
          IconButton(
            tooltip: 'Notificações',
            onPressed: () => _select(2),
            icon: Icon(Icons.notifications_none_rounded),
          ),
          SizedBox(width: 6),
        ],
      ),
      body: content,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _select,
        destinations: [
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
            icon: Icon(Icons.dataset_outlined),
            selectedIcon: Icon(Icons.dataset),
            label: 'Dados',
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
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(20, 22, 20, 26),
              child: AppBrand(compact: !extended),
            ),
            Expanded(
              child: NavigationRail(
                backgroundColor: Theme.of(context).colorScheme.surface,
                extended: extended,
                minExtendedWidth: 220,
                selectedIndex: selectedIndex,
                onDestinationSelected: onSelected,
                labelType: extended ? null : NavigationRailLabelType.selected,
                destinations: [
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
                    icon: Icon(Icons.dataset_outlined),
                    selectedIcon: Icon(Icons.dataset),
                    label: Text('Dados'),
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
              padding: EdgeInsets.all(16),
              child: extended
                  ? ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(child: Icon(Icons.person_outline)),
                      title: Text(
                        userName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13),
                      ),
                      subtitle: Text(
                        userRole == 'admin' ? 'Administrador' : 'Consulta',
                        style: TextStyle(fontSize: 11),
                      ),
                    )
                  : CircleAvatar(child: Icon(Icons.person_outline)),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.onAlerts});

  final String title;
  final VoidCallback onAlerts;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      padding: EdgeInsets.symmetric(horizontal: 28),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Row(
        children: [
          Text(
            title,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          Spacer(),
          ThemePicker(),
          SizedBox(width: 8),
          IconButton(
            tooltip: 'Notificações',
            onPressed: onAlerts,
            icon: Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
    );
  }
}
