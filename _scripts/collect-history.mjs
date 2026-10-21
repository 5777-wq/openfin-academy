#!/usr/bin/env node
/* collect-history.mjs —— 采集长历史序列，产出 data/history/*.json
   来源（全部免密钥、官方或公开接口）：
     · 东方财富 push2his  —— 指数 / 商品 / 外汇 月线
     · CBOE 官方 CSV      —— VIX 日线
     · 美国财政部官方 CSV —— 美债收益率曲线日线
   产物提交进仓库，浏览器只读静态 JSON，不直连海外源。 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'history');
const EAST = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** --only=east,vix,treasury,chain —— 只跑指定环节，方便迭代 */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);

async function getText(url, timeout = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 openfin-academy collector' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally { clearTimeout(t); }
}

/* ---------------- 东方财富月线 ---------------- */
async function eastMonthly(secid, from = '19000101') {
  const u = `${EAST}?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3`
    + `&fields2=f51,f53&klt=103&fqt=0&beg=${from}&end=20991231&lmt=5000`;
  const txt = await getText(u);
  const j = JSON.parse(txt);
  const d = j && j.data;
  if (!d || !d.klines || !d.klines.length) return [];
  return d.klines.map((line) => {
    const p = line.split(',');
    return { t: p[0], v: Number(p[1]) };
  }).filter((x) => Number.isFinite(x.v));
}

/* ---------------- CBOE VIX 日线 → 月末 ---------------- */
async function cboeVix() {
  const txt = await getText('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv');
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((s) => s.trim().toUpperCase());
  const ci = head.indexOf('CLOSE');
  const di = head.indexOf('DATE');
  const byMonth = new Map();
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length <= ci) continue;
    const iso = usToIso(String(p[di]).trim());
    const v = Number(p[ci]);
    if (!iso || !Number.isFinite(v)) continue;
    byMonth.set(iso.slice(0, 7), { t: iso, v });
  }
  return [...byMonth.values()].sort((a, b) => a.t.localeCompare(b.t));
}

function usToIso(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const mm = Number(m[1]), dd = Number(m[2]), yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;   // 脏行直接丢
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/* ---------------- 美国财政部收益率曲线 → 月末 ---------------- */
async function treasuryCurve(years) {
  const out = { US3M: new Map(), US2Y: new Map(), US10Y: new Map(), US30Y: new Map() };
  for (const y of years) {
    const u = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all`
      + `?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    let txt;
    try { txt = await getText(u); } catch (e) { console.warn(`  [treasury] ${y} 失败：${e.message}`); continue; }
    const lines = txt.trim().split(/\r?\n/);
    // 表头形如：Date,"1 Mo","3 Mo","6 Mo",... —— 引号要剥掉再找列
    const head = lines[0].split(',').map((s) => s.trim().replace(/^"|"$/g, '').trim());
    const di = head.indexOf('Date');
    if (di < 0) { console.warn(`  [treasury] ${y} 表头无法识别：${lines[0].slice(0, 80)}`); continue; }
    const idx = {
      US3M: head.indexOf('3 Mo'), US2Y: head.indexOf('2 Yr'),
      US10Y: head.indexOf('10 Yr'), US30Y: head.indexOf('30 Yr'),
    };
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(',');
      const iso = usToIso(String(p[di]).trim().replace(/^"|"$/g, ''));
      if (!iso) continue;
      for (const key of Object.keys(idx)) {
        const j = idx[key];
        if (j < 0 || p[j] === undefined) continue;
        const v = Number(String(p[j]).trim());
        if (!Number.isFinite(v)) continue;
        out[key].set(iso.slice(0, 7), { t: iso, v });
      }
    }
    await sleep(120);
  }
  const res = {};
  for (const k of Object.keys(out)) res[k] = [...out[k].values()].sort((a, b) => a.t.localeCompare(b.t));
  return res;
}

/* ---------------- 写产物 ---------------- */
async function writeSeries(id, def, points) {
  if (!points.length) { console.warn(`  [skip] ${id}：无数据`); return null; }
  const payload = Object.assign({
    id,
    generatedAt: new Date().toISOString(),
    points,
  }, def);
  await writeFile(path.join(OUT, id + '.json'), JSON.stringify(payload), 'utf8');
  console.log(`  [ok] ${id.padEnd(12)} ${points.length} 点  ${points[0].t} → ${points[points.length - 1].t}`);
  return payload;
}

