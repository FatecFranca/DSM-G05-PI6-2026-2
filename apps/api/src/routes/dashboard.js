import { summary } from '../data/demo-data.js';

export async function dashboardRoutes(app) {
  app.get(
    '/summary',
    {
      schema: {
        tags: ['Dashboard'],
        summary: 'Retorna indicadores consolidados do dashboard',
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async () => summary,
  );
}
