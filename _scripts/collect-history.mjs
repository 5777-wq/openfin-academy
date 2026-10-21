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

/** --series=ID,ID —— 只采指定序列（不写其它序列的文件） */
const SERIES = (process.argv.find((a) => a.startsWith('--series=')) || '').slice(9).split(',').filter(Boolean);
const wantedSeries = (id) => !SERIES.length || SERIES.includes(id);

async function getText(url, timeout = 25000) {
  // 重试：CDN 偶发失败是常态。采集脚本是每日流水线，不能因为一次抖动就断。
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; openfin-academy collector)' },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) {
        console.warn(`  [retry ${attempt}] ${url.slice(0, 64)}… ${e.message}`);
        await sleep(900 * attempt);
      }
    } finally { clearTimeout(t); }
  }
  throw lastErr;
}

/* ---------------- 原始文本缓存 ----------------
   CBOE 的 VIX CSV 有 1.5MB，财政部 CSV 每年一份。
   月频与日频两条链路都要它们——不缓存就是同一个进程下两遍，
   容易触发 CDN 限流（实测第二次会 fetch failed）。 */
const rawText = new Map();

async function cboeCsv() {
  const KEY = 'cboe-vix';
  if (rawText.has(KEY)) return rawText.get(KEY);
  const txt = await getText('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv');
  rawText.set(KEY, txt);
  return txt;
}

