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

  /* 十个分类：按"读者真会遇到的顺序"排，不是教科书目录 */
  const CATS = [
    { id: 'data', label: '研报数据', desc: '研报和行情软件里天天出现、却没人解释的数' },
    { id: 'fund', label: '基金与策略', desc: '基金产品与投资策略的门类' },
    { id: 'asset', label: '资产类别', desc: '钱能投在哪：股票、债券、商品、加密' },
    { id: 'option', label: '期权与期权策略', desc: '期权是什么、怎么定价、经典组合怎么搭' },
    { id: 'macro', label: '宏观经济', desc: '整个经济的账' },
    { id: 'basic', label: '基础概念', desc: '绕不开的概念：利率与定价、公司与商业模式、历史上的大泡沫' },
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
    option: ['option-call', 'option-put', 'implied-vol'],
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
    option: ['概念', '是什么', '最容易误解的地方'],
    macro: ['指标', '是什么', '读数时的坑'],
    basic: ['概念', '一句话', '最容易搞错的地方'],
    micro: ['概念', '一句话', '常见的坑'],
    player: ['机构', '是什么', '常见的误解'],
    risk: ['概念', '是什么', '最容易低估的地方'],
    tech: ['指标', '是什么', '最容易误读的地方'],
  };

  /**
   * 组内排序：按「读者真会遇到的顺序」排，不是字母序。
   * 以前是按 id 字母序排出来的——读者看到的是「ETF、ETF 费率、ETF 折溢价、事件驱动……」
   * 这种顺序，看着像字典，不像一份读物。改成按信号分层：
   *   0 站内有**专文**的（links 指向内容页）——读者最可能从它开始读
   *   1 行情终端会链到它的（读 vendor/core/academy-gloss.js 的映射表）——在行情里能撞见
   *   2 有 sym 的（能直接看行情）——有真实数据可以对账
   *   3 其余按 id 升序（保证结果确定，不随运行环境变）
   * 注意区分：links 里既有指向专文的，也有只是「这个词的相关词条」的，
   * 只有指向内容页的才算专文，否则信号会被交叉引用冲淡。
   */
  const ARTICLE_ROUTES = ['#/concepts/', '#/crisis/', '#/cycles/', '#/chains/', '#/family/', '#/assets/'];

  function hasArticle(g, id) {
    const t = g[id] || {};
    return (t.links || []).some((l) => ARTICLE_ROUTES.some((r) => String(l.href || '').indexOf(r) === 0));
  }

  function hotIds() {
    const out = new Set();
    const AG = window.AcademyGloss;
    if (AG) {
      Object.keys(AG.TERM_BY_SYMBOL || {}).forEach((k) => out.add(AG.TERM_BY_SYMBOL[k]));
      Object.keys(AG.CONCEPT_BY_SYMBOL || {}).forEach((k) => {
        const c = AG.CONCEPT_BY_SYMBOL[k];
        if (c && c.id) out.add(c.id);
      });
    }
    // 终端悬停时会解释的概念词（explain.js 的 CONCEPT_NOTES）——
    // 这些正是「读者在行情里会撞见、然后过来查」的词，同样算热门。
    const EX = window.Explain;
    if (EX && EX.CONCEPT_NOTES) {
      Object.keys(EX.CONCEPT_NOTES).forEach((k) => out.add(k));
    }
    return out;
  }

  /* 少数分类的组内顺序需要人工定：
     新开的 `option` 分类里没有任何一条有专文 / sym / 终端映射，
     排序信号全落空、只能退回字母序——而期权的内在顺序是「基础 → 定价 → 策略」，
     按字母排会把 Greeks 和跨式、铁鹰混在一起。
     这里给的顺序就是读者的学习顺序：有行情先看行情，再看怎么定价，最后看怎么搭。 */
  const ORDER_OVERRIDE = {
    option: [
      'option-call', 'option-put', 'strike-price', 'moneyness', 'option-style', 'option-expiration',
      'implied-vol', 'volatility-smile',
      'greek-delta', 'greek-gamma', 'greek-vega', 'greek-theta',
      'covered-call', 'protective-put', 'collar', 'long-straddle',
      'bull-call-spread', 'bear-put-spread', 'iron-condor', 'short-vol',
    ],
  };

  function orderTerms(ids, g, hot, cat) {
    const ov = cat && ORDER_OVERRIDE[cat];
    if (ov) {
      const rank = new Map(ov.map((id, i) => [id, i]));
      return ids.slice().sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a) : 999;
        const rb = rank.has(b) ? rank.get(b) : 999;
        if (ra !== rb) return ra - rb;
        return a < b ? -1 : a > b ? 1 : 0;
      });
    }
    const score = (id) => {
      const t = g[id] || {};
      if (hasArticle(g, id)) return 0;
      if (hot && hot.has(id)) return 1;
      if (t.sym) return 2;
      return 3;
    };
    return ids.slice().sort((a, b) => {
      const d = score(a) - score(b);
      if (d) return d;
      return a < b ? -1 : a > b ? 1 : 0;
    });
  }

  /** 入门三词卡：显示「比喻」而不是「一句话」——
      下方列表和表格里已经有一句话了，再抄一遍就是重复；比喻是新的信息。 */
  function starterCards(ids, g) {
    return ids.filter((id) => g[id]).map((id) => `<a class="starter" href="${esc(linkOf(id))}">
        <span class="st-t">${esc(g[id].term || id)}</span>
        <span class="st-d">${esc(g[id].metaphor || g[id].one || '')}</span>
      </a>`).join('');
  }

  /** 术语库索引：按分类分组 */
  function renderIndex(view) {
    const g = window.Content.glossary();
    const ids = Object.keys(g);
    const hot = hotIds();
    const byCat = {};
    ids.forEach((id) => {
      const c = (g[id].cat || 'basic');
      (byCat[c] = byCat[c] || []).push(id);
    });

    const blocks = CATS.filter((c) => byCat[c.id] && byCat[c.id].length).map((c) => {
      const rows = orderTerms(byCat[c.id], g, hot, c.id).map((id) => {
        const t = g[id];
        return `<a class="entry" href="${esc(linkOf(id))}">
          <span>
            <span class="e-t">${esc(t.term || id)}</span>
            <span class="e-d">${window.TermCard.inline(t.one || '')}</span>
          </span>
          <span class="e-m">看解释 →</span>
        </a>`;
      }).join('');

      // 入门三词：第一次读这一类，先读这三个
      const starters = starterCards(STARTERS[c.id] || [], g);

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
          不知道从哪看起，先去 <a href="#/data">速查表</a>（十类各一张，行行是「是什么 · 什么时候会骗人」）。</p>
      </div>
      ${blocks}`;
  }

  /** aria-label 里要的是纯文本：词条里的 **加粗** 得把星号去掉，
      否则读屏会照着念出「星号 加粗 星号」。 */
  function plain(s) {
    return String(s || '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
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

    const ids = orderTerms(Object.keys(g).filter((id) => (g[id].cat || 'basic') === cur), g, hotIds(), cur);
    const cols = SHEET_COLS[cur] || SHEET_COLS.data;
    // 窄屏表头是视觉隐藏的（不是 display:none），表格语义还在；
    // 但每格再自带一句「列名：内容」——读屏逐格念的时候不用回头找表头。
    const rows = ids.map((id) => {
      const t = g[id];
      const name = t.term || id;
      return `<tr>
        <td class="ds-n" data-label="${esc(cols[0])}" aria-label="${esc(cols[0])}：${esc(plain(name))}"><a href="${esc(linkOf(id))}">${esc(name)}</a><span class="ds-a">${esc(t.alias || '')}</span></td>
        <td class="ds-o" data-label="${esc(cols[1])}" aria-label="${esc(cols[1])}：${esc(plain(t.one || ''))}">${window.TermCard.inline(t.one || '')}</td>
        <td class="ds-p" data-label="${esc(cols[2])}" aria-label="${esc(cols[2])}：${esc(plain(t.pit || ''))}">${window.TermCard.inline(t.pit || '')}</td>
      </tr>`;
    }).join('');

    const starters = starterCards(STARTERS[cur] || [], g);

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

    // 站内其它术语：同类的先推（读者多半在同一条线上继续读），同类内部也按热度排
    const cat = t.cat || 'basic';
    const hot = hotIds();
    const ranked = orderTerms(Object.keys(g).filter((k) => k !== id), g, hot, cat);
    const sameCat = ranked.filter((k) => (g[k].cat || 'basic') === cat);
    const rest = ranked.filter((k) => (g[k].cat || 'basic') !== cat);
    const others = sameCat.concat(rest).slice(0, 10).map((k) => `
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
        ${(window.Site && window.Site.disclaimer) ? window.Site.disclaimer.ICON : ''}
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

  // hasArticle / hotIds 也导出去：搜索结果用的是同一套分层（有专文 > 终端会链到 > 有 sym），
  // 同一个词在术语库和搜索里不该排出两个顺序。
  window.TermView = { render, renderIndex, renderDataSheet, linkOf, CATS, CAT_OF, SHEET_COLS, hasArticle, hotIds, plain };
})();
