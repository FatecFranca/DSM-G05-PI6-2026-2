'use client';
import { useState } from 'react';
import { formatReportDate as date } from '@/lib/report-formatters.mjs';
import useSWR from 'swr';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { DashboardApiClient } from '@/services/dashboard-api-client';
import { DemandChart, ClassificationCard } from '@/components/dashboard';
import { DashboardSkeleton } from '@/components/loading-states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableHead, TableCell, TableRow } from '@/components/ui/table';

const api = new DashboardApiClient();
const number = (v) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v ?? 0);
function ErrorState({ error, retry }) { return <Alert variant="destructive"><AlertTriangle /><AlertTitle>Não foi possível atualizar esta consulta</AlertTitle><AlertDescription>{error.message}<Button variant="outline" onClick={retry}>Tentar novamente</Button></AlertDescription></Alert>; }

export function IntelligencePage() {
  const [horizon, setHorizon] = useState(30);
  const forecast = useSWR(['intelligence-forecast', horizon], ([, h]) => api.getForecast(h));
  const summary = useSWR('dashboard-summary', () => api.getSummary());
  const error = forecast.error || summary.error;
  const predicted = forecast.data?.data.filter((p) => p.forecast !== null) || [];
  return <main className="ux-page"><header className="ux-page-heading"><div><p className="workspace-caption">INTELIGÊNCIA DE ESTOQUE</p><h1>Planeje com perspectiva<span className="brand-period">.</span></h1><p className="muted-copy">Explore cenários de demanda e a importância econômica do catálogo.</p></div><Sparkles className="ux-heading-icon" /></header>
    <div className="ux-context"><AlertTriangle size={18} /><span>Estas projeções são históricas, calculadas após o último dia da base. Não representam vendas previstas para hoje.</span></div>
    <div className="ux-toolbar"><div><strong>Horizonte de planejamento</strong><p className="muted-copy">Escolha o período para comparar a demanda estimada.</p></div><div className="ux-segments" role="group" aria-label="Horizonte de planejamento">{[7,30,90].map((h) => <Button key={h} variant={horizon === h ? 'default' : 'ghost'} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>{h} dias</Button>)}</div></div>
    {error && <ErrorState error={error} retry={() => { forecast.mutate(); summary.mutate(); }} />}
    {forecast.isLoading ? <DashboardSkeleton /> : forecast.data && <><section className="ux-metrics"><Card className="ux-stat"><span>Demanda estimada</span><strong>{number(predicted.reduce((sum,p) => sum + p.forecast, 0))}</strong><small>unidades no horizonte selecionado</small></Card><Card className="ux-stat"><span>Período da projeção</span><strong className="ux-stat-date">{date(predicted[0]?.date)}</strong><small>até {date(predicted.at(-1)?.date)}</small></Card><Card className="ux-stat"><span>Publicação do modelo</span><strong className="ux-stat-date">{date(forecast.data.generatedAt)}</strong><small className="break-all">{forecast.data.model || 'Modelo não publicado'}</small></Card></section><section className="ux-analytics"><DemandChart data={forecast.data.data} horizon={horizon} /><ClassificationCard showLink={false} data={summary.data?.classifications || []} /></section><Card className="ux-panel"><h2>Como interpretar a análise</h2><div className="ux-explain-grid">{[['A · Maior contribuição','Produtos que concentram a receita. Merecem acompanhamento frequente e atenção à reposição.'],['B · Contribuição intermediária','Itens de importância moderada. Equilibre disponibilidade, giro e custo de manutenção.'],['C · Cauda do catálogo','Produtos com menor participação na receita. Revise o histórico antes de aumentar o saldo.']].map(([title, description]) => <div key={title}><strong>{title}</strong><p className="muted-copy">{description}</p></div>)}</div></Card></>}
  </main>;
}

