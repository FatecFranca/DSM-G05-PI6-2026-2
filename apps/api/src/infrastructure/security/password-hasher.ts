import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';

export class PasswordHasher {
  public hash(password: string) {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  public async verify(hash: string, password: string) {
    try { return await argon2.verify(hash, password); } catch { return false; }
  }
}

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
