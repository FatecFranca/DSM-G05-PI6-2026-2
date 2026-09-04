# Escopo e requisitos

## 1. Visão do produto

O **Estoque Inteligente** transforma o histórico de produtos, vendas e saldos do Bling em apoio objetivo à reposição. O sistema deverá mostrar a situação atual do estoque, classificar itens por importância e regularidade, agrupar produtos com comportamentos semelhantes e estimar a demanda futura.

### Problema

Decisões de compra feitas apenas por percepção podem provocar ruptura de itens importantes, capital parado em produtos de baixo giro e compras sem relação com sazonalidade ou prazo de reposição.

### Objetivo geral

Reduzir rupturas e excesso de estoque por meio de uma visão consolidada e de recomendações baseadas no histórico de demanda.

### Objetivos mensuráveis do MVP

- importar ao menos 12 meses de histórico de produtos, vendas e estoque autorizados;
- disponibilizar uma visão diária do estoque até 8h após o fechamento do dia anterior;
- classificar todos os produtos ativos nas curvas ABC e XYZ;
- gerar previsão por produto para 7, 30 e 90 dias;
- medir o erro de previsão e comparar o modelo com uma linha de base ingênua;
- sinalizar itens com risco de ruptura dentro do prazo de reposição.

## 2. Pessoas e sistemas envolvidos

| Ator | Necessidade principal |
| --- | --- |
| Gestor de estoque | Acompanhar indicadores, riscos e produtos prioritários |
| Comprador | Consultar demanda prevista e sugestão de reposição |
| Analista/administrador | Acompanhar sincronizações, qualidade dos dados e modelos |
| Bling | Fornecer produtos, pedidos, itens e posições de estoque |
| Agendador em nuvem | Disparar sincronização e processamento diário |

## 3. Escopo

### Incluído no MVP

- integração autorizada e incremental com dados do Bling;
- catálogo de produtos, categorias, fornecedores e depósitos;
- consolidação diária de vendas e saldo de estoque;
- dashboard responsivo com filtros e indicadores;
- classificação ABC (valor de consumo) e XYZ (variabilidade da demanda);
- agrupamento de produtos por comportamento;
- previsão de demanda por série temporal;
- alertas de ruptura e sugestão inicial de reposição;
- histórico de sincronizações e execuções dos modelos;
- API REST consumida pelos clientes web e móvel;
- cliente desktop Windows compartilhando a base Flutter e os contratos da API;
- processamento assíncrono de integração, mineração e alertas por mensageria;
- exportação de consultas em CSV.

### Fora do MVP

- efetuar pedidos de compra automaticamente no Bling;
- alterar preços ou estoque do sistema de origem;
- substituir funções contábeis ou fiscais do ERP;
- prever demanda de produtos sem histórico mínimo usando dados externos;
- operação offline completa;
- modelos prescritivos autônomos sem aprovação humana.

## 4. Requisitos funcionais

| ID | Requisito | Prioridade | Critério resumido de aceite |
| --- | --- | --- | --- |
| RF01 | Permitir autenticação de usuários e controle por perfil | Alta | Usuário não autenticado não acessa dados de negócio |
| RF02 | Configurar uma integração autorizada com o Bling | Alta | Credencial é validada e armazenada fora do código |
| RF03 | Executar carga inicial e sincronização incremental diária | Alta | Reexecução não duplica registros e gera um histórico da carga |
| RF04 | Consultar produtos, categorias, fornecedores e depósitos | Alta | Busca por nome/SKU e filtros retornam dados paginados |
| RF05 | Exibir saldo atual, reservado e disponível por produto | Alta | Saldo disponível é calculado e mostra data da última atualização |
| RF06 | Apresentar dashboard com KPIs de estoque e demanda | Alta | KPIs possuem período, unidade e estado de carregamento/erro |
| RF07 | Filtrar indicadores por período, categoria, depósito e classe | Média | Todos os componentes refletem os filtros ativos |
| RF08 | Calcular e consultar classificação ABC e XYZ | Alta | Resultado contém classe, métricas usadas e data do cálculo |
| RF09 | Agrupar produtos de comportamento semelhante | Média | Cluster e características predominantes ficam registrados |
| RF10 | Gerar previsão de demanda em 7, 30 e 90 dias | Alta | Previsão possui intervalo, versão do modelo e data de geração |
| RF11 | Identificar risco de ruptura considerando demanda e lead time | Alta | Alerta apresenta causa, severidade e horizonte estimado |
| RF12 | Sugerir quantidade de reposição para revisão humana | Média | Cálculo informa demanda, estoque disponível e estoque de segurança |
| RF13 | Exibir histórico e status das sincronizações e modelos | Média | Falha apresenta etapa, instante e mensagem útil ao administrador |
| RF14 | Exportar listas e previsões para CSV | Baixa | Arquivo respeita os filtros ativos e usa codificação UTF-8 |
| RF15 | Disponibilizar os dados por API versionada | Alta | Rotas usam `/api/v1`, JSON consistente e documentação OpenAPI |
| RF16 | Disponibilizar as jornadas principais em Web, Mobile e Desktop | Alta | Consulta de produto, previsão e risco funciona nas três plataformas |
| RF17 | Publicar comandos e eventos de processamento em um broker | Alta | Mensagens possuem ID, versão, correlação, esquema e consumidor idempotente |
| RF18 | Reprocessar mensagens com falha sem perder ou duplicar resultado | Alta | Retentativas terminam em DLQ e reenvio produz o mesmo estado final |
| RF19 | Consultar histórico analítico sem afetar a API operacional | Média | Consultas históricas são executadas no BigQuery/lago, não no banco transacional |

