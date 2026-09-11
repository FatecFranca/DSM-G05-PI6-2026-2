# Estoque Inteligente — PI 6º semestre

Projeto interdisciplinar do Grupo 05 de DSM para gestão inteligente de estoque, classificação de produtos e previsão de demanda a partir de dados históricos do Bling.

> **Situação atual:** Web com cadastro, login, recuperação e troca de senha,
> conectado à API e ao PostgreSQL. A API exige sessão para dados de estoque;
> o Flutter ainda precisa integrar autenticação. A carga atual é um seed técnico;
> nenhuma credencial ou dado real do Bling está versionado.

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
  mobile/    aplicativo Flutter para dispositivos móveis e desktop
  web/       dashboard Next.js
docs/        documentação acadêmica, diagramas e decisões
infra/
  database/  modelo físico inicial PostgreSQL
  messaging/ contratos Protobuf dos eventos distribuídos
```

Os clientes estão separados da API para que Web, Mobile e Desktop compartilhem as mesmas regras de negócio. Mobile e Desktop usam uma base Flutter adaptativa; o Web usa Next.js. A rotina de mineração será executada em jobs Python independentes e persistirá somente os resultados versionados que a API precisa consultar.

## Executar localmente

Pré-requisitos: Node.js 22 ou superior, npm 10 ou superior, PostgreSQL 18 e Flutter 3.41 ou superior.

```bash
npm install
npm run db:setup
npm run dev
```

A instância local deste computador usa `127.0.0.1:5433`, banco
`estoque_inteligente` e usuário `estoque_app`. A senha fica apenas em
`apps/api/.env`, ignorado pelo Git. Os comandos `npm run db:start` e
`npm run db:stop` controlam a instância isolada do projeto.

- Web: `http://localhost:3000`
- API: `http://localhost:3333`
- Documentação OpenAPI: `http://localhost:3333/docs`

Crie sua conta em `http://localhost:3000/cadastro`. Detalhes de segurança, testes
e recuperação de senha local: [Autenticação](docs/08-autenticacao.md).

Também é possível iniciar os projetos separadamente:

```bash
npm run dev:web
npm run dev:api
npm run mobile
npm run desktop
```

## Validação

```bash
npm run lint
npm run test
npm run build
```

## Equipe

| Integrante |
| --- |
| Vitor Siqueira Simeão |
| Uriel Monte Paz de Araújo |
| Gabriel Aleixo |
| Dimerson Ferreira |

## Política de dados

Antes de importar o ambiente de produção, o grupo deverá obter autorização do responsável pelos dados, criar credenciais exclusivas de leitura, remover dados pessoais desnecessários e executar uma carga piloto anonimizada. Tokens do Bling e segredos de nuvem devem permanecer apenas no gerenciador de segredos e nos arquivos locais ignorados pelo Git.
