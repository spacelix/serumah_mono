export function adminPage(): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Serumah — Log Viewer</title>
<style>
  :root {
    --ink: #1c1c1c;
    --ink-soft: #6b6b6b;
    --paper: #f7f5f0;
    --brick: #b33f3f;
    --brick-soft: rgba(179,63,63,0.12);
    --pine: #2f5d50;
    --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Space Grotesk', system-ui, sans-serif;
    padding: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  h1 { font-size: 22px; letter-spacing: -0.02em; margin-bottom: 4px; }
  .sub { color: var(--ink-soft); font-size: 13px; margin-bottom: 20px; }
  .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  button, select, input {
    font: inherit; font-size: 13px; padding: 6px 12px;
    border: 1px solid #d9d4ca; border-radius: 8px; background: #fff;
    color: var(--ink); cursor: pointer;
  }
  button.primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  input { min-width: 200px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card {
    background: #fff; border: 1px solid #e6e1d6; border-radius: 12px;
    padding: 14px 16px;
  }
  .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
  .card .value { font-family: var(--mono); font-size: 24px; margin-top: 4px; }
  .card .value.err { color: var(--brick); }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e6e1d6; border-radius: 12px; overflow: hidden; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #efece4; white-space: nowrap; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); background: #faf9f5; }
  td.mono { font-family: var(--mono); font-size: 12px; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill.ok { background: rgba(47,93,80,0.14); color: var(--pine); }
  .pill.bad { background: var(--brick-soft); color: var(--brick); }
  .pager { display: flex; gap: 8px; margin-top: 12px; align-items: center; justify-content: flex-end; font-size: 13px; color: var(--ink-soft); }
  .empty { text-align: center; color: var(--ink-soft); padding: 32px 0; }
</style>
</head>
<body>
  <h1>Log Viewer</h1>
  <div class="sub">Serumah API &mdash; statistik &amp; log permintaan (publik)</div>

  <div class="toolbar">
    <button class="primary" id="refresh">Refresh</button>
    <select id="method">
      <option value="">Semua method</option>
      <option>GET</option>
      <option>POST</option>
      <option>PUT</option>
      <option>PATCH</option>
      <option>DELETE</option>
    </select>
    <input id="search" placeholder="Cari path..." />
    <input id="status" placeholder="Status (contoh: 500)" style="min-width:120px" />
  </div>

  <div class="cards" id="cards"></div>
  <table>
    <thead>
      <tr><th>Waktu</th><th>Method</th><th>Path</th><th>Status</th><th>Durasi</th><th>User</th></tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>
  <div class="pager">
    <span id="total"></span>
    <button id="prev">&larr; Prev</button>
    <button id="next">Next &rarr;</button>
  </div>

<script>
  const state = { page: 1, limit: 50 };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  function renderCards(s) {
    const fmt = (n) => Number(n).toLocaleString('id-ID');
    const cards = [
      ['Total Request', fmt(s.total), ''],
      ['Error', fmt(s.errors), s.errors > 0 ? 'err' : ''],
      ['Error Rate', s.errorRate + '%', s.errorRate > 0 ? 'err' : ''],
      ['Avg Latency', s.avgDurationMs + ' ms', ''],
      ['p95 Latency', s.p95DurationMs + ' ms', ''],
    ];
    document.getElementById('cards').innerHTML = cards
      .map(([label, value, cls]) =>
        '<div class="card"><div class="label">' + esc(label) + '</div>' +
        '<div class="value ' + cls + '">' + esc(value) + '</div></div>')
      .join('');
  }

  async function loadStats() {
    try {
      const s = await fetchJson('/api/admin/stats?days=7');
      renderCards(s);
    } catch (e) { /* ignore */ }
  }

  async function loadLogs() {
    const method = document.getElementById('method').value;
    const search = document.getElementById('search').value.trim();
    const status = document.getElementById('status').value.trim();
    const qs = new URLSearchParams({ page: state.page, limit: state.limit });
    if (method) qs.set('method', method);
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    try {
      const data = await fetchJson('/api/admin/logs?' + qs.toString());
      const tbody = document.getElementById('rows');
      if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Belum ada log.</td></tr>';
      } else {
        tbody.innerHTML = data.items.map((e) => {
          const time = new Date(e.timestamp).toLocaleString('id-ID');
          const pill = e.isError ? 'bad' : 'ok';
          const label = e.isError ? e.statusCode : 'OK';
          const title = e.isError && e.errorMessage ? ' title="' + esc(e.errorMessage) + '"' : '';
          return '<tr>' +
            '<td class="mono">' + esc(time) + '</td>' +
            '<td>' + esc(e.method) + '</td>' +
            '<td class="mono" data-err="' + (e.isError ? '1' : '0') + '">' + esc(e.path) + '</td>' +
            '<td' + title + '><span class="pill ' + pill + '">' + esc(label) + '</span></td>' +
            '<td class="mono">' + esc(e.durationMs) + ' ms</td>' +
            '<td class="mono">' + (e.userId ? esc(e.userId.slice(0, 8)) : '-') + '</td>' +
            '</tr>';
        }).join('');
      }
      document.getElementById('total').textContent = data.total + ' baris';
    } catch (e) { /* ignore */ }
  }

  async function load() {
    await Promise.all([loadStats(), loadLogs()]);
  }

  document.getElementById('refresh').addEventListener('click', () => { state.page = 1; load(); });
  document.getElementById('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; loadLogs(); } });
  document.getElementById('next').addEventListener('click', () => { state.page++; loadLogs(); });
  ['method', 'search', 'status'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => { state.page = 1; loadLogs(); });
  });
  document.getElementById('search').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') { state.page = 1; loadLogs(); }
  });

  load();
  setInterval(loadStats, 30000);
</script>
</body>
</html>`;
}