async function treasuryCsv(year) {
  const KEY = 'treasury-' + year;
  if (rawText.has(KEY)) return rawText.get(KEY);
  const u = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all`
    + `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  let txt = null;
  try { txt = await getText(u); } catch (e) { console.warn(`  [treasury] ${year} 失败：${e.message}`); }
  rawText.set(KEY, txt);
  return txt;
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

/* ---------------- 腾讯月线（备源） ----------------
   实测：东财 push2his 在部分网络下直连不通（socket 被掐），腾讯 ifzq 通且回 CORS 头。
   只覆盖 A 股指数——腾讯 symbol 规则简单：1.xxxxxx → shxxxxxx，0.xxxxxx → szxxxxxx。
   lmt 上限 2000（写 5000 腾讯直接回 "param error"）。 */
async function tencentMonthly(secid) {
  const m = /^([10])\.(\d{6})$/.exec(String(secid || ''));
  if (!m) return [];
  const code = (m[1] === '1' ? 'sh' : 'sz') + m[2];
  const u = 'https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param='
    + `${code},month,,,2000&_var=1`;
  const txt = await getText(u);
  const j = JSON.parse(txt);
  const node = j && j.data && j.data[code];
  const rows = node && node.month ? node.month : [];
  return rows.map((r) => ({ t: String(r[0]).slice(0, 10), v: Number(r[2]) }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.t) && Number.isFinite(x.v));
}

/* 腾讯月线（港股）：恒生科技这类只有腾讯能取到的序列 */
async function tencentMonthlyHK(secid) {
  const m = /^100\.(.+)$/.exec(String(secid || ''));
  if (!m) return [];
  const code = 'hk' + m[1];
  const u = 'https://web.ifzq.gtimg.cn/appstock/app/kline/kline?param='
    + `${code},month,,,2000&_var=1`;
  const txt = await getText(u);
  const j = JSON.parse(txt);
  const node = j && j.data && j.data[code];
  const rows = node && node.month ? node.month : [];
  return rows.map((r) => ({ t: String(r[0]).slice(0, 10), v: Number(r[2]) }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.t) && Number.isFinite(x.v));
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
    const txt = await treasuryCsv(y);
    if (!txt) continue;
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

/* ---------------- 危机回放包（日频） ----------------
   月频会把崩盘日藏起来：1997-10 恒指月末收 16459，但当月最低收盘只有 9059。
   所以危机包一律用日频——回放器能逐日拖过雷曼倒闭、黑色星期一。 */
const CRISIS_DEFS = [
  {
    id: '2008', title: '2008 年次贷危机',
    headlineKey: 'SPX',
    from: '2006-01-01', to: '2010-06-30',
    series: ['SPX', 'GC00Y', 'CL00Y', 'US10Y', 'VIX'],
    events: [
      { t: '2006-02-01', title: '美国房价见顶回落', note: '房价是这轮危机的燃料，它先熄火。' },
      { t: '2007-08-09', title: '两只对冲基金爆仓', note: '对冲基金也能爆仓——它们用高杠杆做流动性赌注。' },
      { t: '2007-09-15', title: '北岩银行倒闭', note: '现代投行开始倒下，此前一直被认为「太大不能倒」。' },
      { t: '2008-03-16', title: '贝尔斯登被美联储接管', note: '救助第一次出现，官方还在否认系统性风险。' },
      { t: '2008-09-15', title: '雷曼兄弟破产', note: '158 年历史的投行倒下，全球信用市场当晚冻结。' },
      { t: '2008-09-16', title: 'AIG 获 850 亿美元救助', note: '危机从「投行」级别升级为「保险公司」级别。' },
      { t: '2008-10-14', title: 'G7 达成救市行动计划', note: '各国央行联合降息，财政刺激开始摆上台面。' },
      { t: '2008-10-15', title: '标普单日 -9.03%', note: '危机中最惨的一天。这才是「系统性风险」长什么样。' },
      { t: '2008-11-25', title: '美联储正式实施 QE1', note: '直接买国债和机构债，这是现代央行第一次大规模买资产。' },
      { t: '2008-12-16', title: '联邦基金利率降到 0', note: '常规工具用尽，接下来只能靠 QE。' },
      { t: '2009-03-09', title: '标普500 见底', note: '从 2007 年高点跌去 57%，这个底后来再没破。' },
      { t: '2009-03-18', title: '美联储宣布 QE2', note: '第二轮 1.75 万亿美元，危机还没结束但政策已经转向。' },
    ],
  },
  {
    id: '1990', title: '1990 日本泡沫破裂',
    headlineKey: 'N225',
    from: '1987-04-01', to: '1993-06-30',
    series: ['N225', 'SPX', 'HSI', 'GC00Y', 'CL00Y', 'US10Y'],
    events: [
      { t: '1987-09-12', title: '日本央行加息', note: '把基准利率从 5% 降到 2.5%——听起来是宽松，其实是给泡沫降温。' },
      { t: '1987-10-20', title: '日经单日 -14.9%', note: '美国 10 月 19 日崩盘，日本隔一天崩得更狠。这就是泡沫的起点。' },
      { t: '1989-12-29', title: '日经见顶 38915', note: '这个位置站了整整一年，全世界都以为日本经济不会跌。' },
      { t: '1990-02-13', title: '日本央行加息至 5.25%', note: '泡沫开始裂开。' },
      { t: '1990-04-02', title: '日经 1990 年最大单日跌幅 -6.6%', note: '注意这个数字：1990 年整年最大单日跌幅只有 6.6%——日本泡沫是慢刀子，不是崩盘。' },
      { t: '1990-08-11', title: '日本央行加息至 6%', note: '加息成了压垮骆驼的最后一根稻草。' },
      { t: '1992-03-16', title: '日经跌破 2 万', note: '从 1989 年 12 月的峰值算起，走了 15 个月才跌掉三分之一。' },
      { t: '1992-08-18', title: '日经见底 14309', note: '较峰值跌去 63%。「泡沫经济总清算」结束，接下来是失去的十年。' },
    ],
  },
  {
    id: '1998', title: '1998 亚洲金融危机与 LTCM',
    headlineKey: 'HSI',
    from: '1997-04-01', to: '1999-06-30',
    series: ['HSI', 'N225', 'SPX', 'GC00Y', 'US10Y', 'VIX'],
    events: [
      { t: '1997-05-11', title: '泰铢崩盘', note: '国际炒家一天就把泰铢打下去 15%，盯住泰铢的汇率制度失守。' },
      { t: '1997-07-02', title: '亚洲金融危机全面爆发', note: '从泰国蔓延到印尼、马来西亚、菲律宾、然后是香港。' },
      { t: '1997-10-23', title: '恒指单日 -10.4%', note: '香港政府入市干预，仍没能挡住下跌。' },
      { t: '1997-10-28', title: '恒指单日 -13.7%', note: '「黑色星期五」。这是港股史上单日最大跌幅之一。' },
      { t: '1997-11-10', title: '恒指跌破 10000', note: '从 8 月的 16673 点一路跌下来，跌了四成。' },
      { t: '1998-08-13', title: '恒指见底 6660', note: '较 1997 年 8 月峰值跌去 60%，比亚洲其它市场跌得更深。' },
      { t: '1998-08-17', title: '俄罗斯违约', note: '卢布崩盘，全球市场最怕的事情发生了。' },
      { t: '1998-08-25', title: '美联储组织救助 LTCM', note: '一家对冲基金撑垮了，需要央行召集六家银行来救。' },
      { t: '1998-09-08', title: '雷曼因 LTCM 被迫接受收购', note: '同一年的第二次雷曼新闻，两年后就是 2008。' },
      { t: '1999-03-31', title: '美股掉头向上', note: '降息 + 互联网叙事，1999 到 2000 是史上最疯的两年。' },
    ],
  },
  {
    id: '1994', title: '1994 墨西哥比索危机',
    headlineKey: 'US10Y',
    from: '1993-10-01', to: '1995-12-31',
    series: ['SPX', 'US10Y', 'GC00Y', 'CL00Y', 'HSI'],
    events: [
      { t: '1994-01-01', title: '萨卡多平托掌权', note: '比索被盯上，汇率成为政治问题。' },
      { t: '1994-03-31', title: '比索危机爆发', note: '一夜之间贬值两成。' },
      { t: '1994-12-31', title: '美联储连续加息', note: '为了稳住美元和遏制通胀，一年里连续加了 7 次息。' },
      { t: '1995-02-28', title: '墨西哥经济企稳', note: '国际货币基金组织援助计划生效。' },
    ],
  },
  {
    id: '1987', title: '1987 黑色星期一',
    headlineKey: 'SPX',
    from: '1987-06-01', to: '1988-12-31',
    series: ['SPX', 'CL00Y'],
    events: [
      { t: '1987-10-19', title: '黑色星期一', note: '标普500 单日从 282.70 跌到 224.84，一天蒸发掉五分之一的市值。' },
      { t: '1987-10-20', title: '各地交易所紧急休市', note: '美国停市一天，全球市场像被按了暂停键。' },
      { t: '1987-11-30', title: '格林斯潘放水', note: '央行开始提供流动性，市场在两个月内收复失地。' },
    ],
    note: 'VIX 与美债收益率的官方序列都从 1990 年开始，所以这场只能看标普和原油——这本身就是个诚实的数据边界。',
  },
];

/** 取一段区间的日频序列（东财） */
async function eastDaily(secid, from, to) {
  const u = `${EAST}?secid=${encodeURIComponent(secid)}&fields1=f1,f2`
    + `&fields2=f51,f53&klt=101&fqt=0&beg=${from.replace(/-/g, '')}&end=${to.replace(/-/g, '')}&lmt=5000`;
  const txt = await getText(u);
  const j = JSON.parse(txt);
  const d = j && j.data;
  if (!d || !d.klines || !d.klines.length) return [];
  return d.klines.map((line) => {
    const p = line.split(',');
    return { t: p[0], v: Number(p[1]) };
  }).filter((x) => Number.isFinite(x.v));
}

/** 危机包里的序列：从哪来（日频） */
const CRISIS_SOURCES = {
  SPX: { kind: 'east', secid: '100.SPX' },
  DJIA: { kind: 'east', secid: '100.DJIA' },
  N225: { kind: 'east', secid: '100.N225' },
  HSI: { kind: 'east', secid: '100.HSI' },
  GC00Y: { kind: 'east', secid: '101.GC00Y' },
  SI00Y: { kind: 'east', secid: '101.SI00Y' },
  CL00Y: { kind: 'east', secid: '102.CL00Y' },
  UDI: { kind: 'east', secid: '100.UDI' },
  VIX: { kind: 'cboe' },
  US10Y: { kind: 'treasury', col: '10 Yr' },
  US2Y: { kind: 'treasury', col: '2 Yr' },
  US3M: { kind: 'treasury', col: '3 Mo' },
  US30Y: { kind: 'treasury', col: '30 Yr' },
};

const dailyCache = new Map();

/** CBOE VIX 原始日频 */
async function cboeDaily() {  if (dailyCache.has('VIX')) return dailyCache.get('VIX');
  const txt = await cboeCsv();
  const lines = txt.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((s) => s.trim().toUpperCase());
  const ci = head.indexOf('CLOSE'), di = head.indexOf('DATE');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    if (p.length <= ci) continue;
    const iso = usToIso(String(p[di]).trim());
    const v = Number(p[ci]);
    if (!iso || !Number.isFinite(v)) continue;
    out.push({ t: iso, v });
  }
  out.sort((a, b) => a.t.localeCompare(b.t));
  dailyCache.set('VIX', out);
  return out;
}

/** 美国财政部收益率曲线原始日频（按年增量抓，内存缓存） */
const treasuryRaw = new Map();
async function treasuryDaily(col) {
  if (treasuryRaw.has(col)) return treasuryRaw.get(col);
  const all = [];
  for (let y = 1989; y <= 2026; y++) {
    const txt = await treasuryCsv(y);
    if (!txt) continue;
    const lines = txt.trim().split(/\r?\n/);
    const head = lines[0].split(',').map((s) => s.trim().replace(/^"|"$/g, '').trim());
    const di = head.indexOf('Date');
    const ci = head.indexOf(col);
    if (di < 0 || ci < 0) continue;
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split(',');
      const iso = usToIso(String(p[di]).trim().replace(/^"|"$/g, ''));
      const v = Number(String(p[ci] === undefined ? '' : p[ci]).trim());
      if (!iso || !Number.isFinite(v)) continue;
      all.push({ t: iso, v });
    }
    await sleep(80);
  }
  all.sort((a, b) => a.t.localeCompare(b.t));
  treasuryRaw.set(col, all);
  return all;
}

