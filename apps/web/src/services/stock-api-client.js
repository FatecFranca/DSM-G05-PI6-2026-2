export class StockApiClient {
  async request(path, payload) {
    const response = await fetch(`/api/v1/inventory/${path}`, {
      method: payload ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: payload ? { 'Content-Type': 'application/json', 'X-Requested-With': 'EstoqueInteligente' } : {},
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401) { window.location.replace(new URL('/login', window.location.origin).href); throw new Error('Sua sessão expirou.'); }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.');
    return result;
  }
  options() { return this.request('options'); }
  levels(query) { return this.request(`levels?${query}`); }
  movements(query = 'pageSize=20') { return this.request(`movements?${query}`); }
  apply(payload) { return this.request('movements', payload); }
  transfer(payload) { return this.request('transfers', payload); }
  createWarehouse(name) { return this.request('warehouses', { name }); }
}
