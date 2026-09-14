export class AuthApiClient {
  async request(action, body) {
    let response;
    try {
      response = await fetch(`/api/v1/auth/${action}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EstoqueInteligente' },
        credentials: 'same-origin', cache: 'no-store',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    }
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message ?? 'Não foi possível concluir a solicitação.');
      error.fields = data.fields;
      throw error;
    }
    return data;
  }
}
