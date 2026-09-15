import { parse } from 'csv-parse/sync';
import { ProductError, productInputSchema, type ProductInput, type ProductSource } from '../../domain/product.js';

export class CsvProductSource implements ProductSource {
  read(content: string): ProductInput[] {
    if (Buffer.byteLength(content, 'utf8') > 100_000) throw new ProductError(413, 'CSV limitado a 100 KB.');
    let rows: Record<string, string>[];
    try {
      rows = parse(content, { bom: true, delimiter: ';', skip_empty_lines: true, trim: true, max_record_size: 8000,
        columns: (headers: string[]) => {
          const allowed = Object.keys(productInputSchema.shape);
          if (!headers.includes('sku') || !headers.includes('name') || new Set(headers).size !== headers.length
            || headers.some((header) => !allowed.includes(header))) throw new Error('Cabeçalho inválido');
          return headers;
        },
      });
    } catch { throw new ProductError(400, 'CSV inválido. Use o modelo com separador ponto e vírgula.'); }
    if (rows.length < 1 || rows.length > 100) throw new ProductError(400, 'Importe entre 1 e 100 produtos por arquivo.');
    const seen = new Set<string>();
    return rows.map((row, index) => {
      const values: Record<string, unknown> = { ...row };
      for (const key of ['costPrice', 'salePrice', 'minimumStock']) {
        if (row[key] !== undefined) values[key] = row[key]!.replace(',', '.');
      }
      if (row.leadTimeDays !== undefined) values.leadTimeDays = /^\d+$/.test(row.leadTimeDays) ? Number(row.leadTimeDays) : NaN;
      if (row.active !== undefined) values.active = row.active === 'true' ? true : row.active === 'false' ? false : row.active;
      const result = productInputSchema.safeParse(values);
      if (!result.success) throw new ProductError(400, `Registro ${index + 1}: confira ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}.`);
      if (seen.has(result.data.sku)) throw new ProductError(400, `Registro ${index + 1}: SKU duplicado no arquivo.`);
      seen.add(result.data.sku);
      return result.data;
    });
  }
}
