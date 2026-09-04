import { products } from '../data/demo-data.js';

export async function productRoutes(app) {
  app.get(
    '/',
    {
      schema: {
        tags: ['Products'],
        summary: 'Lista produtos com estoque, classificação e risco',
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', maxLength: 120 },
            risk: { type: 'string', enum: ['critical', 'attention', 'healthy'] },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['data', 'total', 'demo'],
            properties: {
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
              total: { type: 'integer' },
              demo: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request) => {
      const search = request.query.search?.trim().toLocaleLowerCase('pt-BR');
      const filtered = products.filter((product) => {
        const matchesSearch =
          !search ||
          product.name.toLocaleLowerCase('pt-BR').includes(search) ||
          product.sku.toLocaleLowerCase('pt-BR').includes(search);
        const matchesRisk = !request.query.risk || product.risk === request.query.risk;

        return matchesSearch && matchesRisk;
      });

      return { data: filtered, total: filtered.length, demo: true };
    },
  );
}
