const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');

const port = Number(process.argv[2] || process.env.DEEPSEEK_CACHE_PORT || 8789);
const logPath = process.env.CODEX_USAGE_LOG || path.join(os.homedir(), '.opencodex', 'usage.jsonl');
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function pick(obj, names) { for (const name of names) if (obj && obj[name] != null) return num(obj[name]); return 0; }
function rows() {
  if (!fs.existsSync(logPath)) return [];
  return fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row && (String(row.provider || '').toLowerCase().includes('deepseek') || String(row.model || '').toLowerCase().includes('deepseek')));
}
function view(row) {
  const u = row.usage || {};
  const hit = pick(u, ['cachedInputTokens', 'cacheReadInputTokens', 'promptCacheHitTokens', 'prompt_cache_hit_tokens']);
  let input = pick(u, ['inputTokens', 'promptTokens', 'totalInputTokens']);
  const miss = pick(u, ['cacheMissInputTokens', 'promptCacheMissTokens', 'prompt_cache_miss_tokens']);
  if (!input) input = hit + miss;
  const ts = num(row.timestamp);
  return { timestamp: ts > 100000000000 ? ts : ts * 1000, model: row.resolvedModel || row.model || 'deepseek', input, hit, miss: miss || Math.max(0, input - hit), durationMs: num(row.durationMs) };
}
function data(range) {
  const age = range === '1h' ? 3600000 : range === '5h' ? 18000000 : range === '1d' ? 86400000 : range === '7d' ? 604800000 : range === '30d' ? 2592000000 : 0;
  const start = age ? Date.now() - age : 0;
  const list = rows().map(view).filter(row => row.timestamp >= start).sort((a, b) => b.timestamp - a.timestamp);
  const input = list.reduce((s, r) => s + r.input, 0), hit = list.reduce((s, r) => s + r.hit, 0), miss = Math.max(0, input - hit);
  const byModel = {};
  for (const row of list) { const m = byModel[row.model] || { model: row.model, requests: 0, input: 0, hit: 0, miss: 0 }; m.requests++; m.input += row.input; m.hit += row.hit; m.miss += row.miss; byModel[row.model] = m; }
  return { generatedAt: Date.now(), logPath, summary: { requests: list.length, input, hit, miss, hitRate: input ? hit / input : 0 }, models: Object.values(byModel).map(m => ({ ...m, hitRate: m.input ? m.hit / m.input : 0 })), recent: list.slice(0, 40) };
}

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepSeek 缓存监控</title><style>
:root{color-scheme:dark;--bg:#101318;--panel:#191e27;--text:#eff3f8;--muted:#98a4b5;--line:#303a4a;--blue:#57a5ff;--green:#39d98a;--amber:#f5b84b}*{box-sizing:border-box}body{margin:0;padding:28px;background:radial-gradient(circle at 10% 0%,#182b45,var(--bg) 38%);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1100px;margin:auto}header{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:22px}h1{margin:0;font-size:26px}.sub,th,footer{color:var(--muted)}.controls{display:flex;gap:8px}button{border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--text);padding:8px 12px;cursor:pointer}button.active{background:#194d7d;border-color:#4b9eea}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.card,section{background:var(--panel);border:1px solid var(--line);border-radius:14px}.card{padding:17px}.label{color:var(--muted);font-size:13px}.value{font-size:28px;font-weight:650}.green{color:var(--green)}.blue{color:var(--blue)}section{padding:18px;margin-bottom:16px}section h2{font-size:16px;margin:0 0 14px}.bar{height:16px;background:#2b3442;border-radius:999px;overflow:hidden;display:flex}.bar i{display:block;height:100%}.hit{background:var(--green)}.miss{background:var(--amber)}.legend{display:flex;gap:18px;color:var(--muted);margin-top:9px;font-size:12px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:right;padding:10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}th{font-weight:500;font-size:12px}td.rate{color:var(--green);font-weight:600}footer{font-size:12px;display:flex;justify-content:space-between;gap:10px}@media(max-width:700px){body{padding:18px}header{display:block}.controls{margin-top:14px}.grid{grid-template-columns:repeat(2,1fr)}}
</style></head><body><main><header><div><h1>DeepSeek 缓存监控</h1><div class="sub">只读取 OpenCodex 本地日志，不修改 Codex 配置</div></div><div class="controls"><button data-r="1h">1小时</button><button data-r="5h">5小时</button><button data-r="1d">1天</button><button data-r="7d">7天</button><button data-r="all" class="active">全部</button></div></header><div class="grid"><div class="card"><div class="label">缓存命中率</div><div id="rate" class="value green">—</div></div><div class="card"><div class="label">请求次数</div><div id="requests" class="value">—</div></div><div class="card"><div class="label">命中 Token</div><div id="hit" class="value blue">—</div></div><div class="card"><div class="label">未命中 Token</div><div id="miss" class="value">—</div></div></div><section><h2>命中 / 未命中</h2><div class="bar"><i id="hitbar" class="hit"></i><i id="missbar" class="miss"></i></div><div class="legend">命中 <b id="hitpct">—</b>　未命中 <b id="misspct">—</b></div></section><section><h2>按模型</h2><div id="models" class="table-wrap"></div></section><section><h2>最近请求</h2><div id="recent" class="table-wrap"></div></section><footer><span id="source">—</span><span id="updated">—</span></footer></main><script>
let range='all';const nf=new Intl.NumberFormat('zh-CN'),pct=x=>(x*100).toFixed(2)+'%',short=x=>x>=1e6?(x/1e6).toFixed(2)+'M':x>=1e3?(x/1e3).toFixed(1)+'K':nf.format(Math.round(x)),time=x=>x?new Date(x).toLocaleString('zh-CN',{hour12:false}):'—';
async function refresh(){const d=await fetch('/api/data?range='+range,{cache:'no-store'}).then(x=>x.json()),s=d.summary;document.querySelector('#rate').textContent=pct(s.hitRate);document.querySelector('#requests').textContent=nf.format(s.requests);document.querySelector('#hit').textContent=short(s.hit);document.querySelector('#miss').textContent=short(s.miss);document.querySelector('#hitbar').style.width=(s.hitRate*100)+'%';document.querySelector('#missbar').style.width=((1-s.hitRate)*100)+'%';document.querySelector('#hitpct').textContent=pct(s.hitRate);document.querySelector('#misspct').textContent=pct(1-s.hitRate);document.querySelector('#source').textContent='数据源：'+d.logPath;document.querySelector('#updated').textContent='刷新：'+time(d.generatedAt)+' · 每5秒';let m=d.models.map(x=>'<tr><td>'+x.model+'</td><td>'+nf.format(x.requests)+'</td><td>'+short(x.input)+'</td><td>'+short(x.hit)+'</td><td>'+short(x.miss)+'</td><td class="rate">'+pct(x.hitRate)+'</td></tr>').join('');document.querySelector('#models').innerHTML='<table><thead><tr><th>模型</th><th>请求</th><th>输入</th><th>命中</th><th>未命中</th><th>命中率</th></tr></thead><tbody>'+(m||'<tr><td colspan="6">暂无 DeepSeek 请求</td></tr>')+'</tbody></table>';let r=d.recent.map(x=>'<tr><td>'+time(x.timestamp)+'</td><td>'+x.model+'</td><td>'+short(x.input)+'</td><td>'+short(x.hit)+'</td><td>'+short(x.miss)+'</td><td class="rate">'+pct(x.input?x.hit/x.input:0)+'</td><td>'+(x.durationMs?nf.format(Math.round(x.durationMs))+' ms':'—')+'</td></tr>').join('');document.querySelector('#recent').innerHTML='<table><thead><tr><th>时间</th><th>模型</th><th>输入</th><th>命中</th><th>未命中</th><th>命中率</th><th>耗时</th></tr></thead><tbody>'+(r||'<tr><td colspan="7">暂无 DeepSeek 请求</td></tr>')+'</tbody></table>'}
document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{range=b.dataset.r;document.querySelectorAll('[data-r]').forEach(x=>x.classList.toggle('active',x===b));refresh()});refresh();setInterval(refresh,5000);
</script></body></html>`;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/api/data') { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data(url.searchParams.get('range') || 'all'))); return; }
  if (url.pathname === '/health') { res.end('ok'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page);
}).listen(port, '127.0.0.1', () => console.log(`DeepSeek cache monitor: http://127.0.0.1:${port}`));
