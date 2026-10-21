/* views/crisis.js —— 危机复盘：列表 + 详情（含回放器） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  function renderList(view) {
    const items = window.Content.bySection('crisis');
    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">栏目 02 · 危机复盘</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">每一场危机，都值得拖一遍时间轴</h1>
        <p class="art-dek">下面每场危机都配了一个回放器：多条资产在同一条时间轴上同步走，你可以拖到任意一天，看那一刻市场到底发生了什么。</p>
      </div>
      <div class="entries">
        ${items.map((c) => `<a class="entry" href="#/crisis/${c.id}">
          <span>
            <span class="e-t">${esc(c.title)}</span>
            <span class="e-d">${esc(c.dek || '')}</span>
            ${c.tags ? `<span class="e-tags">${c.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}
          </span>
          <span class="e-m">${c.readMinutes ? c.readMinutes + ' min' : ''}</span>
        </a>`).join('')}
      </div>`;
  }

  async function renderDetail(view, id) {
    const art = window.Content.article(id);
    const pack = await window.History.crisis(id);

    if (!art) {
      view.innerHTML = `<div class="empty"><div class="et">这场复盘还没写</div>
        <div class="ed">回放数据${pack ? '已经有了' : '也需要先跑一次采集'}。</div>
        <a class="btn ghost sm" href="#/crisis">回复盘列表</a></div>`;
      if (pack) mountReplay(view, pack);
      return;
    }

    const glossary = window.Content.glossary();
    let html = F().md(art.body || '');
    html = window.TermCard.markTerms(html, glossary);
    const m = art.meta || art;

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">危机复盘${m.range ? ' · ' + esc(m.range) : ''}</div>
        <h1>${esc(m.title || '')}</h1>
        ${m.dek ? `<p class="art-dek">${esc(m.dek)}</p>` : ''}
        <div class="art-meta">
          ${m.readMinutes ? `<span>阅读约 ${m.readMinutes} 分钟</span><span class="msep">·</span>` : ''}
          <span>数据截至 ${esc(m.dataAsOf || '—')}</span>
          ${m.source ? `<span class="msep">·</span><span>来源 ${esc(m.source)}</span>` : ''}
        </div>
      </article>

      <div class="disclaimer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        <span>历史复盘不预测未来。市场结构、监管环境和参与者都和当年不同。</span>
      </div>

      <div id="crisis-replay" style="margin-bottom:var(--s-6)"></div>

      ${(m.points && m.points.length) ? `
        <div class="panel" style="margin-bottom:var(--s-6);background:var(--sheet-2)">
          <div class="eyebrow" style="margin-bottom:10px">这一场的三句话</div>
          <ol style="margin:0;padding-left:1.2em">
            ${m.points.map((p) => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}
          </ol>
        </div>` : ''}

      <div class="prose">${html}</div>`;

    if (pack) mountReplay(view, pack);
  }

  function mountReplay(view, pack) {
    const box = document.getElementById('crisis-replay');
    if (!box) return;
    if (!pack || !pack.series || !pack.series.length) {
      box.innerHTML = `<div class="panel"><div class="empty" style="padding:var(--s-5) 0">
        <div class="et">回放数据还没采集</div>
        <div class="ed">跑一次 <code>node _scripts/collect-history.mjs</code> 就能拿到真实长历史。</div></div></div>`;
      return;
    }
    window.ReplayPlayer.render(box, pack);
  }

  window.CrisisView = { renderList, renderDetail };
})();
