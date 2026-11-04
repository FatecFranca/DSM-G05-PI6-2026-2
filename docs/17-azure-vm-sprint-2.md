# Azure VM — implantação da sprint 2

Homologação recriada e validada em **29/10/2026** na assinatura Azure for
Students. A VM anterior em Canada Central teve indisponibilidade de capacidade;
por isso, o projeto foi migrado para uma VM regional em Mexico Central. A VM
antiga permanece desalocada apenas como recuperação e não hospeda a aplicação.

## Ambiente implantado

| Item | Configuração validada |
| --- | --- |
| Grupo de recursos | `PI5` |
| VM | `servidor_pi_vi` |
| Região | Mexico Central, sem zona fixa |
| Tamanho | `Standard_B2als_v2`, 2 vCPU e 4 GiB |
| Sistema | Ubuntu Server 24.04 LTS |
| Node.js / npm | 22.23.2 / 10.9.8 |
| Banco | PostgreSQL 18 Alpine, contêiner `estoque-postgres` |
| Proxy | Nginx 1.24.0 na porta pública 80 |
| Aplicação | `http://68.155.155.247/` |
| Saúde | `http://68.155.155.247/health` |
| OpenAPI | `http://68.155.155.247/docs/` |

Next.js escuta em `127.0.0.1:3000`, Fastify em `127.0.0.1:3333` e PostgreSQL
em `127.0.0.1:5433`. Somente Nginx fica exposto à internet. API, web, publicador
outbox, consumidor Service Bus, Nginx, Docker e timer do pipeline iniciam com a
VM. O PM2 está instalado e seu daemon está habilitado, mas a lista está vazia:
os processos do projeto usam systemd para não duplicar portas.

## Segurança e mensageria

O NSG publica HTTP 80 e reserva HTTPS 443. SSH 22 fica restrito ao IP
administrativo; regras temporárias de implantação são removidas ao fim do
trabalho. Não há exposição pública de 3000, 3333, 5432 ou 5433. Segredos ficam
em `/etc/estoque-inteligente`, fora do Git e com acesso restrito.

A identidade gerenciada da VM possui somente `Azure Service Bus Data Sender` e
`Data Receiver` no namespace. O tópico `inventory-domain-events` usa detecção
de duplicatas por um dia; a assinatura `inventory-workers` tem dez tentativas,
TTL de 14 dias e DLQ. O consumidor grava UUIDs em `processed_messages` antes do
ack. Na validação, duas mensagens foram processadas, o backlog ficou zerado e a
DLQ vazia. Consulte [Mensageria Azure](19-mensageria-azure.md).

## Dados, ML e automação

As sete migrações foram aplicadas. A carga final preserva 1.067.371 fatos UCI,
1.003.744 itens aceitos, 4.737 produtos originais e 261.024 linhas simuladas em
BRL até 29/10/2026. A fonte é verificada por SHA-256 e nenhum identificador de
cliente é persistido. Os jobs publicam K-Means, Random Forest e previsão de
demanda com métricas e artefatos versionados.

`estoque-pipeline.timer` executa diariamente por volta de **01:30 no horário de
São Paulo** (04:30 UTC, com atraso aleatório de até cinco minutos): primeiro
estende os dados simulados até o dia corrente e depois republica os modelos. O
timer é persistente, então uma execução perdida ocorre na próxima inicialização.
`estoque-backup.timer` gera um dump PostgreSQL customizado por volta de 02:15,
valida tamanho e tabelas essenciais e mantém somente três dias. O primeiro dump
real validado possui aproximadamente 156 MiB. Backup externo e teste de
restauração em outro host continuam necessários para produção.

## Validação

No código até `02ee802`, foram aprovados na própria VM:

- `npm ci`, build e lint de API e web;
- 17 testes Node da API e 8 do web;
- 26 testes de integração com PostgreSQL real, incluindo repetição idempotente;
- 15 testes de ML aprovados e 1 integração opcional ignorada;
- publicação e consumo reais no Azure Service Bus;
- site, `/health` e `/docs/` com HTTP 200 externo.

O `npm audit` ainda informa 24 ocorrências transitivas (1 baixa, 6 moderadas,
13 altas e 4 críticas). Não foi aplicado `--force`, pois exigiria mudanças
potencialmente incompatíveis; a atualização controlada permanece pendência.

## Custo e operação

A assinatura mantém limite de gastos. Como o recurso nativo DevTestLab não está
disponível nessa região, um timer local usa a identidade gerenciada e uma role
customizada mínima para desalocar somente esta VM às **03:00 de São Paulo**.
Isso evita cobrança de computação esquecida; disco e IP continuam sendo
recursos cobrados enquanto existirem.

```powershell
ssh -i "$env:USERPROFILE\.ssh\azure_servidor_pi6_ed25519" MerlinTroll@68.155.155.247
```

```bash
sudo systemctl status estoque-api estoque-web estoque-outbox estoque-consumer
sudo systemctl status estoque-pipeline.timer azure-self-deallocate.timer
sudo docker ps --filter name=estoque-postgres
curl http://127.0.0.1/health
```

O projeto Vitalis e seus contêineres, imagens, volumes, unidades e arquivos não
existem nesta nova VM. Ela contém somente os recursos deste projeto. O ambiente
continua sendo homologação acadêmica em HTTP: domínio, TLS, SMTP real, backup
externo fora da VM, monitoramento com alertas e alta disponibilidade ainda são
requisitos para produção.
