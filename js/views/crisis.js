/* views/crisis.js —— 危机复盘：列表（从回放包自动生成）+ 详情（文章 + 回放器） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  /** 已知的危机包 id（与 _scripts/collect-history.mjs 的 CRISIS_DEFS 对应） */
  const PKG_IDS = ['1987', '1990', '1994', '1998', '2008'];

  /** 轻量索引：列表页只读这个，不加载几百 KB 的完整包 */
  async function loadIndex() {
    const idx = await window.History.loadJSON('data/history/crisis-index.json');
    return (idx && idx.items) || [];
  }

  async function renderList(view) {
    const items = await loadIndex();
    const arts = window.Content.bySection('crisis');
    const artIds = arts.map((a) => a.id);

    const cards = items.map((s) => {
      const art = arts.find((a) => a.id === s.id);
      const h = s.headline;
      // 收益率用「区间变动（百分点）」，价格用「峰谷跌幅（%）」——两者不能混着写
      const tag = !h ? ''
        : h.kind === 'yield'
          ? `<span class="tag up">${esc(h.name)} 区间 ${h.changePp.toFixed(2)} 个百分点</span>`
          : `<span class="tag down">${esc(h.name)} ${h.dropPct.toFixed(1)}%</span>`;
      const worst = h && h.worstDay ? h.worstDay : null;
      return `<a class="entry" href="#/crisis/${esc(s.id)}">
        <span>
          <span class="e-t">${esc(s.title)}</span>
          <span class="e-d">${esc(s.from)} → ${esc(s.to)} · ${s.days} 个交易日 · ${s.seriesCount} 条序列
            ${worst ? `· 最惨一天 ${esc(worst.t)} ${worst.pct.toFixed(2)}%` : ''}</span>
          <span class="e-tags">
            ${tag}
            <span class="tag">${esc(s.freq === 'D' ? '日频' : '月频')}</span>
            <span class="tag">${s.events} 个事件</span>
          </span>
        </span>
        <span class="e-m">${art ? art.readMinutes + ' min' : '看复盘 →'}</span>
      </a>`;
    }).join('');

    // 有文章但还没有回放包的
    const extra = arts.filter((a) => !PKG_IDS.includes(a.id)).map((a) => `
      <a class="entry" href="#/crisis/${esc(a.id)}">
        <span><span class="e-t">${esc(a.title)}</span><span class="e-d">${esc(a.dek || '')}</span></span>
        <span class="e-m">${a.readMinutes || ''} min</span>
      </a>`).join('');

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">栏目 02 · 危机复盘</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">每一场危机，都值得拖一遍时间轴</h1>
        <p class="art-dek">下面每场危机都配了一个回放器：多条资产在同一条时间轴上同步走，<b>日频</b>，你可以拖到崩盘那一天，看那一刻各资产到底怎么了。页面上每个跌幅都是从数据里算出来的，不是手写的。</p>
      </div>
      <div class="entries">${cards}${extra}</div>`;
  }

  async function renderDetail(view, id) {
    const pkg = await window.History.crisis(id);
    const art = window.Content.article(id);

    if (!art) {
      view.innerHTML = `<div class="empty"><div class="et">这场复盘还没写</div>
        <div class="ed">回放数据${pkg ? '已经有了' : '也需要先跑一次采集'}。</div>
        <a class="btn ghost sm" href="#/crisis">回复盘列表</a></div>`;
      if (pkg) mountReplay(view, pkg);
      return;
    }

    const glossary = window.Content.glossary();
    let html = F().md(art.body || '');
    html = window.TermCard.markTerms(html, glossary);
    const m = art.meta || art;
    const s = pkg ? window.Engine.crisis.summarize(pkg) : null;

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">危机复盘${m.range ? ' · ' + esc(m.range) : ''}</div>
        <h1>${esc(m.title || '')}</h1>
        ${m.dek ? `<p class="art-dek">${esc(m.dek)}</p>` : ''}
        <div class="art-meta">
          ${m.readMinutes ? `<span>阅读约 ${m.readMinutes} 分钟</span><span class="msep">·</span>` : ''}
          <span>数据截至 ${esc(m.dataAsOf || '—')}</span>
          ${m.source ? `<span class="msep">·</span><span>来源 ${esc(m.source)}</span>` : ''}
          ${s ? `<span class="msep">·</span><span>${s.days} 个交易日 × ${s.seriesCount} 条序列</span>` : ''}
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

    if (pkg) mountReplay(view, pkg);
  }

  function mountReplay(view, pkg) {
    const box = document.getElementById('crisis-replay');
    if (!box) return;
    if (!pkg || !pkg.series || !pkg.series.length) {
      box.innerHTML = `<div class="panel"><div class="empty" style="padding:var(--s-5) 0">
        <div class="et">回放数据还没采集</div>
        <div class="ed">跑一次 <code>node _scripts/collect-history.mjs</code> 就能拿到真实长历史。</div></div></div>`;
      return;
    }
    window.ReplayPlayer.render(box, pkg);
  }

  window.CrisisView = { renderList, renderDetail, mountReplay, loadIndex, PKG_IDS };
})();
