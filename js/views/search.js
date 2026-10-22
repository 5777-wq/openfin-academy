/* views/search.js —— 站内搜索结果页 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /**
   * 搜索：术语 + 文章 + 标的
   *
   * 为什么不是「整个关键词出现在某一个字段里」：
   *  · 读者会连着打——「pe市盈率」「roe净资产收益率」「etf费率」，
   *    整串匹配一个都搜不到。改成**按词元 AND 匹配**：每个词元都得在，
   *    就能命中了。
   *  · 整串匹配还会误伤：「pe ratio」会命中「sha**rpe ratio**」，
   *    因为 pe 是 sharpe 的子串。ASCII 词元改成**按词边界**匹配就不会。
   */
  function tokenize(q) {
    const s = String(q || '').trim();
    if (!s) return [];
    // ① 在「中文 ↔ 英文数字」的边界处切开（零宽切分，'pe市盈率' → ['pe','市盈率']）
    // ② 再按空白与常见分隔符切
    const parts = s.split(/(?<=[a-z0-9])(?=[\u4e00-\u9fa5])|(?<=[\u4e00-\u9fa5])(?=[a-z0-9])/i)
      .flatMap((x) => x.split(/[\s,，、/／·|]+/))
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    return parts;
  }

  /** 一个词元是否出现在文本里
      ASCII 词元按**词边界**匹配（'pe' 不该命中 'sharpe'），
      中文词元按子串匹配（中文没有词边界概念）。 */
  function tokenHit(tok, text) {
    if (!tok) return true;
    if (/^[a-z0-9.+-]+$/.test(tok)) {
      const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^a-z0-9])' + esc + '([^a-z0-9]|$)');
      if (re.test(text)) return true;
      // 英文复数：'etfs' 找不到时退一步试 'etf'
      if (/s$/.test(tok) && tok.length > 2) {
        const stem = tok.slice(0, -1);
        return new RegExp('(^|[^a-z0-9])' + stem + '([^a-z0-9]|$)').test(text);
      }
      return false;
    }
    return text.indexOf(tok) >= 0;
  }

  /** 一条记录是否命中全部词元 */
  function matchAll(tokens, text) {
    if (!tokens.length) return false;
    return tokens.every((tok) => tokenHit(tok, text));
  }

  /** 词条的可搜文本：id + 词名 + 别名 + 一句话 + 关键词（kw：俗名、英文、口语、常见错字） */
  function termText(id, t) {
    return [id, t.term || '', t.alias || '', t.one || '', (t.kw || []).join(' ')].join(' ').toLowerCase();
  }

  function search(q) {
    const tokens = tokenize(q);
    if (!tokens.length) return { terms: [], articles: [], assets: [] };

    const terms = Object.entries(window.Content.glossary())
      .filter(([id, t]) => matchAll(tokens, termText(id, t)))
      .map(([id, t]) => ({ id, term: t.term, one: t.one, kind: '术语' }));

    const articles = window.Content.list()
      .filter((a) => {
        const text = [a.title || '', a.dek || '', (a.tags || []).join(' ')].join(' ').toLowerCase();
        return matchAll(tokens, text);
      })
      .map((a) => ({ id: a.id, section: a.section, title: a.title, dek: a.dek, kind: '文章' }));

    const assets = (window.Quotes.INSTRUMENTS || [])
      .filter((i) => matchAll(tokens, (i.name + ' ' + i.key).toLowerCase()))
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
