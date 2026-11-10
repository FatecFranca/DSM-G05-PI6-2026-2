# Sprint 2 — entrega em 20/10/2026

Objetivo: versão intermediária com integrações parciais.
Auditoria iniciada em 13/10/2026. Este documento separa implementação,
validação executada e pendências; não substitui evidências reais.
Estado operacional revisado novamente em 10/11/2026.

## Matriz de entrega

| Requisito | Implementação encontrada | Evidência a apresentar |
| --- | --- | --- |
| API com CRUD básico | Fastify/TypeScript; catálogo, cadastro, atualização e inativação lógica; movimentações e transferências | Swagger, requisições autenticadas, testes e registro persistido |
| Front-end parcialmente integrado | Next.js/JavaScript; autenticação, catálogo, estoque, dashboard e inteligência | sequência de telas mostrando cadastro, consulta e alteração |
| Banco implementado e populado | PostgreSQL; migrações 001–007, UCI preservada e fonte simulada BRL | DBeaver com tabelas, contagens e consulta por dataset |
| Commits de todos os integrantes | histórico registra Gabriel, Uriel, Dímerson e Vitor; há também um commit de Alexandre a ser contextualizado pela equipe; a revisão começou com a `main` limpa e sincronizada | conferir contribuições efetivas da sprint, PRs e commits no GitHub |
| Ambiente em nuvem criado | VM Azure revisada em 10/11; Nginx, Next.js, Fastify, PostgreSQL 18, pipeline, SMTP e publicação no Service Bus externo ativos | configuração sanitizada em `17-azure-vm-sprint-2.md`; atualizar o print do portal para a nova VM |
| Coleta/tratamento e técnica de mineração | pipeline UCI; gerador sintético separado; K-Means, Random Forest e previsão temporal | origem/licença, regras, métricas, execução e resultados consultáveis |
| Documentação intermediária | documentos 01–19 e este checklist | anexar prints atuais e logs sanitizados; não incluir credenciais |

Inativação de produto é exclusão lógica: preserva relações com estoque e vendas.
Não apresentar como exclusão física. Mobile/desktop têm consultas e autenticação;
formulários administrativos permanecem no web nesta etapa.

## Roteiro de demonstração

1. Entrar como usuário autorizado; mostrar bloqueio de acesso sem autenticação.
2. Cadastrar um produto de teste em R$, consultar, editar e inativar.
3. Demonstrar entrada/saída e transferência entre depósitos; conferir histórico.
4. Mostrar dashboard e fonte de dados; diferenciar UCI original de dados simulados.
5. Exibir previsão de 7/30/90 dias e erro de validação, sem prometer acurácia real.
6. Consultar tabelas e resultados de mineração no DBeaver.
7. Mostrar os testes aprovados e PRs dos integrantes.
8. Após implantação, repetir uma jornada pela VM Azure.

## Evidências a coletar

Salvar em `docs/evidencias/sprint-2/` somente material sanitizado:

- `01-api-crud.png`: Swagger ou cliente HTTP; ocultar cookies/tokens.
- `02-web-integrado.png`: produto criado e consultado.
- `03-banco.png`: tabelas e contagens; sem tela de credenciais.
- `04-mineracao.png`: fonte, período, métricas e agrupamentos.
- `05-testes.txt`: saída dos testes com data e commit utilizado.
- `06-github.png`: PRs e contribuições reais da equipe.
- `07-azure.txt`: configuração sanitizada da nova VM já coletada; falta
  `07-azure.png` mostrando `servidor_pi_vi` ligada, sem segredos.
- `08-aplicacao-nuvem.txt`: validação técnica atualizada. O PNG existente é da
  VM anterior e deve ser substituído por Swagger e jornada autenticada no IP novo.
- `09-atualizacao-vm-2026-11-10.txt`: estado operacional atual, incluindo dados,
  SMTP e roteamento da mensageria, sem credenciais.

Os logs `05-testes.txt`, `07-azure.txt` e `08-aplicacao-nuvem.txt` foram
produzidos na auditoria de outubro e devem ser preservados como snapshots
históricos. A atualização de novembro está no arquivo `09`; `consultas.sql`
contém consultas somente leitura
para preparar os prints do banco. Os PNGs continuam sendo checklist, **não
prints já produzidos**. Não criar prints fictícios nem atribuir commits a
integrantes que não fizeram o trabalho.

Validação de 13/10/2026 no banco migrado: 25 testes de integração aprovados;
verificação da demonstração, lint web/API e typecheck aprovados; 11 testes de
mineração aprovados e 1 integração opcional ignorada. Não foi executado novo
build Flutter nem teste visual ponta a ponta nesta auditoria.

Validação na Azure em 29/10/2026: lint e build aprovados; 17 testes da API, 8 do
web e 26 integrações com PostgreSQL real aprovados; sete migrações aplicadas;
publisher e consumer do Service Bus ativos, com 2 mensagens processadas,
backlog 0 e DLQ 0; site, saúde e Swagger acessíveis externamente com HTTP 200.
O ambiente era de homologação em HTTP sem SMTP real nessa validação histórica.

Atualização operacional de 10/11/2026: código implantado no commit `35694e8`;
site, saúde e Swagger responderam HTTP 200; SMTP real foi verificado; a carga
UCI permaneceu idempotente; e todas as novas publicações da outbox passaram a
seguir para o tópico externo oficial. O consumidor da VM continua conectado à
assinatura anterior, pois a credencial externa disponível não possui `Listen`.

## Cuidados antes da entrega

- Commitar esta atualização documental após revisão e verificar a CI no GitHub.
- Confirmar todos os integrantes e distribuir tarefas reais com autoria própria.
- Guardar backup fora do Git; testar conexão após migração do banco local.
- Usar senha forte e distinta na nuvem; não reutilizar credenciais compartilhadas.
- A base simulada é estendida diariamente por timer; conferir o último job antes da demonstração.
- VM única é ambiente intermediário, não arquitetura de alta disponibilidade.

Veja [Demonstração em reais](15-demonstracao-em-reais.md) para carga/treino.

## Endpoints para evidenciar o CRUD

- `GET /api/v1/catalog/products`: consulta paginada.
- `POST /api/v1/catalog/products`: criação por administrador.
- `PUT /api/v1/catalog/products/:id`: edição com controle de versão;
  `active: false` realiza a inativação lógica.
- `POST /api/v1/catalog/import`: importação CSV com validação.
- `GET /api/v1/inventory/movements`: consulta de movimentações.
- `POST /api/v1/inventory/movements`: entrada, saída ou ajuste.
- `POST /api/v1/inventory/transfers`: transferência atômica.

Usar sessão válida e proteção CSRF nos endpoints de escrita. Consulte os testes
em `apps/api/test/` para os contratos completos; não retirar proteções para os prints.

## Referência atual dos dados

A base simulada foi atualizada até **09/11/2026**, com 261.552 registros
produto/dia e 52 produtos ativos. A UCI original preserva 1.067.371 fatos,
1.003.744 itens aceitos e 4.737 produtos em GBP. O banco possui 4.789 produtos
ao considerar as duas fontes. A demonstração publicou WAPE de 24,2461%. A
execução UCI publicou F1 de 0,818076, silhouette de 0,35838 com 2 grupos e WAPE
de 1,09163 contra baseline 1,215351. São métricas acadêmicas, não dados de uma
empresa real nem garantia de desempenho futuro.

Documentos complementares: [Azure](17-azure-vm-sprint-2.md) e
[migração PostgreSQL local](18-postgresql-pc.md).
