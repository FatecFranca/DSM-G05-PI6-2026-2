# Movimentações de estoque

## Escopo entregue

A aplicação permite consultar saldos por produto e depósito e, para administradores, registrar:

- entrada de quantidade;
- saída de quantidade;
- ajuste para o saldo contado fisicamente;
- transferência atômica entre dois depósitos.
- cadastro manual de depósitos para habilitar transferências.

O saldo disponível é calculado pelo PostgreSQL como `físico - reservado`. Saídas, ajustes e transferências não podem deixar o saldo físico abaixo da quantidade reservada. Reservas de pedidos serão implementadas em um fluxo separado.

## Consistência e concorrência

Cada movimentação executa em uma transação curta. A linha de saldo é bloqueada com `FOR UPDATE` antes da alteração; assim, duas saídas simultâneas não conseguem consumir a mesma quantidade. Nas transferências, as linhas dos depósitos são bloqueadas em ordem determinística de UUID para reduzir risco de deadlock. A saída da origem e a entrada no destino confirmam ou falham juntas.

Quantidades decimais atravessam a API como texto e são calculadas com `numeric(14,4)` no PostgreSQL. Isso evita erros de arredondamento binário do JavaScript. Consultas usam parâmetros, os corpos são validados estritamente e somente administradores podem escrever.

## Auditoria e mensageria

Na mesma transação do saldo são persistidos:

1. o registro imutável em `stock_movements`;
2. a ação em `audit_logs`;
3. um evento em `outbox_events`.

Os eventos são `stock.entry`, `stock.exit`, `stock.adjustment` e `stock.transferred`. O worker da outbox os serializa em Protocol Buffers e publica no Google Pub/Sub sem o risco de confirmar o saldo e perder o evento. As duas pernas de uma transferência compartilham o mesmo `transfer_id`.

## Origem e simulação

Movimentações locais recebem `source = manual`; cargas antigas usam `legacy` e o saldo inicial da demonstração usa `dataset`. O cliente não pode informar IDs externos nem a origem. Como a UCI não informa estoque físico, o depósito simulado é sempre identificado na interface e na documentação.

## API

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/v1/inventory/options` | autenticado |
| GET | `/api/v1/inventory/levels` | autenticado |
| GET | `/api/v1/inventory/movements` | autenticado |
| POST | `/api/v1/inventory/movements` | administrador |
| POST | `/api/v1/inventory/transfers` | administrador |
| POST | `/api/v1/inventory/warehouses` | administrador |

A tela web está em `/estoque`. Ela inclui estados de carregamento, vazio e erro, filtro por depósito, busca, formulários e histórico recente.

## Testes automatizados

Os testes cobrem validação de entrada, sessão, papel de administrador, CSRF, entrada/saída/ajuste, proteção de reservas, duas saídas concorrentes, transferência atômica, SQL injection tratado como texto, auditoria e outbox. O GitHub Actions executa a integração contra um PostgreSQL descartável.
