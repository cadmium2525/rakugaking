export class RankingClient {
  constructor(endpoint, storage) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.storage = null;
    this.token = null;
    this.authPromise = null;
    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      this.token = this.storage?.getItem(`rakuga.ranking.${this.endpoint}`);
    } catch {
      this.storage = null;
    }
  }
  async request(path, options = {}) {
    if (!this.endpoint)
      throw new Error('オンラインランキングは未接続です。ゲームとローカル記録は利用できます。');
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(this.endpoint + path, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...options.headers,
        },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `通信エラー ${response.status}`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError')
        throw new Error('通信がタイムアウトしました。記録は手元に残っています。');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  async authenticate() {
    if (this.token) return;
    if (!this.authPromise) {
      this.authPromise = (async () => {
        const { token } = await this.request('/session', { method: 'POST' });
        this.token = token;
        try {
          this.storage?.setItem(`rakuga.ranking.${this.endpoint}`, token);
        } catch {
          this.storage = null;
        }
      })().finally(() => {
        this.authPromise = null;
      });
    }
    return this.authPromise;
  }
  async submit(record) {
    await this.authenticate();
    return this.request('/scores', { method: 'POST', body: JSON.stringify(record) });
  }
  async leaderboard() {
    await this.authenticate();
    const [top, own] = await Promise.all([this.request('/scores'), this.request('/me')]);
    return { ...top, ...own };
  }
}