async function buildCrisis(def) {
  const series = [];
  for (const k of def.series) {
    const src = CRISIS_SOURCES[k];
    if (!src) { console.warn(`  [skip] ${def.id}/${k}：未知来源`); continue; }
    let pts = [];
    try {
      if (src.kind === 'east') pts = await eastDaily(src.secid, def.from, def.to);
      else if (src.kind === 'cboe') pts = (await cboeDaily()).filter((p) => p.t >= def.from && p.t <= def.to);
      else if (src.kind === 'treasury') pts = (await treasuryDaily(src.col)).filter((p) => p.t >= def.from && p.t <= def.to);
    } catch (e) { console.warn(`  [skip] ${def.id}/${k}：${e.message}`); continue; }
    if (!pts.length) { console.warn(`  [skip] ${def.id}/${k}：区间内无数据`); continue; }
    const meta = await seriesMeta(k);
    series.push({ key: k, name: meta.name, unit: meta.unit, digits: meta.digits, points: pts });
  }
  if (!series.length) { console.warn(`  [skip] crisis-${def.id}：没有可用序列`); return; }

  // 规范日期轴：所有序列日期的并集
  const set = new Set();
  for (const s of series) for (const p of s.points) set.add(p.t);
  const dates = [...set].sort();

  const payload = {
    id: def.id,
    title: def.title,
    from: def.from, to: def.to, freq: 'D',
    generatedAt: new Date().toISOString(),
    dates,
    series,
    events: def.events || [],
    source: '东方财富（指数/商品）· CBOE（VIX）· 美国财政部（美债收益率）',
    note: def.note || '日频口径。前复权与否按各源原始序列，不做跨源价格调整。',
  };
  await writeFile(path.join(OUT, 'crisis-' + def.id + '.json'), JSON.stringify(payload), 'utf8');
  console.log(`  [ok] crisis-${def.id}  ${dates.length} 个交易日 × ${series.length} 条序列  ${def.title}`);
}