/* ---------------- 2008 危机包 ---------------- */
const CRISIS_2008_EVENTS = [
  { t: '2006-02-01', title: '美国房价见顶回落', note: '房价是这轮危机的燃料，它先熄火。' },
  { t: '2007-08-09', title: '两只对冲基金爆仓', note: '对冲基金也能爆仓——它们用高杠杆做流动性赌注。' },
  { t: '2007-09-15', title: '北岩银行倒闭', note: '现代投行开始倒下，此前一直被认为「太大不能倒」。' },
  { t: '2008-03-16', title: '贝尔斯登被美联储接管', note: '救助第一次出现，官方还在否认系统性风险。' },
  { t: '2008-09-15', title: '雷曼兄弟破产', note: '158 年历史的投行倒下，全球信用市场当晚冻结。' },
  { t: '2008-09-16', title: 'AIG 获 850 亿美元救助', note: '危机从「投行」级别升级为「保险公司」级别。' },
  { t: '2008-10-14', title: 'G7 达成救市行动计划', note: '各国央行联合降息，财政刺激开始摆上台面。' },
  { t: '2008-11-25', title: '美联储正式实施 QE1', note: '直接买国债和机构债，这是现代央行第一次大规模买资产。' },
  { t: '2008-12-16', title: '联邦基金利率降到 0', note: '常规工具用尽，接下来只能靠 QE。' },
  { t: '2009-03-09', title: '标普500 见底 676.53', note: '从 2007 年高点跌去 57%，这个底后来再没破。' },
  { t: '2009-03-18', title: '美联储宣布 QE2', note: '第二轮 1.75 万亿美元，危机还没结束但政策已经转向。' },
];

/** 把一条序列重挂到「每月月末」口径：每月取该月最后一个观测 */
function toMonthEnd(points) {
  const byMonth = new Map();
  for (const p of points) {
    const mk = String(p.t).slice(0, 7);
    const prev = byMonth.get(mk);
    if (!prev || p.t > prev.t) byMonth.set(mk, p);
  }
  return [...byMonth.values()].sort((a, b) => a.t.localeCompare(b.t));
}

async function buildCrisis2008() {
  const from = '2006-01-01', to = '2010-12-31';
  const want = ['SPX', 'GC00Y', 'CL00Y', 'US10Y', 'VIX'];
  const series = [];

  // 直接读已落盘的序列文件，这样 --only=crisis 也能单独重跑
  for (const k of want) {
    const p = path.join(OUT, k + '.json');
    if (!existsSync(p)) { console.warn(`  [skip] ${k}：还没采集`); continue; }
    const src = JSON.parse(await readFile(p, 'utf8'));
    const pts = toMonthEnd(src.points.filter((x) => x.t >= from && x.t <= to));
    if (!pts.length) continue;
    series.push({ key: k, name: src.name, unit: src.unit, digits: src.digits, points: pts });
  }
  if (!series.length) { console.warn('  [skip] crisis-2008：没有可用序列'); return; }

  // 规范月频日期轴：所有序列的月份并集，日期取该月各序列中最晚的那天
  const monthMax = new Map();
  for (const s of series) {
    for (const p of s.points) {
      const mk = p.t.slice(0, 7);
      if (!monthMax.has(mk) || p.t > monthMax.get(mk)) monthMax.set(mk, p.t);
    }
  }
  const months = [...monthMax.keys()].sort();
  const dates = months.map((mk) => monthMax.get(mk));

  const payload = {
    id: '2008',
    title: '2008 年次贷危机',
    from, to, freq: 'M',
    generatedAt: new Date().toISOString(),
    dates,
    series,
    events: CRISIS_2008_EVENTS,
    source: '东方财富（指数/商品）· CBOE（VIX）· 美国财政部（美债收益率）',
    note: '全部序列统一为月末口径。美债收益率取当月最后一个公布值。',
  };
  await writeFile(path.join(OUT, 'crisis-2008.json'), JSON.stringify(payload), 'utf8');
  console.log(`  [ok] crisis-2008  ${dates.length} 个月 × ${series.length} 条序列`);
}

