import { pathToFileURL } from 'node:url';
import { DefaultAzureCredential } from '@azure/identity';
import {
  ServiceBusClient,
  type ServiceBusMessage,
  type ServiceBusReceivedMessage,
} from '@azure/service-bus';

function createClient(connectionStringOrNamespace: string) {
  return connectionStringOrNamespace.startsWith('Endpoint=')
    ? new ServiceBusClient(connectionStringOrNamespace)
    : new ServiceBusClient(connectionStringOrNamespace, new DefaultAzureCredential());
}

function positiveLimit(value: string | undefined) {
  const parsed = Number(value ?? 20);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error('--limit deve ser um inteiro entre 1 e 100.');
  }
  return parsed;
}

function metadata(message: ServiceBusReceivedMessage) {
  return {
    sequenceNumber: String(message.sequenceNumber),
    messageId: String(message.messageId ?? ''),
    correlationId: String(message.correlationId ?? ''),
    deliveryCount: message.deliveryCount,
    deadLetterReason: message.deadLetterReason,
    deadLetterErrorDescription: message.deadLetterErrorDescription,
    enqueuedTimeUtc: message.enqueuedTimeUtc?.toISOString(),
  };
}

function replayMessage(message: ServiceBusReceivedMessage): ServiceBusMessage {
  const originalMessageId = String(message.messageId ?? message.sequenceNumber);
  return {
    body: message.body,
    messageId: `${originalMessageId}:replay:${Date.now()}`,
    ...(message.correlationId === undefined ? {} : { correlationId: message.correlationId }),
    ...(message.contentType === undefined ? {} : { contentType: message.contentType }),
    ...(message.subject === undefined ? {} : { subject: message.subject }),
    applicationProperties: {
      ...message.applicationProperties,
      replayedFromDeadLetter: true,
      originalBrokerMessageId: originalMessageId,
    },
  };
}

async function main() {
  const endpoint = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ?? process.env.AZURE_SERVICE_BUS_NAMESPACE
    ?? (() => { throw new Error('Configure AZURE_SERVICE_BUS_CONNECTION_STRING ou AZURE_SERVICE_BUS_NAMESPACE.'); })();
  const topic = process.env.AZURE_SERVICE_BUS_TOPIC ?? 'inventory-domain-events';
  const subscription = process.env.AZURE_SERVICE_BUS_SUBSCRIPTION ?? 'inventory-workers';
  const execute = process.argv.includes('--execute');
  const limitIndex = process.argv.indexOf('--limit');
  const limit = positiveLimit(limitIndex < 0 ? undefined : process.argv[limitIndex + 1]);
  const client = createClient(endpoint);
  const receiver = client.createReceiver(topic, subscription, { subQueueType: 'deadLetter' });
  const sender = execute ? client.createSender(topic) : undefined;
  try {
    if (!execute) {
      const messages = await receiver.peekMessages(limit);
      console.log(JSON.stringify({ mode: 'inspect', count: messages.length, messages: messages.map(metadata) }, null, 2));
      return;
    }

    const messages = await receiver.receiveMessages(limit, { maxWaitTimeInMs: 5_000 });
    let replayed = 0;
    for (const message of messages) {
      try {
        await sender?.sendMessages(replayMessage(message));
        await receiver.completeMessage(message);
        replayed += 1;
      } catch (error) {
        await receiver.abandonMessage(message);
        throw error;
      }
    }
    console.log(JSON.stringify({ mode: 'replay', received: messages.length, replayed }, null, 2));
  } finally {
    await sender?.close();
    await receiver.close();
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
