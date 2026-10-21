/* components/term-card.js —— 四段式术语卡（签名组件）
   一句话 / 一个比喻 / 一个真实数字 / 一个坑 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /** 术语卡 HTML */
  function render(term) {
    if (!term) return '';
    const parts = [];
    if (term.one) parts.push(part('一句话', term.one));
    if (term.metaphor) parts.push(part('比喻', term.metaphor));
    if (term.number) parts.push(part('数字', term.number));
    if (term.pit) parts.push(part('坑', term.pit, true));
    if (term.detail) parts.push(part('展开', term.detail));
    if (!parts.length) return '';

    return `<div class="term">
      <div class="term-head">
        <span class="tt">${esc(term.term || '')}</span>
        ${term.alias ? `<span class="tag">${esc(term.alias)}</span>` : ''}
        ${term.id ? `<span class="tid">${esc(term.id)}</span>` : ''}
      </div>
      <div class="term-parts">${parts.join('')}</div>
    </div>`;
  }

  function part(k, v, pit) {
    return `<div class="term-part${pit ? ' pit' : ''}">
      <span class="tp-k">${esc(k)}</span>
      <span class="tp-v">${esc(v)}</span>
    </div>`;
  }

  /** 把正文里的「术语引用」标记成可点元素
     语法：[[术语id|显示文本]]
     术语不在库里时不生成可点锚点——不做假入口。 */
  function markTerms(html, glossary) {
    return String(html || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, id, text) => {
      const t = glossary && glossary[id];
      if (!t) return esc(text || id);
      const label = text || t.term || id;
      const tip = t.one ? ` title="${esc(t.one)}"` : '';
      return `<span class="t-ref" data-term="${esc(id)}" role="button" tabindex="0"${tip}>${esc(label)}</span>`;
    });
  }

  window.TermCard = { render, markTerms, part };
})();