/* ---------------- 产业链 secid 解析 ---------------- */
async function resolveChainSecids() {
  const srcFile = path.join(ROOT, 'vendor', 'core', 'industry-chains.js');
  if (!existsSync(srcFile)) { console.warn('  [chain] vendor 尚未同步，跳过'); return; }
  const txt = await readFile(srcFile, 'utf8');
  const re = /\{\s*name:\s*'([^']+)'\s*,\s*symbol:\s*'([^']+)'/g;
  const stocks = new Map();
  let m;
  while ((m = re.exec(txt))) stocks.set(m[2], m[1]);

  const map = {};
  const usList = [];
  for (const [symbol, name] of stocks) {
    if (/^sh\d{6}$/.test(symbol)) map[symbol] = { name, secid: '1.' + symbol.slice(2) };
    else if (/^sz\d{6}$/.test(symbol)) map[symbol] = { name, secid: '0.' + symbol.slice(2) };
    else if (/^hk\d{4,5}$/.test(symbol)) map[symbol] = { name, secid: '116.' + symbol.slice(2) };
    else if (/^us[A-Z0-9.]+$/.test(symbol)) usList.push([symbol, name]);
  }

  // 美股：105=纳斯达克 106=纽交所 107=AMEX，一次批量试出来
  const cand = [];
  usList.forEach(([symbol, name]) => {
    [105, 106, 107].forEach((mk) => cand.push({ symbol, name, secid: mk + '.' + symbol.slice(2) }));
  });
  for (let i = 0; i < cand.length; i += 50) {
    const chunk = cand.slice(i, i + 50);
    const ids = chunk.map((c) => c.secid).join(',');
    const u = `https://push2.eastmoney.com/api/qt/ulist.np/get?fields=f12,f13,f14&secids=${encodeURIComponent(ids)}`;
    try {
      const j = JSON.parse(await getText(u));
      const diff = (j.data && j.data.diff) || [];
      const found = new Set(diff.map((d) => `${d.f13}.${d.f12}`));
      chunk.forEach((c) => {
        if (found.has(c.secid) && !map[c.symbol]) {
          map[c.symbol] = { name: c.name, secid: c.secid };
        }
      });
    } catch (e) { console.warn('  [chain] 一批解析失败：' + e.message); }
    await sleep(100);
  }

  await writeFile(path.join(ROOT, 'data', 'chain-secids.json'), JSON.stringify(map, null, 1), 'utf8');
  const missing = [...stocks.keys()].filter((s) => !map[s]);
  console.log(`  [ok] chain-secids  ${Object.keys(map).length}/${stocks.size} 只成分股已解析${missing.length ? `，未解析 ${missing.length} 只` : ''}`);
}

/* ---------------- 主流程 ---------------- */
async function main() {
  await mkdir(OUT, { recursive: true });
  const seriesMap = {};

  console.log('[collect] 东方财富：指数与商品月线');
  const eastDefs = [    ['SPX',    '100.SPX',   '标普500',     '点',        0, '东方财富 push2his 100.SPX'],
    ['NDX',    '100.NDX',   '纳斯达克100', '点',        0, '东方财富 push2his 100.NDX'],
    ['SH000001', '1.000001', '上证指数',  '点',        0, '东方财富 push2his 1.000001'],
    ['GC00Y',  '101.GC00Y', 'COMEX黄金',   '美元/盎司', 0, '东方财富 push2his 101.GC00Y'],
    ['SI00Y',  '101.SI00Y', 'COMEX白银',   '美元/盎司', 2, '东方财富 push2his 101.SI00Y'],
    ['CL00Y',  '102.CL00Y', 'NYMEX原油',   '美元/桶',   2, '东方财富 push2his 102.CL00Y'],
    ['UDI',    '100.UDI',   '美元指数',     '',          2, '东方财富 push2his 100.UDI'],
  ];
  for (const [id, secid, name, unit, digits, source] of eastDefs) {
    if (!want('east')) break;
    try {
      const pts = await eastMonthly(secid);
      const p = await writeSeries(id, { name, unit, digits, freq: 'M', source, kind: '月收盘价' }, pts);
      if (p) seriesMap[id] = p;
    } catch (e) { console.warn(`  [skip] ${id}：${e.message}`); }
    await sleep(150);
  }

  console.log('[collect] CBOE：VIX');
  if (want('vix')) {
  try {
    const pts = await cboeVix();
    const p = await writeSeries('VIX', { name: 'VIX 恐慌指数', unit: '', digits: 1, freq: 'M', source: 'CBOE 官方 VIX_History.csv', kind: '月末收盘' }, pts);
    if (p) seriesMap['VIX'] = p;
  } catch (e) { console.warn('  [skip] VIX：' + e.message); }
  }

  console.log('[collect] 美国财政部：收益率曲线');
  if (want('treasury')) {
  const years = [];
  for (let y = 1990; y <= 2026; y++) years.push(y);
  const curve = await treasuryCurve(years);
  const tDefs = [
    ['US10Y', '美国10年期国债收益率', '%', 2],
    ['US2Y', '美国2年期国债收益率', '%', 2],
    ['US3M', '美国3月期国库券收益率', '%', 2],
    ['US30Y', '美国30年期国债收益率', '%', 2],
  ];
  for (const [id, name, unit, digits] of tDefs) {
    const p = await writeSeries(id, {
      name, unit, digits, freq: 'M',
      source: '美国财政部官方 daily-treasury-rates.csv',
      kind: '月末值',
    }, curve[id] || []);
    if (p) seriesMap[id] = p;
  }
  }

  console.log('[collect] 组合危机回放包');
  if (want('crisis')) await buildCrisis2008();

  // 序列注册表（与已有注册表合并，便于分步采集）
  const regPath = path.join(ROOT, 'data', 'series-map.json');
  const prev = existsSync(regPath) ? JSON.parse(await readFile(regPath, 'utf8')) : { series: [] };
  const merged = new Map();
  (prev.series || []).forEach((s) => merged.set(s.id, s));
  Object.values(seriesMap).forEach((s) => {
    merged.set(s.id, {
      id: s.id, name: s.name, unit: s.unit, freq: s.freq, kind: s.kind,
      source: s.source, from: s.points[0].t, to: s.points[s.points.length - 1].t, count: s.points.length,
    });
  });
  const registry = {
    generatedAt: new Date().toISOString(),
    note: '正文只能引用本表中的 id，杜绝临时抓数写进文章',
    series: [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  await writeFile(regPath, JSON.stringify(registry, null, 2), 'utf8');
  console.log(`  [ok] series-map  ${registry.series.length} 条序列已登记`);

  console.log('[collect] 产业链成分股 secid 解析');
  if (want('chain')) await resolveChainSecids();

  console.log('[collect] 全部完成');
}

main().catch((e) => { console.error('[collect] 失败：', e); process.exit(1); });
