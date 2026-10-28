import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import protobuf from 'protobufjs';
import { ProtobufEventEncoder } from '../src/infrastructure/messaging/outbox-worker.js';
import { InvalidMessageError, ProtobufEventDecoder } from '../src/infrastructure/messaging/service-bus-consumer.js';

test('serializa evento da outbox no contrato Protocol Buffers', async () => {
  const encoder = await ProtobufEventEncoder.create();
  const data = encoder.encode({
    id: '10000000-0000-4000-8000-000000000001',
    aggregate_type: 'inventory',
    aggregate_id: '20000000-0000-4000-8000-000000000001',
    event_type: 'stock.entry',
    event_version: 1,
    correlation_id: '30000000-0000-4000-8000-000000000001',
    payload: { quantity: '10.0000' },
    occurred_at: new Date('2026-09-16T12:00:00Z'),
  });
  assert.ok(data.length > 20);
  const path = fileURLToPath(new URL('../../../infra/messaging/inventory_events.proto', import.meta.url));
  const root = await protobuf.load(path);
  const envelope = root.lookupType('estoque_inteligente.events.v1.EventEnvelope').decode(data);
  const object = envelope.toJSON() as { messageId: string; domainEvent: { eventType: string } };
  assert.equal(object.messageId, '10000000-0000-4000-8000-000000000001');
  assert.equal(object.domainEvent.eventType, 'stock.entry');
});

test('consumidor decodifica o envelope e preserva identificadores idempotentes', async () => {
  const encoder = await ProtobufEventEncoder.create();
  const decoder = await ProtobufEventDecoder.create();
  const data = encoder.encode({
    id: '10000000-0000-4000-8000-000000000001',
    aggregate_type: 'inventory',
    aggregate_id: '20000000-0000-4000-8000-000000000001',
    event_type: 'stock.entry',
    event_version: 1,
    correlation_id: '30000000-0000-4000-8000-000000000001',
    payload: { quantity: '10.0000' },
    occurred_at: new Date('2026-09-16T12:00:00Z'),
  });
  assert.deepEqual(decoder.decode(data), {
    messageId: '10000000-0000-4000-8000-000000000001',
    correlationId: '30000000-0000-4000-8000-000000000001',
    eventType: 'stock.entry',
  });
});

test('consumidor rejeita conteúdo que não atende ao contrato', async () => {
  const decoder = await ProtobufEventDecoder.create();
  assert.throws(() => decoder.decode(Buffer.from([1, 2, 3])), InvalidMessageError);
});
