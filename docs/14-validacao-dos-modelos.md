# Treinamento e limites das previsões

Prepare o ambiente e importe a base conforme [Primeira execução](11-primeira-execucao.md).

## Avaliar sem alterar o banco

```powershell
npm run test:ml
npm run ml:train -- --evaluate-only
```

A avaliação abre uma transação somente de leitura. Artefatos e `metrics.json`
são gravados em `models/uci-online-retail-ii/evaluation-v2` (fora do Git).
Para publicar os resultados da base ativa, execute `npm run ml:train`.
A API considera apenas a execução de previsão mais recente da base ativa,
sem somar versões antigas. Publicar não cria vendas nem atualiza o histórico.

## Modelos

- Agrupamento não supervisionado: K-Means sobre características normalizadas.
- Classificação supervisionada: Random Forest; atributos anteriores ao corte
  e alvo de demanda média posterior. A avaliação separa produtos, não representa
  acurácia temporal da previsão. O limiar usa somente os produtos de treinamento.
- Previsão: HistGradientBoostingRegressor com objetivo Poisson, lags e médias
  móveis, limitado aos 200 produtos mais vendidos antes do corte.
- Validação: últimos 30 dias previstos recursivamente a partir de um único corte,
  sem alimentar o modelo com vendas reais posteriores. Comparação com repetição
  sazonal da última semana; se o modelo perder em MAE, usa-se essa referência.
- Após avaliação, o regressor é reajustado com todo o histórico disponível.
  Produtos fora dos 200 usam a referência sazonal. Horizontes: 7, 30 e 90 dias.

MAE e WAPE são métricas de seleção no período de validação, não resultados de
um teste final independente nem garantias de desempenho futuro. As bandas
publicadas são heurísticas baseadas no MAE, **não intervalos calibrados**.
Valores ausentes são tratados como zero; isso pressupõe cobertura da fonte
naquele período e não recupera demanda perdida durante rupturas.

Referência metodológica: [validação temporal com atributos defasados — scikit-learn](https://scikit-learn.org/stable/auto_examples/applications/plot_time_series_lagged_features.html).

## Datas e moeda

A fonte UCI termina em 2011-12-09 e seus preços são GBP. Gerar vendas até a
data atual serve apenas como simulação demonstrativa; não aumenta a precisão
sobre vendas reais de 2026. A carga de novos dados e a mudança para R$ dependem
da escolha entre histórico real, simulação identificada e conversão documentada.
Não sobrescrever os valores originais nem renomear GBP para BRL sem conversão.

## Avaliação local em 2026-09-19

Execução somente de leitura sobre a versão `2009-12_to_2011-12`:

- 4.737 produtos; agrupamento em 2 grupos, silhouette 0,358661.
- Classificador: F1 0,818916 em 1.044 produtos separados para avaliação.
- Previsor: MAE 44,538499 unidades por produto/dia; WAPE 109,163%.
- Referência sazonal: WAPE 121,5351%; seleção do HistGradientBoosting.
- Corte da validação: previsões de 2011-11-10 a 2011-12-09.

O erro de previsão permanece elevado. Superar a referência não é suficiente
para recomendar uso operacional. Esta execução **não foi publicada no banco**.
Antes de uso real, avaliar múltiplas janelas temporais, demanda intermitente,
produtos individualmente e cobertura/rupturas da fonte. F1 da classificação
não deve ser apresentado como acurácia das previsões.
