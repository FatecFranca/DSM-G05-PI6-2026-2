import { syncRuns } from '../data/demo-data.js';

export async function syncRunRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Integrations'],
        summary: 'Lista as execuções recentes de sincronização',
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async () => ({ data: syncRuns, total: syncRuns.length, demo: true }),
  );
}
