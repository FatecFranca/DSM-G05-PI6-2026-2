import { readFile, writeFile } from 'node:fs/promises';

const shots = [
  ['01-login', '01 · Tela de login', 'APROVADO', 'A página /login carregou o formulário de acesso no navegador real.'],
  ['02-senha-invalida', '02 · Rejeição de senha incorreta', 'APROVADO', 'O envio do formulário retornou HTTP 401 e a mensagem “E-mail ou senha incorretos.”. A senha permanece mascarada.'],
  ['03-dashboard-falha', '03 · Login válido → dashboard', 'PARCIAL / FALHA', 'O login retornou HTTP 200 e redirecionou para /. A sessão autenticada foi aceita, mas a renderização do dashboard falhou.'],
];
const sections = await Promise.all(shots.map(async ([file, title, status, description]) => {
  const image = await readFile(new URL(`${file}.png`, import.meta.url));
  return `<section><h2>${title}</h2><p class="status">${status}</p><p>${description}</p><img alt="${title}" src="data:image/png;base64,${image.toString('base64')}"></section>`;
}));
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sprint 2 — evidências de teste</title><style>
*{box-sizing:border-box}body{font:16px/1.6 system-ui,sans-serif;color:#192339;background:#f3f5fa;margin:0}main{max-width:1200px;margin:auto;padding:40px 24px}h1,h2{line-height:1.2}h1{font-size:34px}h2{margin-top:0}.meta{color:#536078}.notice{border-left:5px solid #d88616;background:#fff3dd;padding:20px}section{background:white;padding:24px;border:1px solid #d9dfeb;border-radius:12px;margin:28px 0;break-inside:avoid}img{display:block;width:100%;height:auto;border:1px solid #dde2ec}.status{font-weight:700}code{overflow-wrap:anywhere}li{margin:8px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #d9dfeb}@media print{body{background:white}main{padding:0}section{break-before:page;border:0;padding:0}img{max-height:220mm;object-fit:contain}h1{font-size:26px}}
</style><main><h1>Estoque Inteligente — evidências de teste</h1><p class="meta">Sprint 2 · Execução em 13/10/2026 · Ambiente local · Microsoft Edge headless / Playwright · 1440 × 1000</p>
<div class="notice"><strong>Resultado parcial: entrega ainda não aprovada.</strong><br>Foi encontrada uma falha bloqueante na primeira jornada após a autenticação. Os testes ponta a ponta foram interrompidos nesse ponto. Este documento contém prints reais, sem simulação de sucesso.</div>
<h2>Resumo da execução</h2><table><thead><tr><th>Verificação</th><th>Resultado</th></tr></thead><tbody>
<tr><td>API /health e PostgreSQL local</td><td>HTTP 200; database: connected</td></tr>
<tr><td>Criação de conta exclusiva de teste pela API</td><td>HTTP 201; preparação de cenário, não teste da tela de cadastro</td></tr>
<tr><td>Formulário de login e senha inválida</td><td>Aprovados</td></tr>
<tr><td>Login com credenciais válidas</td><td>HTTP 200 e redirecionamento para /</td></tr>
<tr><td>GET /api/v1/dashboard/summary com sessão</td><td>HTTP 200; meta, kpis, demandSeries, classifications e riskProducts presentes</td></tr>
<tr><td>Dashboard no navegador</td><td>Reprovado: erro de renderização</td></tr>
<tr><td>Produtos, estoque, inteligência, logout e recuperação de senha</td><td>Não executados nesta rodada de testes ponta a ponta</td></tr>
</tbody></table>
<h2>Falha identificada</h2><p><code>apps/web/src/components/dashboard.jsx:265</code>: <code>TypeError: Cannot read properties of undefined (reading 'meta')</code>.</p><p>O componente acessa <code>summary.meta.demo</code> enquanto <code>summaryRequest.data</code> ainda está indefinido, antes da proteção que renderiza o skeleton. A consulta autenticada ao endpoint respondeu corretamente; o primeiro limite quebrado é a renderização do front-end durante o carregamento.</p><p><strong>Correção proposta, não aplicada nesta execução:</strong> proteger o bloco de contexto com uma condição de disponibilidade de <code>summary</code> e validar o estado inicial sem dados. Depois, repetir login → dashboard e prosseguir nas demais jornadas.</p>
<h2>Escopo e ressalvas</h2><ul><li>Os prints abaixo foram capturados diretamente da aplicação local. Não foram alterados para ocultar erros ou representar resultados inexistentes.</li><li>A conta temporária foi criada exclusivamente para a evidência e desativada ao encerrar; sua sessão foi expirada. Nenhum produto ou movimento de estoque foi criado nesta rodada.</li><li>A base retornada pelo dashboard é simulada em BRL, com histórico até 19/09/2026. Isso não demonstra previsão validada para dados reais nem atualização até a data desta execução.</li><li>Não foram validados envio real de e-mail, Flutter mobile/desktop, implantação Azure ou entrega de mensagens pelo broker.</li><li>O ambiente apresentou aviso de indisponibilidade do Google Fonts e utilizou fonte alternativa. Isso é distinto do erro bloqueante do dashboard.</li><li>O código da aplicação não foi corrigido nesta rodada. Resultados anteriores de testes automatizados não substituem a validação visual atual.</li></ul>
${sections.join('\n')}<p>Arquivo autocontido: as imagens estão incorporadas. Abra no navegador e use Imprimir → Salvar como PDF, se necessário.</p></main></html>`;
await writeFile(new URL('relatorio-jornadas.html', import.meta.url), html);
console.log('Relatório HTML gerado com 3 capturas reais.');
