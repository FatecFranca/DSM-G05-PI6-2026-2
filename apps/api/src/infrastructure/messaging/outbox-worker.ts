import { fileURLToPath, pathToFileURL } from 'node:url';
import { DefaultAzureCredential } from '@azure/identity';
import { ServiceBusClient } from '@azure/service-bus';
import { PubSub } from '@google-cloud/pubsub';
import protobuf from 'protobufjs';
import { getConfig } from '../../config.js';
import { PostgresDatabase } from '../database/postgres-database.js';

type OutboxEvent = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version: number;
  correlation_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
};

export interface MessageTransport {
  publish(event: OutboxEvent, data: Buffer): Promise<void>;
  close?(): Promise<void>;
}

export class ProtobufEventEncoder {
  private constructor(private readonly envelope: protobuf.Type) {}

  public static async create() {
    const path = fileURLToPath(new URL('../../../../../infra/messaging/inventory_events.proto', import.meta.url));
    const root = await protobuf.load(path);
    return new ProtobufEventEncoder(root.lookupType('estoque_inteligente.events.v1.EventEnvelope'));
  }

  public encode(event: OutboxEvent): Buffer {
    const milliseconds = event.occurred_at.getTime();
    const message = this.envelope.create({
      messageId: event.id,
      correlationId: event.correlation_id,
      producer: 'estoque-inteligente-api',
      eventVersion: event.event_version,
      occurredAt: { seconds: Math.floor(milliseconds / 1000), nanos: (milliseconds % 1000) * 1_000_000 },
      domainEvent: {
        aggregateType: event.aggregate_type,
        aggregateId: event.aggregate_id,
        eventType: event.event_type,
        payloadJson: JSON.stringify(event.payload),
      },
    });
    const error = this.envelope.verify(message);
    if (error) throw new Error(`Evento inválido: ${error}`);
    return Buffer.from(this.envelope.encode(message).finish());
  }
}

export class GooglePubSubTransport implements MessageTransport {
  private readonly client: PubSub;

  public constructor(private readonly topicName: string, projectId?: string) {
    this.client = new PubSub(projectId ? { projectId } : {});
  }

  public async publish(event: OutboxEvent, data: Buffer) {
    await this.client.topic(this.topicName).publishMessage({
      data,
      attributes: {
        eventType: event.event_type,
        aggregateType: event.aggregate_type,
        eventVersion: String(event.event_version),
        correlationId: event.correlation_id,
      },
    });
  }

  public async close() {
    await this.client.close();
  }
}

/** Azure transport keeps the same protobuf envelope and outbox semantics. */
export class AzureServiceBusTransport implements MessageTransport {
  private readonly client: ServiceBusClient;
  private readonly sender;

  public constructor(connectionStringOrNamespace: string, entityName: string) {
    this.client = connectionStringOrNamespace.startsWith('Endpoint=')
      ? new ServiceBusClient(connectionStringOrNamespace)
      : new ServiceBusClient(connectionStringOrNamespace, new DefaultAzureCredential());
    this.sender = this.client.createSender(entityName);
  }

  public async publish(event: OutboxEvent, data: Buffer) {
    await this.sender.sendMessages({
      body: data,
      contentType: 'application/x-protobuf',
      messageId: event.id,
      correlationId: event.correlation_id,
      subject: event.event_type,
      applicationProperties: {
        aggregateType: event.aggregate_type,
        eventVersion: String(event.event_version),
      },
    });
  }

  public async close() {
    await this.sender.close();
    await this.client.close();
  }
}

export class OutboxProcessor {
  public constructor(
    private readonly database: PostgresDatabase,
    private readonly encoder: ProtobufEventEncoder,
    private readonly transport: MessageTransport,
  ) {}

  public processBatch(limit = 50): Promise<number> {
    return this.database.transaction(async (client) => {
      await client.query("SET LOCAL lock_timeout='3s'");
      const result = await client.query<OutboxEvent>(`
        SELECT id::text,aggregate_type,aggregate_id,event_type,event_version,correlation_id::text,payload,occurred_at
        FROM outbox_events WHERE published_at IS NULL AND publish_attempts < 20
        ORDER BY occurred_at LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]);
      let published = 0;
      for (const event of result.rows) {
        try {
          await this.transport.publish(event, this.encoder.encode(event));
          await client.query(`UPDATE outbox_events SET published_at=now(),publish_attempts=publish_attempts+1,last_error=NULL WHERE id=$1`, [event.id]);
          published += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha desconhecida';
          await client.query(`UPDATE outbox_events SET publish_attempts=publish_attempts+1,last_error=$2 WHERE id=$1`, [event.id, message.slice(0, 1000)]);
        }
      }
      return published;
    });
  }
}

async function main() {
  const config = getConfig();
  const mode = process.env.MESSAGING_MODE ?? 'disabled';
  if (!['google-pubsub', 'azure-service-bus'].includes(mode)) {
    throw new Error('Configure MESSAGING_MODE=google-pubsub ou azure-service-bus para iniciar o publicador.');
  }
  const database = new PostgresDatabase(config.databaseUrl, Math.min(config.databasePoolMax, 3));
  const encoder = await ProtobufEventEncoder.create();
  const transport = mode === 'azure-service-bus'
    ? new AzureServiceBusTransport(
      process.env.AZURE_SERVICE_BUS_CONNECTION_STRING ?? process.env.AZURE_SERVICE_BUS_NAMESPACE
        ?? (() => { throw new Error('Configure AZURE_SERVICE_BUS_CONNECTION_STRING ou AZURE_SERVICE_BUS_NAMESPACE.'); })(),
      process.env.AZURE_SERVICE_BUS_TOPIC ?? 'inventory-domain-events',
    )
    : new GooglePubSubTransport(process.env.PUBSUB_TOPIC ?? 'inventory-domain-events', process.env.GOOGLE_CLOUD_PROJECT);
  const processor = new OutboxProcessor(database, encoder, transport);
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    while (!stopping) {
      const published = await processor.processBatch();
      if (published === 0) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  } finally {
    await transport.close();
    await database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
