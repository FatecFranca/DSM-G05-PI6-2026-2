# Azure VM — implantação da sprint 2

Implantação intermediária executada e validada em **18/10/2026**. Para evitar
um segundo custo na assinatura Azure for Students, foi reutilizada a VM
`servidor`, do projeto anterior. O projeto Vitalis foi parado somente depois de
um backup verificável; seus contêineres, volume e arquivos não foram excluídos.

## Ambiente implantado

| Item | Configuração validada |
| --- | --- |
| Assinatura | Azure for Students, limite de gastos ativo |
| Grupo de recursos | `PI5` |
| VM | `servidor` |
| Região | Canada Central |
| Tamanho | `Standard_B2als_v2`, 2 vCPU e 4 GiB |
| Sistema | Ubuntu Server 24.04 LTS |
| Node.js / npm | 22.23.2 / 10.9.8 |
| Banco | PostgreSQL 18 Alpine em contêiner Docker |
| Proxy | Nginx na porta pública 80 |
| Endereço | `http://4.229.233.225` |
| Saúde da API | `http://4.229.233.225/health` |
| OpenAPI/Swagger | `http://4.229.233.225/docs/` |

O site Next.js escuta apenas em `127.0.0.1:3000`, a API Fastify apenas em
`127.0.0.1:3333` e o PostgreSQL apenas em `127.0.0.1:5433`. O Nginx é o único
ponto público da aplicação. API e web são serviços `systemd`; o banco usa
`restart=unless-stopped`. Todos foram habilitados para iniciar com a VM.

## Segurança e rede

O NSG permite HTTP 80 para a demonstração, reserva HTTPS 443 e restringe SSH 22
ao IP administrativo observado na implantação. A antiga regra pública
`Vitalis-API`, porta 3333, foi removida. Não há regras públicas para 3000, 3333,
5432 ou 5433. O UFW também está ativo com política de negar entrada por padrão.

O acesso administrativo usa chave Ed25519; a chave privada não está no
repositório. As variáveis de ambiente ficam em `/etc/estoque-inteligente`, com
permissão `0640`, e não foram impressas nas evidências. O banco usa uma senha
aleatória e uma role de aplicação separada do superusuário do contêiner.

Esta é uma **homologação acadêmica intermediária**, servida por HTTP. A API roda
explicitamente em modo de desenvolvimento com e-mail gravado em arquivo porque
o grupo ainda não forneceu domínio, certificado e SMTP. Não se declarou
`NODE_ENV=production`: o próprio projeto exige HTTPS e SMTP real nesse modo.
Antes de tratar o ambiente como produção, configurar domínio, TLS, SMTP,
desativar cadastro público e revisar cookies, CORS, logs e backup externo.

## Dados e validação

Foram aplicadas as sete migrações e a carga técnica corrigida. Na validação, o
banco continha 4 produtos, 120 linhas de demanda e 508 previsões. O seed revelou
e permitiu corrigir um conflito com o depósito criado pela migração 004.

No commit-base `a2f1069`, executaram com sucesso:

- `npm ci`, lint de API/web, 19 testes não integrados e build de produção;
- saúde da API com banco conectado;
- cadastro temporário, login e consulta autenticada do dashboard;
- acesso externo ao site, `/health` e `/docs/`, todos com HTTP 200;
- reinício controlado de banco/API/web, preservando os 4 produtos do seed.

O `npm audit` informou 21 ocorrências em dependências (2 moderadas, 15 altas e
4 críticas). Não foi usado `npm audit fix --force`, pois isso pode introduzir
mudanças incompatíveis antes da entrega. A triagem e atualização controlada das
dependências permanecem como pendência técnica.

## Preservação do Vitalis

## Mensageria Azure Service Bus

O código atual usa outbox e adaptador Azure Service Bus. Antes da prova de
mensageria, configure identidade gerenciada na VM com permissão de envio no
namespace e valide o tópico e a DLQ. A implantação reproduzível está em
`infra/azure/service-bus.bicep`.

O backup está em
`/home/MerlinTroll/backups/vitalis-20261018T170441Z` e contém dump completo do
PostgreSQL, código sem `node_modules`, arquivos Compose, unidade `systemd`,
inspeção dos contêineres e `SHA256SUMS`. O dump passou em `gzip -t`. Os
contêineres `vitalis-postgres` e `vitalis-ml` estão parados com reinício
automático desabilitado, e o volume `vitalis_vitalis_pg_data` foi preservado.

## Custo e operação

Na consulta de 18/10/2026, a assinatura estava com `spendingLimit: On`. O Cost
Management mostrava aproximadamente **R$ 18,69** em outubro, referentes ao IP
público e ao disco já existentes, antes deste deploy. A referência pública de
varejo consultada para a VM `Standard_B2als_v2` em Canada Central era cerca de
**R$ 0,2182 por hora** de computação, sujeita à cobrança real da assinatura.

O desligamento automático está habilitado para **03:00 no horário de São Paulo**.
Antes da apresentação, ligar a VM no portal e confirmar os três endereços acima.
Desligar pelo portal com desalocação ao terminar; desligar apenas dentro do Linux
pode continuar reservando capacidade e gerando cobrança.

Comando de acesso, sem expor a chave:

```powershell
ssh -i "$env:USERPROFILE\.ssh\azure_servidor_pi6_ed25519" MerlinTroll@4.229.233.225
```

Comandos úteis dentro da VM:

```bash
sudo systemctl status estoque-api estoque-web nginx
sudo docker ps --filter name=estoque-postgres
sudo journalctl -u estoque-api -u estoque-web --since today
curl http://127.0.0.1/health
```

Uma VM continua sendo ponto único de falha. A entrega demonstra ambiente em
nuvem, integração e configuração inicial; não demonstra alta disponibilidade.
