# Mineração de dados — base e planejamento inicial

## 1. Perguntas de negócio

1. Quais produtos mais contribuem para o valor movimentado e exigem maior controle?
2. Quais produtos possuem demanda estável, variável ou intermitente?
3. Que grupos de produtos apresentam comportamento semelhante de giro, margem, sazonalidade e estoque?
4. Quanto será demandado por produto nos próximos 7, 30 e 90 dias?
5. Quais itens podem entrar em ruptura antes de uma reposição chegar?

## 2. Definição da base

### Fonte primária

Dados autorizados do sistema Bling em produção, obtidos por integração oficial e incremental. A carga mínima desejada contém:

- catálogo: identificador externo, SKU, nome, categoria, situação, preços e fornecedor;
- vendas: pedido, data, situação, canal e valor;
- itens: produto, quantidade, preço, desconto e total;
- estoque: depósito, saldo, reserva e instante da posição;
- movimentações e devoluções, quando disponíveis e necessárias;
- campos complementares internos: prazo de reposição e estoque mínimo.

Dados de clientes não são necessários para os objetivos atuais e devem ser excluídos ou anonimizados.

### Base externa para desenvolvimento e validação

Enquanto o histórico autorizado do Bling não estiver disponível, o projeto usará a
base [Retail Sales Data](https://www.kaggle.com/datasets/berkayalan/retail-sales-data),
publicada no Kaggle sob **CC0 1.0 (domínio público)**. Essa licença permite copiar,
modificar e utilizar os dados inclusive para fins comerciais, sem restringir o
software ou o modelo a uso acadêmico.

A versão obtida em 08/09/2026 contém:

- `sales_daily.csv`: 19.454.838 observações e os campos produto, loja, data,
  vendas, receita, estoque, preço e promoções;
- `product_hierarchy.csv`: dimensões físicas, cluster e cinco níveis de
  hierarquia dos produtos;
- `store_cities.csv`: tipo, tamanho e cidade das lojas;
- período informado pela fonte: 2017 a 2019, referente a uma varejista turca;
- SHA-256 de `sales_daily.csv`:
  `049021871734B9CF2382FEBD09D0397B667B65E367DAB8CCD2874E8165A5384E`.

Ela será usada para desenvolver ingestão, perfil, atributos, agrupamento,
classificação e previsão. Apesar da licença permissiva, um modelo treinado apenas
nessa base não será tratado como adequado para decisões de outra empresa: antes
de produção, deverá ser recalibrado e reavaliado com o histórico autorizado do
Bling. A base M5 não foi escolhida como fonte oficial porque sua licença é
condicionada às regras da competição.

### Estratégia de integração com o Bling

A documentação vigente do Bling define uma API v3 REST com autorização OAuth 2.0 pelo fluxo Authorization Code. A integração deve executar troca e renovação de tokens somente no servidor, armazenar o segredo fora do código e adotar o formato JWT recomendado pelo provedor. A primeira versão fará reconciliação incremental diária; webhooks de produto, pedido e estoque podem reduzir a latência em uma etapa posterior, sem substituir a reconciliação diária contra perdas de eventos.

A rotina deverá respeitar os limites publicados da API, paginar respostas, aplicar espera exponencial em falhas transitórias e persistir o cursor apenas após a transação local ser concluída.

### Unidade de análise

- **previsão:** produto × dia (`daily_product_demand`);
- **classificação/agrupamento:** produto × janela de análise;
- **painel operacional:** produto × depósito na posição mais recente.

### Período e corte

Desejável: 24 meses ou mais. Mínimo inicial: 12 meses para capturar parte da sazonalidade. O conjunto de teste usa as semanas mais recentes e nunca é embaralhado, evitando vazamento temporal.

## 3. Processo CRISP-DM

```mermaid
flowchart LR
    A[Entendimento do negócio] --> B[Entendimento dos dados]
    B --> C[Preparação]
    C --> D[Modelagem]
    D --> E[Avaliação temporal]
    E --> F[Publicação e monitoramento]
    E -->|resultado insuficiente| C
    F -->|drift ou erro| B
```

## 4. Preparação dos dados

1. mapear estados de pedido válidos, cancelamentos e devoluções;
2. converter datas para uma referência única e derivar calendário local;
3. eliminar duplicidades por identificador externo e sequência do item;
4. preencher a grade diária por produto, distinguindo zero de venda de dado ausente;
5. criar atributos de calendário: dia da semana, mês, feriado, início/fim de mês;
6. criar defasagens e médias móveis usando somente valores anteriores ao instante previsto;
7. calcular frequência, recência, giro, margem, coeficiente de variação e proporção de zeros;
8. detectar valores extremos e preservá-los quando representarem eventos reais;
9. separar treino, validação e teste em ordem cronológica;
10. versionar conjunto, parâmetros, métricas e artefato.

## 5. Técnicas planejadas

### 5.1 Classificação de produtos

Não supervisionada por regras de negócio:

- **ABC:** participação acumulada no valor de consumo/receita;
- **XYZ:** regularidade, usando coeficiente de variação e frequência de demanda zero;
- matriz combinada `AX` a `CZ` para orientar prioridade e política de estoque.

Caso exista posteriormente um rótulo confiável (por exemplo, “entrou em ruptura nos próximos 30 dias”), serão avaliados modelos supervisionados de classificação, como regressão logística, Random Forest e Gradient Boosting. Métricas: precisão, recall, F1 e PR-AUC, com ênfase em recall para risco de ruptura.

### 5.2 Agrupamento

Algoritmos candidatos:

- K-Means como linha de base para atributos padronizados e numéricos;
- agrupamento hierárquico para interpretar relações entre grupos;
- HDBSCAN se a análise revelar formatos irregulares e muitos ruídos.

Atributos candidatos: vendas médias, desvio, coeficiente de variação, proporção de zeros, intervalo médio entre vendas, giro, margem, preço, lead time e tendência. Número e utilidade dos grupos serão avaliados por silhouette score, Davies–Bouldin, estabilidade e interpretação de negócio. O cluster não terá uma ordem implícita.

### 5.3 Previsão de demanda

Ordem de experimentação:

1. **Naive sazonal** como linha de base obrigatória;
2. médias móveis e suavização exponencial;
3. ETS/ARIMA para séries densas e suficientemente longas;
4. Croston/SBA/TSB para demanda intermitente;
5. modelos globais baseados em árvores com defasagens e atributos de calendário quando houver muitos produtos.

O algoritmo final pode variar por perfil de série. Métricas principais: WAPE e MAE; sMAPE será complementar. MAPE não será a métrica principal por falhar em dias com demanda zero. A avaliação usa backtesting com janelas deslizantes nos horizontes de 7, 30 e 90 dias.

## 6. Critérios de aceite analíticos

| Entrega | Critério inicial |
| --- | --- |
| Qualidade da base | regras críticas aprovadas e relatório de cobertura publicado |
| ABC/XYZ | 100% dos produtos elegíveis classificados e limites registrados |
| Clusters | solução estável, interpretável e melhor que segmentação aleatória nas métricas escolhidas |
| Previsão | WAPE menor que a naive sazonal no teste ou justificativa para manter a linha de base |
| Rastreabilidade | toda saída referencia execução, algoritmo, parâmetros e janela de dados |
| Atualização | execução diária idempotente e monitorada |

Metas numéricas definitivas só serão fixadas após conhecer a variabilidade e a ocorrência de demanda zero.

## 7. Planejamento de experimentos

| Etapa | Saída | Dependência |
| --- | --- | --- |
| Extração piloto | amostra anonimizada + dicionário da origem | autorização e credencial de leitura |
| Perfil | relatório estatístico e problemas de qualidade | amostra piloto |
| Dataset v1 | série diária e atributos reproduzíveis | regras de status/devolução validadas |
| Baselines | naive, ABC e XYZ versionados | dataset v1 |
| Clustering | comparação de algoritmos e perfis dos grupos | atributos escalados |
| Forecast | backtesting por horizonte e tipo de demanda | histórico mínimo |
| Publicação | tabelas de resultados consultadas pela API | modelo aprovado |
| Monitoramento | erro realizado, cobertura e drift | vendas posteriores |

## 8. Governança e riscos

- manter snapshot bruto criptografado somente se autorizado e pelo prazo aprovado;
- não versionar CSV real, tokens, documentos fiscais ou informações pessoais;
- registrar linhagem do dado da origem até a previsão;
- impedir que dados futuros entrem em atributos de treino;
- revisar viés de disponibilidade: venda observada pode ser menor que demanda real quando houve ruptura;
- aplicar validação humana antes de decisões de compra;
- retreinar por calendário ou por degradação comprovada, não a cada acesso ao painel.

## 9. Referências da fonte

- [Visão geral e autenticação da API do Bling](https://developer.bling.com.br/bling-api)
- [Aplicativos e fluxo de autorização](https://developer.bling.com.br/aplicativos)
- [Webhooks disponíveis no Bling](https://developer.bling.com.br/webhooks)
- [Limites de uso da API](https://developer.bling.com.br/limites)
