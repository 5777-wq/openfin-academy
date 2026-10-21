/* views/search.js —— 站内搜索结果页 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /** 搜索：术语 + 文章 + 标的 */
  function search(q) {
    const key = String(q || '').trim().toLowerCase();
    if (!key) return { terms: [], articles: [], assets: [] };

    const terms = Object.entries(window.Content.glossary())
      .filter(([id, t]) => id.toLowerCase().includes(key)
        || (t.term || '').toLowerCase().includes(key)
        || (t.alias || '').toLowerCase().includes(key)
        || (t.one || '').toLowerCase().includes(key))
      .map(([id, t]) => ({ id, term: t.term, one: t.one, kind: '术语' }));

    const articles = window.Content.list()
      .filter((a) => (a.title || '').toLowerCase().includes(key)
        || (a.dek || '').toLowerCase().includes(key)
        || (a.tags || []).some((t) => String(t).toLowerCase().includes(key)))
      .map((a) => ({ id: a.id, section: a.section, title: a.title, dek: a.dek, kind: '文章' }));

    const assets = (window.Quotes.INSTRUMENTS || [])
      .filter((i) => i.name.toLowerCase().includes(key) || i.key.toLowerCase().includes(key))
      .map((i) => ({ key: i.key, name: i.name, kind: '标的' }));

    return { terms, articles, assets };
  }

  function render(view, q) {
    const r = search(q);
    const total = r.terms.length + r.articles.length + r.assets.length;
    const q1 = esc(q || '');

    const group = (title, items, renderItem) => items.length
      ? `<div style="margin-bottom:var(--s-5)"><div class="eyebrow">${esc(title)} · ${items.length}</div>
         <div class="entries">${items.map(renderItem).join('')}</div></div>`
      : '';

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">站内搜索</div>
        <h1 style="font-size:var(--t-h1);margin-bottom:var(--s-2)">${q1 ? '「' + q1 + '」的搜索结果' : '搜索'}</h1>
        <p class="art-dek">${total ? `找到 ${total} 条结果。` : '没有匹配结果。'} 术语会告诉你"这是什么"，文章会告诉你"为什么"。</p>
      </div>
      ${group('术语', r.terms, (t) => `<a class="entry" href="#" data-term-go="${esc(t.id)}">
          <span><span class="e-t">${esc(t.term)}</span><span class="e-d">${esc(t.one || '')}</span></span>
          <span class="e-m">${esc(t.kind)}</span></a>`)}
      ${group('文章', r.articles, (a) => `<a class="entry" href="#/${esc(a.section)}/${esc(a.id)}">
          <span><span class="e-t">${esc(a.title)}</span><span class="e-d">${esc(a.dek || '')}</span></span>
          <span class="e-m">${esc(a.kind)}</span></a>`)}
      ${group('标的', r.assets, (a) => `<div class="entry">
          <span><span class="e-t">${esc(a.name)}</span><span class="e-d">实时行情见顶部报价条</span></span>
          <span class="e-m">${esc(a.kind)}</span></div>`)}
      ${!total ? `<div class="empty"><div class="et">没有找到</div>
        <div class="ed">换个词试试，或者去<a href="#/path">新手路径</a>从头看起。</div></div>` : ''}`;

    view.querySelectorAll('[data-term-go]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.TermDrawer.open(el.getAttribute('data-term-go'));
      });
    });
  }

  window.SearchView = { render, search };
})();
