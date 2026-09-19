# Primeira execução do projeto

Este guia prepara uma máquina nova para executar API, Web, PostgreSQL, pipeline
de dados, IA e Flutter. Os comandos abaixo usam PowerShell e devem ser
executados na raiz do repositório.

## 1. Pré-requisitos

Instale:

- Git;
- Node.js 22 ou superior (a CI usa Node.js 24);
- npm 10 ou superior;
- Python 3.12;
- PostgreSQL 18;
- Flutter 3.41 ou superior, somente para Mobile/Desktop;
- Visual Studio com **Desktop development with C++**, para o executável Windows;
- Android Studio/SDK, para Android.

Confirme as instalações:

```powershell
git --version
node --version
npm --version
py --version
psql --version
flutter --version
```

O projeto não usa Kaggle nem exige a ferramenta `kaggle`. A base é baixada
diretamente do repositório oficial da UCI.

## 2. Instalar as dependências JavaScript

Entre na pasta clonada e instale exatamente as versões do lockfile:

```powershell
cd C:\caminho\para\DSM-G05-PI6-2026-2
npm install
```

Em CI ou depois que o `package-lock.json` estiver consolidado, prefira
`npm ci` para uma instalação totalmente reproduzível.

## 3. Criar os arquivos de ambiente

Os arquivos reais são ignorados pelo Git. Não envie senhas, chaves ou tokens ao
repositório.

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Se algum arquivo já existir, não o sobrescreva. A configuração mínima da API é:

```dotenv
HOST=0.0.0.0
PORT=3333
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://estoque_app:SUA_SENHA@127.0.0.1:5432/estoque_inteligente
DB_POOL_MAX=10
WEB_URL=http://localhost:3000
REGISTRATION_ENABLED=true
MAIL_MODE=file
MAIL_FROM=noreply@estoque.local
MESSAGING_MODE=disabled
PUBSUB_TOPIC=inventory-domain-events
```

O Web precisa apenas de:

```dotenv
API_URL=http://127.0.0.1:3333
```

Se a senha do PostgreSQL tiver caracteres como `@`, `:`, `/`, `#` ou `%`, eles
precisam estar codificados na URL. Para a primeira execução, uma senha longa
alfanumérica evita esse problema.

## 4. Preparar o PostgreSQL

Escolha somente uma das opções.

### Opção A — PostgreSQL normal na porta 5432

Esta é a opção mais simples em outro computador. Abra o **SQL Shell (psql)** ou
um terminal administrativo do PostgreSQL:

```powershell
psql -U postgres -h 127.0.0.1 -p 5432
```

Informe a senha definida na instalação do PostgreSQL e execute, substituindo a
senha do exemplo pela mesma usada no `DATABASE_URL`:

```sql
CREATE ROLE estoque_app WITH LOGIN PASSWORD 'SUA_SENHA';
CREATE DATABASE estoque_inteligente OWNER estoque_app;
\q
```

Se a role já existir, não a recrie. Para redefinir sua senha:

```sql
ALTER ROLE estoque_app WITH PASSWORD 'NOVA_SENHA';
```

Mantenha a porta `5432` no `DATABASE_URL`. O serviço do PostgreSQL instalado no
Windows normalmente inicia automaticamente, portanto não use `npm run db:start`
nesta opção.

### Opção B — instância isolada existente na porta 5433

Esta opção é usada no computador em que a instância exclusiva do projeto já foi
inicializada em `%LOCALAPPDATA%\EstoqueInteligente\postgres-18\data`:

```powershell
npm run db:start
```

Nesse caso, use a porta `5433` no `DATABASE_URL`. O comando apenas inicia uma
instância já inicializada; em uma máquina nova, use a opção A.

### Testar a conexão

No DBeaver, use:

| Campo | Valor |
| --- | --- |
| Host | `127.0.0.1` |
| Porta | `5432` ou `5433`, conforme a opção |
| Banco | `estoque_inteligente` |
| Usuário | `estoque_app` |
| Senha | a definida localmente |

Depois aplique as migrações:

```powershell
npm run db:migrate
```

Não é necessário executar `db:seed` para usar a base UCI. O seed existe apenas
como amostra técnica pequena.

## 5. Preparar Python, carregar a base e treinar a IA

Crie o ambiente virtual e instale as dependências fixadas:

```powershell
py -m venv .venv
npm run ml:setup
```

Execute todo o pipeline:

```powershell
npm run data:setup
```

Esse comando:

1. confirma as migrações do banco;
2. baixa aproximadamente 45 MB da UCI;
3. valida e registra o SHA-256 do arquivo;
4. lê cerca de 1,07 milhão de linhas sem armazenar `Customer ID`;
5. carrega produtos, pedidos, demanda diária e fatos particionados;
6. cria um depósito explicitamente marcado como simulado;
7. executa ABC/XYZ, K-Means, classificação e previsão;
8. grava resultados, métricas e versões no PostgreSQL.

