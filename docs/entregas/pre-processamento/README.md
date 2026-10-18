# Entrega — pré-processamento do PI

Abra `relatorio.html` no navegador. O documento contém as oito seções da atividade,
tabelas de auditoria e comparação do modelo inicial com seleção de atributos.
Para anexar em PDF, use **Imprimir → Salvar como PDF**. Revise e acrescente nomes
dos integrantes e identificação da turma antes do envio. Não houve envio automático.

`relatorio.md` é a versão textual e `metrics.json` contém os valores medidos.
O estudo usa exclusivamente o XLSX original da UCI, em GBP; não usa o histórico
sintético brasileiro. Não modifica o banco nem substitui os modelos da aplicação.

## Executar novamente

Na raiz do repositório, com Python e as dependências configurados:

```powershell
npm run ml:setup
npm run data:download
npm run ml:study
npm run test:ml
```

O experimento lê cerca de um milhão de linhas, audita a limpeza e seleciona os
200 produtos de maior volume apenas no treino. O teste é o último bloco de
30 dias. Os primeiros 28 dias do treino são aquecimento dos lags. A informação
mútua seleciona 4 das 8 entradas com até 20 mil exemplos do treino (semente 42).
Não há ajuste de hiperparâmetros no teste. O resultado pode piorar após seleção:
isso é um resultado válido e deve ser discutido, não ocultado.

Os dois modelos ficam em `models/preprocessing-study/` (ignorado pelo Git).
Cada artefato guarda colunas, ordem dos produtos, data de corte e hash da fonte.
Métricas são de vendas observadas, não de demanda perdida por falta de estoque.

Para atualizar somente a apresentação, preservando o experimento medido:

```powershell
npm run ml:study -- --report-only
```

## Testes

`test_preprocessing_study.py` verifica exclusões mutuamente exclusivas, manutenção
de vendas sem cliente identificado, descarte de números não finitos, ausência
de Customer ID na saída, construção causal dos lags, seleção reprodutível,
fórmula do WAPE e uso das colunas selecionadas. Os testes de previsão já existentes
verificam a recursão sem consumir os alvos futuros.

Este experimento é distinto das métricas anteriormente publicadas pelo projeto;
não substitua números entre os relatórios, pois seleção da população e regras
de limpeza precisam ser comparadas juntamente com as métricas.
