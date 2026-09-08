import pg from 'pg';

const { Pool } = pg;

export class PostgresDatabase {
  private readonly pool: pg.Pool;

  public constructor(connectionString: string, maxConnections: number) {
    this.pool = new Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'estoque-inteligente-api',
    });
  }

  public query<Row extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
    return this.pool.query<Row>(text, values);
  }

  public async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public close() {
    return this.pool.end();
  }
}