O primeiro processamento pode levar alguns minutos. As mensagens
`linhas lidas...` indicam progresso. Se aparecer “a versão já foi carregada”, a
proteção idempotente funcionou e nenhuma duplicação foi criada.

Arquivos baixados ficam em `data/raw/` e modelos em `models/`; ambos são
ignorados pelo Git.

## 6. Iniciar API e Web

```powershell
npm run dev
```

Endereços:

- Web: `http://localhost:3000`;
- API: `http://localhost:3333`;
- saúde da API: `http://localhost:3333/health`;
- OpenAPI/Swagger: `http://localhost:3333/docs`.

Crie a primeira conta em `http://localhost:3000/cadastro`. Para torná-la
administradora e permitir cadastros e movimentações:

```powershell
npm run user:promote -- --email seu-email@exemplo.com
```

Pare `npm run dev` com `Ctrl+C`. A instância isolada da opção B pode ser
encerrada com `npm run db:stop`.

## 7. Recuperação de senha e e-mail

Na primeira execução, `MAIL_MODE=file` não envia mensagens externas. Os e-mails
de recuperação são gravados em `.local/mail/`, o que permite testar sem conta de
provedor.

Para envio real, configure um SMTP e mantenha a credencial somente em
`apps/api/.env`:

```dotenv
MAIL_MODE=smtp
MAIL_FROM=noreply@seu-dominio.com
SMTP_URL=smtps://USUARIO:SENHA_CODIFICADA@SERVIDOR:465
```

O domínio de `MAIL_FROM` precisa estar autorizado pelo provedor. Nunca coloque a
chave SMTP no Git, em prints ou na documentação.

## 8. Executar Mobile e Desktop

Consulte também [Interface Flutter](13-interface-flutter.md) para temas,
validação visual, APK de desenvolvimento e conexão por USB.

Com a API funcionando:

```powershell
npm run mobile
npm run desktop
```

Endereço padrão da API por plataforma:

- emulador Android: `http://10.0.2.2:3333`;
- Windows/Desktop: `http://127.0.0.1:3333`;
- celular físico: use o IP local do computador.

Exemplo para aparelho físico:

```powershell
cd apps/mobile
flutter run --dart-define=API_BASE_URL=http://192.168.0.10:3333
```

O computador e o aparelho precisam estar na mesma rede, e o firewall deve
permitir a porta 3333. Em produção, a URL deve usar HTTPS.

## 9. Mensageria

A API já grava eventos na `outbox_events`. Sem Google Cloud ou emulador, deixe
`MESSAGING_MODE=disabled`; as funcionalidades HTTP e de estoque continuam
operando normalmente.

Com um projeto Google Cloud ou emulador do Pub/Sub configurado:

```dotenv
MESSAGING_MODE=google-pubsub
PUBSUB_TOPIC=inventory-domain-events
GOOGLE_CLOUD_PROJECT=estoque-inteligente-dev
# PUBSUB_EMULATOR_HOST=127.0.0.1:8085
```

Inicie o publicador:

```powershell
npm run worker:outbox
```

O worker usa Protocol Buffers, retentativas e bloqueio concorrente
`FOR UPDATE SKIP LOCKED`. A entrega é pelo menos uma vez; consumidores devem usar
`processed_messages` para idempotência.

## 10. Validar a instalação

```powershell
npm run lint
npm test
npm run test:ml
npm run test:integration --workspace=@estoque-inteligente/api
npm run build

cd apps/mobile
flutter analyze
flutter test
```

Os testes de integração criam schemas descartáveis e não apagam as tabelas do
projeto.

## 11. Problemas comuns

### `ECONNREFUSED 127.0.0.1:5432` ou `5433`

O PostgreSQL está parado ou o `DATABASE_URL` aponta para outra porta. Confirme a
opção escolhida na seção 4 e teste a conexão no DBeaver.

### `password authentication failed`

A senha do `apps/api/.env` não corresponde à role `estoque_app`. Entre como
`postgres`, execute `ALTER ROLE` e atualize o arquivo `.env`.

### `py` ou `python` não reconhecido

Reinstale Python 3.12 marcando **Add Python to PATH**. No Windows, o comando
esperado neste guia é `py`.

### `kaggle` não reconhecido

Isso não afeta o projeto. O Kaggle deixou de ser usado; execute
`npm run data:setup`.

### A Web abre, mas os dados não aparecem

Confirme, nesta ordem:

```powershell
npm run db:migrate
npm run data:setup
npm run dev:api
```

Abra `http://localhost:3333/health`. A resposta deve informar
`"database":"connected"`.

### Porta já ocupada

Verifique qual processo usa a porta:

```powershell
Get-NetTCPConnection -LocalPort 3000,3333,5432,5433 -ErrorAction SilentlyContinue
```

Altere as portas somente mantendo `apps/api/.env`, `apps/web/.env.local` e a URL
do Flutter consistentes.
