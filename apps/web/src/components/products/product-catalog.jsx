'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, LoaderCircle, PackageSearch, Plus, Search } from 'lucide-react';
import { AccountMenu } from '@/components/auth/account-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductApiClient } from '@/services/product-api-client';

const api = new ProductApiClient();
const empty = { sku: '', name: '', description: '', unit: 'UN', costPrice: '0', salePrice: '0', minimumStock: '0', leadTimeDays: 0, active: true };
const labels = { sku: 'SKU / código', name: 'Nome', unit: 'Unidade', costPrice: 'Custo (R$)', salePrice: 'Preço de venda (R$)', minimumStock: 'Estoque mínimo', leadTimeDays: 'Prazo de reposição (dias)' };
const sources = { manual: 'Manual', csv: 'CSV', legacy: 'Base inicial', bling: 'Bling' };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function ProductEditor({ product, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(Object.keys(empty).map((key) => [key, product?.[key] ?? empty[key]])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const values = { ...form, leadTimeDays: Number(form.leadTimeDays) };
      for (const key of ['costPrice', 'salePrice', 'minimumStock']) values[key] = String(values[key]).replace(',', '.');
      await api.save(values, product?.id, product?.version);
      onSaved();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <Card className="p-6" id="product-editor">
    <h2 className="text-xl font-semibold">{product?.id ? 'Editar produto' : 'Novo produto'}</h2>
    <p className="text-sm text-muted-foreground">O cadastro não altera o saldo de estoque. Inativar preserva o histórico.</p>
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        {Object.entries(labels).map(([key, label]) => <label key={key} className="space-y-2 text-sm font-medium">
          <span>{label}</span>
          <Input required autoFocus={key === 'sku'} value={form[key]} maxLength={key === 'name' ? 200 : key === 'sku' ? 60 : key === 'unit' ? 6 : 16}
            type={key === 'leadTimeDays' ? 'number' : 'text'} min={key === 'leadTimeDays' ? 0 : undefined} max={key === 'leadTimeDays' ? 3650 : undefined}
            inputMode={['costPrice', 'salePrice', 'minimumStock'].includes(key) ? 'decimal' : undefined}
            onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
        </label>)}
        <label className="space-y-2 text-sm font-medium"><span>Situação</span>
          <Select value={String(form.active)} onValueChange={(value) => setForm({ ...form, active: value === 'true' })} disabled={busy}>
            <SelectTrigger className="w-full" aria-label="Situação do produto"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent>
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2"><span>Descrição</span>
          <Input maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
      </fieldset>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}Salvar produto</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button></div>
    </form>
  </Card>;
}

function CsvImporter({ onImported }) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);
  async function readFile(event) {
    setCsv(''); setPreview(null); setMessage('');
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 100000) { setMessage('Escolha um CSV com até 100 KB.'); return; }
    setBusy(true);
    try { setCsv(await file.text()); } catch { setMessage('Não foi possível ler o arquivo.'); }
    finally { setBusy(false); }
  }
  async function send(isPreview) {
    setBusy(true); setMessage('');
    try {
      const result = await api.import(csv, isPreview);
      if (isPreview) setPreview(result);
      else {
        setMessage(`${result.total} produtos importados.`); setPreview(null); setCsv('');
        if (fileInput.current) fileInput.current.value = '';
        onImported();
      }
    } catch (failure) { setMessage(failure.message); }
    finally { setBusy(false); }
  }
  return <Card className="p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Importação CSV</h2>
      <Button variant="outline" asChild><a href="/modelo-produtos.csv" download><Download className="size-4" />Baixar modelo</a></Button></div>
    <p className="text-sm text-muted-foreground">Até 100 novos produtos / 100 KB. Separador ponto e vírgula. SKUs existentes não serão sobrescritos.</p>
    <label className="space-y-2 text-sm"><span>Arquivo de produtos</span><Input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy} onChange={readFile} /></label>
    <Button variant="outline" disabled={!csv || busy} onClick={() => send(true)}>{busy && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}Validar arquivo</Button>
    {preview && <div className="space-y-3">
      <p className="text-sm">{preview.total} registros válidos. A confirmação verifica conflitos com o banco; qualquer conflito cancela o lote.</p>
      <div className="max-h-60 overflow-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Nome</TableHead></TableRow></TableHeader>
        <TableBody>{preview.data.map((p) => <TableRow key={p.sku}><TableCell>{p.sku}</TableCell><TableCell>{p.name}</TableCell></TableRow>)}</TableBody></Table></div>
      <Button disabled={busy} onClick={() => send(false)}>Confirmar importação de {preview.total} produtos</Button>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </Card>;
}

