# Contratos de mensageria

O arquivo `inventory_events.proto` define o envelope comum e os payloads v1 usados no Google Pub/Sub.

## Convenções

- tópico operacional: `inventory-domain-events` (atributo `eventType` para filtros);
- `message_id`: UUID gerado uma única vez pelo produtor;
- `correlation_id`: UUID preservado durante todo o fluxo distribuído;
- instantes: UTC no tipo `google.protobuf.Timestamp`;
- somente adicionar campos na mesma versão; remoções ou mudanças incompatíveis exigem novo tópico/schema;
- consumidores devem validar o esquema, processar de forma idempotente e confirmar apenas depois do commit;
- payloads não carregam tokens nem dados pessoais.

## Transporte

O worker `npm run worker:outbox` lê a outbox com bloqueio concorrente, codifica o envelope em Protocol Buffers e publica pelo cliente oficial do Google Pub/Sub (gRPC/HTTP autenticado). Assinaturas push, quando utilizadas com Cloud Run, usam HTTPS. O ambiente local pode usar o emulador oficial do Pub/Sub.

## Falhas

Cada assinatura recebe política de retentativa e tópico `inventory.dead-letter.v1`. O reprocessamento da DLQ deve preservar `message_id`, `correlation_id` e payload original, além de registrar o operador e o motivo.
