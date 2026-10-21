/* views/chain.js —— 产业链图谱：列表 + 详情（含实时环节强弱） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  function chains() {
    return (typeof window.INDUSTRY_CHAINS !== 'undefined' && window.INDUSTRY_CHAINS) || [];
  }

  function renderList(view) {
    const cs = chains();
    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">栏目 04 · 产业链图谱</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">从上游到下游，谁在赚钱</h1>
        <p class="art-dek">一条产业链就是一串"谁给谁供货"的关系。环节强弱用成分股当日涨跌幅等权平均算，口径写在页面上，不做加工。</p>
      </div>
      <div class="entries">
        ${cs.map((c) => `<a class="entry" href="#/chains/${esc(c.id)}">
          <span>
            <span class="e-t">${esc(c.name)}</span>
            <span class="e-d">${esc((c.links || []).map((l) => l.name).join(' → '))}</span>
            <span class="e-tags"><span class="tag">${(c.links || []).length} 个环节</span>
              <span class="tag">${(c.links || []).reduce((n, s) => n + (s.stocks || []).length, 0)} 只成分股</span></span>
          </span>
          <span class="e-m">看链路 →</span>
        </a>`).join('')}
      </div>`;
  }

  async function renderDetail(view, id) {
    const c = chains().find((x) => x.id === id);
    if (!c) {
      view.innerHTML = `<div class="empty"><div class="et">没有这条产业链</div>
        <a class="btn ghost sm" href="#/chains">回列表</a></div>`;
      return;
    }
    const links = c.links || [];

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">产业链图谱</div>
        <h1>${esc(c.name)}</h1>
        <p class="art-dek">${esc(links.map((l) => l.name).join(' → '))}</p>
      </div>
      <div id="chain-heat" style="margin-bottom:var(--s-6)">
        <div class="panel"><div class="skel" style="height:16px;width:40%"></div></div>
      </div>
      <div class="prose">
        ${links.map((s) => `
          <h3>${esc(s.name)}</h3>
          ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
          <p class="small muted" style="font-family:var(--font-mono)">成分：${(s.stocks || []).map((x) => esc(x.name)).join(' · ')}</p>
        `).join('')}
      </div>`;

    await window.ChainHeat.loadQuotes();
    window.ChainHeat.render(document.getElementById('chain-heat'), c);
  }

  window.ChainView = { renderList, renderDetail, chains };
})();
