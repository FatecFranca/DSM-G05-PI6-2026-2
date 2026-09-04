'use client';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Flex,
  Heading,
  IconButton,
  Select,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  ChevronRight,
  CircleGauge,
  CloudCog,
  Download,
  Layers3,
  Menu,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { abcData, demandData, riskProducts } from '@/data/demo-data';

const navigation = [
  { label: 'Visão geral', icon: CircleGauge, href: '#conteudo', active: true },
  { label: 'Produtos', icon: PackageSearch, href: '#produtos' },
  { label: 'Previsões', icon: ChartNoAxesCombined, href: '#previsoes' },
  { label: 'Classificação', icon: Layers3, href: '#classificacao' },
  { label: 'Integrações', icon: CloudCog, href: '#integracoes' },
];

const metrics = [
  {
    label: 'Valor em estoque',
    value: 'R$ 184.320',
    trend: '+4,8%',
    trendLabel: 'vs. mês anterior',
    icon: Warehouse,
    tone: 'teal',
    direction: 'up',
  },
  {
    label: 'Produtos ativos',
    value: '1.248',
    trend: '+2,1%',
    trendLabel: '26 novos itens',
    icon: Boxes,
    tone: 'blue',
    direction: 'up',
  },
  {
    label: 'Risco de ruptura',
    value: '18',
    trend: '−3 itens',
    trendLabel: 'desde ontem',
    icon: AlertTriangle,
    tone: 'red',
    direction: 'down',
  },
  {
    label: 'Nível de serviço',
    value: '94,2%',
    trend: '+1,6 p.p.',
    trendLabel: 'últimos 30 dias',
    icon: ShieldCheck,
    tone: 'amber',
    direction: 'up',
  },
];

function MetricCard({ metric }) {
  const Icon = metric.icon;
  const DirectionIcon = metric.direction === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <Card className="metric-card">
      <Flex justify="between" align="start">
        <div>
          <Text as="p" size="2" color="gray" weight="medium">
            {metric.label}
          </Text>
          <Heading as="h2" size="7" className="metric-value">
            {metric.value}
          </Heading>
        </div>
        <div className={`metric-icon metric-icon--${metric.tone}`} aria-hidden="true">
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </Flex>
      <Flex align="center" gap="1" mt="4">
        <span className="trend-positive">
          <DirectionIcon size={14} /> {metric.trend}
        </span>
        <Text size="1" color="gray">
          {metric.trendLabel}
        </Text>
      </Flex>
    </Card>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload
        .filter((entry) => ['actual', 'forecast'].includes(entry.dataKey))
        .map((entry) => (
          <span key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey === 'actual' ? 'Real' : 'Previsto'}: {entry.value} un.
          </span>
        ))}
    </div>
  );
}

