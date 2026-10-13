'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Boxes, LoaderCircle, Search, SlidersHorizontal } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StockApiClient } from '@/services/stock-api-client';

const api = new StockApiClient();
const movementLabels = { entry: 'Entrada', exit: 'Saída', adjustment: 'Ajuste', transfer_in: 'Transferência recebida', transfer_out: 'Transferência enviada' };
const movementIcons = { entry: ArrowDownToLine, exit: ArrowUpFromLine, adjustment: SlidersHorizontal };
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

function OptionSelect({ value, onValueChange, options, placeholder, disabled, label }) {
  return <Select value={value} onValueChange={onValueChange} disabled={disabled}>
    <SelectTrigger className="w-full" aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

function MovementForm({ options, onDone }) {
  const [type, setType] = useState('entry');
  const [productId, setProductId] = useState(''); const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const Icon = movementIcons[type];
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const amount = quantity.replace(',', '.');
      await api.apply(type === 'adjustment' ? { type, productId, warehouseId, targetQuantity: amount, reason }
        : { type, productId, warehouseId, quantity: amount, reason });
      setQuantity(''); setReason(''); onDone(`${movementLabels[type]} registrada com sucesso.`);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <Card className="p-5 transition-shadow duration-200 hover:shadow-sm">
    <div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span>
      <div><h2 className="font-semibold">Movimentar estoque</h2><p className="text-sm text-muted-foreground">Registre a causa para manter uma trilha auditável.</p></div></div>
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium"><span>Operação</span><Select value={type} onValueChange={setType} disabled={busy}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entry">Entrada</SelectItem><SelectItem value="exit">Saída</SelectItem><SelectItem value="adjustment">Ajuste de contagem</SelectItem></SelectContent></Select></label>
      <label className="space-y-2 text-sm font-medium"><span>Produto</span><OptionSelect value={productId} onValueChange={setProductId} disabled={busy}
        label="Produto" placeholder="Selecione" options={options.products.map((item) => ({ id: item.id, label: `${item.sku} · ${item.name}` }))} /></label>
      <label className="space-y-2 text-sm font-medium"><span>Depósito</span><OptionSelect value={warehouseId} onValueChange={setWarehouseId} disabled={busy}
        label="Depósito" placeholder="Selecione" options={options.warehouses.map((item) => ({ id: item.id, label: item.name }))} /></label>
      <label className="space-y-2 text-sm font-medium"><span>{type === 'adjustment' ? 'Novo saldo físico' : 'Quantidade'}</span>
        <Input required value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" maxLength={15} placeholder="0,0000" /></label>
      <label className="space-y-2 text-sm font-medium sm:col-span-2"><span>Motivo / referência</span>
        <Input required minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: recebimento da NF 1234" /></label>
      {error && <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button className="sm:col-span-2 sm:w-fit" disabled={busy || !productId || !warehouseId}>{busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}Confirmar {movementLabels[type].toLowerCase()}</Button>
    </form>
  </Card>;
}

function TransferForm({ options, onDone }) {
  const [form, setForm] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', reason: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [warehouseName, setWarehouseName] = useState(''); const [warehouseBusy, setWarehouseBusy] = useState(false); const [warehouseError, setWarehouseError] = useState('');
  const warehouseOptions = options.warehouses.map((item) => ({ id: item.id, label: item.name }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.transfer({ ...form, quantity: form.quantity.replace(',', '.') }); setForm({ ...form, quantity: '', reason: '' }); onDone('Transferência concluída nos dois depósitos.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function createWarehouse(event) {
    event.preventDefault(); setWarehouseBusy(true); setWarehouseError('');
    try { await api.createWarehouse(warehouseName); setWarehouseName(''); onDone('Depósito cadastrado. As transferências já estão habilitadas.'); }
    catch (failure) { setWarehouseError(failure.message); } finally { setWarehouseBusy(false); }
  }
  return <Card className="p-5 transition-shadow duration-200 hover:shadow-sm">
    <div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><ArrowRightLeft className="size-5" /></span>
      <div><h2 className="font-semibold">Transferir entre depósitos</h2><p className="text-sm text-muted-foreground">A saída e a entrada são confirmadas juntas.</p></div></div>
    {options.warehouses.length < 2 ? <Alert><AlertDescription>Cadastre um segundo depósito abaixo para habilitar transferências.</AlertDescription></Alert>
      : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium sm:col-span-2"><span>Produto</span><OptionSelect value={form.productId} onValueChange={(value) => setForm({ ...form, productId: value })}
          label="Produto da transferência" placeholder="Selecione" disabled={busy} options={options.products.map((item) => ({ id: item.id, label: `${item.sku} · ${item.name}` }))} /></label>
        <label className="space-y-2 text-sm font-medium"><span>Origem</span><OptionSelect value={form.fromWarehouseId} onValueChange={(value) => setForm({ ...form, fromWarehouseId: value })} label="Depósito de origem" placeholder="Selecione" disabled={busy} options={warehouseOptions} /></label>
        <label className="space-y-2 text-sm font-medium"><span>Destino</span><OptionSelect value={form.toWarehouseId} onValueChange={(value) => setForm({ ...form, toWarehouseId: value })} label="Depósito de destino" placeholder="Selecione" disabled={busy} options={warehouseOptions} /></label>
        <label className="space-y-2 text-sm font-medium"><span>Quantidade</span><Input required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} inputMode="decimal" /></label>
        <label className="space-y-2 text-sm font-medium"><span>Motivo</span><Input required minLength={3} maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
        {error && <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button className="sm:col-span-2 sm:w-fit" disabled={busy || !form.productId || !form.fromWarehouseId || !form.toWarehouseId || form.fromWarehouseId === form.toWarehouseId}>{busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}Confirmar transferência</Button>
      </form>}
    {warehouseError && <Alert variant="destructive"><AlertDescription>{warehouseError}</AlertDescription></Alert>}
    <form onSubmit={createWarehouse} className="mt-auto flex flex-wrap items-end gap-2 border-t pt-4">
      <label className="min-w-48 flex-1 space-y-2 text-sm font-medium"><span>Novo depósito</span><Input required minLength={2} maxLength={120} value={warehouseName}
        onChange={(event) => setWarehouseName(event.target.value)} placeholder="Ex.: Loja Centro" disabled={warehouseBusy} /></label>
      <Button type="submit" variant="outline" disabled={warehouseBusy}>{warehouseBusy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}Adicionar depósito</Button>
    </form>
  </Card>;
}

export function StockManagement({ user }) {
  const [options, setOptions] = useState(null); const [levels, setLevels] = useState(null); const [movements, setMovements] = useState(null);
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [warehouseId, setWarehouseId] = useState('all');
  const [revision, setRevision] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ search, pageSize: '100' }); if (warehouseId !== 'all') params.set('warehouseId', warehouseId);
    Promise.all([api.options(), api.levels(params), api.movements('pageSize=30')]).then(([nextOptions, nextLevels, nextMovements]) => {
      if (active) { setOptions(nextOptions); setLevels(nextLevels); setMovements(nextMovements); setError(''); }
    }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, warehouseId, revision]);
  function done(message) { setNotice(message); setLoading(true); setRevision((value) => value + 1); }
  const admin = user.role === 'admin';
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><Boxes className="size-4" />ESTOQUE</div>
      <h1 className="text-3xl font-semibold tracking-tight">Movimentações e saldos</h1><p className="mt-2 text-muted-foreground">Controle manual com depósito simulado para a base pública UCI.</p></div>
      <Button variant="outline" asChild><Link href="/produtos">Gerenciar produtos</Link></Button></header>
    {!admin && <Alert><AlertDescription>Seu acesso é somente para consulta. Movimentações exigem papel de administrador.</AlertDescription></Alert>}
    {notice && <Alert role="status"><AlertDescription>{notice}</AlertDescription></Alert>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {admin && options && <section className="grid gap-5 lg:grid-cols-2"><MovementForm options={options} onDone={done} /><TransferForm options={options} onDone={done} /></section>}
    <Card className="gap-0 overflow-hidden"><div className="flex flex-wrap gap-3 border-b p-4"><form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setLoading(true); setSearch(query); }}>
      <Input aria-label="Buscar saldo por produto" placeholder="Buscar produto ou SKU" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} /><Button type="submit" variant="outline" aria-label="Buscar saldos"><Search className="size-4" /></Button></form>
      <Select value={warehouseId} onValueChange={(value) => { setLoading(true); setWarehouseId(value); }}><SelectTrigger aria-label="Filtrar depósito"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os depósitos</SelectItem>{options?.warehouses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="overflow-x-auto">{loading ? <div className="space-y-3 p-5" aria-label="Carregando saldos">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>
        : !levels?.data.length ? <p className="p-10 text-center text-muted-foreground">Nenhum saldo encontrado.</p>
          : <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Depósito</TableHead><TableHead className="text-right">Físico</TableHead><TableHead className="text-right">Reservado</TableHead><TableHead className="text-right">Disponível</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
            <TableBody>{levels.data.map((level) => { const low = Number(level.available) <= Number(level.minimumStock); return <TableRow key={`${level.productId}-${level.warehouseId}`}><TableCell><strong>{level.productName}</strong><small className="block text-muted-foreground">{level.sku} · {level.unit}</small></TableCell><TableCell>{level.warehouseName}</TableCell><TableCell className="text-right">{decimal.format(Number(level.onHand))}</TableCell><TableCell className="text-right">{decimal.format(Number(level.reserved))}</TableCell><TableCell className="text-right font-medium">{decimal.format(Number(level.available))}</TableCell><TableCell><Badge variant={low ? 'destructive' : 'secondary'}>{low ? 'Reposição' : 'Saudável'}</Badge></TableCell></TableRow>; })}</TableBody></Table>}</div>
    </Card>
    <Card className="gap-0 overflow-hidden"><div className="border-b p-4"><h2 className="font-semibold">Histórico recente</h2><p className="text-sm text-muted-foreground">Operações manuais e futuras sincronizações aparecem na mesma trilha.</p></div>
      <div className="overflow-x-auto">{loading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</div>
        : !movements?.data.length ? <p className="p-10 text-center text-muted-foreground">Ainda não há movimentações.</p>
          : <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Operação</TableHead><TableHead>Produto</TableHead><TableHead>Depósito</TableHead><TableHead className="text-right">Variação</TableHead><TableHead>Motivo</TableHead><TableHead>Responsável</TableHead></TableRow></TableHeader>
            <TableBody>{movements.data.map((movement) => <TableRow key={movement.id}><TableCell>{dateTime.format(new Date(movement.occurredAt))}</TableCell><TableCell><Badge variant="outline">{movementLabels[movement.type] || movement.type}</Badge></TableCell><TableCell><strong>{movement.productName}</strong><small className="block text-muted-foreground">{movement.sku}</small></TableCell><TableCell>{movement.warehouseName}</TableCell><TableCell className={`text-right font-medium ${Number(movement.quantityDelta) > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{Number(movement.quantityDelta) > 0 ? '+' : ''}{decimal.format(Number(movement.quantityDelta))}</TableCell><TableCell className="max-w-56 whitespace-normal">{movement.reason}</TableCell><TableCell>{movement.actorName || 'Integração'}</TableCell></TableRow>)}</TableBody></Table>}</div>
    </Card>
  </main>;
}
