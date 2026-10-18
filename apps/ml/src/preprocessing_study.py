"""Experimento acadêmico isolado: lê XLSX, não acessa nem altera PostgreSQL."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import hashlib
from html import escape
import json
from pathlib import Path
import platform
import re
from time import perf_counter

import numpy as np
import pandas as pd
from openpyxl import load_workbook
import sklearn
from sklearn.feature_selection import mutual_info_regression
from threadpoolctl import threadpool_limits

from .forecasting import FEATURES, daily_history, new_regressor, recursive_forecast, seasonal_forecast
from .settings import WORKBOOK_PATH, REPOSITORY_ROOT, DATASET_PAGE
from .train_models import make_forecast_frame

SPECIAL = re.compile(r'^(POST|D|M|DOT|BANK CHARGES|TEST\d*|AMAZONFEE|CRUK)$', re.I)
HEADERS = ('Invoice', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'Price', 'Customer ID', 'Country')


def normalize(value):
    return ' '.join(str(value if value is not None else '').replace('\x00', '').split())


def preprocess(rows):
    """Auditoria em ordem exclusiva; Customer ID nunca sai desta função."""
    counts, missing, countries = Counter(), Counter(), Counter()
    seen, daily = set(), defaultdict(lambda: [0., 0.])
    for row in rows:
        counts['read'] += 1
        for name, value in zip(HEADERS, row, strict=True):
            if value is None or not normalize(value):
                missing[name] += 1
        invoice, sku, description, quantity, stamp, price, _, country = row
        invoice, sku = normalize(invoice), normalize(sku).upper()
        description, country = normalize(description), normalize(country) or 'Unknown'
        try:
            quantity, price = float(quantity), float(price)
            if not invoice or not sku or not isinstance(stamp, datetime) or not np.isfinite([quantity, price]).all():
                raise ValueError('Invalid row')
        except (ValueError, TypeError):
            counts['malformed'] += 1
            continue
        if invoice.upper().startswith('C') or quantity < 0:
            counts['cancellation'] += 1
            continue
        if quantity <= 0 or price <= 0:
            counts['nonpositive'] += 1
            continue
        if not description:
            counts['missing_description'] += 1
            continue
        if SPECIAL.fullmatch(sku):
            counts['non_product'] += 1
            continue
        # Duplicidade operacional: campos de venda sem Customer ID (não exportado).
        key = (invoice, sku, description, quantity, stamp, price, country)
        if key in seen:
            counts['duplicate'] += 1
            continue
        seen.add(key)
        counts['accepted'] += 1
        countries[country] += 1
        values = daily[(sku, stamp.date())]
        values[0] += quantity
        values[1] += quantity * price
        if counts['read'] % 200000 == 0:
            print(f"Linhas percorridas: {counts['read']:,}", flush=True)
    frame = pd.DataFrame([(sku, day, *values) for (sku, day), values in daily.items()],
                         columns=['product_id', 'demand_date', 'units_sold', 'gross_revenue'])
    if frame.empty:
        raise ValueError('Nenhuma venda elegível.')
    frame.demand_date = pd.to_datetime(frame.demand_date)
    counts['rejected'] = counts['read'] - counts['accepted']
    return frame.sort_values(['product_id', 'demand_date']), dict(counts), dict(missing), dict(countries)


def workbook_rows(path):
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        for sheet in workbook.worksheets:
            rows = sheet.iter_rows(values_only=True)
            if tuple(next(rows)) != HEADERS:
                raise ValueError(f'Cabeçalho inesperado em {sheet.title}')
            yield from rows
    finally:
        workbook.close()


def select_attributes(train, k=4):
    # Amostragem só no treino para limitar custo do estimador de informação mútua.
    sample = train.sample(n=min(len(train), 20000), random_state=42)
    scores = mutual_info_regression(sample[FEATURES], sample.units_sold,
        discrete_features=[True, True, True, False, False, False, False, False], random_state=42)
    ranking = sorted(zip(FEATURES, map(float, scores), strict=True), key=lambda x: (-x[1], x[0]))
    return [name for name, _ in ranking[:k]], dict(ranking)


class FeatureSubset:
    def __init__(self, model, columns):
        self.model, self.columns = model, columns

    def predict(self, frame):
        return self.model.predict(frame[self.columns])


def evaluate(actual, predicted):
    error = np.asarray(actual) - np.asarray(predicted)
    return {'mae': float(np.abs(error).mean()), 'rmse': float(np.sqrt(np.square(error).mean())),
            'wape_pct': float(np.abs(error).sum() / np.sum(actual) * 100) if np.sum(actual) else None,
            'bias': float(-error.mean())}


def table(headers, rows):
    return '<table><tr>' + ''.join(f'<th>{escape(str(x))}</th>' for x in headers) + '</tr>' + ''.join(
        '<tr>' + ''.join(f'<td>{escape(str(x))}</td>' for x in row) + '</tr>' for row in rows) + '</table>'


def comparison_chart(metrics):
    maximum = max(m['wape_pct'] for m in metrics.values()) or 1
    rows = []
    for index, (key, label, color) in enumerate([
        ('baseline', 'Naive sazonal', '#64748b'), ('initial', 'Inicial · 8 atributos', '#2563eb'),
        ('selected', 'Seleção · 4 atributos', '#0d9488')]):
        value, y = metrics[key]['wape_pct'], 30 + index * 64
        rows.append(f'<text x="10" y="{y+22}">{label}</text><rect x="210" y="{y}" width="{value/maximum*410:.1f}" height="32" fill="{color}"/><text x="{220+value/maximum*410:.1f}" y="{y+22}">{value:.2f}%</text>')
    return '<figure><svg role="img" aria-label="Comparação do erro WAPE, menor é melhor" viewBox="0 0 750 230" style="width:100%;font:15px system-ui">' + ''.join(rows) + '</svg><figcaption>WAPE no mesmo teste temporal; menor é melhor. Não é acurácia.</figcaption></figure>'


def report(result, output):
    c, eda, split, metrics = (result[k] for k in ['cleaning', 'eda', 'split', 'metrics'])
    f = lambda x: f'{x:,.4f}'.replace(',', '_').replace('.', ',').replace('_', '.')
    delta = metrics['selected']['wape_pct'] - metrics['initial']['wape_pct']
    trend = 'reduziu' if delta < 0 else 'aumentou' if delta > 0 else 'manteve'
    labels = {'read': 'Lidas', 'malformed': 'Inválidas (identificador/data/número)',
              'cancellation': 'Cancelamentos/devoluções', 'nonpositive': 'Quantidade/preço não positivo',
              'missing_description': 'Descrição ausente (após filtros anteriores)',
              'non_product': 'Códigos administrativos', 'duplicate': 'Duplicatas operacionais',
              'accepted': 'Aceitas', 'rejected': 'Excluídas (total)'}
    sections = [
      ('1. Introdução', f'''Projeto: Gestão inteligente de estoque e previsão de demanda. Objetivo: prever unidades vendidas por produto/dia e investigar o compromisso entre erro e número de atributos. A base Online Retail II (Chen, 2012, UCI) registra transações de varejo britânico de 2009–2011, em GBP. Fonte: <a href="{DATASET_PAGE}">UCI Online Retail II</a>; DOI 10.24432/C5CG6D; licença CC BY 4.0, com atribuição. Não foram usados Bling, dados de clientes do projeto nem vendas sintéticas até 2026. Este estudo é supervisionado (regressão); não reavalia os clusters ou o classificador do sistema.'''),
      ('2. Pré-processamento e exploração dos dados', f'''Arquivo: online_retail_II.xlsx, duas planilhas, oito campos originais. Invoice identifica a transação; StockCode, o produto; Description, sua descrição; Quantity é a quantidade; InvoiceDate, a data/hora; Price, o preço em GBP; Customer ID identifica o cliente; Country, o país. Identificadores não são variáveis quantitativas contínuas.
Normalização de espaços e códigos; validação de identificadores, datas e números finitos; remoção sequencial de cancelamentos/devoluções, preços ou quantidades não positivos, descrição vazia, códigos administrativos e duplicatas operacionais. A primeira regra aplicável contabiliza cada exclusão uma única vez. A chave de duplicidade inclui fatura, SKU, descrição, quantidade, timestamp, preço e país, sem Customer ID: é uma hipótese operacional, não prova de erro na origem. Customer ID ausente não exclui venda e o identificador não é armazenado nos artefatos.
{table(['Etapa (exclusiva)', 'Linhas'], [(labels[key], format(c.get(key, 0), ',').replace(',', '.')) for key in labels])}
{table(['Campo original', 'Ausentes antes da limpeza'], [(name, result['missing'].get(name, 0)) for name in HEADERS])}
As ausências acima podem se sobrepor às demais regras. Uma descrição ausente pode ter sido excluída antes por quantidade não positiva; por isso a exclusão exclusiva por descrição pode ser zero, apesar de haver descrições ausentes no arquivo.
Agregação por SKU e dia: soma de quantidades e receita. A data é a data civil registrada na fonte britânica, sem deslocamento para o fuso brasileiro. Após limpar: {eda['products']} SKUs, {eda['rows']} pares produto/dia, {eda['days']} dias de calendário, período {split['start']} a {split['end']}. Os dias sem transação são preenchidos com zero para a grade dos produtos avaliados. Isso assume ausência de venda registrada, não ausência de procura; antes da primeira venda pode representar item ainda não lançado.
As estatísticas descritivas desta seção cobrem a base inteira; não são usadas para ajustar limiares, normalização, seleção ou treinamento.
{table(['Estatística', 'Unidades por dia com venda'], [(k, f(v)) for k, v in eda['positive_day_units'].items()])}
{table(['País (linhas aceitas)', 'Linhas'], result['top_countries'])}
Outliers não foram cortados: vendas em lote podem ser legítimas. A distribuição assimétrica motiva MAE, RMSE e WAPE. Imputação de lags indisponíveis não foi usada: os primeiros 28 dias são removidos. A árvore não requer padronização; escalas diferentes não justificam aplicar StandardScaler neste modelo. Preço, receita do dia, estoque simulado e Customer ID não entram no modelo. Diferenças contra contagens do banco podem ocorrer: esta limpeza exige descrição válida em cada venda e usa exclusões sequenciais; não reutiliza o filtro de product_id da carga operacional.'''),
      ('3. Divisão em conjunto de treinamento e teste', f'''Corte cronológico, sem embaralhamento. Seleção de até 200 produtos de maior volume exclusivamente até {split['cutoff']}; desempate por SKU. Foram selecionados {split['products']} produtos, cobrindo {eda['train_volume_coverage_pct']:.2f}% das unidades do período de treino. A avaliação não representa todo o catálogo ou produtos novos.
Treino com atributos completos: {split['feature_start']} a {split['cutoff']}, {split['train_rows']} exemplos. Teste: {split['test_start']} a {split['end']}, {split['test_rows']} pares produto/dia ({split['test_days']} dias). Na grade do treino, {eda['train_zero_pct']:.2f}% dos alvos são zero.
Origem fixa: o histórico observado termina no corte. A previsão dos 30 dias é recursiva; lags futuros usam previsões anteriores, nunca vendas reais do teste. Seleção de produtos e atributos ocorre antes de consultar os alvos de teste. Quantidade de atributos k=4 e hiperparâmetros são definidos previamente, sem busca no teste. Não há validação interna adicional; se esta comparação orientar ajustes futuros, será necessário outro holdout ou backtesting aninhado.'''),
      ('4. Treinamento e avaliação do modelo inicial', f'''HistGradientBoostingRegressor, perda Poisson, 180 iterações, 31 folhas, learning_rate=0,08, regularização L2=0,1, random_state=42 e early_stopping=False. A tarefa é regressão de vendas não negativas. Os oito atributos são product_code (SKU codificado), day_of_week, month, lag_1, lag_7, lag_14, rolling_7 e rolling_28. Lags e médias móveis são calculados apenas sobre o passado, com shift(1). O código do produto é ordinal por implementação, uma limitação a comparar futuramente com codificação categórica.
Referência: naive sazonal repete a última semana observada durante os 30 dias. MAE e RMSE têm unidade unidades/produto/dia; WAPE = 100 × soma dos erros absolutos / soma das vendas; bias = média(previsto − real). WAPE não é percentual de acerto. Não usamos MAPE por haver zeros.
{table(['Modelo', 'MAE', 'RMSE', 'WAPE (%)', 'Bias'], [[label, *[f(metrics[key][m]) for m in ['mae', 'rmse', 'wape_pct', 'bias']]] for key, label in [('baseline', 'Naive sazonal'), ('initial', 'Inicial: 8 atributos')]])}'''),
      ('5. Seleção de atributos', f'''Método de filtro: informação mútua com o alvo, estimada somente em uma amostra reprodutível de até 20.000 exemplos do treino. Calendário e código do produto são tratados como discretos pelo seletor. Mantêm-se os quatro maiores escores (k definido previamente); desempate pelo nome. O escore não tem interpretação causal, pode favorecer identificadores e não mede redundância conjunta entre lags correlacionados.
{table(['Atributo', 'Informação mútua (treino)', 'Selecionado'], [(name, f(score), 'Sim' if name in result['selected_features'] else 'Não') for name, score in result['feature_scores'].items()])}
Selecionados: {', '.join(result['selected_features'])}. Nenhuma receita contemporânea ou venda futura é fornecida como preditor.'''),
      ('6. Treinamento e avaliação do modelo com seleção de atributos', f'''Novo modelo, mesmos hiperparâmetros, produtos, datas, alvos e protocolo recursivo. Somente as colunas de entrada mudam. Ambos são ajustados exclusivamente no treino, sem publicação no banco.
{table(['Modelo', 'Atributos', 'MAE', 'RMSE', 'WAPE (%)', 'Treino (s)'], [[label, n, *[f(metrics[key][m]) for m in ['mae', 'rmse', 'wape_pct']], f(result['fit_seconds'][key])] for key, label, n in [('initial', 'Inicial', 8), ('selected', 'Seleção', 4)]])}
O WAPE {trend}: diferença seleção − inicial = {delta:+.4f} pontos percentuais. O tempo é uma medição nesta máquina, não benchmark controlado.'''),
      ('7. Discussão dos resultados', f'''A redução de 8 para 4 atributos diminui a dimensionalidade em 50%, mas não garante maior precisão ou interpretabilidade causal. Nesta execução o WAPE {trend} em relação ao modelo completo. Comparar também o naive: uma IA mais complexa não é automaticamente melhor. A escolha do modelo para produção exige avaliação independente adicional, e não seleção oportunista pelo mesmo teste.
Neste teste, o naive obteve WAPE de {metrics['baseline']['wape_pct']:.2f}%, o modelo inicial {metrics['initial']['wape_pct']:.2f}% e a seleção {metrics['selected']['wape_pct']:.2f}%. O RMSE passou de {metrics['initial']['rmse']:.2f} para {metrics['selected']['rmse']:.2f}; a MAE passou de {metrics['initial']['mae']:.2f} para {metrics['selected']['mae']:.2f}. WAPE acima de 100% significa que a soma dos erros absolutos excedeu o volume vendido, não uma acurácia negativa. Assim, o desempenho absoluto é insuficiente para recomendar compras automaticamente, embora os dois modelos superem o naive em MAE neste recorte.
O identificador do produto liderou a informação mútua, seguido de informações do histórico recente. Isso permite diferenciar séries conhecidas, mas não generalizar diretamente para novos SKUs. A retirada de day_of_week limita a representação explícita da sazonalidade semanal: na série agregada, há dias sem vendas e a versão reduzida tende a suavizá-los. Essa é uma interpretação descritiva, não prova causal.
Principais limites: uma única janela temporal, demanda de fim de ano, base antiga e de outro país, foco em itens de alto volume, vendas no atacado, possíveis rupturas não observadas e política de duplicidade. A observação final de 09/12/2011 pode representar dia incompleto. A informação mútua é univariada e pode reter atributos redundantes. Picos elevam RMSE e WAPE; a recursão acumula erros. Resultados sobre vendas observadas não medem demanda perdida por ruptura. Não há garantia de transferência para uma empresa brasileira; GBP não foi convertido artificialmente em R$.'''),
      ('8. Conclusão', '''Foi executado um fluxo reproduzível de limpeza auditada, exploração, geração de atributos defasados, separação temporal, treinamento e comparação com seleção de atributos. A comparação documenta o efeito medido, sem pressupor melhoria. A entrega atende ao estudo de pré-processamento e seleção; não substitui a homologação da IA operacional. Próximos passos: backtesting em várias origens, seleção conjunta dentro de validação temporal, modelagem da intermitência e avaliação em dados reais recentes. A base e os modelos publicados no sistema não foram alterados.'''),
    ]
    repro = f'''Execução: npm run ml:study. Pré-requisitos: npm run ml:setup e npm run data:download. Testes: npm run test:ml.
SHA-256 do XLSX: {result['sha256']}
Python {result['versions']['python']}; pandas {pd.__version__}; numpy {np.__version__}; scikit-learn {sklearn.__version__}; semente 42; até 2 threads. Artefatos locais em models/preprocessing-study; métricas e relatório em docs/entregas/pre-processamento. Nenhum segredo ou Customer ID é exportado.
Referências: Chen, D. (2012), Online Retail II, UCI, DOI 10.24432/C5CG6D, CC BY 4.0; scikit-learn, documentação de HistGradientBoostingRegressor, mutual_info_regression e validação temporal (https://scikit-learn.org/stable/).'''
    sections.append(('Reprodução e referências', repro))
    sections[5] = (sections[5][0], sections[5][1] + comparison_chart(metrics))
    markdown = '# Pré-processamento e seleção de atributos — PI\n\nExecução: 18/10/2026.\n\n' + '\n\n'.join(f'## {title}\n\n{body}' for title, body in sections)
    (output / 'relatorio.md').write_text(markdown, encoding='utf-8')
    body = ''.join(f'<section><h2>{title}</h2><div class="copy">{content}</div></section>' for title, content in sections)
    html = '''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pré-processamento — Estoque Inteligente</title><style>body{font:16px/1.65 system-ui;color:#17253c;background:#edf2f7;margin:0}main{max-width:1050px;margin:auto;padding:40px}h1{font-size:34px}h2{color:#123e65}section{background:white;padding:28px;margin:24px 0;border:1px solid #d8e0eb;border-radius:10px}.copy{white-space:pre-line;overflow-wrap:anywhere}table{white-space:normal;border-collapse:collapse;width:100%;margin:20px 0;font-size:14px}td,th{padding:9px;border-bottom:1px solid #d8e0eb;text-align:left}th{background:#e9f0f7}a{color:#125ea7}@media print{body{background:white}main{padding:0}section{border:0;padding:0}h2{break-after:avoid}tr{break-inside:avoid}}</style><main><h1>Pré-processamento e seleção de atributos</h1><p>Estoque Inteligente · PI · 18/10/2026 · Experimento histórico, não produção</p>''' + body + '</main></html>'
    (output / 'relatorio.html').write_text(html, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=WORKBOOK_PATH)
    parser.add_argument('--output', type=Path, default=REPOSITORY_ROOT / 'docs/entregas/pre-processamento')
    parser.add_argument('--report-only', action='store_true', help='Regenera documentos a partir das métricas existentes, sem treinar.')
    args = parser.parse_args()
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    if args.report_only:
        report(json.loads((output/'metrics.json').read_text(encoding='utf-8')), output)
        return
    with args.input.open('rb') as source:
        sha = hashlib.file_digest(source, 'sha256').hexdigest()
    print('Lendo e auditando a base original (sem alterações no banco)...', flush=True)
    demand, counts, missing, countries = preprocess(workbook_rows(args.input))
    start, end = demand.demand_date.min().date(), demand.demand_date.max().date()
    cutoff = end - timedelta(days=30)
    if (cutoff - start).days < 60:
        raise ValueError('Histórico insuficiente para experimento.')
    past = demand[demand.demand_date <= pd.Timestamp(cutoff)]
    totals = past.groupby('product_id').units_sold.sum().sort_index().sort_values(ascending=False, kind='stable')
    ids = totals.head(200).index.tolist()
    # Não criar atributos a partir do teste, nem para seleção.
    train = make_forecast_frame(past, ids, start, cutoff)
    print(f'Treino: {len(train):,} exemplos, {len(ids)} produtos; selecionando atributos...', flush=True)
    with threadpool_limits(limits=2):
        selected, scores = select_attributes(train)
        history = daily_history(past, ids, start, cutoff)
        observed = daily_history(demand, ids, cutoff + timedelta(days=1), end)
        actual = np.array([observed[key] for key in ids])
        baseline = np.array([seasonal_forecast(history[key], 30) for key in ids])
        metrics, fit_seconds = {'baseline': evaluate(actual, baseline)}, {}
        artifacts = REPOSITORY_ROOT / 'models/preprocessing-study'
        artifacts.mkdir(parents=True, exist_ok=True)
        import joblib
        predictions = {'actual': actual.sum(axis=0).tolist(), 'baseline': baseline.sum(axis=0).tolist()}
        for label, columns in [('initial', FEATURES), ('selected', selected)]:
            print(f'Treinando {label}: {columns}', flush=True)
            model, clock = new_regressor(), perf_counter()
            model.fit(train[columns], train.units_sold)
            fit_seconds[label] = perf_counter() - clock
            values = recursive_forecast(FeatureSubset(model, columns), history, ids, cutoff, 30)
            array = np.array([values[key] for key in ids])
            metrics[label] = evaluate(actual, array)
            predictions[label] = array.sum(axis=0).tolist()
            joblib.dump({'model': model, 'features': columns, 'product_ids': ids, 'cutoff': cutoff.isoformat(), 'source_sha256': sha}, artifacts / f'{label}.joblib')
    result = {'sha256': sha, 'cleaning': counts, 'missing': missing,
        'top_countries': sorted(countries.items(), key=lambda x: -x[1])[:10],
        'eda': {'products': demand.product_id.nunique(), 'rows': len(demand), 'days': (end-start).days+1,
                'train_zero_pct': float((train.units_sold == 0).mean()*100),
                'train_volume_coverage_pct': float(totals.head(200).sum()/totals.sum()*100),
                'positive_day_units': demand.units_sold.describe(percentiles=[.5, .9, .99]).to_dict()},
        'split': {'start': start.isoformat(), 'end': end.isoformat(), 'cutoff': cutoff.isoformat(),
                  'feature_start': train.demand_date.min().date().isoformat(),
                  'test_start': (cutoff+timedelta(days=1)).isoformat(), 'test_days': 30,
                  'products': len(ids), 'train_rows': len(train), 'test_rows': int(actual.size)},
        'selected_features': selected, 'feature_scores': scores, 'metrics': metrics, 'fit_seconds': fit_seconds,
        'aggregate_test_series': predictions,
        'versions': {'python': platform.python_version(), 'pandas': pd.__version__, 'numpy': np.__version__, 'sklearn': sklearn.__version__}}
    (output/'metrics.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    report(result, output)
    print(json.dumps({'metrics': metrics, 'selected_features': selected, 'report': str(output/'relatorio.html')}, indent=2), flush=True)


if __name__ == '__main__':
    main()
