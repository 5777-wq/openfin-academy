/* site/content.js —— 内容加载（MD 编译产物 data/content/*.json） */
(function () {
  'use strict';

  const BASE = 'data/content/';
  const idx = { list: null, byId: new Map(), articles: new Map(), glossary: null, path: null };

  async function loadJSON(path) {
    // 带超时：任何一个请求卡住都不允许让整页空白
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(path, { cache: 'no-cache', signal: ctl.signal });
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
    return idx;
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

  window.Content = { BASE, loadAll, list, meta, article, glossary, term, bySection, pathPlan, idx };
})();
