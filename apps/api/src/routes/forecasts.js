import { demandSeries } from '../data/demo-data.js';

export async function forecastRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Forecasts'],
        summary: 'Retorna a série histórica e a previsão publicada',
        querystring: {
          type: 'object',
          properties: {
            horizon: { type: 'integer', enum: [7, 30, 90], default: 7 },
            productId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => ({
      demo: true,
      productId: request.query.productId ?? null,
      horizon: request.query.horizon ?? 7,
      model: 'baseline-sazonal-v0',
      generatedAt: '2026-09-03T09:05:00.000Z',
      data: demandSeries,
    }),
  );
}
