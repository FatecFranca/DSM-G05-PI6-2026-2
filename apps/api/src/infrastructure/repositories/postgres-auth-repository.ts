import type { AuthRepository, CredentialUser, User } from '../../domain/auth.js';
import type { PostgresDatabase } from '../database/postgres-database.js';

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly db: PostgresDatabase) {}

  public async createUser(name: string, email: string, passwordHash: string) {
    return this.db.transaction(async (client) => {
      const result = await client.query<User>(`INSERT INTO users (name, email, password_hash)
        VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING id,name,email,role`, [name, email, passwordHash]);
      const user = result.rows[0];
      if (user) { await client.query("INSERT INTO audit_logs(user_id,event) VALUES ($1,'user.registered')", [user.id]); }
      return user ?? null;
    });
  }

  public async findByEmail(email: string) {
    const result = await this.db.query<CredentialUser>(
      'SELECT id,name,email,role,password_hash,active FROM users WHERE email=$1', [email]);
    return result.rows[0] ?? null;
  }

  public async createSession(userId: string, passwordHash: string, tokenHash: string, expiresAt: Date) {
    return this.db.transaction(async (client) => {
      // Serializa login e troca de senha: um login em andamento não recria sessão revogada.
      const user = await client.query('SELECT id FROM users WHERE id=$1 AND password_hash=$2 AND active FOR UPDATE', [userId, passwordHash]);
      if (!user.rowCount) { return false; }
      await client.query('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [tokenHash, userId, expiresAt]);
      await client.query("INSERT INTO audit_logs(user_id,event) VALUES ($1,'session.created')", [userId]);
      return true;
    });
  }

  public async findSession(tokenHash: string) {
    const result = await this.db.query<User>(`SELECT u.id,u.name,u.email,u.role FROM auth_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL
      AND s.expires_at>now() AND u.active`, [tokenHash]);
    return result.rows[0] ?? null;
  }

  public async revokeSession(tokenHash: string) {
    await this.db.query(`WITH revoked AS (
      UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING user_id
    ) INSERT INTO audit_logs(user_id,event) SELECT user_id,'session.revoked' FROM revoked`, [tokenHash]);
  }

  public async createReset(userId: string, tokenHash: string, expiresAt: Date) {
    await this.db.transaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [userId]);
      await client.query('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash, userId, expiresAt]);
    });
  }

  public async resetPassword(tokenHash: string, passwordHash: string) {
    return this.db.transaction(async (client) => {
      const result = await client.query<{ id: string }>(`SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id
        WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND u.active FOR UPDATE OF u`, [tokenHash]);
      const user = result.rows[0];
      if (!user) { return false; }
      // Revalida após adquirir o lock do usuário (uso único mesmo com chamadas simultâneas).
      const consumed = await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id', [tokenHash]);
      if (!consumed.rowCount) { return false; }
      await client.query('UPDATE users SET password_hash=$2,password_changed_at=now() WHERE id=$1', [user.id, passwordHash]);
      await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [user.id]);
      await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
      await client.query("INSERT INTO audit_logs(user_id,event) VALUES($1,'password.reset')", [user.id]);
      return true;
    });
  }

  public async changePassword(userId: string, oldHash: string, newHash: string) {
    return this.db.transaction(async (client) => {
      const result = await client.query(`UPDATE users SET password_hash=$3,password_changed_at=now()
        WHERE id=$1 AND password_hash=$2 AND active RETURNING id`, [userId, oldHash, newHash]);
      if (!result.rowCount) { return false; }
      await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
      await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [userId]);
      await client.query("INSERT INTO audit_logs(user_id,event) VALUES($1,'password.changed')", [userId]);
      return true;
    });
  }

  public async consumeLimit(key: string, maximum: number, seconds: number) {
    const result = await this.db.query<{ attempts: number }>(`INSERT INTO auth_rate_limits(key_hash,expires_at)
      VALUES($1,now()+$2*interval '1 second') ON CONFLICT(key_hash) DO UPDATE SET
      attempts=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
      expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END
      RETURNING attempts`, [key, seconds]);
    return (result.rows[0]?.attempts ?? maximum + 1) <= maximum;
  }
}
