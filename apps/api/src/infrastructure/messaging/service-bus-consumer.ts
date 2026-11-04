import { fileURLToPath, pathToFileURL } from 'node:url';
import { DefaultAzureCredential } from '@azure/identity';
import {
  ServiceBusClient,
  type ProcessErrorArgs,
  type ServiceBusReceivedMessage,
} from '@azure/service-bus';
import protobuf from 'protobufjs';
import { getConfig } from '../../config.js';
import { PostgresDatabase } from '../database/postgres-database.js';

const CONSUMER_NAME = 'inventory-workers-v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidMessageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidMessageError';
  }
}

export type DecodedEvent = {
  messageId: string;
  correlationId: string;
  eventType: string;
};

export class ProtobufEventDecoder {
  private constructor(private readonly envelope: protobuf.Type) {}

  public static async create() {
    const path = fileURLToPath(new URL('../../../../../infra/messaging/inventory_events.proto', import.meta.url));
    const root = await protobuf.load(path);
    return new ProtobufEventDecoder(root.lookupType('estoque_inteligente.events.v1.EventEnvelope'));
  }

  public decode(data: Uint8Array): DecodedEvent {
    let object: Record<string, unknown>;
    try {
      const decoded = this.envelope.decode(data);
      object = this.envelope.toObject(decoded, { oneofs: true }) as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'conteúdo binário inválido';
      throw new InvalidMessageError(`Envelope Protobuf inválido: ${message}`);
    }

    const messageId = String(object.messageId ?? '');
    const correlationId = String(object.correlationId ?? '');
    if (!UUID_PATTERN.test(messageId) || !UUID_PATTERN.test(correlationId)) {
      throw new InvalidMessageError('message_id e correlation_id devem ser UUIDs válidos.');
    }

    const domainEvent = object.domainEvent as Record<string, unknown> | undefined;
    const payloadType = String(object.payload ?? '');
    const eventType = domainEvent ? String(domainEvent.eventType ?? '') : payloadType;
    if (!payloadType || !eventType) {
      throw new InvalidMessageError('O envelope deve conter exatamente um payload de evento identificável.');
    }
    return { messageId, correlationId, eventType };
  }
}

export class IdempotentEventConsumer {
  public constructor(
    private readonly database: PostgresDatabase,
    private readonly decoder: ProtobufEventDecoder,
    private readonly consumerName = CONSUMER_NAME,
  ) {}

  public async process(body: unknown): Promise<'processed' | 'duplicate'> {
    const data = toBytes(body);
    const event = this.decoder.decode(data);
    return this.database.transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO processed_messages(consumer_name,message_id,correlation_id)
         VALUES($1,$2,$3) ON CONFLICT(consumer_name,message_id) DO NOTHING
         RETURNING message_id`,
        [this.consumerName, event.messageId, event.correlationId],
      );
      return inserted.rowCount === 1 ? 'processed' : 'duplicate';
    });
  }
}

function toBytes(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (typeof body === 'string') return Buffer.from(body, 'base64');
  if (body && typeof body === 'object' && 'data' in body) {
    const data = (body as { data: unknown }).data;
    if (Array.isArray(data) && data.every((value) => Number.isInteger(value))) return Uint8Array.from(data);
  }
  throw new InvalidMessageError('Corpo da mensagem não contém bytes Protobuf.');
}

function createClient(connectionStringOrNamespace: string) {
  return connectionStringOrNamespace.startsWith('Endpoint=')
    ? new ServiceBusClient(connectionStringOrNamespace)
    : new ServiceBusClient(connectionStringOrNamespace, new DefaultAzureCredential());
}

async function main() {
  const config = getConfig();
  const endpoint = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ?? process.env.AZURE_SERVICE_BUS_NAMESPACE
    ?? (() => { throw new Error('Configure AZURE_SERVICE_BUS_CONNECTION_STRING ou AZURE_SERVICE_BUS_NAMESPACE.'); })();
  const topic = process.env.AZURE_SERVICE_BUS_TOPIC ?? 'inventory-domain-events';
  const subscription = process.env.AZURE_SERVICE_BUS_SUBSCRIPTION ?? 'inventory-workers';
  const database = new PostgresDatabase(config.databaseUrl, Math.min(config.databasePoolMax, 4));
  const decoder = await ProtobufEventDecoder.create();
  const consumer = new IdempotentEventConsumer(database, decoder);
  const client = createClient(endpoint);
  const receiver = client.createReceiver(topic, subscription, { receiveMode: 'peekLock' });

  const handlers = {
    processMessage: async (message: ServiceBusReceivedMessage) => {
      try {
        const result = await consumer.process(message.body);
        await receiver.completeMessage(message);
        console.info(JSON.stringify({
          level: 'info', action: result, brokerMessageId: String(message.messageId ?? ''),
        }));
      } catch (error) {
        if (error instanceof InvalidMessageError) {
          await receiver.deadLetterMessage(message, {
            deadLetterReason: 'SchemaValidationFailed',
            deadLetterErrorDescription: error.message.slice(0, 4096),
          });
          console.error(JSON.stringify({ level: 'error', action: 'dead-lettered', reason: error.message }));
          return;
        }
        await receiver.abandonMessage(message);
        const reason = error instanceof Error ? error.message : 'falha transitória desconhecida';
        console.error(JSON.stringify({ level: 'error', action: 'abandoned', reason }));
      }
    },
    processError: async (args: ProcessErrorArgs) => {
      console.error(JSON.stringify({
        level: 'error', action: 'receiver-error', namespace: args.fullyQualifiedNamespace,
        entityPath: args.entityPath, error: args.error.message,
      }));
    },
  };

  const subscriptionHandle = receiver.subscribe(handlers, {
    autoCompleteMessages: false,
    maxConcurrentCalls: Number(process.env.MESSAGING_MAX_CONCURRENT_CALLS ?? 4),
  });
  await new Promise<void>((resolve) => {
    let resolved = false;
    const stop = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  await subscriptionHandle.close();
  await receiver.close();
  await client.close();
  await database.close();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
