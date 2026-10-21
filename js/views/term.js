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

  const LENS_BASE = 'https://5777-wq.github.io/openfinlens/';

  /* 九个分类：按"读者真会遇到的顺序"排，不是教科书目录 */
  const CATS = [
    { id: 'data', label: '研报数据', desc: '研报和行情软件里天天出现、却没人解释的数' },
    { id: 'fund', label: '基金与策略', desc: '基金产品与投资策略的门类' },
    { id: 'asset', label: '资产类别', desc: '钱能投在哪：股票、债券、商品、加密' },
    { id: 'macro', label: '宏观经济', desc: '整个经济的账' },
    { id: 'basic', label: '基础概念', desc: '绕不开的概念' },
    { id: 'micro', label: '微观与行为', desc: '公司层面，与人的偏误' },
    { id: 'player', label: '机构与人物', desc: '谁在市场上' },
    { id: 'risk', label: '风险与交易', desc: '怎么算风险、怎么下注' },
    { id: 'tech', label: '技术指标', desc: '图表上那几条线' },
  ];
  const CAT_OF = CATS.reduce((m, c) => (m[c.id] = c, m), {});

  /* 每个分类的「入门三词」：第一次读这个分类，先读这三个就够用 */
  const STARTERS = {
    data: ['pe-ratio', 'roe', 'max-drawdown'],
    fund: ['etf', 'index-fund', 'hedge-fund'],
    asset: ['stock', 'gold', 'btc'],
    macro: ['cpi', 'lpr', 'yield-curve'],
    basic: ['risk-premium', 'discount-rate', 'moat'],
    micro: ['supply-demand', 'mean-reversion', 'herding'],
    player: ['berkshire-hathaway', 'bridgewater', 'jane-street'],
    risk: ['leverage', 'liquidity', 'value-at-risk'],
    tech: ['moving-average', 'macd', 'rsi'],
  };

  /* 速查表的三列标题随分类变：机构那栏叫「机构」，指标那栏叫「指标」 */
  const SHEET_COLS = {
    data: ['指标', '是什么', '什么时候会骗人'],
    fund: ['产品或策略', '是什么', '最容易误解的地方'],
    asset: ['资产', '是什么', '常见的坑'],
    macro: ['指标', '是什么', '读数时的坑'],
    basic: ['概念', '一句话', '最容易搞错的地方'],
    micro: ['概念', '一句话', '常见的坑'],
    player: ['机构', '是什么', '常见的误解'],
    risk: ['概念', '是什么', '最容易低估的地方'],
    tech: ['指标', '是什么', '最容易误读的地方'],
  };

  /** 术语库索引：按分类分组 */
  function renderIndex(view) {
    const g = window.Content.glossary();
    const ids = Object.keys(g);
    const byCat = {};
    ids.forEach((id) => {
      const c = (g[id].cat || 'basic');
      (byCat[c] = byCat[c] || []).push(id);
    });

    const blocks = CATS.filter((c) => byCat[c.id] && byCat[c.id].length).map((c) => {
      const rows = byCat[c.id].map((id) => {
        const t = g[id];
        return `<a class="entry" href="${esc(linkOf(id))}">
          <span>
            <span class="e-t">${esc(t.term || id)}</span>
            <span class="e-d">${esc(t.one || '')}</span>
          </span>
          <span class="e-m">看解释 →</span>
        </a>`;
      }).join('');

      // 入门三词：第一次读这一类，先读这三个
      const starters = (STARTERS[c.id] || [])
        .filter((id) => g[id])
        .map((id) => `<a class="starter" href="${esc(linkOf(id))}">
            <span class="st-t">${esc(g[id].term || id)}</span>
            <span class="st-d">${esc(g[id].one || '')}</span>
          </a>`).join('');

      return `<div class="cat-block">
        <div class="eyebrow" style="margin:var(--s-6) 0 var(--s-2)">${esc(c.label)} · ${byCat[c.id].length}</div>
        <div class="cat-desc">${esc(c.desc)}</div>
        ${starters ? `<div class="starters">
          <div class="st-label">入门三词</div>
          <div class="st-list">${starters}</div>
        </div>` : ''}
        <div class="entries">${rows}</div>
        <a class="btn ghost sm" style="margin-top:var(--s-3)" href="#/data?cat=${esc(c.id)}">这一类的速查表 →</a>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">术语库</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">${ids.length} 个词，按你遇到的地方找</h1>
        <p class="art-dek">每个词四段：一句话讲清是什么、一个好懂的比喻、一个真实数字、一个容易踩的坑。
          不知道从哪看起，先去 <a href="#/data">速查表</a>（九类各一张，行行是「是什么 · 什么时候会骗人」）。</p>
      </div>
      ${blocks}`;
  }

  /** 速查表：按分类切换（#/data?cat=macro），每个分类先给「入门三词」 */
  function renderDataSheet(view, query) {
    const g = window.Content.glossary();
    const q = query || {};
    const want = String(q.cat || 'data');
    const cur = CAT_OF[want] ? want : 'data';

    const counts = {};
    Object.keys(g).forEach((id) => {
      const c = g[id].cat || 'basic';
      counts[c] = (counts[c] || 0) + 1;
    });

    const tabs = CATS.filter((c) => counts[c.id]).map((c) => `
      <a class="ds-tab${c.id === cur ? ' active' : ''}" href="#/data?cat=${esc(c.id)}">
        ${esc(c.label)}<span class="ds-tab-n">${counts[c.id]}</span>
      </a>`).join('');

    const ids = Object.keys(g).filter((id) => (g[id].cat || 'basic') === cur);
    const cols = SHEET_COLS[cur] || SHEET_COLS.data;
    const rows = ids.map((id) => {
      const t = g[id];
      return `<tr>
        <td class="ds-n"><a href="${esc(linkOf(id))}">${esc(t.term || id)}</a><span class="ds-a">${esc(t.alias || '')}</span></td>
        <td class="ds-o">${esc(t.one || '')}</td>
        <td class="ds-p">${esc(t.pit || '')}</td>
      </tr>`;
    }).join('');

    const starters = (STARTERS[cur] || []).filter((id) => g[id]).map((id) => `
      <a class="starter" href="${esc(linkOf(id))}">
        <span class="st-t">${esc(g[id].term || id)}</span>
        <span class="st-d">${esc(g[id].one || '')}</span>
      </a>`).join('');

    const cat = CAT_OF[cur];
    const dek = cur === 'data'
      ? '这一页专治「这个数是什么意思、该怎么看、什么时候会骗人」。点任何一个进词条，看四段完整解释和它的历史。'
      : `${esc(cat.desc)}。这一类一共 ${ids.length} 个词，先读入门三词，再按需点开。`;

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">速查表</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">${cur === 'data' ? '看研报时撞见的那些数' : esc(cat.label) + '速查'}</h1>
        <p class="art-dek">${dek}</p>
      </div>

      <nav class="ds-tabs" aria-label="分类切换">${tabs}</nav>

      ${starters ? `<div class="starters">
        <div class="st-label">入门三词</div>
        <div class="st-list">${starters}</div>
      </div>` : ''}

      <table class="ds">
        <thead><tr><th>${esc(cols[0])}</th><th>${esc(cols[1])}</th><th>${esc(cols[2])}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:var(--s-6)"><a class="btn ghost sm" href="#/terms">看全部 ${Object.keys(g).length} 个术语 →</a></p>`;
  }

  /** 术语详情页 */
  function render(view, id, query) {
    const q = query || {};
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

    // 站内其它术语：同类的先推（读者多半在同一条线上继续读）
    const cat = t.cat || 'basic';
    const others = Object.keys(g).filter((k) => k !== id)
      .sort((a, b) => (g[b].cat === cat ? 1 : 0) - (g[a].cat === cat ? 1 : 0))
      .slice(0, 10).map((k) => `
      <a class="entry" href="${esc(linkOf(k))}">
        <span><span class="e-t">${esc(g[k].term || k)}</span>
          <span class="e-d">${esc(g[k].one || '')}</span></span>
        <span class="e-m">看解释 →</span>
      </a>`).join('');

    // —— 与行情终端的双向跳转：看数据 / 回终端 / 留在本站继续读 ——
    // 从终端点进来的（?from=lens&sym=xxx）：把"这只票"和"这个词"都带回去
    const fromLens = q.from === 'lens';
    const sym = q.sym || t.sym || '';
    const cross = window.Cross.bar({
      sym: sym,
      lens: t.lens || '',
      fromLens: fromLens,
      moreHref: '#/terms',
      moreLabel: '继续读别的 →',
    });

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">${esc((CAT_OF[cat] || {}).label || '术语卡')} · 这条链接可以直接分享出去</div>
        <h1>${esc(t.term || id)}</h1>
        <p class="art-dek">每个词固定四段：一句话讲清它是什么、一个好懂的比喻、一个真实数字、一个容易踩的坑。</p>
      </article>

      <div style="margin-bottom:var(--s-6)">
        ${window.TermCard.render(t, { noName: true })}
      </div>

      ${cross}

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

  window.TermView = { render, renderIndex, renderDataSheet, linkOf, CATS, CAT_OF };
})();
