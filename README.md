# Estoque Inteligente — PI 6º semestre

Projeto interdisciplinar do Grupo 05 de DSM para gestão inteligente de estoque, classificação de produtos e previsão de demanda a partir de uma base pública versionada.

> **Situação atual:** Web e Flutter (mobile/desktop) conectados à API e ao
> PostgreSQL, com autenticação, catálogo, saldos e movimentações. A base oficial
> do projeto é a **UCI Online Retail II**, licenciada sob CC BY 4.0. O pipeline
> reproduzível carrega mais de um milhão de linhas, classifica ABC/XYZ, agrupa
> produtos e publica previsões versionadas. Nenhum dado pessoal da fonte é salvo.

## Entregas da 1ª sprint

| Entrega mínima | Evidência no repositório |
| --- | --- |
| Escopo e requisitos | [`docs/01-escopo-e-requisitos.md`](docs/01-escopo-e-requisitos.md) |
| Alinhamento com as disciplinas | [`docs/00-alinhamento-academico.md`](docs/00-alinhamento-academico.md) |
| Casos de uso e arquitetura | [`docs/02-modelagem-e-arquitetura.md`](docs/02-modelagem-e-arquitetura.md) |
| Repositório do grupo | Este repositório GitHub, com histórico compartilhado |
| Back-end e API configurada | [`apps/api`](apps/api) — Node.js, Fastify, OpenAPI e testes |
| Protótipo do front-end | [`apps/web`](apps/web) — Next.js, JavaScript, shadcn/ui e Recharts |
| Banco conceitual e lógico | [`docs/03-banco-de-dados.md`](docs/03-banco-de-dados.md) e [`infra/database/schema.sql`](infra/database/schema.sql) |
| Serviços de nuvem | [`docs/04-computacao-em-nuvem.md`](docs/04-computacao-em-nuvem.md) |
| Base e técnicas de mineração | [`docs/05-mineracao-de-dados.md`](docs/05-mineracao-de-dados.md) |
| Aplicativos móvel e desktop | [`apps/mobile`](apps/mobile) — Flutter adaptativo conectado à API, com dashboard, produtos e alertas |
| Decisão sobre desktop | [`docs/decisions/ADR-001-plataforma-desktop.md`](docs/decisions/ADR-001-plataforma-desktop.md) |
| TDD e testes | [`docs/06-estrategia-de-testes.md`](docs/06-estrategia-de-testes.md) |
| Versionamento e colaboração | [`docs/07-versionamento-e-colaboracao.md`](docs/07-versionamento-e-colaboracao.md) |

## Arquitetura do repositório

```text
apps/
  api/       API REST Node.js/Fastify
  ml/        ingestão, qualidade e modelos Python/scikit-learn
  mobile/    aplicativo Flutter para dispositivos móveis e desktop
  web/       dashboard Next.js
docs/        documentação acadêmica, diagramas e decisões
infra/
  database/  PostgreSQL operacional e fatos analíticos particionados
  messaging/ contratos Protobuf dos eventos distribuídos
```

Os clientes estão separados da API para que Web, Mobile e Desktop compartilhem as mesmas regras de negócio. Mobile e Desktop usam uma base Flutter adaptativa; o Web usa Next.js. Os jobs Python mantêm linhagem por hash, métricas e artefatos; a API consulta apenas resultados publicados no PostgreSQL.

## Executar localmente

Para preparar uma máquina do zero, siga o guia completo de
[primeira execução](docs/11-primeira-execucao.md).

Pré-requisitos: Node.js 22 ou superior, npm 10 ou superior, Python 3.12, PostgreSQL 18 e Flutter 3.41 ou superior.

```bash
npm install
npm run db:start
npm run db:migrate
py -m venv .venv
npm run ml:setup
npm run data:setup
npm run dev
```

A instância local deste computador usa `127.0.0.1:5433`, banco
`estoque_inteligente` e usuário `estoque_app`. A senha fica apenas em
`apps/api/.env`, ignorado pelo Git. Os comandos `npm run db:start` e
`npm run db:stop` controlam a instância isolada do projeto.

- Web: `http://localhost:3000`
- API: `http://localhost:3333`
- Documentação OpenAPI: `http://localhost:3333/docs`

Crie sua conta em `http://localhost:3000/cadastro`. Detalhes: [Autenticação](docs/08-autenticacao.md),
[Catálogo](docs/09-catalogo-produtos.md) e [Movimentações de estoque](docs/10-movimentacoes-estoque.md).

Também é possível iniciar os projetos separadamente:

```bash
npm run dev:web
npm run dev:api
npm run mobile
npm run desktop
```

`npm run data:setup` baixa a base diretamente da UCI, valida o SHA-256,
desidentifica a carga e treina os modelos. Download, planilha e artefatos são
ignorados pelo Git. A carga pode ser repetida sem duplicar registros.

O conjunto de vendas não fornece estoque físico. Para demonstrar as regras de
movimentação, o pipeline cria o depósito claramente identificado como
`Depósito simulado (UCI)` e calcula uma posição inicial reproduzível. Valores
monetários da base são exibidos em GBP, sem mistura silenciosa de moedas.

Para executar a publicação assíncrona, configure credenciais do Google Cloud ou
o emulador do Pub/Sub, defina `MESSAGING_MODE=google-pubsub` e execute:

```bash
npm run worker:outbox
```

## Validação

Veja também a [interface e identidade visual](docs/12-interface-e-identidade.md)
para temas, navegação e critérios de validação do frontend.

```bash
npm run lint
npm run test
npm run test:ml
npm run build
```

## Equipe

| Integrante |
| --- |
| Vitor Siqueira Simeão |
| Uriel Monte Paz de Araújo |
| Gabriel Aleixo |
| Dimerson Ferreira |

## Fonte e política de dados

A [UCI Online Retail II](https://doi.org/10.24432/C5CG6D) é distribuída sob
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), permitindo adaptação
e uso comercial com atribuição. O projeto não persiste o campo `Customer ID`.
Arquivos brutos, credenciais, e-mails e artefatos de modelo permanecem fora do
Git; em nuvem, segredos ficam no Secret Manager e dados grandes no Object Storage.
