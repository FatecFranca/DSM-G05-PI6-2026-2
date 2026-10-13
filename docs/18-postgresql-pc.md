# PostgreSQL instalado no PC

Destino local: `127.0.0.1:5432`, banco `estoque_inteligente`, usuário `gabriel`.
A senha permanece somente em `apps/api/.env`, fora do Git. Não está neste guia.

## Uso diário

O serviço `postgresql-x64-18` do Windows deve estar em execução.
`npm run db:start` agora **verifica a conexão**, não inicia outra instância.
Se o serviço estiver parado, use Serviços do Windows com autorização administrativa.
Não pare o serviço sem verificar outros bancos que dependem dele.

No DBeaver, use os dados acima e informe a senha apenas no campo apropriado.
Não use mais a porta 5433 para a aplicação após a migração.

## Migração segura

Origem preservada: instância dedicada `127.0.0.1:5433/estoque_inteligente`.
Foi criado backup custom, sem proprietários/ACL, em `.local/backups/` (ignorado
pelo Git), para restaurar em banco **novo**, sem sobrescrever os bancos existentes.
Validar contagens e aplicação antes do corte. O backup contém dados de usuários
e deve ser protegido como informação sensível, mesmo com senhas em hash.

Não executar `db:seed` para migrar: restauração preserva dados, usuários e histórico.
A instância antiga não deve receber novas escritas após o corte. Retorno após
novas escritas exige reconciliar os dados; trocar a URL de volta não faz isso.

O usuário `gabriel` possui superusuário na instalação local. Essa configuração
é somente de desenvolvimento; para nuvem, usar usuário de aplicação restrito,
migrações separadas e nova senha forte.

Comandos `db:legacy:start`/`db:legacy:stop` ficam disponíveis apenas para a
instância antiga dedicada, não para controlar o serviço compartilhado do PC.

## Registro da migração — 13/10/2026

Backup: `.local/backups/sprint2-before-pc-migration-20261013.dump`,
182.242.799 bytes. Restauração concluída sem erros em transação única, em banco
novo na porta 5432. A URL local foi alterada somente após comparar as contagens.

| Tabela | Linhas na origem e no destino |
| --- | ---: |
| products | 4.789 |
| users | 1 |
| inventory_levels | 4.789 |
| sales_orders | 39.566 |
| sales_order_items | 1.003.744 |
| retail_sales_facts | 1.067.371 |
| daily_product_demand | 789.378 |
| model_runs | 8 |
| demand_forecasts | 608.203 |
| product_analyses | 4.789 |
| stock_movements | 0 |
| schema_migrations | 7 |

Contagens são uma verificação de integridade quantitativa, não comparação
campo a campo de todas as linhas. Nenhum outro banco da instância foi alterado.
O histórico operacional de movimentações estava vazio na origem; as evidências
de entrada/saída/transferência precisam ser demonstradas com dados de teste.
