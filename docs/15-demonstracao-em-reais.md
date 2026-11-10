# Primeira execução da demonstração em R$

Pré-requisitos: [ambiente inicial](11-primeira-execucao.md), UCI importada e dependências Python instaladas.
Na raiz:

```powershell
npm run db:start
npm run db:migrate
npm run data:demo
npm run ml:demo
npm run dev
```

Reinicie API e aplicativos já abertos. O web permanece JavaScript/Next.js,
API TypeScript e mobile/desktop Flutter.

## Dados e separação

- Fonte `demo-brl`, gerador `demo-brl-generator-v1`, semente 20260919.
- 52 produtos fictícios ativos `DEMO-*`; preços BRL definidos diretamente, sem conversão de GBP.
- Série diária desde o dia posterior ao fim da UCI até hoje, fuso America/Sao_Paulo.
  Variação semanal/anual, tendência, aumento em novembro e demanda intermitente.
- Registros representam **produto/dia**, não pedidos individuais. `orders_count`
  indica apenas dia com venda; não usar para ticket médio ou contagem de pedidos.
- Depósito e saldo inicial simulados. O histórico analítico não movimenta o saldo
  atual: não representa uma reprodução contábil de todas as entradas e saídas.
- SHA-256 identifica o manifesto do gerador, não um arquivo de vendas.

UCI, produtos GBP, transações e séries originais ficam preservados. As views
`operational_products` e `operational_warehouses` selecionam a fonte ativa mais
recentemente carregada, mantendo cadastros manuais. O KPI monetário não soma
moedas distintas. Não há seletor de datasets na interface nesta entrega.

## Atualizações

Execute `npm run demo:refresh` em outro dia para acrescentar datas e recalcular
previsões (`data:demo` seguido de `ml:demo`). Localmente não há agendamento
automático; na VM, `estoque-pipeline.timer` executa a atualização diariamente.
No mesmo dia a carga não insere nada. Não aceita datas futuras nem retrocede o histórico.
Um corte pode ser reproduzido com `npm run data:demo -- --through 2026-09-19`.

Carga transacional com advisory lock. Extensões preservam valores anteriores,
preços editados, saldos, reservas e movimentações manuais. Preços históricos
seguem o catálogo sintético fixo, mesmo após edição do preço operacional.

## IA

`ml:demo` usa os últimos 730 dias. Publica K-Means, Random Forest e previsão
HistGradientBoosting (ou referência sazonal se obtiver menor MAE).
Horizontes 7/30/90 dias começam após o último dia gerado; não são vendas novas.
Na carga validada até 09/11/2026, portanto, começam em 10/11/2026. Se a rotina
diária deixar de rodar, a API marca a resposta como desatualizada e a interface orienta executar
`npm run demo:refresh`; ela não reaproveita uma previsão velha mudando sua data.
Artefatos e métricas: `models/demo-brl/v2/` (fora do Git). Para apenas avaliar:
`npm run ml:demo -- --evaluate-only`. Retreinar substitui a execução lógica da versão.

Na atualização de 09/11/2026, a demonstração possui 261.552 registros
produto/dia e WAPE publicado de 24,2461%. A execução UCI publicada registrou F1
0,818076, silhouette 0,35838 com 2 grupos e WAPE 1,09163 contra baseline
1,215351. Isso **não comprova precisão em vendas reais**. A validação usada para
seleção não é teste independente; bandas do gráfico são heurísticas.

Inteligência mostra tendências por produto, reposição e mudanças projetadas na
Curva ABC. A tendência compara a média diária prevista com os 30 dias recentes
(limiar de ±10%). O ponto de reposição considera demanda durante o lead time e
o maior valor entre estoque mínimo e sete dias previstos; a sugestão é a falta
até esse ponto. Não considera pedidos em aberto, lotes mínimos, validade,
capacidade ou orçamento e não dispara compras.

## Verificar

```powershell
npm run test:ml
$env:ML_INTEGRATION='1'
npm run test:ml
Remove-Item Env:ML_INTEGRATION
npm run test:integration --workspace=@estoque-inteligente/api
npm run demo:verify --workspace=@estoque-inteligente/api
```

A integração Python usa schema isolado revertido por rollback. O último comando
é somente leitura e exige demonstração carregada e treinada. Verifica moeda,
separação do catálogo, original GBP e horizontes futuros. Os testes Python
cobrem repetição, extensão e preservação de valores antigos, saldo e reservas.
