/* site/content.js —— 内容加载（MD 编译产物 data/content/*.json） */
(function () {
  'use strict';

  const BASE = 'data/content/';
  const idx = { list: null, byId: new Map(), articles: new Map(), glossary: null, path: null, assetIds: null };

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

  /** 载入索引 + 全部文章正文 */
  async function loadAll() {
    if (idx.list) return idx;
    const index = await loadJSON(BASE + 'index.json');
    idx.list = index;
    (index.items || []).forEach((it) => idx.byId.set(it.id, it));

    const articles = await Promise.all((index.items || []).map(async (it) => {
      try {
        const full = await loadJSON(BASE + it.id + '.json');
        idx.articles.set(it.id, full);
        return full;
      } catch (e) {
        console.warn('[content] 缺正文', it.id);
        return null;
      }
    }));
    void articles;

    try { idx.glossary = await loadJSON(BASE + 'glossary.json'); } catch (e) { idx.glossary = { terms: {} }; }
    try { idx.path = await loadJSON(BASE + 'path.json'); } catch (e) { idx.path = null; }
    // 标的清单（94 个终端标的在本站有对应标的页）：search 要用它们的名字和代码做匹配，
    // 否则「工商银行」「600519」这类词永远搜不到。20KB，一次拉够。
    try { idx.assetIds = await loadJSON(BASE + 'asset-ids.json'); } catch (e) { idx.assetIds = null; }
    return idx;
  }

  /** 站内标的页清单：[{symbol, label}]（symbol 就是 #/assets/<symbol> 里的那一段） */
  function assetPages() {
    const d = (idx.assetIds && idx.assetIds.detail) || {};
    return Object.keys(d).map((symbol) => ({ symbol, label: d[symbol].label || symbol }));
  }

  function list() { return (idx.list && idx.list.items) || []; }
  function meta(id) { return idx.byId.get(id) || null; }
  function article(id) { return idx.articles.get(id) || null; }
  function glossary() { return (idx.glossary && idx.glossary.terms) || {}; }
  function term(id) { return glossary()[id] || null; }
  function pathPlan() { return idx.path; }

  /** 按栏目分组 */
  function bySection(section) {
    return list().filter((x) => x.section === section);
  }

  window.Content = { BASE, loadAll, list, meta, article, glossary, term, bySection, pathPlan, assetPages, idx };
})();
