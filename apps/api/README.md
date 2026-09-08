# API

API REST em Node.js, TypeScript e Fastify, organizada em domínio, aplicação,
infraestrutura e apresentação. O PostgreSQL é acessado por um pool e por um
repositório injetado nos serviços.

```bash
npm run db:setup
npm run dev --workspace=@estoque-inteligente/api
```

- Base: `http://localhost:3333`
- OpenAPI: `http://localhost:3333/docs`
- Saúde e banco: `http://localhost:3333/health`

As credenciais locais ficam em `.env`, ignorado pelo Git. O arquivo
`.env.example` serve apenas de modelo. Os testes usam um repositório em
memória que implementa o mesmo contrato da infraestrutura PostgreSQL.
