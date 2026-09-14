'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AuthApiClient } from '@/services/auth-api-client';

const api = new AuthApiClient();
const screens = {
  login: { title: 'Que bom ter você de volta.', description: 'Entre na sua conta para acompanhar seu estoque.', submit: 'Entrar na conta', endpoint: 'login' },
  register: { title: 'Comece por aqui.', description: 'Crie seu acesso ao Estoque Inteligente.', submit: 'Criar minha conta', endpoint: 'register' },
  forgot: { title: 'Esqueceu sua senha?', description: 'Informe seu e-mail. Enviaremos um link para criar uma nova senha.', submit: 'Enviar link de recuperação', endpoint: 'forgot-password' },
  reset: { title: 'Uma nova senha.', description: 'Escolha uma senha longa e exclusiva para sua conta.', submit: 'Redefinir senha', endpoint: 'reset-password' },
  change: { title: 'Proteja sua conta.', description: 'Ao alterar a senha, suas sessões serão encerradas em todos os dispositivos.', submit: 'Alterar senha', endpoint: 'change-password' },
};

function PasswordField({ id, label, isNew = false, error }) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-password">
      <Input id={id} name={id} type={visible ? 'text' : 'password'} required minLength={isNew ? 15 : 1} maxLength={128}
        autoComplete={isNew ? 'new-password' : 'current-password'} aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : isNew ? `${id}-hint` : undefined} />
      <Button type="button" variant="ghost" size="icon" onClick={() => setVisible(!visible)} aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible}>
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
    {isNew && <small id={`${id}-hint`}>Use de 15 a 128 caracteres. Uma frase é uma boa opção.</small>}
    {error && <small className="auth-field-error" id={`${id}-error`}>{error}</small>}
  </div>;
}

export function AuthForm({ mode = 'login', registrationEnabled = true }) {
  const screen = screens[mode];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});
  const [success, setSuccess] = useState('');
  const hasEmail = ['login', 'register', 'forgot'].includes(mode);
  const hasNewPassword = ['register', 'reset', 'change'].includes(mode);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setFields({});
    const form = new FormData(event.currentTarget);
    const body = {};
    if (hasEmail) body.email = form.get('email').trim();
    if (mode === 'register') body.name = form.get('name').trim();
    if (mode !== 'forgot') body.password = form.get('password');
    if (mode === 'login') body.remember = form.get('remember') === 'on';
    if (mode === 'change') body.currentPassword = form.get('currentPassword');
    if (hasNewPassword && body.password !== form.get('confirmPassword')) {
      setFields({ confirmPassword: 'As senhas precisam ser iguais.' });
      setError('Confira a confirmação da senha.');
      return;
    }
    if (mode === 'reset') {
      body.token = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (!/^[A-Za-z0-9_-]{43}$/.test(body.token ?? '')) {
        setError('Link inválido. Solicite um novo link de recuperação.');
        return;
      }
    }
    setBusy(true);
    let navigating = false;
    try {
      const result = await api.request(screen.endpoint, body);
      if (mode === 'login') { navigating = true; window.location.replace('/'); return; }
      if (mode === 'reset') window.history.replaceState(null, '', '/redefinir-senha');
      setSuccess(result.message);
    } catch (failure) {
      setError(failure.message);
      setFields(Object.fromEntries(Object.entries(failure.fields ?? {}).map(([key, messages]) => [key, messages[0]])));
    } finally { if (!navigating) setBusy(false); }
  }

  return <Card className="auth-card">
    <CardHeader className="auth-card-heading">
      <p className="auth-eyebrow">SUA CONTA</p>
      <h2>{success ? (mode === 'forgot' ? 'Confira seu e-mail.' : 'Tudo certo!') : screen.title}</h2>
      <p>{success ? 'Você pode continuar pelo próximo passo abaixo.' : screen.description}</p>
    </CardHeader>
    <CardContent>
      {success ? <div className="auth-success motion-enter">
        <CheckCircle2 size={38} aria-hidden="true" />
        <p role="status">{success}</p>
        <Button asChild className="auth-submit"><Link href="/login">Ir para o login<ArrowRight /></Link></Button>
        {mode === 'forgot' && <Button variant="ghost" onClick={() => setSuccess('')}>Usar outro e-mail</Button>}
      </div> : <form onSubmit={submit} className="auth-form" aria-busy={busy}>
        {error && <Alert variant="destructive" className="motion-feedback"><AlertTitle>Não foi possível continuar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        <fieldset disabled={busy} className="auth-fields">
          {mode === 'register' && <div className="auth-field"><label htmlFor="name">Seu nome</label><Input id="name" name="name" autoComplete="name" minLength={2} maxLength={100} required aria-invalid={!!fields.name} />{fields.name && <small className="auth-field-error">{fields.name}</small>}</div>}
          {hasEmail && <div className="auth-field"><label htmlFor="email">E-mail</label><Input id="email" name="email" type="email" placeholder="voce@empresa.com.br" autoComplete="email" maxLength={254} required aria-invalid={!!fields.email} />{fields.email && <small className="auth-field-error">{fields.email}</small>}</div>}
          {mode === 'change' && <PasswordField id="currentPassword" label="Senha atual" error={fields.currentPassword} />}
          {mode !== 'forgot' && <PasswordField id="password" label={hasNewPassword ? 'Nova senha' : 'Senha'} isNew={hasNewPassword} error={fields.password} />}
          {hasNewPassword && <PasswordField id="confirmPassword" label="Confirmar senha" isNew error={fields.confirmPassword} />}
          {mode === 'login' && <div className="auth-options"><label className="auth-check"><input type="checkbox" name="remember" />Manter conectado por 7 dias</label><Link href="/esqueci-senha">Esqueci minha senha</Link></div>}
          <Button type="submit" disabled={busy} className="auth-submit">{busy ? <><LoaderCircle className="animate-spin" />Aguarde…</> : <>{screen.submit}<ArrowRight /></>}</Button>
        </fieldset>
        <span className="sr-only" role="status">{busy ? 'Processando sua solicitação…' : ''}</span>
      </form>}
      {!success && <div className="auth-links">
        {mode === 'login' && registrationEnabled && <p>Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></p>}
        {mode !== 'login' && <Link href={mode === 'change' ? '/' : '/login'}><ArrowLeft size={15} />{mode === 'change' ? 'Voltar ao painel' : 'Voltar para o login'}</Link>}
        {mode === 'reset' && <Link href="/esqueci-senha">Solicitar um novo link</Link>}
      </div>}
    </CardContent>
  </Card>;
}
