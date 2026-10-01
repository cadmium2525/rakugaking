import { RankingClient } from '../core/ranking-client.js';
import { formatTime } from '../core/timer.js';
export class RankingPanel {
  constructor() {
    this.client = null;
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'ranking-panel';
    this.dialog.innerHTML =
      '<p class="eyebrow">ALL STAGES / WORLD RANKING</p><h2>世界のラクガキたち。</h2><p class="ranking-status" role="status"></p><div class="ranking-table"></div><button class="ranking-refresh">再読み込み</button><button class="ranking-close">もどる</button>';
    document.body.append(this.dialog);
    this.dialog.querySelector('.ranking-close').onclick = () => this.dialog.close();
    this.dialog.querySelector('.ranking-refresh').onclick = () => this.load();
  }
  async connect() {
    if (!this.client) {
      const response = await fetch(`${import.meta.env.BASE_URL}ranking-config.json`);
      if (!response.ok) throw new Error('ランキング設定を読み込めません');
      const config = await response.json();
      if (
        config.endpoint &&
        !/^https:\/\//.test(config.endpoint) &&
        !/^http:\/\/127\.0\.0\.1:\d+$/.test(config.endpoint)
      )
        throw new Error('ランキング接続先が不正です');
      this.client = new RankingClient(config.endpoint || '');
    }
    return this.client;
  }
  async open() {
    this.dialog.showModal();
    await this.load();
  }
  async load() {
    const status = this.dialog.querySelector('.ranking-status'),
      container = this.dialog.querySelector('.ranking-table');
    status.textContent = 'ランキングを読み込んでいます…';
    container.replaceChildren();
    try {
      const client = await this.connect(),
        data = await client.leaderboard();
      status.textContent = data.score
        ? `自分のベスト ${formatTime(data.score.total)} / ${data.rank} 位（同タイム同順位）`
        : 'まだ登録された自分の記録はありません。';
      const table = document.createElement('table');
      const header = table.insertRow();
      for (const label of ['RANK', 'PLAYER / CHARACTER', 'LEVEL', 'TIME']) {
        const th = document.createElement('th');
        th.textContent = label;
        header.append(th);
      }
      let rank = 1;
      data.scores.forEach((s, i) => {
        if (i === 0 || s.total !== data.scores[i - 1].total) rank = i + 1;
        const row = table.insertRow();
        for (const value of [rank, `${s.player} / ${s.character}`, s.level, formatTime(s.total)])
          row.insertCell().textContent = value;
      });
      container.append(table);
      if (!data.scores.length) status.textContent += ' 最初の記録を待っています。';
    } catch (error) {
      status.textContent = navigator.onLine
        ? error.message
        : 'オフラインです。ランキングのみ利用できません。';
    }
  }
  async submit(record, player) {
    const client = await this.connect();
    await client.submit({ ...record, player });
  }
}
