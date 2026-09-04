import 'package:flutter/material.dart';

void main() {
  runApp(const EstoqueInteligenteApp());
}

class EstoqueInteligenteApp extends StatelessWidget {
  const EstoqueInteligenteApp({super.key});

  @override
  Widget build(BuildContext context) {
    const brand = Color(0xFF0C7767);

    return MaterialApp(
      title: 'Estoque Inteligente',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: brand,
          brightness: Brightness.light,
          surface: const Color(0xFFF6F8F7),
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F7F5),
        useMaterial3: true,
        cardTheme: const CardThemeData(
          elevation: 0,
          margin: EdgeInsets.zero,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(18)),
            side: BorderSide(color: Color(0xFFE1E9E6)),
          ),
        ),
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var _currentIndex = 0;

  static const _titles = ['Visão geral', 'Produtos', 'Alertas'];

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 900;
    final content = IndexedStack(
      index: _currentIndex,
      children: const [DashboardTab(), ProductsTab(), AlertsTab()],
    );

    if (isDesktop) {
      return Scaffold(
        body: Row(
          children: [
            SafeArea(
              child: NavigationRail(
                extended: width >= 1120,
                selectedIndex: _currentIndex,
                onDestinationSelected: (index) =>
                    setState(() => _currentIndex = index),
                leading: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.inventory_2_outlined,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                      if (width >= 1120) ...[
                        const SizedBox(width: 12),
                        const Text(
                          'Estoque Inteligente',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ],
                  ),
                ),
                destinations: const [
                  NavigationRailDestination(
                    icon: Icon(Icons.dashboard_outlined),
                    selectedIcon: Icon(Icons.dashboard),
                    label: Text('Resumo'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.inventory_2_outlined),
                    selectedIcon: Icon(Icons.inventory_2),
                    label: Text('Produtos'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.warning_amber_rounded),
                    selectedIcon: Icon(Icons.warning_rounded),
                    label: Text('Alertas'),
                  ),
                ],
              ),
            ),
            const VerticalDivider(width: 1),
            Expanded(
              child: Column(
                children: [
                  Container(
                    height: 72,
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    alignment: Alignment.centerLeft,
                    child: Row(
                      children: [
                        Text(
                          _titles[_currentIndex],
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const Spacer(),
                        const Chip(
                          avatar: Icon(Icons.science_outlined, size: 17),
                          label: Text('Dados demonstrativos'),
                          side: BorderSide.none,
                        ),
                        const SizedBox(width: 12),
                        IconButton(
                          onPressed: () {},
                          icon: const Icon(Icons.notifications_none_rounded),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
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
        titleSpacing: 20,
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(11),
              ),
              child: const Icon(
                Icons.inventory_2_outlined,
                color: Colors.white,
                size: 20,
              ),
            ),
            const SizedBox(width: 11),
            Text(
              _titles[_currentIndex],
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          const SizedBox(width: 8),
        ],
        backgroundColor: const Color(0xFFF3F7F5),
        surfaceTintColor: Colors.transparent,
      ),
      body: content,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Resumo',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Produtos',
          ),
          NavigationDestination(
            icon: Icon(Icons.warning_amber_rounded),
            selectedIcon: Icon(Icons.warning_rounded),
            label: 'Alertas',
          ),
        ],
      ),
    );
  }
}

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
      children: [
        Row(
          children: [
            Chip(
              avatar: const Icon(Icons.science_outlined, size: 17),
              label: const Text('Dados demonstrativos'),
              backgroundColor: const Color(0xFFFFF5D9),
              side: BorderSide.none,
              labelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Text(
              'Atualizado há 3 min',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: Colors.black54),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text(
          'Olá, Grupo 05',
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 5),
        Text(
          'Veja o que precisa da sua atenção hoje.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: Colors.black54),
        ),
        const SizedBox(height: 22),
        const Row(
          children: [
            Expanded(
              child: MetricCard(
                label: 'Em estoque',
                value: 'R\$ 184 mil',
                icon: Icons.warehouse_outlined,
                color: Color(0xFF0C7767),
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                label: 'Risco de ruptura',
                value: '18 itens',
                icon: Icons.warning_amber_rounded,
                color: Color(0xFFC44E42),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text(
          'Prioridade de hoje',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        const RiskTile(
          name: 'Café Torrado 500 g',
          sku: 'CAF-500-TD',
          coverage: '2 dias',
          critical: true,
        ),
        const SizedBox(height: 10),
        const RiskTile(
          name: 'Leite Integral 1 L',
          sku: 'LEI-1L-IN',
          coverage: '4 dias',
          critical: true,
        ),
        const SizedBox(height: 10),
        const RiskTile(
          name: 'Detergente Neutro 500 ml',
          sku: 'DET-500-N',
          coverage: '18 dias',
          critical: false,
        ),
        const SizedBox(height: 20),
        Card(
          color: const Color(0xFFE8F5F1),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.auto_awesome,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Insight do dia',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Café e leite concentram o risco imediato. Revise os prazos de reposição.',
                        style: TextStyle(height: 1.35),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, color: color, size: 21),
            ),
            const SizedBox(height: 18),
            Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: Colors.black54),
            ),
          ],
        ),
      ),
    );
  }
}

class RiskTile extends StatelessWidget {
  const RiskTile({
    super.key,
    required this.name,
    required this.sku,
    required this.coverage,
    required this.critical,
  });

  final String name;
  final String sku;
  final String coverage;
  final bool critical;

  @override
  Widget build(BuildContext context) {
    final color = critical ? const Color(0xFFC44E42) : const Color(0xFFB87A11);

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(Icons.inventory_2_outlined, color: color, size: 21),
        ),
        title: Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: Text(
          '$sku · cobertura de $coverage',
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Icon(Icons.chevron_right, color: Colors.grey.shade500),
      ),
    );
  }
}

class ProductsTab extends StatelessWidget {
  const ProductsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: EmptyTab(
        icon: Icons.inventory_2_outlined,
        title: 'Catálogo de produtos',
        description: 'A consulta será conectada à API nas próximas sprints.',
      ),
    );
  }
}

class AlertsTab extends StatelessWidget {
  const AlertsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: EmptyTab(
        icon: Icons.notifications_active_outlined,
        title: 'Central de alertas',
        description: 'Riscos de ruptura e reposições aparecerão aqui.',
      ),
    );
  }
}

class EmptyTab extends StatelessWidget {
  const EmptyTab({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 42, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 14),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.black54),
          ),
        ],
      ),
    );
  }
}