/** 危机包轻量索引：列表页只读这个，不加载几百 KB 的完整包
    头条资产由 CRISIS_DEFS 的 headlineKey 指定（是编辑判断），
    但数值一律从数据算（不是手写）——指定"看哪条"，不指定"是多少"。 */
async function buildCrisisIndex() {
  const isYield = (k) => k === 'US10Y' || k === 'US2Y' || k === 'US3M' || k === 'US30Y';
  const items = [];
  for (const def of CRISIS_DEFS) {
    const p = path.join(OUT, 'crisis-' + def.id + '.json');
    if (!existsSync(p)) continue;
    const pkg = JSON.parse(await readFile(p, 'utf8'));

    const s = (pkg.series || []).find((x) => x.key === def.headlineKey)
      || (pkg.series || []).find((x) => !isYield(x.key));
    if (!s) continue;

    let peak = null, trough = null, worst = { pct: 0, t: '' };
    for (let i = 0; i < s.points.length; i++) {
      const q = s.points[i];
      if (!peak || q.v > peak.v) peak = q;
      if (!trough || q.v < trough.v) trough = q;
      if (i > 0) {
        const pct = (q.v / s.points[i - 1].v - 1) * 100;
        if (pct < worst.pct) worst = { pct, t: q.t };
      }
    }
    const yieldType = isYield(s.key);
    items.push({
      id: pkg.id, title: pkg.title,
      from: pkg.dates[0], to: pkg.dates[pkg.dates.length - 1],
      days: pkg.dates.length, freq: pkg.freq,
      seriesCount: (pkg.series || []).length,
      events: (pkg.events || []).length,
      headline: {
        key: s.key, name: s.name, kind: yieldType ? 'yield' : 'price',
        peak: { t: peak.t, v: peak.v },
        trough: { t: trough.t, v: trough.v },
        // 收益率用「区间变动（百分点）」，价格用「峰谷跌幅（%）」——两者不能混
        dropPct: yieldType ? null : (trough.v / peak.v - 1) * 100,
        changePp: yieldType ? (peak.v - trough.v) : null,
        worstDay: worst.pct ? { t: worst.t, pct: worst.pct } : null,
      },
      note: pkg.note || '',
    });
  }
  await writeFile(path.join(OUT, 'crisis-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), items }), 'utf8');
  console.log(`  [ok] crisis-index  ${items.length} 场（列表页只读这个）`);
}

/** 取序列的名称/单位/小数位（读月度产物即可，元信息一致） */
async function seriesMeta(id) {
  try {
    const j = JSON.parse(await readFile(path.join(OUT, id + '.json'), 'utf8'));
    return { name: j.name, unit: j.unit, digits: j.digits };
  } catch (e) {
    return { name: id, unit: '', digits: 2 };
  }
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
  const eastDefs = [
    // 指数点位保留两位小数：回放器里读者要能对着原始收盘价核对
    ['SPX', '100.SPX', '标普500', '点', 2, '东方财富 push2his 100.SPX'],
    ['NDX', '100.NDX', '纳斯达克100', '点', 2, '东方财富 push2his 100.NDX'],
    ['DJIA', '100.DJIA', '道琼斯工业指数', '点', 2, '东方财富 push2his 100.DJIA'],
    ['N225', '100.N225', '日经225', '点', 2, '东方财富 push2his 100.N225'],
    ['HSI', '100.HSI', '恒生指数', '点', 2, '东方财富 push2his 100.HSI'],
    ['HSTECH', '100.HSTECH', '恒生科技指数', '点', 2, '东方财富 push2his 100.HSTECH'],
    ['SH000001', '1.000001', '上证指数', '点', 2, '东方财富 push2his 1.000001'],
    ['SZ399001', '0.399001', '深证成指', '点', 2, '东方财富 push2his 0.399001'],
    ['SZ399006', '0.399006', '创业板指', '点', 2, '东方财富 push2his 0.399006'],
    ['SH000688', '1.000688', '科创50', '点', 2, '东方财富 push2his 1.000688'],
    ['GC00Y', '101.GC00Y', 'COMEX黄金', '美元/盎司', 2, '东方财富 push2his 101.GC00Y'],
    ['SI00Y', '101.SI00Y', 'COMEX白银', '美元/盎司', 2, '东方财富 push2his 101.SI00Y'],
    ['CL00Y', '102.CL00Y', 'NYMEX原油', '美元/桶', 2, '东方财富 push2his 102.CL00Y'],
    ['UDI', '100.UDI', '美元指数', '', 2, '东方财富 push2his 100.UDI'],
  ];
  for (const [id, secid, name, unit, digits, source] of eastDefs) {
    if (!want('east')) break;
    if (!wantedSeries(id)) continue;
    let pts = [], used = source;
    try {
      pts = await eastMonthly(secid);
    } catch (e) {
      console.warn(`  [fallback] ${id}：东财不可达（${e.message}），改用腾讯备源`);
    }
    if (!pts.length) {
      try {
        pts = await tencentMonthly(secid);
        if (!pts.length) pts = await tencentMonthlyHK(secid);
        if (pts.length) used = `腾讯 ifzq 备源 ${secid}`;
      } catch (e) { console.warn(`  [skip] ${id}：${e.message}`); }
    }
    if (!pts.length) {
      console.warn(`  [skip] ${id}：两个源都没取到数据`);
    } else {
      const p = await writeSeries(id, { name, unit, digits, freq: 'M', source: used, kind: '月收盘价' }, pts);
      if (p) seriesMap[id] = p;
    }
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
  if (want('crisis')) {
    for (const def of CRISIS_DEFS) await buildCrisis(def);
    await buildCrisisIndex();
  }

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
