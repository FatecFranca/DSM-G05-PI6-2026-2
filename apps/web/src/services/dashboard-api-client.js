class DashboardApiClient {
  constructor(baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333") {
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
      signal
    });
    if (!response.ok) {
      throw new Error(`A API respondeu com status ${response.status}.`);
    }
    return response.json();
  }
}
export {
  DashboardApiClient
};
