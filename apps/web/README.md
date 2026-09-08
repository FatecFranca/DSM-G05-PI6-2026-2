# Front-end web

Dashboard responsivo construído com Next.js App Router, JavaScript, shadcn/ui,
Lucide, Recharts e SWR.

```bash
npm run dev --workspace=@estoque-inteligente/web
```

A camada `DashboardApiClient` consome a API configurada por
`NEXT_PUBLIC_API_URL`, com cache, revalidação, carregamento e falha. Os
componentes shadcn ficam versionados em `src/components/ui`.
