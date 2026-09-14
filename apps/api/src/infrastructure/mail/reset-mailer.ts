import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { ResetMailer } from '../../domain/auth.js';
import type { AppConfig } from '../../config.js';

export class ConfiguredResetMailer implements ResetMailer {
  private readonly transport;
  public constructor(private readonly config: AppConfig) {
    const smtp = config.smtpUrl ? new URL(config.smtpUrl) : null;
    this.transport = config.mailMode === 'smtp' && smtp ? nodemailer.createTransport({
      host: smtp.hostname,
      port: Number(smtp.port || (smtp.protocol === 'smtps:' ? 465 : 587)),
      secure: smtp.protocol === 'smtps:',
      requireTLS: smtp.protocol !== 'smtps:',
      ...(smtp.username ? { auth: { user: decodeURIComponent(smtp.username), pass: decodeURIComponent(smtp.password) } } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    }) : null;
  }

  public async sendReset(email: string, url: string) {
    const message = {
      from: this.config.mailFrom,
      to: email,
      subject: 'Redefina sua senha — Estoque Inteligente',
      text: `Recebemos uma solicitação para redefinir sua senha.\n\n${url}\n\nO link expira em 30 minutos e só pode ser usado uma vez. Se não foi você, ignore esta mensagem.`,
    };
    if (this.transport) {
      await this.transport.sendMail(message);
      return;
    }
    // Somente desenvolvimento; a configuração impede file em produção.
    const directory = new URL('../../../../../.local/mail/', import.meta.url);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(new URL(`${Date.now()}-${randomUUID()}.json`, directory), JSON.stringify(message, null, 2), { mode: 0o600, flag: 'wx' });
  }
}
