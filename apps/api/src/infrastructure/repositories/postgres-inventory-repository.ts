import type { InventoryRepository } from '../../domain/inventory-repository.js';
import type {
  ClassificationSummary,
  DashboardSummary,
  DemandPoint,
  ForecastResult,
  ProductFilters,
  ProductList,
  ProductSummary,
  RiskLevel,
  SyncRunList,
} from '../../domain/models.js';
import type { PostgresDatabase } from '../database/postgres-database.js';

const classificationColors = { A: '#0c7767', B: '#d69e2e', C: '#7c8a96' } as const;

function asNumber(value: string | number | null): number {
  return value === null ? 0 : Number(value);
}

function asNullableNumber(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`))
    .replace('.', '');
}

function riskPresentation(risk: RiskLevel) {
  if (risk === 'critical') return 'Crítico' as const;
  if (risk === 'attention') return 'Atenção' as const;
  return 'Saudável' as const;
}

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: string;
  forecast: string;
  coverage: string;
  classification: string | null;
  risk: RiskLevel;
};

const productProjection = `
  WITH latest_analysis AS (
    SELECT DISTINCT ON (pa.product_id)
      pa.product_id, pa.abc_class, pa.xyz_class
    FROM product_analyses pa
    JOIN model_runs mr ON mr.id = pa.model_run_id AND mr.status = 'succeeded'
    ORDER BY pa.product_id, pa.analyzed_at DESC, mr.created_at DESC
  ), stock AS (
    SELECT product_id, SUM(available_quantity) AS available
    FROM inventory_levels
    GROUP BY product_id
  ), demand AS (
    SELECT product_id, SUM(units_sold) / 30.0 AS daily_average
    FROM daily_product_demand
    WHERE demand_date BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE
    GROUP BY product_id
  ), forecast AS (
    SELECT df.product_id, SUM(df.predicted_quantity) AS predicted
    FROM demand_forecasts df
    JOIN model_runs mr ON mr.id = df.model_run_id AND mr.status = 'succeeded'
    WHERE df.horizon_days = 30
      AND df.target_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 30
    GROUP BY df.product_id
  ), projected AS (
    SELECT
      p.id,
      p.sku,
      p.name,
      COALESCE(c.name, 'Sem categoria') AS category,
      COALESCE(s.available, 0) AS stock,
      COALESCE(f.predicted, 0) AS forecast,
      CASE
        WHEN COALESCE(d.daily_average, 0) = 0 THEN 999
        ELSE FLOOR(COALESCE(s.available, 0) / d.daily_average)
      END AS coverage,
      COALESCE(la.abc_class::text || la.xyz_class::text, 'N/D') AS classification,
      CASE
        WHEN COALESCE(s.available, 0) <= COALESCE(p.minimum_stock, 0)
          OR (COALESCE(d.daily_average, 0) > 0 AND COALESCE(s.available, 0) / d.daily_average <= GREATEST(COALESCE(p.lead_time_days, 0), 7))
          THEN 'critical'
        WHEN COALESCE(d.daily_average, 0) > 0 AND COALESCE(s.available, 0) / d.daily_average <= 21
          THEN 'attention'
        ELSE 'healthy'
      END AS risk
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stock s ON s.product_id = p.id
    LEFT JOIN demand d ON d.product_id = p.id
    LEFT JOIN forecast f ON f.product_id = p.id
    LEFT JOIN latest_analysis la ON la.product_id = p.id
    WHERE p.active = true
  )`;

export class PostgresInventoryRepository implements InventoryRepository {
  public constructor(private readonly database: PostgresDatabase) {}

  public async healthCheck(): Promise<boolean> {
    const result = await this.database.query<{ healthy: boolean }>('SELECT true AS healthy');
    return result.rows[0]?.healthy === true;
  }

  public async getDashboardSummary(): Promise<DashboardSummary> {
    const [kpis, series, classes, products, sync] = await Promise.all([
      this.database.query<{
        stock_value: string;
        active_products: string;
        stockout_risk: string;
        service_level: string;
      }>(`${productProjection}
        SELECT
          COALESCE((SELECT SUM(il.available_quantity * COALESCE(p.cost_price, 0)) FROM inventory_levels il JOIN products p ON p.id = il.product_id WHERE p.active), 0) AS stock_value,
          COUNT(*) AS active_products,
          COUNT(*) FILTER (WHERE risk = 'critical') AS stockout_risk,
          COALESCE((SELECT ROUND(100.0 * (1 - AVG(CASE WHEN was_stockout THEN 1 ELSE 0 END)), 1) FROM daily_product_demand WHERE demand_date >= CURRENT_DATE - 29), 100) AS service_level
        FROM projected`),
      this.database.query<{ day: string; actual: string | null; forecast: string | null; lower: string | null; upper: string | null }>(`
        WITH calendar AS (
          SELECT day::date FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE + 7, INTERVAL '1 day') AS day
        ), actual AS (
          SELECT demand_date AS day, SUM(units_sold) AS quantity
          FROM daily_product_demand
          WHERE demand_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE
          GROUP BY demand_date
        ), predicted AS (
          SELECT target_date AS day, SUM(predicted_quantity) AS quantity,
                 SUM(lower_bound) AS lower, SUM(upper_bound) AS upper
          FROM demand_forecasts df
          JOIN model_runs mr ON mr.id = df.model_run_id AND mr.status = 'succeeded'
          WHERE horizon_days = 7 AND target_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7
          GROUP BY target_date
        )
        SELECT calendar.day::text, actual.quantity AS actual, predicted.quantity AS forecast,
               predicted.lower, predicted.upper
        FROM calendar
        LEFT JOIN actual USING (day)
        LEFT JOIN predicted USING (day)
        ORDER BY calendar.day`),
      this.database.query<{ abc_class: 'A' | 'B' | 'C'; products: string; revenue: string }>(`
        WITH latest AS (
          SELECT DISTINCT ON (pa.product_id) pa.product_id, pa.abc_class
          FROM product_analyses pa
          JOIN model_runs mr ON mr.id = pa.model_run_id AND mr.status = 'succeeded'
          ORDER BY pa.product_id, mr.created_at DESC
        ), revenue AS (
          SELECT product_id, SUM(gross_revenue) AS amount
          FROM daily_product_demand
          WHERE demand_date >= CURRENT_DATE - 29
          GROUP BY product_id
        )
        SELECT latest.abc_class, COUNT(*) AS products, COALESCE(SUM(revenue.amount), 0) AS revenue
        FROM latest LEFT JOIN revenue USING (product_id)
        WHERE latest.abc_class IS NOT NULL
        GROUP BY latest.abc_class
        ORDER BY latest.abc_class`),
      this.queryProducts({}, true),
      this.database.query<{ finished_at: Date | null }>(`
        SELECT finished_at FROM sync_runs WHERE status IN ('succeeded', 'partial')
        ORDER BY finished_at DESC NULLS LAST LIMIT 1`),
    ]);

    const kpi = kpis.rows[0];
    const totalProducts = classes.rows.reduce((sum, row) => sum + asNumber(row.products), 0);
    const totalRevenue = classes.rows.reduce((sum, row) => sum + asNumber(row.revenue), 0);
    const classMap = new Map(classes.rows.map((row) => [row.abc_class, row]));
    const classifications: ClassificationSummary[] = (['A', 'B', 'C'] as const).map((name) => {
      const row = classMap.get(name);
      const count = asNumber(row?.products ?? 0);
      const revenue = asNumber(row?.revenue ?? 0);
      return {
        name: `Classe ${name}`,
        products: count,
        percent: totalProducts ? Math.round((count / totalProducts) * 100) : 0,
        revenue: totalRevenue ? Math.round((revenue / totalRevenue) * 100) : 0,
        color: classificationColors[name],
      };
    });

    return {
      meta: {
        source: 'postgresql',
        demo: false,
        generatedAt: new Date().toISOString(),
        lastSyncAt: sync.rows[0]?.finished_at?.toISOString() ?? null,
      },
      kpis: {
        stockValue: asNumber(kpi?.stock_value ?? 0),
        activeProducts: asNumber(kpi?.active_products ?? 0),
        stockoutRisk: asNumber(kpi?.stockout_risk ?? 0),
        serviceLevel: asNumber(kpi?.service_level ?? 100),
      },
      demandSeries: series.rows.map((row) => ({
        date: row.day,
        label: formatDateLabel(row.day),
        actual: asNullableNumber(row.actual),
        forecast: asNullableNumber(row.forecast),
        lower: asNullableNumber(row.lower),
        upper: asNullableNumber(row.upper),
      })),
      classifications,
      riskProducts: products.filter((product) => product.risk !== 'healthy').slice(0, 10),
    };
  }

  public async listProducts(filters: ProductFilters): Promise<ProductList> {
    const data = await this.queryProducts(filters, false);
    return { data, total: data.length, demo: false };
  }

  private async queryProducts(filters: ProductFilters, risksOnly: boolean): Promise<ProductSummary[]> {
    const search = filters.search?.trim() ? `%${filters.search.trim()}%` : null;
    const requestedRisk = filters.risk ?? null;
    const result = await this.database.query<ProductRow>(`${productProjection}
      SELECT id, sku, name, category, stock, forecast, coverage, classification, risk
      FROM projected
      WHERE ($1::text IS NULL OR name ILIKE $1 OR sku ILIKE $1)
        AND ($2::text IS NULL OR risk = $2)
        AND ($3::boolean = false OR risk IN ('critical', 'attention'))
      ORDER BY CASE risk WHEN 'critical' THEN 1 WHEN 'attention' THEN 2 ELSE 3 END, coverage, name
      LIMIT 250`, [search, requestedRisk, risksOnly]);

    return result.rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      stock: asNumber(row.stock),
      forecast: asNumber(row.forecast),
      coverage: asNumber(row.coverage),
      classification: row.classification ?? 'N/D',
      risk: row.risk,
      severity: riskPresentation(row.risk),
    }));
  }

  public async getForecast(horizon: 7 | 30 | 90, productId?: string): Promise<ForecastResult> {
    const series = await this.database.query<{
      day: string;
      actual: string | null;
      forecast: string | null;
      lower: string | null;
      upper: string | null;
    }>(`
      WITH actual AS (
        SELECT demand_date AS day, SUM(units_sold) AS quantity
        FROM daily_product_demand
        WHERE demand_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE
          AND ($1::uuid IS NULL OR product_id = $1)
        GROUP BY demand_date
      ), predicted AS (
        SELECT target_date AS day, SUM(predicted_quantity) AS quantity,
               SUM(lower_bound) AS lower, SUM(upper_bound) AS upper
        FROM demand_forecasts df
        JOIN model_runs mr ON mr.id = df.model_run_id AND mr.status = 'succeeded'
        WHERE df.horizon_days = $2
          AND df.target_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + $2
          AND ($1::uuid IS NULL OR df.product_id = $1)
        GROUP BY target_date
      )
      SELECT day::text, SUM(actual) AS actual, SUM(forecast) AS forecast,
             SUM(lower) AS lower, SUM(upper) AS upper
      FROM (
        SELECT day, quantity AS actual, NULL::numeric AS forecast, NULL::numeric AS lower, NULL::numeric AS upper FROM actual
        UNION ALL
        SELECT day, NULL, quantity, lower, upper FROM predicted
      ) points
      GROUP BY day ORDER BY day`, [productId ?? null, horizon]);
    const model = await this.database.query<{ model_version: string; finished_at: Date | null }>(`
      SELECT model_version, finished_at FROM model_runs
      WHERE task = 'forecast' AND status = 'succeeded'
      ORDER BY finished_at DESC NULLS LAST, created_at DESC LIMIT 1`);

    return {
      demo: false,
      productId: productId ?? null,
      horizon,
      model: model.rows[0]?.model_version ?? null,
      generatedAt: model.rows[0]?.finished_at?.toISOString() ?? null,
      data: series.rows.map((row): DemandPoint => ({
        date: row.day,
        label: formatDateLabel(row.day),
        actual: asNullableNumber(row.actual),
        forecast: asNullableNumber(row.forecast),
        lower: asNullableNumber(row.lower),
        upper: asNullableNumber(row.upper),
      })),
    };
  }

  public async listSyncRuns(): Promise<SyncRunList> {
    const result = await this.database.query<{
      id: string;
      source: string;
      status: string;
      started_at: Date | null;
      finished_at: Date | null;
      records_processed: string;
    }>(`
      SELECT id, source, status, started_at, finished_at,
             (records_inserted + records_updated) AS records_processed
      FROM sync_runs
      ORDER BY created_at DESC LIMIT 50`);
    const data = result.rows.map((row) => ({
      id: row.id,
      source: row.source,
      status: row.status,
      startedAt: row.started_at?.toISOString() ?? null,
      finishedAt: row.finished_at?.toISOString() ?? null,
      recordsProcessed: asNumber(row.records_processed),
    }));
    return { data, total: data.length, demo: false };
  }
}
