import assert from 'node:assert/strict';
import { test } from 'node:test';
import protobuf from 'protobufjs';
import { ProtobufEventEncoder } from '../src/infrastructure/messaging/outbox-worker.js';

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
  const path = new URL('../../../infra/messaging/inventory_events.proto', import.meta.url).pathname;
  const root = await protobuf.load(process.platform === 'win32' ? path.slice(1) : path);
  const envelope = root.lookupType('estoque_inteligente.events.v1.EventEnvelope').decode(data);
  const object = envelope.toJSON() as { messageId: string; domainEvent: { eventType: string } };
  assert.equal(object.messageId, '10000000-0000-4000-8000-000000000001');
  assert.equal(object.domainEvent.eventType, 'stock.entry');
});
