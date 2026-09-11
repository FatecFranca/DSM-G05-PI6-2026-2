"use client";
import Image from "next/image";
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
  Warehouse
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import useSWR from "swr";
import appIcon from "@/app/icon.png";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { DashboardApiClient } from "@/services/dashboard-api-client";
const api = new DashboardApiClient();
const navigation = [
  { label: "Vis\xE3o geral", icon: CircleGauge, href: "#conteudo", active: true },
  { label: "Produtos", icon: PackageSearch, href: "#produtos" },
  { label: "Previs\xF5es", icon: ChartNoAxesCombined, href: "#previsoes" },
  { label: "Classifica\xE7\xE3o", icon: Layers3, href: "#classificacao" },
  { label: "Integra\xE7\xF5es", icon: CloudCog, href: "#integracoes" }
];
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(value);
}
function MetricCard({ metric }) {
  const Icon = metric.icon;
  const Direction = metric.direction === "down" ? ArrowDownRight : ArrowUpRight;
  return <Card className="metric-card">
      <div className="row-between">
        <div>
          <p className="muted-copy">{metric.label}</p>
          <h2 className="metric-value">{metric.value}</h2>
        </div>
        <div className={`metric-icon metric-icon--${metric.tone}`}>
          <Icon size={21} />
        </div>
      </div>
      <div className="metric-trend">
        <span className="trend-positive"><Direction size={14} />{metric.trend}</span>
        <span className="subtle-copy">{metric.trendLabel}</span>
      </div>
    </Card>;
}
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.filter((entry) => ["actual", "forecast"].includes(String(entry.dataKey))).map((entry) => <span key={String(entry.dataKey)} style={{ color: entry.color }}>
            {entry.dataKey === "actual" ? "Real" : "Previsto"}: {entry.value} un.
          </span>)}
    </div>;
}
function DemandChart({
  data,
  horizon
}) {
  return <Card className="chart-card" id="previsoes">
      <div className="row-between">
        <div>
          <div className="title-with-badge">
            <h2>Demanda e previsão</h2>
            <Badge variant="secondary">Modelo v1</Badge>
          </div>
          <p className="muted-copy">Histórico e projeção para {horizon} dias</p>
        </div>
        <div className="chart-legend">
          <span><i className="legend-dot legend-dot--actual" />Realizado</span>
          <span><i className="legend-dot legend-dot--forecast" />Previsto</span>
        </div>
      </div>
      <div className="chart-container" aria-label="Demanda realizada e prevista">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 22, right: 10, left: -22 }}>
            <defs>
              <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a394" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#16a394" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e7eceb" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="upper" stroke="none" fill="url(#forecastArea)" connectNulls />
            <Area dataKey="lower" stroke="none" fill="#fff" fillOpacity={0.75} connectNulls />
            <Line dataKey="actual" stroke="#263d38" strokeWidth={2.6} connectNulls />
            <Line dataKey="forecast" stroke="#0c8d7d" strokeWidth={2.6} strokeDasharray="6 5" connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-note">
        <Sparkles size={15} />
        <span>Intervalos calculados pelo modelo publicado no PostgreSQL.</span>
      </div>
    </Card>;
}
function ClassificationCard({ data }) {
  return <Card className="classification-card" id="classificacao">
      <h2>Curva ABC</h2>
      <p className="muted-copy">Participação no catálogo e na receita</p>
      <div className="classification-list">
        {data.map((item) => <div className="classification-item" key={item.name}>
            <div className="row-between">
              <strong><i className="class-mark" style={{ backgroundColor: item.color }} />{item.name}</strong>
              <span className="muted-copy">{item.products} itens</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
            </div>
            <div className="row-between subtle-copy">
              <span>{item.percent}% dos produtos</span>
              <strong>{item.revenue}% da receita</strong>
            </div>
          </div>)}
      </div>
      <Button variant="secondary" className="full-button">
        Ver matriz ABC × XYZ <ChevronRight size={15} />
      </Button>
    </Card>;
}
function RisksTable({
  products,
  query
}) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const rows = useMemo(
    () => products.filter((product) => !normalized || product.name.toLocaleLowerCase("pt-BR").includes(normalized) || product.sku.toLocaleLowerCase("pt-BR").includes(normalized)),
    [normalized, products]
  );
  function exportCsv() {
    const header = ["SKU", "Produto", "Categoria", "Estoque", "Previs\xE3o 30d", "Cobertura", "Classe", "Risco"];
    const values = rows.map((item) => [
      item.sku,
      item.name,
      item.category,
      item.stock,
      item.forecast,
      item.coverage,
      item.classification,
      item.severity
    ]);
    const csv = [header, ...values].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "produtos-em-risco.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return <Card className="table-card" id="produtos">
      <div className="row-between table-heading">
        <div>
          <h2>Produtos que pedem atenção</h2>
          <p className="muted-copy">Priorizados por cobertura e demanda prevista</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} />Exportar CSV
        </Button>
      </div>
      <div className="table-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Previsão 30d</TableHead>
              <TableHead className="text-right">Cobertura</TableHead>
              <TableHead>Risco</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => <TableRow key={product.id}>
                <TableCell><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></TableCell>
                <TableCell><Badge variant="outline">{product.classification}</Badge></TableCell>
                <TableCell className="text-right">{product.stock} un.</TableCell>
                <TableCell className="text-right">{Math.round(product.forecast)} un.</TableCell>
                <TableCell className="text-right"><strong>{product.coverage} dias</strong></TableCell>
                <TableCell>
                  <Badge variant={product.risk === "critical" ? "destructive" : "secondary"}>
                    {product.severity}
                  </Badge>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
        {!rows.length && <div className="empty-state"><PackageSearch />Nenhum produto encontrado.</div>}
      </div>
    </Card>;
}
function Sidebar({ lastSyncAt }) {
  const syncLabel = lastSyncAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastSyncAt)) : "aguardando primeira carga";
  return <aside className="sidebar">
      <a href="#conteudo" className="brand">
        <span className="brand-symbol"><Image src={appIcon} alt="" width={31} height={31} priority /></span>
        <span><strong>Estoque</strong><small>Inteligente</small></span>
      </a>
      <nav aria-label="Navegação principal">
        <p className="nav-label">GESTÃO</p>
        {navigation.map((item) => {
    const Icon = item.icon;
    return <a key={item.label} href={item.href} className={item.active ? "nav-item nav-item--active" : "nav-item"}>
              <Icon size={18} /><span>{item.label}</span>
            </a>;
  })}
      </nav>
      <div className="sidebar-footer">
        <div className="sync-status" id="integracoes">
          <span className="sync-dot" />
          <div><strong>PostgreSQL conectado</strong><small>{syncLabel}</small></div>
        </div>
        <Separator />
        <div className="profile-row">
          <Avatar><AvatarFallback>G5</AvatarFallback></Avatar>
          <div className="profile-copy"><strong>Grupo 05</strong><small>Administrador</small></div>
          <ChevronRight size={16} />
        </div>
      </div>
    </aside>;
}
function DashboardSkeleton() {
  return <div className="loading-grid">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div>;
}
function Dashboard() {
  const [horizon, setHorizon] = useState(7);
  const [query, setQuery] = useState("");
  const summaryRequest = useSWR("dashboard-summary", () => api.getSummary());
  const forecastRequest = useSWR(
    ["demand-forecast", horizon],
    ([, selectedHorizon]) => api.getForecast(selectedHorizon)
  );
  const summary = summaryRequest.data;
  const series = forecastRequest.data?.data ?? summary?.demandSeries ?? [];
  const error = summaryRequest.error ?? forecastRequest.error;
  const loading = summaryRequest.isLoading || forecastRequest.isLoading;
  const validating = summaryRequest.isValidating || forecastRequest.isValidating;
  const metrics = summary ? [
    { label: "Valor em estoque", value: formatCurrency(summary.kpis.stockValue), trend: "Banco real", trendLabel: "posi\xE7\xE3o atual", icon: Warehouse, tone: "teal", direction: "up" },
    { label: "Produtos ativos", value: String(summary.kpis.activeProducts), trend: "Cat\xE1logo", trendLabel: "itens monitorados", icon: Boxes, tone: "blue", direction: "up" },
    { label: "Risco de ruptura", value: String(summary.kpis.stockoutRisk), trend: "Prioridade", trendLabel: "reposi\xE7\xE3o necess\xE1ria", icon: AlertTriangle, tone: "red", direction: "down" },
    { label: "N\xEDvel de servi\xE7o", value: `${summary.kpis.serviceLevel.toFixed(1)}%`, trend: "30 dias", trendLabel: "sem ruptura registrada", icon: ShieldCheck, tone: "amber", direction: "up" }
  ] : [];
  return <div className="app-shell">
      <Sidebar lastSyncAt={summary?.meta.lastSyncAt ?? null} />
      <main className="main-content" id="conteudo">
        <header className="topbar">
          <div className="mobile-brand"><Menu size={21} /><Image src={appIcon} alt="" width={25} height={25} priority /><strong>Estoque Inteligente</strong></div>
          <div className="topbar-actions"><Badge variant="secondary">PostgreSQL</Badge><Bell size={19} /></div>
        </header>
        <div className="content-wrap">
          <section className="page-intro">
            <div><p className="eyebrow">VISÃO GERAL</p><h1>Decisões de estoque, mais claras.</h1><p className="muted-copy">Dados operacionais e previsões em uma visão única.</p></div>
            <div className="page-actions">
              <div className="search-box"><Search size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou SKU" /></div>
              <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="7">Próximos 7 dias</SelectItem><SelectItem value="30">Próximos 30 dias</SelectItem><SelectItem value="90">Próximos 90 dias</SelectItem></SelectContent>
              </Select>
              <Button
    variant="outline"
    onClick={() => void Promise.all([
      summaryRequest.mutate(),
      forecastRequest.mutate()
    ])}
    disabled={validating}
  >
                <RefreshCw size={15} />Atualizar
              </Button>
            </div>
          </section>
          {error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>API indisponível</AlertTitle><AlertDescription>{error instanceof Error ? error.message : "Falha na consulta."} Confirme se a API está em http://localhost:3333.</AlertDescription></Alert>}
          {loading && !summary ? <DashboardSkeleton /> : summary && <>
              <section className="metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
              <section className="analytics-grid"><DemandChart data={series} horizon={horizon} /><ClassificationCard data={summary.classifications} /></section>
              <section className="insight-strip"><span className="insight-icon"><TrendingUp size={19} /></span><div><strong>INSIGHT DO DIA</strong><p>Priorize os itens críticos pela cobertura calculada com a demanda dos últimos 30 dias.</p></div></section>
              <RisksTable products={summary.riskProducts} query={query} />
            </>}
          <footer className="page-footer"><span>Projeto acadêmico · PI 6º semestre · Grupo 05</span><span>API Node.js + PostgreSQL</span></footer>
        </div>
      </main>
    </div>;
}
export {
  Dashboard
};
