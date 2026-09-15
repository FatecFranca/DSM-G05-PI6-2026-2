# Catálogo de produtos e futura integração Bling

## Decisão atual

Enquanto não há uma conta Bling disponível, o catálogo aceita cadastro manual e importação CSV. A API do Bling usa REST, JSON e OAuth 2.0; por isso a aplicação mantém regras de negócio e persistência independentes do provedor. Quando a integração for autorizada, um adaptador `BlingProductSource` poderá produzir o mesmo `ProductInput` usado pelo cadastro e pelo CSV.

O identificador UUID do produto é interno e permanente. IDs do Bling ou de outros ERPs ficam em `product_external_links`, identificados por provedor e conta. A futura sincronização não deve unir produtos automaticamente apenas pelo SKU, pois um SKU pode ter sido reutilizado ou alterado no sistema de origem.

## Recursos entregues

- consulta autenticada, busca por nome/SKU, filtro de situação e paginação;
- cadastro, edição e inativação por administradores;
- controle otimista pela coluna `version`, impedindo sobrescrita silenciosa;
- importação de até 100 novos produtos e 100 KB por CSV, com prévia;
- transação única: qualquer SKU conflitante desfaz produtos, auditoria e eventos do lote;
- auditoria e eventos `product.created` / `product.updated` na outbox;
- origem registrada como `manual`, `csv`, `legacy` ou, futuramente, `bling`.

Saldo não pertence ao cadastro do produto. Quantidade disponível, reservas e movimentações permanecem nas tabelas de estoque e serão implementadas em uma etapa própria.

## CSV

Use `apps/web/public/modelo-produtos.csv`, codificação UTF-8 e separador `;`. Campos:

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `sku` | sim | único, até 60 caracteres; letras são normalizadas para maiúsculas |
| `name` | sim | 2 a 200 caracteres |
| `unit` | não | padrão `UN`, até 6 caracteres |
| `costPrice`, `salePrice`, `minimumStock` | não | não negativos, até 4 casas; ponto ou vírgula no CSV |
| `leadTimeDays` | não | inteiro de 0 a 3650 |
| `active` | não | `true` ou `false` |
| `description` | não | até 2000 caracteres |

O CSV não aceita saldo, ID externo ou campos desconhecidos. A importação atual insere produtos; ela não atualiza registros existentes.

## Permissão inicial

Novas contas têm perfil de consulta (`viewer`). Depois de cadastrar a pessoa responsável pelo catálogo, promova-a localmente:

```powershell
npm run user:promote -- --email pessoa@example.com
```

O comando utiliza consultas parametrizadas e não recebe senha. Em produção, essa operação deverá ficar em um fluxo administrativo auditado.

## Próxima integração

O adaptador do Bling deverá implementar OAuth 2.0, armazenar tokens cifrados em serviço de segredos, respeitar paginação e limites da API, renovar tokens, registrar `sync_runs`, validar cada registro e fazer upsert pelos vínculos de `product_external_links`. Chamadas HTTP externas devem ocorrer fora das transações do PostgreSQL.