export function DataQualityPage() {
  const dataset = useSWR('dataset-current', () => api.get('/api/v1/datasets/current'));
  const runs = useSWR('sync-runs', () => api.get('/api/v1/sync-runs'));
  const d = dataset.data;
  const [expanded, setExpanded] = useState(false);
  const labels = { duplicate: 'Linhas duplicadas', cancellation: 'Cancelamentos / quantidade negativa', missing_description: 'Descrição ausente', nonpositive_price: 'Preço não positivo', nonpositive_quantity: 'Quantidade não positiva', non_product_code: 'Códigos que não são mercadorias', malformed: 'Registros malformados', missing_customer: 'Identificador de cliente ausente (não armazenado)' };
  return <main className="ux-page"><header className="ux-page-heading"><div><p className="workspace-caption">TRANSPARÊNCIA E CONFIANÇA</p><h1>Conheça seus dados<span className="brand-period">.</span></h1><p className="muted-copy">Origem, cobertura e critérios de preparação em um só lugar.</p></div><Button variant="outline" disabled={dataset.isValidating || runs.isValidating} onClick={() => { dataset.mutate(); runs.mutate(); }}><RefreshCw size={16} className={dataset.isValidating ? 'animate-spin' : ''} />Atualizar</Button></header>
    {dataset.error && <ErrorState error={dataset.error} retry={() => dataset.mutate()} />}
    {dataset.isLoading && <DashboardSkeleton />}
    {d && <><Card className="ux-source-card"><div className="ux-source-icon"><Database size={28} /></div><div><Badge variant="secondary">{d.license}</Badge><h2>UCI Online Retail II</h2><p>Vendas históricas · {date(d.periodStartedOn)} a {date(d.periodEndedOn)}</p></div><Button variant="outline" asChild><a href={`https://doi.org/${encodeURIComponent(d.doi)}`} target="_blank" rel="noreferrer">Fonte oficial <ExternalLink size={15} /></a></Button></Card>
    <section className="ux-metrics">{[[Database,'Registros lidos',d.recordsRead],[CheckCircle2,'Vendas aceitas',d.recordsAccepted],[AlertTriangle,'Fora da demanda válida',d.recordsRejected]].map(([Icon,title,value]) => <Card className="ux-stat" key={title}><div className="flex justify-between"><span>{title}</span><Icon size={18}/></div><strong>{number(value)}</strong><small>{d.recordsRead ? number(value/d.recordsRead*100) : 0}% dos registros lidos</small></Card>)}</section>
    <section className="ux-analytics"><Card className="ux-panel"><div><p className="workspace-caption">PREPARAÇÃO</p><h2>O que foi identificado?</h2><p className="muted-copy">Ocorrências podem se sobrepor; não some estas contagens.</p></div><div className="ux-quality-list">{Object.entries(labels).map(([key,label]) => <div key={key}><span>{label}</span><strong>{number(d.qualitySummary?.[key])}</strong></div>)}</div></Card><Card className="ux-panel"><p className="workspace-caption">CONTEXTO DA ANÁLISE</p><h2>Limitações conhecidas</h2><div className="ux-explain-grid single"><div><strong>Estoque simulado</strong><p className="muted-copy">A base não informa saldo físico, custo ou prazo de reposição. Esses valores foram simulados para demonstrar a gestão.</p></div><div><strong>Vendas observadas</strong><p className="muted-copy">Dias sem venda não comprovam ausência de demanda. Não há informação confiável de ruptura.</p></div><div><strong>Privacidade e moeda</strong><p className="muted-copy">Customer ID não é armazenado. Os valores da fonte são em libras (GBP), sem conversão para reais.</p></div></div></Card></section>
    <Card className="ux-panel"><div className="ux-panel-heading"><div><h2>Rastreabilidade da carga</h2><p className="muted-copy">Importada em {date(d.importedAt)} · versão {d.version}</p></div><Button variant="outline" aria-expanded={expanded} aria-controls="dataset-fingerprint" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ocultar identificação' : 'Ver identificação'}</Button></div>{expanded && <div id="dataset-fingerprint" className="ux-fingerprint motion-enter"><strong>SHA-256 do arquivo</strong><code>{d.fileSha256}</code><p>Chen, D. (2012). Online Retail II. UCI Machine Learning Repository.</p></div>}</Card></>}
    <Card className="ux-panel"><h2>Histórico de cargas</h2>{runs.error ? <ErrorState error={runs.error} retry={() => runs.mutate()} /> : runs.isLoading ? <p role="status">Carregando histórico…</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Fonte</TableHead><TableHead>Início</TableHead><TableHead>Resultado</TableHead><TableHead>Registros processados</TableHead></TableRow></TableHeader><TableBody>{runs.data?.data.map((run) => <TableRow key={run.id}><TableCell>{run.source}</TableCell><TableCell>{date(run.startedAt)}</TableCell><TableCell><Badge variant={run.status === 'failed' ? 'destructive' : 'secondary'}>{{ succeeded:'Concluída',failed:'Falhou',running:'Em execução',pending:'Aguardando',partial:'Parcial' }[run.status] || run.status}</Badge></TableCell><TableCell>{number(run.recordsProcessed)}</TableCell></TableRow>)}</TableBody></Table>{!runs.data?.data.length && <p className="ux-empty">Nenhuma carga registrada.</p>}</div>}</Card>
  </main>;
}
