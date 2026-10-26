# Mensageria na Azure

## Decisão

O transporte de eventos do estoque será o **Azure Service Bus**, mantendo o
envelope Protobuf e o padrão Transactional Outbox já implementados. O banco
confirma a movimentação e grava o evento na mesma transação; o worker publica
depois, sem perder o evento quando o Service Bus estiver temporariamente
indisponível.

O adaptador está em
[`apps/api/src/infrastructure/messaging/outbox-worker.ts`](../apps/api/src/infrastructure/messaging/outbox-worker.ts)
e é selecionado por configuração:

```env
MESSAGING_MODE=azure-service-bus
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...
AZURE_SERVICE_BUS_TOPIC=inventory-domain-events
```

Em uma VM Azure, a recomendação é substituir a connection string por
identidade gerenciada e informar apenas o namespace:

```env
MESSAGING_MODE=azure-service-bus
AZURE_SERVICE_BUS_NAMESPACE=sb-estoque-inteligente.servicebus.windows.net
AZURE_SERVICE_BUS_TOPIC=inventory-domain-events
```

Atribua à aplicação a permissão **Azure Service Bus Data Sender** no namespace.
A connection string fica restrita ao ambiente local de desenvolvimento e nunca
deve ser versionada.

## Infraestrutura reproduzível

O arquivo [`infra/azure/service-bus.bicep`](../infra/azure/service-bus.bicep)
cria um namespace Standard, um tópico e uma assinatura de consumo. O tópico
habilita detecção de duplicatas por 1 dia; a assinatura mantém mensagens por 14
dias e envia mensagens expiradas para a DLQ.

Exemplo de implantação, depois de criar o grupo de recursos:

```powershell
az deployment group create `
  --resource-group rg-estoque-inteligente `
  --template-file infra/azure/service-bus.bicep `
  --parameters namespaceName=sb-estoque-inteligente topicName=inventory-domain-events
```

Para desenvolvimento local, mantenha `MESSAGING_MODE=disabled`. Para testar o
worker contra a Azure, configure os valores somente no `apps/api/.env`, execute
`npm run worker:outbox` e monitore a assinatura no Service Bus Explorer.

## Contrato e confiabilidade

Cada mensagem contém `messageId`, `correlationId`, tipo do evento, versão,
instante UTC e o payload Protobuf. O `messageId` é o UUID da linha da outbox;
isso permite retentativa segura. Os consumidores devem continuar idempotentes,
pois a entrega é pelo menos uma vez. Falhas persistentes devem ser
inspecionadas na dead-letter queue antes de reprocessar.

Eventos publicados pelo estoque:

- `stock.entry`;
- `stock.exit`;
- `stock.adjustment`;
- `stock.transferred`;
- `product.created` e `product.updated`.

## Segurança e custo

- usar o SKU Standard para duplicação e DLQ; o SKU Basic não oferece detecção
  de duplicatas;
- restringir a rede pública quando a VM e os consumidores estiverem em uma
  VNet privada;
- usar identidade gerenciada na VM, com menor privilégio;
- criar alertas de backlog, mensagens na DLQ, falhas de publicação e custo;
- aplicar TTL e retenção compatíveis com a política do projeto.

Referências: [SDK JavaScript do Azure Service Bus](https://learn.microsoft.com/en-us/javascript/api/overview/azure/service-bus),
[detecção de mensagens duplicadas](https://learn.microsoft.com/en-us/azure/service-bus-messaging/enable-duplicate-detection)
e [dead-letter queues](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues).
