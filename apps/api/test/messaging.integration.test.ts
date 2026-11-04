import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { getConfig } from '../src/config.js';
import { PostgresDatabase } from '../src/infrastructure/database/postgres-database.js';
import { ProtobufEventEncoder } from '../src/infrastructure/messaging/outbox-worker.js';
import { IdempotentEventConsumer, ProtobufEventDecoder } from '../src/infrastructure/messaging/service-bus-consumer.js';

describe('Consumidor idempotente com PostgreSQL real', { skip: process.env.AUTH_INTEGRATION !== '1' }, () => {
  const schema = `messaging_test_${randomUUID().replaceAll('-', '')}`;
  let owner: PostgresDatabase;
  let database: PostgresDatabase;
  let created = false;

  before(async () => {
    const config = getConfig();
    owner = new PostgresDatabase(config.databaseUrl, 1);
    await owner.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    const url = new URL(config.databaseUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    database = new PostgresDatabase(url.toString(), 2);
    await database.query(`CREATE TABLE processed_messages(
      consumer_name text NOT NULL,
      message_id uuid NOT NULL,
      correlation_id uuid NOT NULL,
      processed_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(consumer_name,message_id)
    )`);
  });

  after(async () => {
    await database?.close();
    if (created) await owner.query(`DROP SCHEMA "${schema}" CASCADE`);
    await owner?.close();
  });

  it('grava a primeira entrega e reconhece a repetição sem duplicar', async () => {
    const messageId = randomUUID();
    const correlationId = randomUUID();
    const encoder = await ProtobufEventEncoder.create();
    const consumer = new IdempotentEventConsumer(database, await ProtobufEventDecoder.create(), 'integration-test');
    const body = encoder.encode({
      id: messageId,
      aggregate_type: 'inventory',
      aggregate_id: randomUUID(),
      event_type: 'stock.entry',
      event_version: 1,
      correlation_id: correlationId,
      payload: { quantity: '3.0000' },
      occurred_at: new Date('2026-10-29T00:00:00Z'),
    });

    assert.equal(await consumer.process(body), 'processed');
    assert.equal(await consumer.process(body), 'duplicate');
    const result = await database.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM processed_messages WHERE consumer_name=$1 AND message_id=$2',
      ['integration-test', messageId],
    );
    assert.equal(result.rows[0]?.count, 1);
  });
});
