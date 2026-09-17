# Catálogo de produtos e carga pública

## Decisão atual

O catálogo aceita cadastro manual, importação CSV e carga da UCI Online Retail II. As regras de negócio e a persistência continuam independentes da fonte; a planilha é tratada apenas pelo job Python de ingestão.

O identificador UUID do produto é interno e permanente. Códigos da UCI recebem vínculo estável pelo `external_id` prefixado com a versão da fonte. Uma integração futura com outro sistema deve usar vínculos próprios e não unir produtos automaticamente apenas pelo SKU.

## Recursos entregues

- consulta autenticada, busca por nome/SKU, filtro de situação e paginação;
- cadastro, edição e inativação por administradores;
- controle otimista pela coluna `version`, impedindo sobrescrita silenciosa;
- importação de até 100 novos produtos e 100 KB por CSV, com prévia;
- transação única: qualquer SKU conflitante desfaz produtos, auditoria e eventos do lote;
- auditoria e eventos `product.created` / `product.updated` na outbox;
- origem registrada como `manual`, `csv`, `legacy` ou `uci_online_retail`.

Saldo não pertence ao cadastro do produto. Quantidade disponível, reservas e movimentações permanecem nas tabelas de estoque e estão documentadas em [Movimentações de estoque](10-movimentacoes-estoque.md).

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

## Extensibilidade

Novas fontes deverão implementar validação, paginação quando aplicável, `sync_runs`, idempotência e upsert por vínculo de origem. Chamadas HTTP externas devem ocorrer fora das transações do PostgreSQL.
