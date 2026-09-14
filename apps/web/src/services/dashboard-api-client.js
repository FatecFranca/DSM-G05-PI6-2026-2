class DashboardApiClient {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }
  baseUrl;
  getSummary(signal) {
    return this.get("/api/v1/dashboard/summary", signal);
  }
  getForecast(horizon, signal) {
    return this.get(
      `/api/v1/forecasts?horizon=${horizon}`,
      signal
    );
  }
  async get(path, signal) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      credentials: 'same-origin',
      cache: 'no-store',
      signal
    });
    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        window.location.replace('/login');
        throw new Error('Sua sessão expirou. Entre novamente.');
      }
      throw new Error(`A API respondeu com status ${response.status}.`);
    }
    return response.json();
  }
}
export {
  DashboardApiClient
};
