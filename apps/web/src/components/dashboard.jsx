"use client";
import { serializeCsv } from '@/lib/report-formatters.mjs';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Download,
  PackageSearch,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Warehouse
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import useSWR from "swr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ChartSkeleton, DashboardSkeleton } from '@/components/loading-states';
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
function formatCurrency(value, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
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
export function DemandChart({
  data,
  horizon
}) {
  return <Card className="chart-card" id="previsoes">
      <div className="row-between">
        <div>
          <div className="title-with-badge">
            <h2>Demanda e previsão</h2>
            <Badge variant="secondary">Projeção histórica</Badge>
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
          <ComposedChart data={data} margin={{ top: 22, right: 10, left: -22 }}>
            <defs>
              <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Area dataKey="upper" stroke="none" fill="url(#forecastArea)" connectNulls />
            <Area dataKey="lower" stroke="none" fill="var(--card)" fillOpacity={0.75} connectNulls />
            <Line dataKey="actual" stroke="var(--foreground)" strokeWidth={2.6} connectNulls />
            <Line dataKey="forecast" stroke="var(--primary)" strokeWidth={2.6} strokeDasharray="6 5" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-note">
        <Sparkles size={15} />
        <span>Estimativas após o fim do histórico. Revise antes de planejar reposições.</span>
      </div>
    </Card>;
}
export function ClassificationCard({ data, showLink = true }) {
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
      {showLink && <Button variant="secondary" className="full-button" asChild><Link href="/inteligencia">Explorar análises <ChevronRight size={15} /></Link></Button>}
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
    const csv = serializeCsv([header, ...values]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
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
          <p className="muted-copy">Até 10 prioridades da base · cobertura depende do histórico recente de vendas</p>
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
                <TableCell className="text-right"><strong>{product.coverage === 999 ? 'Sem referência' : `${product.coverage} dias`}</strong></TableCell>
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
function Dashboard({ user }) {
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
    { label: "Valor em estoque", value: formatCurrency(summary.kpis.stockValue, summary.kpis.stockValueCurrency), trend: "Simulado", trendLabel: "base UCI em GBP", icon: Warehouse, tone: "teal", direction: "up" },
    { label: "Produtos ativos", value: String(summary.kpis.activeProducts), trend: "Cat\xE1logo", trendLabel: "itens monitorados", icon: Boxes, tone: "blue", direction: "up" },
    { label: "Risco de ruptura", value: String(summary.kpis.stockoutRisk), trend: "Prioridade", trendLabel: "reposi\xE7\xE3o necess\xE1ria", icon: AlertTriangle, tone: "red", direction: "down" },
    { label: "Horizonte de análise", value: "7 / 30 / 90", trend: "Dias", trendLabel: "após o fim do histórico", icon: TrendingUp, tone: "teal", direction: "up" }
  ] : [];
  return <div className="dashboard-view motion-enter"><main id="conteudo"><div className="content-wrap">
          <section className="page-intro">
            <div><p className="eyebrow">VISÃO GERAL</p><h1>Olá, {user.name.split(' ')[0]}<span className="brand-period">.</span></h1><p className="muted-copy">{summary?.meta.dataset ?? "Dados operacionais e previsões em uma visão única."}{summary?.meta.datasetPeriodEnd ? ` · referência até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${summary.meta.datasetPeriodEnd}T00:00:00Z`))}` : ""}</p></div>
            <div className="page-actions">
              <div className="search-box"><Search size={16} /><Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filtrar produtos prioritários" placeholder="Filtrar prioridades por nome ou SKU" /></div>
              <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value))}>
                <SelectTrigger aria-label="Horizonte de previsão"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="7">Próximos 7 dias</SelectItem><SelectItem value="30">Próximos 30 dias</SelectItem><SelectItem value="90">Próximos 90 dias</SelectItem></SelectContent>
              </Select>
              <Button
    variant="outline"
    onClick={() => void Promise.all([
      summaryRequest.mutate(),
      forecastRequest.mutate()
    ])}
    disabled={validating}
    aria-busy={validating}
  >
                <RefreshCw size={15} className={validating ? 'animate-spin' : undefined} />{validating ? 'Atualizando…' : 'Atualizar'}
              </Button>
            </div>
          </section>
          <div className="ux-context"><Sparkles size={18} /><span><strong>Análise histórica</strong> · Saldo inicial e custos simulados. Projeções relativas ao fim da base.</span><Link href="/dados">Entenda os dados ↗</Link></div>
          {error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Não foi possível atualizar os dados</AlertTitle><AlertDescription>Verifique a conexão e tente novamente pelo botão Atualizar.</AlertDescription></Alert>}
          {loading && !summary ? <DashboardSkeleton /> : summary && <>
              <section className="metrics-grid motion-stagger">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
              <section className="analytics-grid">{forecastRequest.isLoading ? <ChartSkeleton /> : <DemandChart data={series} horizon={horizon} />}<ClassificationCard data={summary.classifications} /></section>
              <section className="insight-strip"><span className="insight-icon"><TrendingUp size={19} /></span><div><strong>INSIGHT DO DIA</strong><p>Priorize os itens críticos pela cobertura calculada com a demanda dos últimos 30 dias.</p></div></section>
              <RisksTable products={summary.riskProducts} query={query} />
            </>}
        </div>
      </main>
    </div>;
}
export {
  Dashboard
};
