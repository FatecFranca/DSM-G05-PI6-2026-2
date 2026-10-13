# Azure VM — roteiro para o final da sprint 2

Decisão do usuário em 13/10/2026: usar VM na Azure. **VM ainda não criada**;
nenhum recurso pago foi provisionado nesta etapa. Este documento é preparação,
não prova de implantação. A proposta anterior Google Cloud fica como histórico.

## Topologia intermediária proposta

Uma VM Linux Ubuntu Server com web Next.js, API Fastify e PostgreSQL local.
Proxy reverso com HTTPS na frente dos serviços; banco sem porta pública.
Processos supervisionados por systemd ou contêineres, não terminais de desenvolvimento.
Treinamento inicialmente executado separadamente; publicar artefatos/resultados
identificados, sem exigir treinamento concorrente com as requisições da aplicação.

Uma VM é ponto único de falha. Reiniciar um processo não equivale a alta
disponibilidade. Evolução futura: múltiplas instâncias, balanceamento e banco
gerenciado redundante, com orçamento e validação específicos.

## Antes de criar

- Conferir assinatura, créditos estudantis, região, cotas e estimativa de custo.
- Escolher capacidade após observar memória/disco do build, PostgreSQL e ML.
- Definir grupo de recursos do projeto, responsável e limite de orçamento.
- Autenticar SSH por chave; nunca commitar chave privada, `.env` ou backup.
- Não reutilizar a senha local divulgada no chat. Criar credenciais fortes e
  distintas; aplicação sem superusuário e usuário de migração separado.

## Portal e rede

No portal Azure: Virtual machines → Create → Azure virtual machine. Escolher
Ubuntu Server compatível, assinatura/grupo/região e chave SSH. Revisar o custo
antes de confirmar. Procedimento oficial: [criar VM Linux](https://learn.microsoft.com/azure/virtual-machines/linux/quick-create-portal?tabs=ubuntu).

Configurar NSG: SSH 22 restrito ao IP administrativo, HTTPS 443 para usuários
e HTTP 80 somente para redirecionamento/emissão de certificado, quando necessário.
Não publicar 5432, 3000 ou 3333. As regras do NSG filtram tráfego de entrada e
saída: [documentação Microsoft](https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview).

## Implantação a executar após a criação

1. Atualizar o sistema, configurar firewall e usuário não-root.
2. Instalar versões compatíveis de Node.js e PostgreSQL, conforme `package.json`
   e versão do backup. Não restaurar dump PostgreSQL 18 em versão antiga sem validar.
3. Transferir código de um commit revisado; instalar com `npm ci` e executar build.
4. Criar banco vazio dedicado; restaurar backup sanitizado ou carregar dados
   de demonstração. Não levar sessões ativas/usuários pessoais para a nuvem.
5. Configurar segredos locais com permissões restritas; não imprimir URLs com senha.
6. Configurar domínio e TLS, proxy reverso e processos supervisionados.
7. API: `NODE_ENV=production`, `WEB_URL` e `CORS_ORIGIN` com HTTPS; SMTP válido,
   remetente verificado e `REGISTRATION_ENABLED` definido intencionalmente.
   O código exige SMTP e HTTPS em produção; não contornar essa validação.
8. Configurar a URL interna usada pelo proxy Next.js e a URL HTTPS da API no
   Flutter. Confirmar cookies Secure, CSRF, CORS e recuperação de senha.
9. Executar migrações e verificar saúde, login, CRUD e persistência após reinício.
10. Definir backup externo à VM, testar restauração e revisar logs sem segredos.

Os comandos específicos de implantação serão definidos após informar VM,
sistema operacional, domínio e forma de execução. Não há deploy automático pronto
nem VM validada neste roteiro.

## Mensageria

O código atual usa outbox e adaptador Google Pub/Sub. Mover a API para uma VM
Azure **não converte esse adaptador para Azure Service Bus**. Antes da prova de
mensageria, decidir entre manter Pub/Sub com credenciais próprias ou implementar
e testar outro adaptador. Não marcar mensageria Azure como implementada.

## Evidências finais

Registrar VM em execução, sistema/região/capacidade, NSG sem banco público,
aplicação HTTPS, testes de uma jornada e recuperação após reinício. Documentar
custos observados e limitações. Não expor chaves, cookies ou credenciais nos prints.
