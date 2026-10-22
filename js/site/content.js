/* site/content.js —— 内容加载（MD 编译产物 data/content/*.json）
   首屏只拉四份文件：index.json（目录）、glossary.json（术语库）、path.json（新手路径）、asset-ids.json（标的清单）。
   22 篇文章正文各自按需拉：打开哪篇才拉哪篇，拉过就缓存。 */
(function () {
  'use strict';

  const BASE = 'data/content/';
  const idx = { list: null, byId: new Map(), articles: new Map(), glossary: null, path: null, assetIds: null };
  const inflight = new Map();   // id → 正在进行的请求：同一篇别重复拉
  const warned = new Set();     // 已经提醒过的 id：正文没到时别刷屏

  async function loadJSON(path) {
    // 带超时：任何一个请求卡住都不允许让整页空白
    // 用默认缓存（走 HTTP 缓存 + ETag 协商），不要 no-cache：
    // no-cache 会强制每次都回源校验，9 个内容文件就是 9 个额外往返，首屏明显变慢
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(path, { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  /** 载入索引 + 三份附属文件（**不含**正文） */
  async function loadAll() {
    if (idx.list) return idx;
    const index = await loadJSON(BASE + 'index.json');
    idx.list = index;
    (index.items || []).forEach((it) => idx.byId.set(it.id, it));

    // 三份附属文件互相不依赖，一起拉完，谁先到先谁。
    // 标的清单（94 个终端标的在本站有对应标的页）：search 要用它们的名字和代码做匹配，
    // 否则「工商银行」「600519」这类词永远搜不到。20KB，一次拉够。
    const [glossary, path, assetIds] = await Promise.all([
      loadJSON(BASE + 'glossary.json').catch(() => ({ terms: {} })),
      loadJSON(BASE + 'path.json').catch(() => null),
      loadJSON(BASE + 'asset-ids.json').catch(() => null),
    ]);
    idx.glossary = glossary;
    idx.path = path;
    idx.assetIds = assetIds;
    return idx;
  }

  /**
   * 按需取正文：返回 Promise，拿到的是这一篇的完整内容。
   * 同一篇并发调用只会发一次请求；取过一次就进缓存，之后同步读得到。
   * 取不到（文件不存在 / 网络失败）返回 null，**不抛**——调用方自己决定怎么兜底。
   */
  function ensureArticle(id) {
    const key = String(id || '');
    if (!key) return Promise.resolve(null);
    if (idx.articles.has(key)) return Promise.resolve(idx.articles.get(key));
    if (inflight.has(key)) return inflight.get(key);
    const p = loadJSON(BASE + key + '.json')
      .then((full) => {
        idx.articles.set(key, full);
        inflight.delete(key);
        return full;
      })
      .catch((e) => {
        console.warn('[content] 缺正文', key);
        inflight.delete(key);
        return null;
      });
    inflight.set(key, p);
    return p;
  }

  /** 站内标的页清单：[{symbol, label}]（symbol 就是 #/assets/<symbol> 里的那一段） */
  function assetPages() {
    const d = (idx.assetIds && idx.assetIds.detail) || {};
    return Object.keys(d).map((symbol) => ({ symbol, label: d[symbol].label || symbol }));
  }

  function list() { return (idx.list && idx.list.items) || []; }
  function meta(id) { return idx.byId.get(id) || null; }

  /**
   * 同步读正文。
   * 正文还没拉到时退回索引里的那一条（标题、简介都在），
   * 这样「这一篇到底存不存在」仍然答得上来，但**只有标题，没有 body**。
   * 要 body 就先 await ensureArticle(id)。
   */
  function article(id) {
    const full = idx.articles.get(id);
    if (full) return full;
    const m = idx.byId.get(id);
    if (m && !warned.has(id)) {
      warned.add(id);
      console.warn('[content] 正文还没到，article() 只能给索引信息：', id);
    }
    return m || null;
  }

  function glossary() { return (idx.glossary && idx.glossary.terms) || {}; }
  function term(id) { return glossary()[id] || null; }
  function pathPlan() { return idx.path; }

  /** 按栏目分组 */
  function bySection(section) {
    return list().filter((x) => x.section === section);
  }

  window.Content = { BASE, loadAll, ensureArticle, list, meta, article, glossary, term, bySection, pathPlan, assetPages, idx };
})();
