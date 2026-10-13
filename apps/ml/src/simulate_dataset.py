"""Append-only synthetic BRL daily sales. Never rewrites original UCI or stock."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import numpy as np
import psycopg

from .settings import database_url

SLUG = 'demo-brl'
VERSION = 'demo-brl-generator-v1'
SEED = 20260919
NAMES = ['Caneca cerâmica', 'Garrafa térmica', 'Caderno pontilhado', 'Organizador de mesa',
         'Luminária de mesa', 'Porta-retrato', 'Almofada decorativa', 'Vaso decorativo',
         'Toalha de mesa', 'Jogo americano', 'Caixa organizadora', 'Cesto multiuso',
         'Kit de canetas', 'Agenda permanente', 'Suporte para livros', 'Relógio de parede',
         'Bandeja de madeira', 'Pote hermético', 'Kit de talheres', 'Tábua de cozinha',
         'Bolsa reutilizável', 'Estojo escolar', 'Tapete de entrada', 'Difusor de ambiente']


def catalog():
    for index in range(48):
        yield index, f'DEMO-{index+1:03}', f'{NAMES[index // 2]} — {"Clássico" if index % 2 == 0 else "Premium"} (simulado)', Decimal(1290 + (index * 1379) % 17000) / 100


def generate_series(index: int, start: date, end: date):
    """Full deterministic prefix makes an extension independent of batch boundaries."""
    if end < start:
        raise ValueError('A data final deve ser posterior ao início.')
    rng = np.random.default_rng(np.random.SeedSequence([SEED, index]))
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        base = 1.5 + (index % 12) * 2.3
        weekly = [1.05, 1.0, 1.0, 1.1, 1.3, 0.75, 0.55][day.weekday()]
        annual = 1 + 0.22 * np.sin(2 * np.pi * (day.timetuple().tm_yday / 365.25 + index / 48))
        promotion = 1.4 if day.month == 11 else 1.0
        trend = 1 + min(offset / 365.25, 20) * 0.012
        quantity = int(rng.poisson(base * weekly * annual * promotion * trend))
        if index % 8 == 0 and rng.random() < 0.65:
            quantity = 0  # intermittent demand, not a stockout observation
        yield day, quantity


def load_demo(connection, end: date) -> dict:
    # Serialize concurrent loads. Everything, including tracking, commits atomically.
    connection.execute("SELECT pg_advisory_xact_lock(hashtext('demo-brl-generator-v1'))")
    existing = connection.execute('SELECT id,period_started_on,period_ended_on,quality_summary FROM dataset_versions WHERE slug=%s AND version=%s', (SLUG, VERSION)).fetchone()
    if existing and existing[2] >= end:
        return {'inserted': 0, 'period_end': existing[2].isoformat(), 'unchanged': True}
    source = connection.execute("SELECT id,period_ended_on FROM dataset_versions WHERE slug='uci-online-retail-ii' AND status='ready' ORDER BY imported_at DESC NULLS LAST LIMIT 1").fetchone()
    if not source:
        raise RuntimeError('Carregue a UCI original primeiro: npm run data:load.')
    start = existing[1] if existing else source[1] + timedelta(days=1)
    if end < start:
        raise ValueError('Data final anterior ao primeiro dia simulado.')
    manifest = {'generator': VERSION, 'seed': SEED, 'products': 48, 'currency': 'BRL',
                'is_simulated': True, 'start': start.isoformat(), 'end': end.isoformat(),
                'source_dataset_id': str(source[0]), 'prices': 'synthetic-not-fx-conversion',
                'granularity': 'product-day', 'inventory': 'initial-snapshot-only',
                'citation': 'Dados sintéticos do projeto; UCI original preservada separadamente.'}
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    dataset_id = connection.execute("""INSERT INTO dataset_versions
      (slug,version,source_url,doi,license,file_sha256,status,is_simulated,currency,display_name)
      VALUES (%s,%s,'https://github.com/FatecFranca/DSM-G05-PI6-2026-2','','Dados sintéticos do projeto',%s,'loading',true,'BRL','Demonstração brasileira — dados simulados')
      ON CONFLICT(slug,version) DO UPDATE SET status='loading' RETURNING id""", (SLUG, VERSION, digest)).fetchone()[0]
    warehouse = connection.execute("""INSERT INTO warehouses(external_id,name,source)
      VALUES ('demo-brl-warehouse','Depósito demonstrativo — BRL','dataset')
      ON CONFLICT(external_id) DO UPDATE SET external_id=excluded.external_id RETURNING id""").fetchone()[0]
    connection.execute('CREATE TEMP TABLE demo_stage(product_id uuid,demand_date date,units_sold numeric,gross_revenue numeric,orders_count integer) ON COMMIT DROP')
    products = []
    for index, sku, name, price in catalog():
        product = connection.execute("""INSERT INTO products(external_id,sku,name,description,unit,currency,sale_price,cost_price,minimum_stock,lead_time_days,source)
          VALUES (%s,%s,%s,'Produto fictício; preço em reais sem conversão da UCI.','UN','BRL',%s,%s,%s,7,'simulated')
          ON CONFLICT(external_id) DO UPDATE SET external_id=excluded.external_id RETURNING id""",
          (f'{SLUG}:{sku}', sku, name, price, (price * Decimal('0.6')).quantize(Decimal('0.01')), 10 + index % 12 * 8)).fetchone()[0]
        products.append((index, product, price))
    inserted = 0
    for index, product, price in products:
        recent = []
        with connection.cursor().copy('COPY demo_stage FROM STDIN') as copy:
            for day, units in generate_series(index, start, end):
                if (end - day).days < 30:
                    recent.append(units)
                if existing and day <= existing[2]:
                    continue
                copy.write_row((product, day, units, price * units, 1 if units else 0))
                inserted += 1
        # Never reset stock/reservations or erase a user's movements on reruns.
        initial = round(sum(recent) / len(recent) * [5, 15, 35, 60][index % 4])
        connection.execute("""INSERT INTO inventory_levels(product_id,warehouse_id,on_hand_quantity,reserved_quantity,measured_at)
          VALUES (%s,%s,%s,0,%s) ON CONFLICT DO NOTHING""", (product, warehouse, initial, end))
    connection.execute("""INSERT INTO daily_product_demand(product_id,demand_date,units_sold,gross_revenue,orders_count,was_stockout,dataset_version_id)
      SELECT product_id,demand_date,units_sold,gross_revenue,orders_count,NULL,%s FROM demo_stage
      ON CONFLICT(product_id,demand_date) DO NOTHING""", (dataset_id,))
    count = connection.execute('SELECT count(*) FROM daily_product_demand WHERE dataset_version_id=%s', (dataset_id,)).fetchone()[0]
    if count != 48 * ((end - start).days + 1):
        raise RuntimeError('Cobertura diária inesperada; a transação será desfeita.')
    connection.execute("""UPDATE dataset_versions SET status='ready',records_read=%s,records_accepted=%s,
      records_rejected=0,period_started_on=%s,period_ended_on=%s,quality_summary=%s::jsonb,file_sha256=%s,imported_at=now()
      WHERE id=%s""", (count, count, start, end, json.dumps(manifest), digest, dataset_id))
    connection.execute("""INSERT INTO sync_runs(source,status,dataset_version_id,started_at,finished_at,records_read,records_inserted)
      VALUES ('demo-brl','succeeded',%s,now(),now(),%s,%s)""", (dataset_id, inserted, inserted))
    connection.execute('DROP TABLE pg_temp.demo_stage')
    return {'inserted': inserted, 'total_product_days': count, 'period_end': end.isoformat(), 'simulated': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--through', type=date.fromisoformat, default=datetime.now(ZoneInfo('America/Sao_Paulo')).date())
    args = parser.parse_args()
    if args.through > datetime.now(ZoneInfo('America/Sao_Paulo')).date():
        parser.error('Não gerar vendas posteriores a hoje; use o modelo para previsões.')
    with psycopg.connect(database_url(), connect_timeout=10) as connection:
        print(json.dumps(load_demo(connection, args.through), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
