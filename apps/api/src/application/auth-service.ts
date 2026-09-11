import { setTimeout } from 'node:timers/promises';
import { AuthError, type AuthRepository, type ResetMailer, type User } from '../domain/auth.js';
import { PasswordHasher, hashToken, newToken } from '../infrastructure/security/password-hasher.js';

export class AuthService {
  private readonly dummyHash: Promise<string>;
  public constructor(
    private readonly repository: AuthRepository,
    private readonly mailer: ResetMailer,
    private readonly webUrl: string,
    private readonly registrationEnabled: boolean,
    private readonly hasher = new PasswordHasher(),
  ) { this.dummyHash = hasher.hash(newToken()); }

  public async limit(key: string, maximum: number, seconds = 900) {
    if (!await this.repository.consumeLimit(hashToken(key), maximum, seconds)) {
      throw new AuthError(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
    }
  }

  public async register(name: string, email: string, password: string) {
    if (!this.registrationEnabled) { throw new AuthError(403, 'O cadastro está fechado. Entre em contato com o responsável.'); }
    const hash = await this.hasher.hash(password);
    const user = await this.repository.createUser(name.trim(), email, hash);
    if (!user) { throw new AuthError(409, 'Não foi possível cadastrar esta conta. Tente entrar ou recuperar sua senha.'); }
    return user;
  }

  public async login(email: string, password: string, remember: boolean) {
    await this.limit(`login:${email}`, 10);
    const user = await this.repository.findByEmail(email);
    const valid = await this.hasher.verify(user?.password_hash ?? await this.dummyHash, password);
    if (!valid || !user?.active) { throw new AuthError(401, 'E-mail ou senha incorretos.'); }
    const token = newToken();
    const expiresAt = new Date(Date.now() + (remember ? 7 * 86400 : 8 * 3600) * 1000);
    if (!await this.repository.createSession(user.id, user.password_hash, hashToken(token), expiresAt)) {
      throw new AuthError(401, 'E-mail ou senha incorretos.');
    }
    return { token, expiresAt, user: this.publicUser(user) };
  }

  public async authenticate(token?: string): Promise<User> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) { throw new AuthError(401, 'Entre na sua conta para continuar.'); }
    const user = await this.repository.findSession(hashToken(token));
    if (!user) { throw new AuthError(401, 'Sua sessão expirou. Entre novamente.'); }
    return user;
  }

  public async logout(token?: string) {
    if (token) { await this.repository.revokeSession(hashToken(token)); }
  }

  public async forgotPassword(email: string) {
    const startedAt = Date.now();
    // A mesma resposta para contas inexistentes, limitadas ou falhas de entrega.
    const allowed = await this.repository.consumeLimit(hashToken(`reset:${email}`), 3, 900);
    const user = await this.repository.findByEmail(email);
    if (allowed && user?.active) {
      const token = newToken();
      await this.repository.createReset(user.id, hashToken(token), new Date(Date.now() + 30 * 60000));
      try {
        await this.mailer.sendReset(email, `${this.webUrl}/redefinir-senha#token=${token}`);
      } catch {
        // Não imprime destinatário, credenciais SMTP ou token nos logs.
        console.error('Falha ao entregar e-mail de recuperação. Verifique o serviço de e-mail.');
      }
    }
    await setTimeout(Math.max(0, 600 - (Date.now() - startedAt)));
  }

  public async resetPassword(token: string, password: string) {
    const hash = await this.hasher.hash(password);
    if (!await this.repository.resetPassword(hashToken(token), hash)) {
      throw new AuthError(400, 'Link inválido ou expirado. Solicite uma nova recuperação.');
    }
  }

  public async changePassword(user: User, currentPassword: string, password: string) {
    await this.limit(`change:${user.id}`, 10);
    const stored = await this.repository.findByEmail(user.email);
    if (!stored || !await this.hasher.verify(stored.password_hash, currentPassword)) {
      throw new AuthError(400, 'A senha atual está incorreta.');
    }
    if (currentPassword === password) { throw new AuthError(400, 'Escolha uma senha diferente da atual.'); }
    if (!await this.repository.changePassword(user.id, stored.password_hash, await this.hasher.hash(password))) {
      throw new AuthError(401, 'Sua conta foi alterada. Entre novamente.');
    }
  }

  private publicUser(user: User): User {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}
