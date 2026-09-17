export class ProductApiClient {
  async request(path, payload, method = payload ? 'POST' : 'GET') {
    const response = await fetch(`/api/v1/catalog/${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: payload ? { 'Content-Type': 'application/json', 'X-Requested-With': 'EstoqueInteligente' } : {},
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401) { window.location.replace(new URL('/login', window.location.origin).href); throw new Error('Sua sessão expirou.'); }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.');
    return result;
  }
  list(query) { return this.request(`products?${query}`); }
  save(product, id, version) { return this.request(id ? `products/${id}` : 'products', id ? { product, version } : product, id ? 'PUT' : 'POST'); }
  import(csv, preview) { return this.request('import', { csv, preview }); }
}
