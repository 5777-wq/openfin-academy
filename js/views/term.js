/* views/term.js —— 术语页（可被外站深链：#/term/<id>）与术语库索引（#/terms）
   正文里的术语卡走抽屉；这一页是同一个组件的"可分享"形态——
   别人从行情终端点过来时，落地就是一个能讲清楚这个词的页面。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /** 术语 → 一条能直接发出去的链接 */
  function linkOf(id) {
    return '#/term/' + encodeURIComponent(id);
  }

  /** 术语详情页 */
  function render(view, id) {
    const t = window.Content.term(id);
    if (!t) {
      view.innerHTML = `<div class="empty"><div class="et">这个词还没有收录</div>
        <div class="ed">术语库正在补充中。如果你就是知道答案的人，欢迎提一个 Issue 把它写进来。</div>
        <a class="btn ghost sm" href="https://github.com/5777-wq/openfin-academy/issues/new" target="_blank" rel="noopener">去补充这个词 →</a>
        <br><a class="btn ghost sm" href="#/terms">看术语库 →</a></div>`;
      return;
    }

    const g = window.Content.glossary();
    const related = (t.links || []).map((l) => `
      <a class="entry" href="${esc(l.href)}">
        <span><span class="e-t">${esc(l.text)}</span></span>
        <span class="e-m">读一篇 →</span>
      </a>`).join('');

    // 站内其它术语：给第一次来的人一个继续往下的入口
    const others = Object.keys(g).filter((k) => k !== id).slice(0, 10).map((k) => `
      <a class="entry" href="${esc(linkOf(k))}">
        <span><span class="e-t">${esc(g[k].term || k)}</span>
          <span class="e-d">${esc(g[k].one || '')}</span></span>
        <span class="e-m">看解释 →</span>
      </a>`).join('');

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">术语卡 · 这条链接可以直接分享出去</div>
        <h1>${esc(t.term || id)}</h1>
        <p class="art-dek">每个词固定四段：一句话讲清它是什么、一个好懂的比喻、一个真实数字、一个容易踩的坑。</p>
      </article>

      <div style="margin-bottom:var(--s-6)">
        ${window.TermCard.render(t, { noName: true })}
      </div>

      <div class="disclaimer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        <span>${t.source ? '出处：' + esc(t.source) : '本站编写的通俗解释'}。术语是理解框架，不是操作建议。</span>
      </div>

      ${related ? `
        <div class="eyebrow" style="margin:var(--s-6) 0 var(--s-3)">延伸阅读</div>
        <div class="entries">${related}</div>` : ''}

      <div class="eyebrow" style="margin:var(--s-6) 0 var(--s-3)">术语库里还有</div>
      <div class="entries">${others}</div>

      <p style="margin-top:var(--s-6)">
        <a class="btn ghost sm" href="#/terms">看全部 ${Object.keys(g).length} 个术语 →</a>
      </p>`;
  }

  /** 术语库索引 */
  function renderIndex(view) {
    const g = window.Content.glossary();
    const keys = Object.keys(g);
    const items = keys.map((k) => `
      <a class="entry" href="${esc(linkOf(k))}">
        <span>
          <span class="e-t">${esc(g[k].term || k)}</span>
          <span class="e-d">${esc(g[k].one || '')}</span>
        </span>
        <span class="e-m">${g[k].alias ? esc(g[k].alias) : '看解释 →'}</span>
      </a>`).join('');

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">术语库</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">${keys.length} 个词，每个四段讲完</h1>
        <p class="art-dek">一句话 / 一个比喻 / 一个真实数字 / 一个坑。这张表同时是站内所有正文里那些金色虚线词的来源。</p>
      </div>
      <div class="entries">${items || '<div class="empty"><div class="et">术语库还是空的</div><div class="ed">正在补充中。</div></div>'}</div>`;
  }

  window.TermView = { render, renderIndex, linkOf };
})();