## 5. Requisitos não funcionais

| ID | Categoria | Requisito verificável |
| --- | --- | --- |
| RNF01 | Desempenho | Consultas comuns devem responder em até 2 s no percentil 95, excluindo importações |
| RNF02 | Atualização | A sincronização diária deve terminar até 8h após o fechamento do dia anterior |
| RNF03 | Segurança | Todo tráfego externo usa TLS; tokens ficam em gerenciador de segredos e nunca em logs ou Git |
| RNF04 | Privacidade | Coletar somente campos necessários e anonimizar identificadores de clientes para análise |
| RNF05 | Confiabilidade | Importações são idempotentes, retomáveis e registram contagens de inseridos, atualizados e rejeitados |
| RNF06 | Disponibilidade | Meta inicial mensal de 99,5% para leitura do dashboard |
| RNF07 | Usabilidade | Interface responsiva, estados vazios claros e linguagem de negócio em português brasileiro |
| RNF08 | Acessibilidade | Atender WCAG 2.2 nível AA nas jornadas principais |
| RNF09 | Manutenibilidade | Lint, testes automatizados, API documentada e separação entre domínio e integrações |
| RNF10 | Observabilidade | Logs estruturados, correlação por requisição, métricas de erro e alertas de falha nos jobs |
| RNF11 | Recuperação | Em produção, PITR habilitado com RPO de até 15 min e RTO de até 60 min, validados em ensaio |
| RNF12 | Qualidade do modelo | A previsão só é promovida quando supera a linha de base em WAPE no conjunto de teste temporal |
| RNF13 | Mensageria | Entrega é tratada como pelo menos uma vez; consumidores usam `message_id` para deduplicação |
| RNF14 | Alta disponibilidade | Ambiente produtivo usa serviços regionais e Cloud SQL HA, com meta mensal inicial de 99,9% |
| RNF15 | Escalabilidade | API e workers escalam independentemente e consultas analíticas não disputam recursos do OLTP |
| RNF16 | Portabilidade | Web, API e jobs geram contêineres OCI; o cliente Flutter gera artefatos Android, iOS e Windows |
| RNF17 | Testabilidade | Regras de domínio são desenvolvidas pelo ciclo TDD e não dependem diretamente de UI, broker ou banco |

## 6. Regras de negócio iniciais

- **RN01 — Estoque disponível:** quantidade em mãos menos quantidade reservada.
- **RN02 — Demanda:** quantidade vendida em pedidos válidos, agregada pela data da venda; cancelamentos e devoluções devem ser tratados explicitamente.
- **RN03 — Curva ABC:** classificação pelo valor de consumo no período (`quantidade × custo` ou, na ausência do custo, receita), com limites configuráveis inicialmente em 80%, 15% e 5% do valor acumulado.
- **RN04 — Curva XYZ:** classificação pela estabilidade da demanda a partir do coeficiente de variação e da frequência de dias sem venda; limites serão calibrados após o perfil dos dados.
- **RN05 — Ruptura:** existe risco quando o estoque disponível não cobre a demanda prevista durante o prazo de reposição somado ao estoque de segurança.
- **RN06 — Decisão humana:** sugestão de compra é informativa; a aprovação e o lançamento do pedido permanecem com o comprador.
- **RN07 — Rastreabilidade:** cada classificação ou previsão referencia a versão do modelo e a janela de dados usada.
- **RN08 — Eventos:** somente confirmar uma mensagem depois da transação local; mensagens repetidas não podem repetir o efeito.
- **RN09 — Consistência:** atualizações assíncronas podem ter consistência eventual, mas a interface deve mostrar a data da última atualização.

## 7. Histórias prioritárias

1. Como gestor, quero ver os produtos com maior risco de ruptura para priorizar ações.
2. Como comprador, quero comparar estoque disponível, demanda prevista e prazo de reposição antes de comprar.
3. Como analista, quero avaliar a qualidade dos dados importados antes de treinar modelos.
4. Como administrador, quero saber quando a última sincronização terminou e quais registros falharam.
5. Como gestor, quero filtrar o painel por categoria e período para investigar mudanças de demanda.

## 8. Premissas e riscos

| Item | Tratamento |
| --- | --- |
| Acesso ao Bling ainda depende de autorização | Desenvolver primeiro com contrato de dados e amostras anonimizadas |
| Campos e volume reais ainda são desconhecidos | Executar perfil de dados antes de congelar limiares e capacidade |
| Produtos podem ter pouco histórico | Aplicar regra de histórico mínimo e uma estratégia global/por grupo |
| Promoções e rupturas distorcem vendas observadas | Registrar eventos e diferenciar venda zero de indisponibilidade quando possível |
| Lead time pode não existir na origem | Permitir cadastro complementar e identificar valor estimado |
| Experiência desktop exige outra entrega | Compilar a aplicação Flutter para Windows e usar layout adaptativo |
| Mensagens podem chegar mais de uma vez ou fora de ordem | ID único, versão, consumidor idempotente, retentativas e DLQ |
| Crescimento histórico pode degradar o banco operacional | Particionar dados analíticos no lago/BigQuery e manter no PostgreSQL apenas o necessário à operação |