function DemandChart({ horizon }) {
  const description =
    horizon === '7'
      ? 'Histórico recente e projeção diária'
      : `Visão resumida da projeção para ${horizon} dias`;

  return (
    <Card className="chart-card" id="previsoes">
      <Flex justify="between" align="start" gap="3" wrap="wrap">
        <div>
          <Flex align="center" gap="2">
            <Heading as="h2" size="4">
              Demanda e previsão
            </Heading>
            <Badge color="teal" variant="soft" radius="full">
              Modelo v0
            </Badge>
          </Flex>
          <Text as="p" size="2" color="gray" mt="1">
            {description}
          </Text>
        </div>
        <Flex gap="4" className="chart-legend" aria-label="Legenda do gráfico">
          <span><i className="legend-dot legend-dot--actual" />Realizado</span>
          <span><i className="legend-dot legend-dot--forecast" />Previsto</span>
        </Flex>
      </Flex>
      <div className="chart-container" aria-label="Gráfico de demanda realizada e prevista">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demandData} margin={{ top: 22, right: 10, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a394" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#16a394" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7eceb" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#788681', fontSize: 11 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#788681', fontSize: 11 }} domain={[80, 220]} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#a7b5b0', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#forecastArea)" connectNulls />
            <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={0.75} connectNulls />
            <Line type="monotone" dataKey="actual" stroke="#263d38" strokeWidth={2.6} dot={{ r: 3, fill: '#263d38' }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="forecast" stroke="#0c8d7d" strokeWidth={2.6} strokeDasharray="6 5" dot={{ r: 3, fill: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Flex align="center" gap="2" className="chart-note">
        <Sparkles size={15} />
        <Text size="1">Intervalo de confiança ilustrativo. Resultados reais serão avaliados por backtesting temporal.</Text>
      </Flex>
    </Card>
  );
}

function ClassificationCard() {
  return (
    <Card className="classification-card" id="classificacao">
      <Heading as="h2" size="4">Curva ABC</Heading>
      <Text as="p" size="2" color="gray" mt="1">Participação no catálogo e na receita</Text>
      <div className="classification-list">
        {abcData.map((item) => (
          <div className="classification-item" key={item.name}>
            <Flex justify="between" align="center">
              <Flex align="center" gap="2">
                <span className="class-mark" style={{ backgroundColor: item.color }} />
                <Text size="2" weight="bold">{item.name}</Text>
              </Flex>
              <Text size="2" color="gray">{item.products} itens</Text>
            </Flex>
            <div className="progress-track" aria-label={`${item.name}: ${item.percent}% dos produtos`}>
              <span style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
            </div>
            <Flex justify="between">
              <Text size="1" color="gray">{item.percent}% dos produtos</Text>
              <Text size="1" weight="bold">{item.revenue}% da receita</Text>
            </Flex>
          </div>
        ))}
      </div>
      <Button variant="soft" color="gray" size="2" className="full-button">
        Ver matriz ABC × XYZ <ChevronRight size={15} />
      </Button>
    </Card>
  );
}

function RisksTable({ query }) {
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const rows = useMemo(
    () => riskProducts.filter((product) =>
      !normalizedQuery ||
      product.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
      product.sku.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
    ),
    [normalizedQuery],
  );

  const exportCsv = () => {
    const header = ['SKU', 'Produto', 'Categoria', 'Estoque', 'Previsão 30d', 'Cobertura', 'Classe', 'Risco'];
    const values = rows.map((item) => [
      item.sku,
      item.name,
      item.category,
      item.stock,
      item.forecast,
      item.coverage,
      item.classification,
      item.severity,
    ]);
    const csv = [header, ...values]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'produtos-em-risco.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="table-card" id="produtos">
      <Flex justify="between" align="start" gap="3" wrap="wrap" className="table-heading">
        <div>
          <Heading as="h2" size="4">Produtos que pedem atenção</Heading>
          <Text as="p" size="2" color="gray" mt="1">Priorizados por cobertura e demanda prevista</Text>
        </div>
        <Button variant="outline" color="gray" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} /> Exportar CSV
        </Button>
      </Flex>
      <div className="table-scroll">
        <Table.Root variant="surface" size="2">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Produto</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Classe</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Estoque</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Previsão 30d</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Cobertura</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Risco</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((product) => (
              <Table.Row key={product.sku}>
                <Table.RowHeaderCell>
                  <Text as="div" size="2" weight="bold">{product.name}</Text>
                  <Text as="div" size="1" color="gray">{product.sku} · {product.category}</Text>
                </Table.RowHeaderCell>
                <Table.Cell><Badge color="gray" variant="soft">{product.classification}</Badge></Table.Cell>
                <Table.Cell align="right">{product.stock} un.</Table.Cell>
                <Table.Cell align="right">{product.forecast} un.</Table.Cell>
                <Table.Cell align="right"><Text weight="bold">{product.coverage} dias</Text></Table.Cell>
                <Table.Cell>
                  <Badge color={product.severity === 'Crítico' ? 'red' : 'amber'} variant="soft" radius="full">
                    {product.severity}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {!rows.length && (
          <div className="empty-state">
            <PackageSearch size={26} />
            <Text size="2" color="gray">Nenhum produto demonstrativo corresponde à busca.</Text>
          </div>
        )}
      </div>
    </Card>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <a href="#conteudo" className="brand" aria-label="Estoque Inteligente — início">
        <span className="brand-symbol"><Boxes size={22} /></span>
        <span><strong>Estoque</strong><small>Inteligente</small></span>
      </a>
      <nav aria-label="Navegação principal">
        <Text as="p" size="1" weight="bold" className="nav-label">GESTÃO</Text>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.label} href={item.href} className={item.active ? 'nav-item nav-item--active' : 'nav-item'}>
              <Icon size={18} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sync-status" id="integracoes">
          <span className="sync-dot" />
          <div>
            <Text as="div" size="1" weight="bold">Bling sincronizado</Text>
            <Text as="div" size="1" color="gray">Demonstração · hoje, 06:03</Text>
          </div>
        </div>
        <Separator size="4" my="3" />
        <Flex align="center" gap="3">
          <Avatar fallback="G5" color="teal" radius="full" />
          <div className="profile-copy">
            <Text as="div" size="2" weight="bold">Grupo 05</Text>
            <Text as="div" size="1" color="gray">Administrador</Text>
          </div>
          <ChevronRight size={16} className="profile-arrow" />
        </Flex>
      </div>
    </aside>
  );
}

export function Dashboard() {
  const [horizon, setHorizon] = useState('7');
  const [query, setQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState('Atualizado há 3 min');

  const handleRefresh = () => {
    setLastRefresh('Atualizado agora');
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" id="conteudo">
        <header className="topbar">
          <Flex align="center" gap="3">
            <IconButton variant="ghost" color="gray" className="mobile-menu" aria-label="Abrir menu">
              <Menu size={21} />
            </IconButton>
            <div className="mobile-brand"><Boxes size={20} /><strong>Estoque Inteligente</strong></div>
          </Flex>
          <Flex align="center" gap="3">
            <Badge color="amber" variant="soft" radius="full">Dados demonstrativos</Badge>
            <IconButton variant="ghost" color="gray" aria-label="Notificações">
              <Bell size={19} />
            </IconButton>
            <Avatar fallback="G5" size="2" color="teal" radius="full" className="mobile-avatar" />
          </Flex>
        </header>

        <div className="content-wrap">
          <section className="page-intro">
            <div>
              <Text as="p" size="1" color="teal" weight="bold" className="eyebrow">VISÃO GERAL</Text>
              <Heading as="h1" size="7">Decisões de estoque, mais claras.</Heading>
              <Text as="p" size="2" color="gray" mt="2">Acompanhe o desempenho e antecipe a demanda dos seus produtos.</Text>
            </div>
            <Flex gap="2" align="center" wrap="wrap" className="page-actions">
              <div className="search-box">
                <Search size={16} aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou SKU" aria-label="Buscar produto ou SKU" />
              </div>
              <Select.Root value={horizon} onValueChange={setHorizon}>
                <Select.Trigger aria-label="Período da previsão" />
                <Select.Content>
                  <Select.Item value="7">Próximos 7 dias</Select.Item>
                  <Select.Item value="30">Próximos 30 dias</Select.Item>
                  <Select.Item value="90">Próximos 90 dias</Select.Item>
                </Select.Content>
              </Select.Root>
              <Button variant="soft" color="teal" onClick={handleRefresh}>
                <RefreshCw size={15} /> {lastRefresh}
              </Button>
            </Flex>
          </section>

          <section className="metrics-grid" aria-label="Indicadores principais">
            {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </section>

          <section className="analytics-grid">
            <DemandChart horizon={horizon} />
            <ClassificationCard />
          </section>

          <section className="insight-strip">
            <span className="insight-icon"><TrendingUp size={19} /></span>
            <div>
              <Text as="p" size="1" weight="bold" color="teal">INSIGHT DO DIA</Text>
              <Text as="p" size="2"><strong>Café e leite concentram o risco imediato.</strong> Revisar os prazos de reposição pode evitar até 2 rupturas nesta semana.</Text>
            </div>
            <Button variant="ghost" color="teal">Ver detalhes <ChevronRight size={15} /></Button>
          </section>

          <RisksTable query={query} />
          <footer className="page-footer">
            <Text size="1" color="gray">Protótipo acadêmico · PI 6º semestre · Grupo 05</Text>
            <Text size="1" color="gray">Última sincronização demonstrativa: 03/09/2026 às 06:03</Text>
          </footer>
        </div>
      </main>
    </div>
  );
}
