/* views/assets.js —— 标的百科：索引（与行情终端同一份标的清单）+ 详情（专文 + 真实数据卡）
   为什么这么做：终端能看的每个标的，科普站都要能查到它的历史。
   所以索引是数据驱动生成的（不手写清单），详情页的峰谷、区间涨跌也全部由序列算出。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const LENS = 'https://5777-wq.github.io/openfinlens/';

  /* 终端的 symbol → 站内序列 id（大部分同名，指数/商品另有一套） */
  const SERIES_OF = {
    sh000001: 'SH000001', sz399001: 'SZ399001', sz399006: 'SZ399006', sh000688: 'SH000688',
    usINX: 'SPX', usDJI: 'DJIA', hkHSI: 'HSI', hkHSTECH: 'HSTECH',
    'EM:100.N225': 'N225',            // 终端「全球指数条」那一排里的日经225
    'EM:101.GC00Y': 'GC00Y', 'EM:101.SI00Y': 'SI00Y', 'EM:102.CL00Y': 'CL00Y',
    'EM:100.UDI': 'UDI', 'EM:171.US10Y': 'US10Y', 'EM:171.US2Y': 'US2Y',
    'EM:171.US3M': 'US3M', 'EM:171.US30Y': 'US30Y',
    gold: 'GC00Y',            // 老链接 #/assets/gold 也要能拿到数据卡
  };

  /* 站内 id → 终端的 symbol。
     两者**不是一回事**：#/assets/gold 是站内老链接，终端里没有 gold 这个 symbol
     （只有 EM:101.GC00Y）。用站内 id 去链终端，终端会打开一个名为「ld」、
     没有数据的空详情页。 */
  const LENS_OF = {
    gold: 'EM:101.GC00Y',
  };

  /* 站内自有序列：终端里没有对应标的，不给「去看历史数据」的链接
     （链过去终端会打开一个空详情页）。 */
  const NO_LENS = new Set(['VIX', 'IXIC']);

  /* 站内自有序列：终端不展示、但本站有月线数据的序列。
     它们以前只能被词条引用（「站内 VIX 月度序列可核对」），读者却找不到地方核对——
     序列收在仓库里，站内没有任何页面能打开它。 */
  const OWN_SERIES = [
    { id: 'VIX', label: 'VIX 恐慌指数', note: 'CBOE 官方月末收盘 · 标普500期权的隐含波动率' },
    { id: 'IXIC', label: '纳斯达克综合指数（1991 年起）', note: '综合指数的长历史 · 站内另有腾讯源的 usIXIC（2007 年起）' },
  ];

  /* 终端的 symbol → 站内专文 id（已写过专文的） */
  const ARTICLE_OF = {
    'EM:101.GC00Y': 'gold',
  };

  const GROUP_LABEL = {
    index: '指数', cn: 'A 股', hk: '港股', us: '美股',
    crypto: '加密', fx: '外汇', commodity: '商品', macro: '利率', other: '其它',
  };

  /** 终端 universe（vendor 同步过来的那份）——两边共用同一份标的清单 */
  function universe() {
    const t = (window.TENCENT_UNIVERSE || []).map((x) => Object.assign({ market: x.group }, x));
    const em = (window.EM_UNIVERSE || []).map((x) => Object.assign({ market: x.group }, x));
    return t.concat(em);
  }

  function seriesIdOf(sym) { return SERIES_OF[sym] || sym; }
  function articleIdOf(sym) { return ARTICLE_OF[sym] || sym; }

  /** 标的百科索引：清单 + 覆盖区间，全部来自数据，不手写 */
  async function renderIndex(view) {
    const reg = await window.History.registry();
    const map = new Map(((reg && reg.series) || []).map((s) => [s.id, s]));
    const uni = universe();

    const groups = new Map();
    for (const u of uni) {
      const sid = seriesIdOf(u.symbol);
      const s = map.get(sid);
      if (!s) continue;                       // 没采到数据的就不列——不列空页
      const g = u.market || 'other';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push({ u, s });
    }

    const order = ['index', 'cn', 'hk', 'us', 'commodity', 'macro', 'fx', 'crypto', 'other'];
    const blocks = order.filter((g) => groups.has(g)).map((g) => {
      const rows = groups.get(g).map(({ u, s }) => {
        const art = window.Content.article(articleIdOf(u.symbol));
        return `<a class="entry" href="#/assets/${encodeURIComponent(u.symbol)}">
          <span>
            <span class="e-t">${esc(u.label)}</span>
            <span class="e-d">${esc(s.from)} → ${esc(s.to)} · ${s.count} 个月末点${art ? ' · 有专文' : ''}</span>
          </span>
          <span class="e-m">看这一页 →</span>
        </a>`;
      }).join('');
      return `<div class="eyebrow" style="margin:var(--s-6) 0 var(--s-3)">${esc(GROUP_LABEL[g] || g)} · ${rows ? groups.get(g).length : 0}</div>
        <div class="entries">${rows}</div>`;
    }).join('');

    // 站内自有序列：终端不展示，但本站有数据、词条也在引用它们。
    // 不列出来的话，「站内 VIX 月度序列可核对」这句话就是空头支票。
    const ownRows = OWN_SERIES.map((o) => {
      const s = map.get(o.id);
      if (!s) return '';
      return `<a class="entry" href="#/assets/${encodeURIComponent(o.id)}">
        <span>
          <span class="e-t">${esc(o.label)}</span>
          <span class="e-d">${esc(o.note)} · ${esc(s.from)} → ${esc(s.to)} · ${s.count} 个月末点</span>
        </span>
        <span class="e-m">看这一页 →</span>
      </a>`;
    }).filter(Boolean).join('');
    const ownBlock = ownRows ? `
      <div class="eyebrow" style="margin:var(--s-6) 0 var(--s-3)">站内自有序列 · ${ownRows.split('<a class="entry"').length - 1}</div>
        <div class="entries">${ownRows}</div>
        <p class="cat-desc" style="margin-top:var(--s-2)">这几条行情终端里不展示，但本站有完整的月线数据——词条里说「可在站内核对」的就是它们。</p>` : '';

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">栏目 03 · 标的百科</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">和行情终端同一份标的清单</h1>
        <p class="art-dek">下面是行情终端里能看的每一只标的。点进去有它的真实历史读数（峰值、谷底、峰谷跌幅、近一年涨跌），有专文的还会多一篇讲清楚它靠什么赚钱。</p>
      </div>
      ${blocks || '<div class="empty"><div class="et">数据还没采齐</div><div class="ed">跑一次采集脚本就能拿到真实历史。</div></div>'}
      ${ownBlock}`;
  }

  /** 标的详情页：专文（如果有）+ 真实数据卡 */
  async function renderDetail(view, id) {
    const sym = id;
    const sid = seriesIdOf(sym);
    const aid = articleIdOf(sym);
    const art = window.Content.article(aid);
    const series = await window.History.series(sid);
    const st = window.Engine.instrument ? window.Engine.instrument.stats(series) : null;

    const q = window.Router ? window.Router.parse(location.hash).query : {};
    const fromLens = q.from === 'lens';

    const dataCard = st ? `
      <div class="panel" style="margin-bottom:var(--s-6)">
        <div class="eyebrow" style="margin-bottom:var(--s-3)">真实历史读数 · 全部由月线序列算出</div>
        <div class="stat-grid">
          <div class="stat"><span class="s-k">最新月末</span><span class="s-v num">${esc(fmtNum(st.last.v, series))}</span><span class="s-n">${esc(st.to)}</span></div>
          <div class="stat"><span class="s-k">峰值</span><span class="s-v num">${esc(fmtNum(st.peak.v, series))}</span><span class="s-n">${esc(st.peak.t)}</span></div>
          <div class="stat"><span class="s-k">谷底</span><span class="s-v num">${esc(fmtNum(st.trough.v, series))}</span><span class="s-n">${esc(st.trough.t)}</span></div>
          <div class="stat"><span class="s-k">峰谷跌幅</span><span class="s-v num ${st.dropPct < 0 ? 'down' : 'up'}">${st.dropPct.toFixed(1)}%</span><span class="s-n">峰值到谷底</span></div>
          <div class="stat"><span class="s-k">近一年</span><span class="s-v num ${(st.chg1y || 0) >= 0 ? 'up' : 'down'}">${st.chg1y === null ? '--' : st.chg1y.toFixed(1) + '%'}</span><span class="s-n">不含分红</span></div>
          <div class="stat"><span class="s-k">覆盖区间</span><span class="s-v num">${esc(st.from.slice(0, 7))} 起</span><span class="s-n">${st.count} 个月末点</span></div>
        </div>
        <p class="insight-note">口径：${esc(series.kind || '月收盘价')} · ${esc(series.source || '')}${st.unadj ? '。未复权价不含分红，所以这里的涨幅是价格涨幅，不是总回报' : ''}。</p>
      </div>` : `
      <div class="panel" style="margin-bottom:var(--s-6)">
        <div class="eyebrow">历史数据</div>
        <p class="muted" style="margin:0">这一只的月线序列还没采到，跑一次采集脚本就能补上。</p>
      </div>`;

    // —— 与行情终端的双向跳转 ——
    // lensSym：站内 id 不一定是终端的 symbol（gold → EM:101.GC00Y）；
    // 站内自有序列（VIX / NDX）终端根本没有，就不给「去看历史数据」。
    const lensSym = LENS_OF[sym] || (NO_LENS.has(sym) ? '' : sym);
    const cross = window.Cross.bar({
      sym: sym,
      lensSym: lensSym,
      fromLens: fromLens,
      moreHref: '#/assets',
      moreLabel: '看别的标的 →',
    });

    const body = art ? window.TermCard.markTerms(window.Fmt.md(art.body || ''), window.Content.glossary()) : '';

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">标的百科</div>
        <h1>${esc((art && art.title) || (series && series.name) || sym)}</h1>
        ${art && art.dek ? `<p class="art-dek">${esc(art.dek)}</p>` : ''}
        ${series ? `<p class="art-meta"><span>${esc(series.name || sym)}</span><span class="msep">·</span><span>${esc(series.unit || '')}</span><span class="msep">·</span><span>数据截至 ${esc(st ? st.to : '—')}</span></p>` : ''}
      </article>

      ${dataCard}
      ${cross}

      ${art ? `<div class="prose">${body}</div>` : `
        <div class="empty"><div class="et">这一只还没有专文</div>
          <div class="ed">数据卡是真的（上面每个数都能对着月线序列核）；但"它靠什么赚钱、什么时候会跌"这类解释还在写。${
            (window.Cross && window.Cross.enabled())
              ? '想看它的实时行情与走势，去 OpenFinLens。'
              : ''}</div>
          ${(window.Cross && window.Cross.enabled())
            ? `<a class="btn ghost sm" href="${LENS}#symbol=${encodeURIComponent(sym)}" target="_blank" rel="noopener">去 OpenFinLens 看行情 →</a>`
            : ''}
        </div>`}

      ${art ? `<p style="margin-top:var(--s-6)"><a class="btn ghost sm" href="#/assets">看全部标的 →</a></p>` : ''}`;
  }

  function fmtNum(v, series) {
    const d = series && series.digits !== undefined ? series.digits : 2;
    return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  window.AssetsView = { renderIndex, renderDetail, universe, SERIES_OF, ARTICLE_OF, seriesIdOf, LENS_OF, OWN_SERIES };
})();
