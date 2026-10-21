#!/usr/bin/env node
/* render-test.mjs —— 无浏览器渲染测试
   目标：在 Node 里把站点 JS 真正跑起来，实测每个视图的输出。
   做法：最小 DOM 桩 + 本地 fetch → 执行真实视图函数 → 断言产物 HTML。
   能抓到的正是之前踩过的那类 bug：未定义标识符、字段名对不上、路由缺失。

   用法：node _test/render-test.mjs
*/
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; failures.push(name + (extra ? '  →  ' + extra : '')); }
}
function has(name, hay, needle) {
  ok(name, typeof hay === 'string' && hay.includes(needle),
    '未找到：' + needle + (typeof hay === 'string' ? '（实际长度 ' + hay.length + '）' : '（非字符串）'));
}
/** 元素文本：innerHTML 与 textContent 都算（视图里两种都用） */
function elText(el) {
  if (!el) return '';
  return String(el.innerHTML || '') + String(el.textContent || '');
}
function hasEl(name, el, needle) {
  has(name, elText(el), needle);
}

/* ================= 最小 DOM 桩 ================= */
class El {
  constructor(id, tag) {
    this.id = id; this.tag = tag || 'div';
    this.innerHTML = ''; this.textContent = ''; this.value = '';
    this.dataset = {}; this.style = { cssText: '' }; this.attrs = {};
    this.children = []; this.hidden = false;
    const self = this;
    this.classList = {
      _set: new Set(),
      add(...c) { c.forEach((x) => self.classList._set.add(x)); },
      remove(...c) { c.forEach((x) => self.classList._set.delete(x)); },
      toggle(c, f) { if (f === undefined) f = !self.classList._set.has(c); f ? self.classList._set.add(c) : self.classList._set.delete(c); return f; },
      contains(c) { return self.classList._set.has(c); },
    };
  }
  addEventListener() {} removeEventListener() {} dispatchEvent() {}
  querySelectorAll() { return []; }
  querySelector() { return null; }
  closest() { return null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
  remove() {}
  getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getBoundingClientRect() { return { x: 0, y: 0, width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 }; }
  getTotalLength() { return 100; }
  focus() {} blur() {} click() {}
  setPointerCapture() {} releasePointerCapture() {}
}

const REG = new Map();
function getElementById(id) {
  if (!REG.has(id)) REG.set(id, new El(id));
  return REG.get(id);
}

const documentEl = new El('document');
const doc = {
  getElementById,
  createElement: (t) => new El(null, t),
  createTextNode: (t) => ({ nodeType: 3, textContent: t }),
  body: new El('body'),
  head: new El('head'),
  documentElement: new El('html'),
  title: '',
  readyState: 'complete',
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  activeElement: null,
};
documentEl.appendChild(doc.body);

/* ================= 本地 fetch ================= */
async function localFetch(url) {
  const u = String(url);
  if (/^https?:\/\//.test(u)) {
    // 外部源：模拟不可达（离线测试）
    return { ok: false, status: 0, json: async () => { throw new Error('offline'); } };
  }
  const p = path.join(ROOT, u.split('?')[0].split('#')[0]);
  if (!existsSync(p)) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
  const text = await readFile(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
}

/* ================= 沙箱 ================= */
const mem = new Map();
const localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, Math, Date, JSON, Map, Set, WeakMap, WeakSet,
  Number, String, Array, Object, Boolean, Error, TypeError, RangeError, SyntaxError, RegExp,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  encodeURI, decodeURI, escape, unescape,
  AbortController, AbortSignal, URL, URLSearchParams,
  TextDecoder, TextEncoder, Intl, Symbol, Proxy, Reflect, BigInt,
  fetch: localFetch, localStorage, document: doc,
  addEventListener() {}, removeEventListener() {},
  dispatchEvent() {},
  location: { hash: '#/', href: 'http://127.0.0.1:8765/#/', search: '' },
  history: { pushState() {}, replaceState() {} },
  scrollY: 0, innerWidth: 1280, innerHeight: 900,
  scrollTo() {}, open() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window.document = doc;

const ctx = vm.createContext(sandbox);

/** 与 index.html 保持一致的脚本顺序 */
const SCRIPTS = [
  'vendor/core/utils.js',
  'vendor/core/universe.js',
  'vendor/core/explain.js',
  'vendor/core/industry-chains.js',
  'js/site/format.js',
  'js/store.js',
  'js/router.js',
  'js/engine/series.js',
  'js/engine/percentile.js',
  'js/engine/drawdown.js',
  'js/engine/spread.js',
  'js/engine/similarity.js',
  'js/engine/analogy.js',
  'js/engine/crisis.js',
  'js/sources/quotes.js',
  'js/sources/history.js',
  'js/site/content.js',
  'js/components/term-card.js',
  'js/components/term-drawer.js',
  'js/components/era-timeline.js',
  'js/components/replay-player.js',
  'js/components/chain-heat.js',
  'js/views/home.js',
  'js/views/list.js',
  'js/views/article.js',
  'js/views/crisis.js',
  'js/views/chain.js',
  'js/views/path.js',
  'js/views/term.js',
  'js/views/search.js',
  'js/app.js',
];

async function main() {
  /* ---- 1. 所有脚本能无异常加载 ---- */
  for (const f of SCRIPTS) {
    const p = path.join(ROOT, f);
    if (!existsSync(p)) { ok('脚本存在 ' + f, false, '文件缺失'); continue; }
    try {
      vm.runInContext(await readFile(p, 'utf8'), ctx, { filename: f });
      ok('脚本加载 ' + f, true);
    } catch (e) {
      ok('脚本加载 ' + f, false, e.message);
    }
  }

  /* ---- 2. 全局对象齐备 ---- */
  for (const g of ['Fmt', 'Store', 'Router', 'Quotes', 'History', 'Content', 'TermCard',
    'TermDrawer', 'EraTimeline', 'ReplayPlayer', 'ChainHeat',
    'HomeView', 'ListView', 'ArticleView', 'CrisisView', 'ChainView', 'PathView', 'SearchView', 'TermView',
    'Engine', 'Explain', 'INDUSTRY_CHAINS']) {
    ok('全局对象 ' + g, typeof sandbox[g] !== 'undefined');
  }
  ok('Engine 六个模块齐备', sandbox.Engine
    && !!sandbox.Engine.series && !!sandbox.Engine.percentile && !!sandbox.Engine.drawdown
    && !!sandbox.Engine.spread && !!sandbox.Engine.similarity && !!sandbox.Engine.analogy);

  /* ---- 3. 内容加载 ---- */
  await sandbox.Content.loadAll();
  ok('内容索引非空', sandbox.Content.list().length >= 6, '实际 ' + sandbox.Content.list().length);
  ok('术语库非空', Object.keys(sandbox.Content.glossary()).length >= 12);
  ok('新手路径有 8 课', !!sandbox.Content.pathPlan() && sandbox.Content.pathPlan().lessons.length === 8);

  /* ---- 4. 路由表覆盖所有内容分区 ---- */
  const paths = sandbox.Router.ROUTES.map((r) => r.path);
  for (const p of ['/concepts/:id', '/crisis/:id', '/assets/:id', '/chains/:id', '/cycles/:id', '/family/:id',
    '/term/:id', '/terms']) {
    ok('路由存在 ' + p, paths.indexOf(p) >= 0);
  }
  // 每篇文章的 section 都要有对应的详情路由
  const routeOf = { concepts: '/concepts/:id', assets: '/assets/:id', crisis: '/crisis/:id', cycles: '/cycles/:id', family: '/family/:id' };
  for (const a of sandbox.Content.list()) {
    ok('文章 ' + a.id + ' 有详情路由', paths.indexOf(routeOf[a.section]) >= 0, 'section=' + a.section);
  }

  /* ---- 5. 视图渲染 ---- */
  const view = () => getElementById('view');

  // 首页（先塞几条假报价，测到"有数据"那条分支）
  sandbox.Quotes.state.quotes.set('EM:171.US10Y', { key: 'EM:171.US10Y', name: '美债10年', price: 5.24, pct: 0.29, digits: 2, unit: '%' });
  sandbox.Quotes.state.quotes.set('EM:101.GC00Y', { key: 'EM:101.GC00Y', name: '黄金', price: 4143.8, pct: -0.13, digits: 1, unit: '美元/盎司' });
  sandbox.Quotes.state.quotes.set('sh000001', { key: 'sh000001', name: '上证', price: 3717.09, pct: -0.49, digits: 2, unit: '' });
  sandbox.Quotes.state.source = '测试桩';
  sandbox.HomeView.render(view());
  const home = view().innerHTML;
  has('首页：主标题', home, '讲成你听得懂的话');
  has('首页：今日一词', home, '今日一词');
  has('首页：姊妹站', home, 'OpenFinLens');
  has('首页：新手路径入口', home, '从零开始');
  has('首页：时代横轴容器', home, 'id="home-era"');
  // 时代横轴与仪表是子元素，要单独断言
  hasEl('首页：时代横轴渲染', getElementById('home-era'), '互联网泡沫');
  hasEl('首页：时代横轴含 AI 周期', getElementById('home-era'), 'AI 周期');
  hasEl('首页：仪表卡名', getElementById('home-gauges'), '美债 10 年期收益率');
  hasEl('首页：仪表卡含黄金', getElementById('home-gauges'), 'COMEX 黄金');
  hasEl('首页：仪表卡有真实读数', getElementById('home-gauges'), '5.24');
  hasEl('首页：仪表卡有涨跌幅', getElementById('home-gauges'), '+0.29%');
  hasEl('首页：仪表卡有解释链接', getElementById('home-gauges'), 'risk-free-rate');
  hasEl('首页：仪表卡有"这是什么"提示', getElementById('home-gauges'), 'dp-f');
  hasEl('首页：仪表数据源标注', getElementById('gauge-src'), '测试桩');

  // 列表页
  for (const sec of ['concepts', 'assets', 'cycles', 'family']) {
    sandbox.ListView.render(view(), sec);
    const h = view().innerHTML;
    ok('列表页 ' + sec + ' 有条目', /class="entry"/.test(h) && h.length > 500);
  }

  // 文章详情（每一篇都要能渲染，且标题不为空）
  for (const a of sandbox.Content.list()) {
    let html = '';
    let err = null;
    try {
      sandbox.ArticleView.render(view(), a.section, a.id);
      html = view().innerHTML;
    } catch (e) { err = e.message; }
    ok('文章渲染 ' + a.id, !err, err || '');
    if (!err) {
      // 标题：HTML 里引号被转义，所以比"非空 + 含标题主干"而不是全等
      const h1 = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '';
      ok('文章 ' + a.id + ' 标题非空', h1.replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim().length > 4, 'h1=' + h1);
      ok('文章 ' + a.id + ' 标题与索引一致', h1.replace(/&quot;/g, '"').includes(String(a.title).slice(0, 6)));
      ok('文章 ' + a.id + ' 有免责声明', html.includes('不构成投资建议'));
      ok('文章 ' + a.id + ' 有数据截止日期', html.includes('数据截至'));
      ok('文章 ' + a.id + ' 正文非空', html.includes('class="prose"'));
    }
  }

  // 危机详情
  let crisisErr = null;
  try { await sandbox.CrisisView.renderDetail(view(), '2008'); } catch (e) { crisisErr = e.message; }
  ok('危机详情渲染', !crisisErr, crisisErr || '');
  if (!crisisErr) {
    const h = view().innerHTML;
    has('危机：标题', h, '2008');
    has('危机：免责声明', h, '历史复盘不预测未来');
    ok('危机：含回放器容器', h.includes('id="crisis-replay"'));
  }

  // 回放器：真实数据
  const pkg = await sandbox.History.crisis('2008');
  ok('危机包可加载', !!pkg && !!pkg.series);
  if (pkg) {
    ok('危机包 5 条序列', pkg.series.length === 5, '实际 ' + pkg.series.length);
    ok('危机包为日频', pkg.freq === 'D');
    ok('危机包 1000+ 个交易日', pkg.dates.length > 1000, '实际 ' + pkg.dates.length);
    sandbox.ReplayPlayer.render(getElementById('replay-host'), pkg);
    const rows = getElementById('rp-rows').innerHTML;
    has('回放器：标普轨道', rows, '标普500');
    has('回放器：黄金轨道', rows, 'COMEX黄金');
    has('回放器：美债轨道', rows, '美国10年期国债收益率');
    has('回放器：VIX 轨道', rows, 'VIX 恐慌指数');
    has('回放器：游标', rows, 'id="cur-SPX"');
    has('回放器：事件列表', getElementById('rp-events').innerHTML, '雷曼兄弟破产');

    // 纵向可读性：基准线、涨跌面积、峰谷标记、回撤段、现值点
    has('回放器：基准线', rows, 'rt-base');
    has('回放器：涨跌面积', rows, 'rt-area');
    has('回放器：峰值圈', rows, 'rt-peak');
    has('回放器：谷值圈', rows, 'rt-trough');
    has('回放器：现值点', rows, 'rt-now');
    has('回放器：回撤段', rows, 'id="dd-SPX"');
    has('回放器：轨道用 100×100 坐标系', rows, 'viewBox="0 0 100 100"');
    has('回放器：图例', getElementById('replay-host').innerHTML, '区间起点基准线');

    // 跳到 2008-09-30，读数必须与数据一致
    sandbox.ReplayPlayer.jumpTo('2008-09-30');
    const spx = getElementById('val-SPX').innerHTML;
    const gold = getElementById('val-GC00Y').innerHTML;
    const vix = getElementById('val-VIX').innerHTML;
    has('回放：标普读数 1,166', spx, '1,166');
    ok('回放：标普涨跌幅为负（相对区间起点）', /-\d+\.\d+%/.test(spx), spx);
    has('回放：黄金读数 880.80', gold, '880.80');
    has('回放：VIX 读数 39.4', vix, '39.4');
    hasEl('回放：日期显示 2008-09-30', getElementById('rp-date'), '2008-09-30');
    // 说明条应显示离游标最近的事件（09-30 距 AIG 09-16 为 14 天，比雷曼 09-15 的 15 天更近）
    hasEl('回放：事件说明条显示最近事件', getElementById('rp-note'), 'AIG');

    // 日频数据里有 09-15 这一天：游标能精确落在事件当天
    sandbox.ReplayPlayer.jumpTo('2008-09-15');
    hasEl('回放：游标精确落在 2008-09-15', getElementById('rp-date'), '2008-09-15');
    hasEl('回放：点雷曼就显示雷曼的说明', getElementById('rp-note'), '雷曼兄弟破产');
    has('回放：雷曼当天标普 1,192.70', getElementById('val-SPX').innerHTML, '1,192.70');
    has('回放：雷曼当天黄金 787', getElementById('val-GC00Y').innerHTML, '787');

    // 三行读数：现价 / 相对起点 / 距峰值——"距峰值"就是"跌了多少"
    has('回放：标普距峰值 -23.80%', getElementById('val-SPX').innerHTML, '距峰值 -23.80%');
    has('回放：标普较起点 -6.00%', getElementById('val-SPX').innerHTML, '较起点 -6.00%');
    has('回放：收益率用百分点', getElementById('val-US10Y').innerHTML, 'pp');
    has('回放：美债距峰值 -1.79pp', getElementById('val-US10Y').innerHTML, '距峰值 -1.79pp');
    ok('回放：回撤段已画出', (getElementById('dd-SPX').attrs.d || '').startsWith('M'),
      getElementById('dd-SPX').attrs.d || '(空)');
    ok('回放：现值点跟随游标', /%$/.test(String(getElementById('now-SPX').style.left || '')),
      String(getElementById('now-SPX').style.left));

    // 手动拖走之后，锁定自动解除
    sandbox.ReplayPlayer.jumpTo('2008-12-31');
    hasEl('回放：拖走后说明条跟随最近事件', getElementById('rp-note'), '12-16');
    hasEl('回放：12 月说明条', getElementById('rp-note'), '联邦基金利率');

    // 远离所有事件的日期：说明条回落到本场第一个事件，而不是写死的 2008
    sandbox.ReplayPlayer.jumpTo('2007-01-15');
    hasEl('回放：默认说明指向本场第一个事件', getElementById('rp-note'), pkg.events[0].t);
  }

  // 1990：日经的"跌了多少"读数（用户最在意的那条）
  const p90 = await sandbox.History.crisis('1990');
  if (p90) {
    sandbox.ReplayPlayer.render(getElementById('replay-1990'), p90);
    sandbox.ReplayPlayer.jumpTo('1992-02-21');
    const n225 = getElementById('val-N225').innerHTML;
    has('回放：日经现价 21,291.81', n225, '21,291.81');
    has('回放：日经距峰值 -45.29%', n225, '距峰值 -45.29%');
    has('回放：日经较起点 -10.86%', n225, '较起点 -10.86%');
    ok('回放：日经回撤段已画出', (getElementById('dd-N225').attrs.d || '').length > 10,
      getElementById('dd-N225').attrs.d || '(空)');
    ok('回放：日经峰值圈已定位', /rt-peak" style="left:\d+\.\d+%/.test(
      getElementById('rp-rows').innerHTML), '峰值圈没定位');
  }

  // 其余四场危机包
  for (const id of ['1987', '1990', '1994', '1998']) {
    const p = await sandbox.History.crisis(id);
    ok('危机包可加载 ' + id, !!p);
    if (!p) continue;
    const s = sandbox.Engine.crisis.summarize(p);
    ok('危机摘要 ' + id + ' 有头条跌幅', s && s.headline && typeof s.headline.dropPct === 'number');
    ok('危机摘要 ' + id + ' 天数正确', s.days === p.dates.length);
    sandbox.ReplayPlayer.render(getElementById('replay-' + id), p);
    ok('回放器渲染 ' + id, getElementById('rp-rows').innerHTML.length > 100);
    ok('回放器 ' + id + ' 有事件', getElementById('rp-events').innerHTML.length > 50);
  }

  // 危机列表：从回放包自动生成，头条跌幅由数据算出
  await sandbox.CrisisView.renderList(view());
  const clist = view().innerHTML;
  has('危机列表：标题', clist, '每一场危机');
  for (const id of ['1987', '1990', '1994', '1998', '2008']) {
    ok('危机列表含 ' + id, clist.indexOf('#/crisis/' + id) >= 0);
  }
  has('危机列表：日频标注', clist, '日频');
  has('危机列表：日经跌幅来自数据', clist, '-63.2%');
  has('危机列表：恒指跌幅来自数据', clist, '-60.1%');
  has('危机列表：标普跌幅来自数据', clist, '-56.8%');
  has('危机列表：1994 用收益率口径（百分点）', clist, '个百分点');
  has('危机列表：最惨一天', clist, '最惨一天');

  // 产业链
  const chains = sandbox.INDUSTRY_CHAINS;
  ok('产业链 10 条', chains.length === 10, '实际 ' + chains.length);
  ok('产业链用 links 作环节数组', chains[0].links && chains[0].links.length > 0);
  let chainErr = null;
  try { await sandbox.ChainView.renderDetail(view(), 'ai'); } catch (e) { chainErr = e.message; }
  ok('产业链详情渲染', !chainErr, chainErr || '');
  if (!chainErr) {
    const h = view().innerHTML;
    has('产业链：标题', h, 'AI 算力');
    has('产业链：环节', h, '光模块');
    ok('产业链：强弱条容器', h.includes('id="chain-heat"'));
  }
  sandbox.ChainView.renderList(view());
  has('产业链列表', view().innerHTML, '新能源车');

  // 新手路径
  sandbox.PathView.render(view());
  has('新手路径：标题', view().innerHTML, '从零开始');
  ok('新手路径：8 个课次', (view().innerHTML.match(/data-lesson=/g) || []).length === 8);

  // 搜索
  sandbox.SearchView.render(view(), '黄金');
  has('搜索：命中术语', view().innerHTML, '黄金');
  sandbox.SearchView.render(view(), '不存在的词xyz');
  has('搜索：无结果提示', view().innerHTML, '没有找到');

  // 术语页：给行情终端深链用的落地页
  sandbox.TermView.render(view(), 'gold');
  const th = view().innerHTML;
  has('术语页：术语名', th, '黄金');
  has('术语页：页面标题是 h1', th, '<h1>黄金</h1>');
  has('术语页：四段式卡片', th, 'class="term"');
  has('术语页：一句话', th, '一句话');
  has('术语页：可分享的说明', th, '这条链接可以直接分享出去');
  sandbox.TermView.render(view(), 'risk-free-rate');
  has('术语页：有延伸阅读时列出来', view().innerHTML, '延伸阅读');
  sandbox.TermView.render(view(), '不存在的词xyz');
  has('术语页：未收录有兜底', view().innerHTML, '还没有收录');
  sandbox.TermView.renderIndex(view());
  const tlist = view().innerHTML;
  has('术语库：标题', tlist, '每个四段讲完');
  ok('术语库：列出全部术语', (tlist.match(/href="#\/term\//g) || []).length === Object.keys(sandbox.Content.glossary()).length,
    '实际 ' + (tlist.match(/href="#\/term\//g) || []).length);
  ok('术语库：每个术语都有可深链的 id', Object.keys(sandbox.Content.glossary()).every((k) => sandbox.TermView.linkOf(k) === '#/term/' + k));

  // 术语卡里的数字必须能在站内序列里对账（口径 = 站点显示的小数位）
  // 手写的数字会悄悄过期，读者对着站内数据一算就是错的——所以每条都验一遍
  {
    const seriesOf = {
      'sse-index': 'SH000001', 'szse-component': 'SZ399001', 'chinext': 'SZ399006',
      'kechuang-50': 'SH000688', 'sp500': 'SPX', 'dow-jones': 'DJIA', 'hsi': 'HSI',
      'nikkei': 'N225', 'vix': 'VIX', 'silver': 'SI00Y', 'dollar-index': 'UDI',
    };
    for (const [id, sid] of Object.entries(seriesOf)) {
      const t = sandbox.Content.term(id);
      const s = JSON.parse(await readFile(path.join(ROOT, 'data/history', sid + '.json'), 'utf8'));
      const set = new Set(s.points.map((p) => p.v.toFixed(s.digits)));
      const nums = (String(t.number || '').match(/\d[\d,]*\.\d+/g) || []).map((x) => x.replace(/,/g, ''));
      const hit = nums.filter((n) => set.has(n));
      ok('术语 ' + id + ' 的数字能在站内序列对账', hit.length >= 2,
        '只命中 ' + hit.length + ' 个：' + JSON.stringify(nums));
    }
  }

  /* ---- 6. 术语抽屉 ---- */
  sandbox.TermDrawer.init();
  sandbox.TermDrawer.open('discount-rate');
  const drawer = getElementById('drawer-body').innerHTML;
  has('抽屉：一句话', drawer, '一句话');
  has('抽屉：比喻', drawer, '比喻');
  has('抽屉：数字', drawer, '数字');
  has('抽屉：坑', drawer, '坑');
  hasEl('抽屉：术语名', getElementById('drawer-title'), '折现率');
  sandbox.TermDrawer.open('不存在的术语');
  has('抽屉：未收录兜底', getElementById('drawer-body').innerHTML, '还没有收录');

  /* ---- 7. 术语标记注入 ---- */
  const marked = sandbox.TermCard.markTerms('看[[discount-rate|折现率]]和[[没有这个词]]。', sandbox.Content.glossary());
  has('术语标记：已知词变锚点', marked, 'data-term="discount-rate"');
  ok('术语标记：未知词不生成假入口', !marked.includes('data-term="没有这个词"'));

  /* ---- 8. index.html 里的每个资源都真实存在 ---- */
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');

  // 首屏骨架：静态 HTML 里就撑住版面，路由渲染后被替换
  ok('首屏骨架写在静态 HTML 里', html.includes('首屏骨架'));
  ok('首屏骨架含主标题', html.includes('讲成你听得懂的话'));
  ok('首屏骨架含占位卡', html.includes('class="skel"'));
  ok('渲染后首屏骨架被替换', !view().innerHTML.includes('class="skel"'));

  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^https?:/.test(u) && !u.startsWith('data:'));
  for (const r of refs) {
    ok('index.html 引用存在 ' + r, existsSync(path.join(ROOT, r)));
  }
  // 页面引用的脚本都应被本测试加载过
  for (const s of SCRIPTS) {
    ok('index.html 加载了 ' + s, html.includes(s));
  }

  console.log('');
  console.log(`渲染测试：通过 ${pass} 条，失败 ${fail} 条`);
  if (failures.length) {
    console.log('');
    failures.forEach((f) => console.log('  ✗ ' + f));
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('渲染测试崩溃：', e); process.exit(1); });
