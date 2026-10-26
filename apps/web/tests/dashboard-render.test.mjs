import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { transform, loadBindings } = require('next/dist/build/swc');
await loadBindings();
const source = await readFile(new URL('../src/components/dashboard.jsx', import.meta.url), 'utf8');
const compiled = await transform(source, {
  filename: 'dashboard.jsx',
  jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});

// Renderiza o Dashboard real; isola rede e componentes visuais secundários.
function render(summaryState, forecastState = { data: undefined, isLoading: false }) {
  const exports = {};
  const passthrough = ({ children }) => React.createElement('div', null, children);
  vm.runInNewContext(compiled.code, {
    exports,
    require(name) {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'swr') return (key) => key === 'dashboard-summary' ? summaryState : forecastState;
      if (name === 'next/link') return passthrough;
      if (name === '@/services/dashboard-api-client') return { DashboardApiClient: class {} };
      if (name === '@/lib/report-formatters.mjs') return { serializeCsv: () => '' };
      if (name === '@/components/loading-states') return {
        DashboardSkeleton: () => React.createElement('div', null, 'SKELETON_DASHBOARD'),
        ChartSkeleton: () => React.createElement('div', null, 'SKELETON_CHART'),
      };
      if (name.startsWith('@/components/ui/') || name === 'lucide-react' || name === 'recharts') {
        return new Proxy({}, { get: () => passthrough });
      }
      throw new Error(`Dependência não isolada: ${name}`);
    },
  });
  return renderToStaticMarkup(React.createElement(exports.Dashboard, { user: { name: 'Pessoa Teste' } }));
}

test('primeiro render sem resumo mostra skeleton sem classificar a origem', () => {
  const html = render({ data: undefined, isLoading: true });
  assert.match(html, /SKELETON_DASHBOARD/);
  assert.doesNotMatch(html, /Análise histórica|Demonstração simulada em R\$/);
});

test('falha antes do primeiro resumo mostra alerta sem lançar TypeError', () => {
  const html = render({ data: undefined, isLoading: false, error: new Error('Indisponível') });
  assert.match(html, /Não foi possível atualizar os dados/);
  assert.doesNotMatch(html, /Análise histórica|Demonstração simulada em R\$/);
});

for (const demo of [true, false]) {
  test(`resumo disponível mantém aviso correto demo=${demo}`, () => {
    const html = render({ data: {
      meta: { demo, dataset: 'Base de teste' },
      kpis: { stockValue: 100, stockValueCurrency: 'BRL', activeProducts: 1, stockoutRisk: 0 },
      classifications: [], riskProducts: [], demandSeries: [],
    }, isLoading: false }, { isLoading: true });
    assert.match(html, demo ? /Demonstração simulada em R\$/ : /Análise histórica/);
    assert.match(html, /Valor em estoque/);
    assert.match(html, /SKELETON_CHART/);
    assert.doesNotMatch(html, /SKELETON_DASHBOARD/);
  });
}
