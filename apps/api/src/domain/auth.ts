export type User = { id: string; name: string; email: string; role: 'viewer' | 'admin' };
export type CredentialUser = User & { password_hash: string; active: boolean };

export interface AuthRepository {
  createUser(name: string, email: string, passwordHash: string): Promise<User | null>;
  findByEmail(email: string): Promise<CredentialUser | null>;
  createSession(userId: string, passwordHash: string, tokenHash: string, expiresAt: Date): Promise<boolean>;
  findSession(tokenHash: string): Promise<User | null>;
  revokeSession(tokenHash: string): Promise<void>;
  createReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  resetPassword(tokenHash: string, passwordHash: string): Promise<boolean>;
  changePassword(userId: string, oldHash: string, newHash: string): Promise<boolean>;
  consumeLimit(key: string, maximum: number, seconds: number): Promise<boolean>;
}

export interface ResetMailer { sendReset(email: string, url: string): Promise<void> }

export class AuthError extends Error {
  public constructor(public readonly statusCode: number, message: string) { super(message); }
}
