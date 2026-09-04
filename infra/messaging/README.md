# Contratos de mensageria

O arquivo `inventory_events.proto` define o envelope comum e os payloads v1 usados no Google Pub/Sub.

## Convenções

- tópicos: `inventory.<evento>.v1`;
- `message_id`: UUID gerado uma única vez pelo produtor;
- `correlation_id`: UUID preservado durante todo o fluxo distribuído;
- instantes: UTC no tipo `google.protobuf.Timestamp`;
- somente adicionar campos na mesma versão; remoções ou mudanças incompatíveis exigem novo tópico/schema;
- consumidores devem validar o esquema, processar de forma idempotente e confirmar apenas depois do commit;
- payloads não carregam tokens nem dados pessoais.

## Transporte

As bibliotecas internas usam gRPC/HTTP autenticado para publicar e consumir. Assinaturas push, quando utilizadas com Cloud Run, usam HTTPS. O ambiente local usará o emulador oficial do Pub/Sub para testes de integração.

## Falhas

Cada assinatura recebe política de retentativa e tópico `inventory.dead-letter.v1`. O reprocessamento da DLQ deve preservar `message_id`, `correlation_id` e payload original, além de registrar o operador e o motivo.