export function ProductCatalog({ user }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState('');
  const admin = user.role === 'admin';
  useEffect(() => {
    let active = true;
    api.list(new URLSearchParams({ search, status, page: String(page), pageSize: '20' })).then((data) => {
      if (active) { setResult(data); setError(''); }
    }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, status, page, revision]);
  function refresh() { setLoading(true); setRevision((value) => value + 1); }
  function edit(product) { setEditor(product); setNotice(''); }
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
    <div className="flex items-center justify-between"><Button variant="ghost" asChild><Link href="/"><ArrowLeft className="size-4" />Painel</Link></Button><AccountMenu user={user} /></div>
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><PackageSearch className="size-4" />CATÁLOGO</div>
        <h1 className="text-3xl font-semibold tracking-tight">Produtos</h1><p className="mt-2 text-muted-foreground">Organize seu catálogo, mesmo sem um ERP conectado.</p></div>
      {admin && <Button onClick={() => edit({})}><Plus className="size-4" />Novo produto</Button>}
    </header>
    {!admin && <Alert><AlertDescription>Você tem acesso de consulta. Um administrador pode cadastrar, importar e editar produtos.</AlertDescription></Alert>}
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {editor && <ProductEditor key={editor.id || 'new'} product={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Produto salvo com sucesso.'); refresh(); }} />}
    <Card className="gap-0 overflow-hidden">
      <div className="flex flex-wrap gap-3 border-b p-4">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setLoading(true); setSearch(query); setPage(1); setRevision((value) => value + 1); }}>
          <Input aria-label="Buscar por nome ou SKU" placeholder="Buscar por nome ou SKU" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} />
          <Button type="submit" variant="outline" aria-label="Buscar produtos"><Search className="size-4" /></Button>
        </form>
        <Select value={status} onValueChange={(value) => { setLoading(true); setStatus(value); setPage(1); }}>
          <SelectTrigger aria-label="Filtrar situação"><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativos</SelectItem><SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent></Select>
      </div>
      {loading ? <div className="space-y-3 p-5" aria-label="Carregando produtos">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : error ? <div className="space-y-3 p-5"><Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert><Button onClick={refresh}>Tentar novamente</Button></div>
          : !result?.data.length ? <p className="p-10 text-center text-muted-foreground">Nenhum produto encontrado. Ajuste os filtros ou cadastre um produto.</p>
            : <Table><TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Preço</TableHead><TableHead>Situação</TableHead><TableHead>Origem</TableHead>{admin && <TableHead>Ações</TableHead>}</TableRow></TableHeader>
              <TableBody>{result.data.map((p) => <TableRow key={p.id}><TableCell><div className="max-w-72 whitespace-normal break-words font-medium">{p.name}</div><span className="text-xs text-muted-foreground">{p.sku} · {p.unit}</span></TableCell>
                <TableCell>{currency.format(Number(p.salePrice))}</TableCell><TableCell><Badge variant={p.active ? 'default' : 'secondary'}>{p.active ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell>{sources[p.source] || p.source}</TableCell>{admin && <TableCell><Button variant="outline" size="sm" onClick={() => edit(p)} aria-label={`Editar ${p.name}`}>Editar</Button></TableCell>}</TableRow>)}</TableBody></Table>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
        <span>{result?.total ?? 0} produtos · Página {page}</span><div className="flex gap-2">
          <Button variant="outline" disabled={loading || page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Anterior</Button>
          <Button variant="outline" disabled={loading || page * 20 >= (result?.total ?? 0)} onClick={() => { setLoading(true); setPage(page + 1); }}>Próxima</Button>
        </div>
      </div>
    </Card>
    {admin && <CsvImporter onImported={refresh} />}
  </main>;
}
