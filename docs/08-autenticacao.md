# Autenticação — API TypeScript e Web JavaScript

Implementada em `feature/authentication`, com PR diretamente para `main`.

## Executar e experimentar

```powershell
npm install
npm run db:start
npm run db:migrate
npm run dev
```

Abra `http://localhost:3000/cadastro`, crie sua conta e entre em `/login`.
Não existe usuário administrador ou senha padrão. O cadastro cria o papel
`viewer` (consulta). Todos os usuários desta versão pertencem à mesma operação;
ainda não há isolamento entre empresas. O cadastro é aberto por padrão somente
em desenvolvimento/teste; produção exige liberação explícita por configuração.

## Telas e API

| Tela | Método e endpoint |
| --- | --- |
| `/cadastro` | POST `/api/v1/auth/register` — name, email, password |
| `/login` | POST `/api/v1/auth/login` — email, password, remember |
| `/esqueci-senha` | POST `/api/v1/auth/forgot-password` — email |
| `/redefinir-senha#token=…` | POST `/api/v1/auth/reset-password` — token, password |
| `/conta` | POST `/api/v1/auth/change-password` — currentPassword, password |
| Botão Sair | POST `/api/v1/auth/logout` — objeto vazio |
| Sessão atual | GET `/api/v1/auth/me` |
| Cadastro disponível | GET `/api/v1/auth/config` |

O navegador chama o Next.js no mesmo domínio. Um intermediário com lista explícita
de endpoints encaminha chamadas para a API Fastify (`API_URL`, variável somente
do servidor). As regras de autenticação vivem na API; a página `/` e `/conta`
também verificam a sessão no servidor antes de renderizar.

## Senhas, sessões e acesso

- Senhas de 15 a 128 caracteres, sem truncamento ou normalização silenciosa.
  Armazenamento Argon2id com salt aleatório, memória de 19 MiB, duas iterações e
  paralelismo 1. Não se usa criptografia reversível para senhas.
- Sessões opacas de 256 bits; apenas SHA-256 do token é armazenado no banco.
  Cookie `estoque_session`: HttpOnly, SameSite=Lax, Path=/, Secure em produção.
  Não há token em localStorage ou no JSON de login.
- Sessão de 8 horas; opção "Manter conectado" dá validade de 7 dias e cookie
  persistente. Sem a opção, o cookie é de sessão; navegadores podem restaurá-lo,
  mas a validade de 8 horas no servidor continua obrigatória.
- Logout revoga a sessão no PostgreSQL. Troca e recuperação de senha revogam
  todas as sessões e links pendentes, em transação.
- Lock do usuário e verificação do hash impedem que login concorrente à troca de
  senha recrie uma sessão com a senha antiga. O reset revalida o token após o lock.
- Consultas SQL parametrizadas; validação estrita do corpo, sem aceitar `role`.
- Login inválido usa mensagem genérica e verificação de hash fictício para conta
  inexistente. Recuperação responde genericamente para conta inexistente e limite
  por conta. Cadastro duplicado retorna 409; não promete ocultar existência de conta.
- CSRF: validação de Origin e header customizado `X-Requested-With:
  EstoqueInteligente` em toda escrita, incluindo login/logout; CORS com allowlist.
  No Next.js, POST também exige JSON e Origin idêntico ao domínio da requisição.
- Limite por IP em memória, reforçado por contadores atômicos no PostgreSQL para
  login, cadastro e reset. Sem confiar em `X-Forwarded-For` fornecido pelo cliente.
  Atrás do Next.js, a API observa o IP do intermediário; em produção, configurar
  proxy confiável/rate limiting na borda para não limitar vários usuários juntos.
- Respostas autenticadas usam `Cache-Control: no-store`; logs não incluem cookies,
  senhas, links de recuperação ou credenciais SMTP.

Base: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
e [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Recuperação de senha e e-mail

Sem configuração adicional, `MAIL_MODE=file` grava mensagens em `.local/mail/`
na raiz do repositório. Esses arquivos são **apenas para desenvolvimento**, contêm
links válidos e são ignorados pelo Git. Abra a mensagem mais recente localmente e
copie o link do campo `text` para o navegador. Não existe endpoint público para
consultar essa caixa e a API nunca devolve o token na resposta de recuperação.

O link expira em 30 minutos, só pode ser usado uma vez e um novo pedido invalida
o anterior. O token fica no fragmento `#token=`, evitando envio em URL aos logs
HTTP e cabeçalhos Referer; é enviado à API somente no corpo do POST de redefinição.

Para envio real, configure em `apps/api/.env`:

```dotenv
MAIL_MODE=smtp
SMTP_URL=smtps://usuario:senha@servidor:465
MAIL_FROM=contato@seu-dominio.com.br
WEB_URL=https://seu-dominio.com.br
REGISTRATION_ENABLED=false
```

Codifique caracteres especiais de usuário/senha SMTP para URL. Não versione
credenciais. Produção recusa inicialização com caixa local ou WEB_URL HTTP.
O envio SMTP real depende das credenciais e do remetente configurados. Falhas
produzem um log genérico; ainda não há fila com retentativas de envio de e-mails.

## Banco e testes

Migração incremental `002_authentication`: `users`, `auth_sessions`,
`password_reset_tokens`, `auth_rate_limits`, `audit_logs`. O schema inicial
permanece inalterado e o migrador valida checksums de ambas as migrações.

```powershell
npm test
npm run test:integration --workspace @estoque-inteligente/api
npm run lint
npm run build
```

Os testes de integração usam a DATABASE_URL configurada, criam um schema de nome
aleatório e removem somente esse schema ao terminar. Precisam de permissão
CREATE SCHEMA. Testam cadastro, hash, SQL injection, CSRF, proteção de estoque,
cookies, recuperação concorrente/uso único, revogação, expiração e rate limit.
O GitHub Actions executa esses testes com um PostgreSQL descartável.

## Feedback visual

As telas Web usam transições CSS curtas (140–280 ms), entrada dos formulários
na navegação, feedback animado de sucesso/erro e spinners durante envio/logout.
`loading.js` oferece skeletons nas telas de autenticação, conta e painel;
as previsões também têm skeleton ao consultar um novo período. A atualização
de dados já carregados preserva o conteúdo e sinaliza o progresso no botão.
Não há espera artificial para exibir animações. `prefers-reduced-motion` reduz
transições e desativa o movimento contínuo dos skeletons.

## Limites desta etapa

- Flutter ainda precisa de telas de autenticação e persistência segura de cookies.
  As consultas antigas sem sessão recebem 401; não há bypass para mobile/desktop.
- Ainda não há MFA, verificação de e-mail, convites ou administração de usuários.
  Não abrir cadastro de produção para uma operação com dados reais sem controle
  de admissão dos usuários. `viewer` dá acesso de leitura à operação existente.
- CSP bloqueia frames e objetos, mas permite scripts inline necessários à
  configuração atual do Next.js. Nonces/CSP estrita ficam para uma etapa posterior.
- Definir retenção e rotina de limpeza para sessões/tokens expirados, contadores
  e logs antes da operação contínua em produção.
