import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../application/auth-service.js';
import { AuthError, type User } from '../domain/auth.js';
import type { AppConfig } from '../config.js';

declare module 'fastify' { interface FastifyRequest { user: User | null } }

export const sessionCookie = 'estoque_session';
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(15, 'Use uma senha com pelo menos 15 caracteres.').max(128);
const loginPassword = z.string().min(1).max(128);
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function readToken(request: FastifyRequest) {
  return request.cookies[sessionCookie];
}

export async function registerAuthRoutes(app: FastifyInstance, service: AuthService, config: AppConfig) {
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: config.nodeEnv === 'production' };
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0]!;
    if (request.method === 'OPTIONS') { return; }
    if (path.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
      if (!['GET', 'HEAD'].includes(request.method)) {
        // Custom header exige preflight; Origin é validado, inclusive em login/logout.
        if (request.headers['x-requested-with'] !== 'EstoqueInteligente'
          || (request.headers.origin && ![config.webUrl, ...config.corsOrigins].includes(request.headers.origin))) {
          throw new AuthError(403, 'Origem da solicitação não permitida.');
        }
      }
      if (!path.startsWith('/api/v1/auth/')) {
        request.user = await service.authenticate(readToken(request));
      }
    }
    if (path.startsWith('/docs') && config.nodeEnv === 'production') {
      const user = await service.authenticate(readToken(request));
      if (user.role !== 'admin') { throw new AuthError(403, 'Acesso restrito.'); }
    }
  });

  const protectedRoute = async (request: FastifyRequest) => {
    request.user = await service.authenticate(readToken(request));
  };
  const publicWrite = { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } };
  app.get('/api/v1/auth/config', async () => ({ registrationEnabled: config.registrationEnabled }));

  app.post('/api/v1/auth/register', publicWrite, async (request, reply) => {
    const body = z.object({ name: z.string().trim().min(2).max(100), email, password }).strict().parse(request.body);
    await service.limit(`register-ip:${request.ip}`, 10);
    const user = await service.register(body.name, body.email, body.password);
    return reply.code(201).send({ user, message: 'Conta criada. Entre com seu e-mail e senha.' });
  });
  app.post('/api/v1/auth/login', publicWrite, async (request, reply) => {
    const body = z.object({ email, password: loginPassword, remember: z.boolean().default(false) }).strict().parse(request.body);
    await service.limit(`login-ip:${request.ip}`, 40);
    const session = await service.login(body.email, body.password, body.remember);
    reply.setCookie(sessionCookie, session.token, { ...cookieOptions,
      ...(body.remember ? { expires: session.expiresAt } : {}),
    });
    return { user: session.user, expiresAt: session.expiresAt };
  });
  app.get('/api/v1/auth/me', { preHandler: protectedRoute }, async (request) => ({ user: request.user }));
  app.post('/api/v1/auth/logout', async (request, reply) => {
    await service.logout(readToken(request));
    reply.clearCookie(sessionCookie, cookieOptions);
    return { message: 'Sessão encerrada.' };
  });
  app.post('/api/v1/auth/forgot-password', publicWrite, async (request) => {
    const body = z.object({ email }).strict().parse(request.body);
    await service.limit(`reset-ip:${request.ip}`, 20);
    await service.forgotPassword(body.email);
    return { message: 'Se houver uma conta com esse e-mail, enviaremos as instruções de recuperação.' };
  });
  app.post('/api/v1/auth/reset-password', publicWrite, async (request, reply) => {
    const body = z.object({ token, password }).strict().parse(request.body);
    await service.limit(`reset-confirm-ip:${request.ip}`, 20);
    await service.resetPassword(body.token, body.password);
    reply.clearCookie(sessionCookie, cookieOptions);
    return { message: 'Senha redefinida. Entre novamente em sua conta.' };
  });
  app.post('/api/v1/auth/change-password', { ...publicWrite, preHandler: protectedRoute }, async (request, reply) => {
    const body = z.object({ currentPassword: loginPassword, password }).strict().parse(request.body);
    await service.changePassword(request.user!, body.currentPassword, body.password);
    reply.clearCookie(sessionCookie, cookieOptions);
    return { message: 'Senha alterada e sessões encerradas. Entre novamente.' };
  });
}
