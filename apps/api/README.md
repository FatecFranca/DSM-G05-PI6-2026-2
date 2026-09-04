# API

API REST inicial em Node.js e Fastify. Nesta sprint, as rotas de leitura usam dados demonstrativos compatíveis com o domínio planejado.

```bash
npm run dev --workspace=@estoque-inteligente/api
```

- Base: `http://localhost:3333`
- OpenAPI: `http://localhost:3333/docs`
- Saúde: `http://localhost:3333/health`

Copie `.env.example` para `.env` apenas quando precisar alterar a configuração local. O próximo passo de implementação é substituir o módulo `src/data/demo-data.js` por repositórios PostgreSQL e criar o adaptador autorizado do Bling.
