/* app.js —— 站点主控：路由编排 / 导航 / 报价条 / 键盘操控 / 主题 */
(function () {
  'use strict';

  const F = () => window.Fmt;
  const esc = (s) => window.Fmt.esc(s);

  const NAV = [
    { id: 'home',     path: '/',              label: '首页',       n: '00' },
    { id: 'concepts', path: '/concepts',      label: '货币与利率', n: '01', section: 'concepts' },
    { id: 'crisis',   path: '/crisis',        label: '危机复盘',   n: '02', section: 'crisis' },
    { id: 'assets',   path: '/assets',        label: '标的百科',   n: '03', section: 'assets' },
    { id: 'chains',   path: '/chains',        label: '产业链图谱', n: '04', section: 'chains' },
    { id: 'cycles',   path: '/cycles',        label: '周期与镜鉴', n: '05', section: 'cycles' },
    { id: 'family',   path: '/family',        label: '家庭理财',   n: '06', section: 'family' },
    { id: 'path',     path: '/path',          label: '新手路径',   n: '★' },
  ];

  const TABS = [
    { path: '/',         label: '首页',   icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
    { path: '/concepts', label: '概念',   icon: 'M4 5h16M4 12h16M4 19h10' },
    { path: '/crisis',   label: '复盘',   icon: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5' },
    { path: '/chains',   label: '产业链', icon: 'M4 4v16h16M8 15l3-4 3 2 4-6' },
    { path: '/search',   label: '搜索',   icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5' },
  ];

  let currentKey = '';

  /* ---------------- 报头 ---------------- */
  function paintMasthead() {
    const d = document.getElementById('mh-date');
    if (d) d.textContent = F().cnDateWithWeek(F().today());

    const sister = document.getElementById('mh-sister');
    if (sister) {
      sister.innerHTML = '姊妹站 OpenFinLens ↗';
      sister.style.cursor = 'pointer';
      sister.onclick = () => window.open('https://5777-wq.github.io/openfinlens/', '_blank', 'noopener');
    }

    // 报头下的时间刻度线：1990 → 2026
    const tr = document.getElementById('tick-rule');
    if (tr && !tr.childElementCount) {
      let html = '';
      for (let i = 0; i <= 36; i++) {
        const major = i % 6 === 0;
        html += `<i class="${major ? 'major' : ''}" style="left:${(i / 36 * 100).toFixed(2)}%"></i>`;
      }
      tr.innerHTML = html;
    }
  }

  /* ---------------- 左栏 ---------------- */
  function paintRail() {
    const rail = document.getElementById('rail');
    if (!rail) return;
    const groups = [
      { label: '栏目', items: NAV.slice(0, 7) },
      { label: '开始', items: [NAV[7]] },
    ];
    rail.innerHTML = groups.map((g) => `
      <div class="rail-group">
        <div class="rail-label">${esc(g.label)}</div>
        ${g.items.map((it) => {
          // 产业链的条目来自 vendor（10 条链），不是内容索引
          let count = null;
          if (it.section === 'chains') {
            count = (typeof window.INDUSTRY_CHAINS !== 'undefined' && window.INDUSTRY_CHAINS) || [];
            count = count.length;
          } else if (it.section) {
            count = window.Content.bySection(it.section).length;
          }
          return `<a class="rail-item" data-path="${esc(it.path)}">
            <span class="ri-n">${esc(it.n)}</span>
            <span class="ri-t">${esc(it.label)}</span>
            ${count !== null ? `<span class="ri-c">${count}</span>` : ''}
          </a>`;
        }).join('')}
      </div>`).join('') + `
      <div class="rail-sister">
        <div class="rs-t">OpenFinLens</div>
        <p class="rs-d">实时行情终端。热力图、全球事件、产业链实时强弱、13F 与龙虎榜。</p>
        <a class="btn ghost sm" style="margin-top:10px;width:100%;justify-content:center" target="_blank" rel="noopener"
           href="https://5777-wq.github.io/openfinlens/">打开 ↗</a>
      </div>`;

    rail.querySelectorAll('.rail-item').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); window.Router.go(a.dataset.path); });
    });
  }

  function paintTabbar() {
    const bar = document.getElementById('tabbar');
    if (!bar) return;
    bar.innerHTML = TABS.map((t) => `
      <button data-path="${esc(t.path)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${t.icon}"/>
        </svg>
        <span>${esc(t.label)}</span>
      </button>`).join('');
    bar.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        const p = b.dataset.path;
        if (p === '/search') openPalette();
        else window.Router.go(p);
      });
    });
  }

  function markActive(path) {
    document.querySelectorAll('.rail-item').forEach((a) => {
      const p = a.dataset.path;
      a.classList.toggle('on', p === '/' ? path === '/' : path.indexOf(p) === 0);
    });
    document.querySelectorAll('#tabbar button').forEach((b) => {
      const p = b.dataset.path;
      b.classList.toggle('on', p === '/' ? path === '/' : path.indexOf(p) === 0);
    });
  }

  /* ---------------- 报价条 ---------------- */
  function paintTicker() {
    const box = document.getElementById('ticker');
    if (!box) return;
    const rows = window.Quotes.all();
    if (!rows.length) {
      const tried = !!window.Quotes.state.source;
      box.innerHTML = `<span class="tk src-note">${tried ? '行情暂不可用（数据源不可达且无本地缓存）' : '行情加载中…'}</span>`;
      return;
    }
    box.innerHTML = rows.map((q) => {
      const d = F().dir(q.pct);
      const pct = q.pct === null ? '--' : F().pct(q.pct);
      return `<a class="tk" href="#/assets" title="${esc(q.name)}">
        <span class="k">${esc(q.name)}</span>
        <span class="v">${F().num(q.price, q.digits)}</span>
        <span class="c ${d}">${pct}</span>
      </a>`;
    }).join('') + `<span class="tk src-note">${esc(window.Quotes.state.source)}${window.Quotes.state.degraded ? ' · 降级' : ''}</span>`;

    box.querySelectorAll('.tk[href]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); window.Router.go('/assets'); });
    });
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    const m = window.Router.current();
    const view = document.getElementById('view');
    if (!m) { window.Router.go('/'); return; }

    const key = location.hash;
    if (key !== currentKey) {
      window.Router.stashScroll(currentKey);
      currentKey = key;
    }

    const { route: r, params, query } = m;
    const path = window.Router.parse(location.hash).path;

    try {
      switch (r.id) {
        case 'home': window.HomeView.render(view); break;
        case 'concepts': window.ListView.render(view, 'concepts'); break;
        case 'concept': window.ArticleView.render(view, 'concepts', params.id); break;
        case 'assets': window.ListView.render(view, 'assets'); break;
        case 'cycles': window.ListView.render(view, 'cycles'); break;
        case 'family': window.ListView.render(view, 'family'); break;
        case 'family-one': window.ArticleView.render(view, 'family', params.id); break;
        case 'chains': window.ChainView.renderList(view); break;
        case 'path': window.PathView.render(view); break;
        case 'search': window.SearchView.render(view, query.q || ''); break;
        case 'crisis':
          if (params.id) window.CrisisView.renderDetail(view, params.id);
          else window.CrisisView.renderList(view);
          break;
        case 'crisis-one': window.CrisisView.renderDetail(view, params.id); break;
        case 'asset': window.ArticleView.render(view, 'assets', params.id); break;
        case 'chain': window.ChainView.renderDetail(view, params.id); break;
        case 'cycle': window.ArticleView.render(view, 'cycles', params.id); break;
        default:
          window.ListView.render(view, 'concepts');
      }
    } catch (e) {
      console.error('[render]', e);
      view.innerHTML = `<div class="empty"><div class="et">这一页出了点问题</div>
        <div class="ed">${esc(e.message || String(e))}</div>
        <a class="btn ghost sm" href="#/">回首页</a></div>`;
    }

    markActive(path);
    document.title = (r.title && r.title !== '首页' ? r.title + ' · ' : '') + '白话金融';
    window.Router.restoreScroll(currentKey);
    if (r.id !== 'search') window.scrollTo(0, 0);
  }

  /* ---------------- 命令面板 ---------------- */
  function openPalette() {
    const wrap = document.getElementById('palette-wrap');
    const input = document.getElementById('palette-input');
    wrap.classList.add('on');
    input.value = '';
    paintPalette('');
    input.focus();
  }
  function closePalette() {
    document.getElementById('palette-wrap').classList.remove('on');
  }

  function paintPalette(q) {
    const list = document.getElementById('palette-list');
    const key = String(q || '').trim().toLowerCase();
    const r = window.SearchView.search(key);
    const items = [];
    r.terms.forEach((t) => items.push({ g: '术语', t: t.term, s: t.one || '', go: () => window.TermDrawer.open(t.id) }));
    r.articles.forEach((a) => items.push({ g: '文章', t: a.title, s: a.dek || '', go: () => window.Router.go('/' + a.section + '/' + a.id) }));
    r.assets.forEach((a) => items.push({ g: '标的', t: a.name, s: '', go: () => window.Router.go('/assets') }));

    if (!items.length) {
      list.innerHTML = `<div class="pl-group">无结果</div><div class="pl-item muted">换个词试试，或者按 Esc 关闭</div>`;
      return;
    }
    let lastG = null, html = '';
    items.slice(0, 40).forEach((it, i) => {
      if (it.g !== lastG) { html += `<div class="pl-group">${esc(it.g)}</div>`; lastG = it.g; }
      html += `<div class="pl-item${i === 0 ? ' sel' : ''}" data-i="${i}">
        <span class="pli-t">${esc(it.t)}</span>
        ${it.s ? `<span class="pli-k">${esc(String(it.s).slice(0, 22))}</span>` : ''}
      </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.pl-item').forEach((el) => {
      el.addEventListener('click', () => {
        const it = items[Number(el.dataset.i)];
        closePalette();
        if (it) it.go();
      });
    });
  }

  /* ---------------- 快捷键面板 ---------------- */
  function showKeys() {
    const rows = [
      ['/', '搜索（打开命令面板）'],
      ['⌘K / Ctrl+K', '命令面板'],
      ['?', '打开这个面板'],
      ['← →', '危机回放器：前后步进'],
      ['Esc', '关闭抽屉 / 面板'],
      ['T', '切换日夜皮肤'],
      ['G 然后 H', '回首页'],
    ];
    document.getElementById('drawer-title').textContent = '快捷键';
    document.getElementById('drawer-body').innerHTML =
      `<div class="keys">${rows.map(([k, d]) => `<div class="kr"><span>${esc(d)}</span><span class="kk"><span class="kbd">${esc(k)}</span></span></div>`).join('')}</div>`;
    document.getElementById('drawer-foot').innerHTML = '<span>本站全程键盘可达</span>';
    const el = document.getElementById('drawer');
    el.classList.add('on');
    document.getElementById('scrim').classList.add('on');
  }

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    const t = window.Store.get('theme') || 'day';
    document.body.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'night' ? '#14191C' : '#F2EAE6');
  }
  function toggleTheme() {
    const t = window.Store.get('theme') === 'night' ? 'day' : 'night';
    window.Store.set('theme', t);
    applyTheme();
  }

  /* ---------------- 滚动进度 ---------------- */
  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const p = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    const bar = document.getElementById('progress');
    if (bar) bar.style.width = p.toFixed(2) + '%';
    const top = document.getElementById('to-top');
    if (top) top.classList.toggle('on', doc.scrollTop > 500);
  }

  /* ---------------- 键盘 ---------------- */
  function onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === 'Escape') {
      if (window.TermDrawer.isOpen()) { window.TermDrawer.close(); return; }
      closePalette();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === '/') { e.preventDefault(); openPalette(); return; }
    if (e.key === '?') { e.preventDefault(); showKeys(); return; }
    if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) { toggleTheme(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      window.ReplayPlayer.onKey(e);
    }
  }

  /** 首页仪表：行情到达后补上读数（不重绘整页） */
  function paintGauges() {
    if (window.HomeView && window.HomeView.paintGauges) window.HomeView.paintGauges();
    const src = document.getElementById('gauge-src');
    if (src && window.Quotes.state.source) {
      src.textContent = `来源 ${window.Quotes.state.source} · ${window.Quotes.state.degraded ? '（降级：缓存数据）' : '实时'}`;
    }
  }

  /* ---------------- 启动 ---------------- */
  // 启动轨迹：排查白屏时用。默认不显示，加 ?debug=1 才出现。
  const DEBUG = /(\?|&)debug=1/.test(location.search);
  const trace = [];
  function step(msg) {
    trace.push(msg);
    if (!DEBUG) return;
    try {
      let el = document.getElementById('boot-trace');
      if (!el) {
        el = document.createElement('pre');
        el.id = 'boot-trace';
        el.style.cssText = 'position:fixed;left:0;bottom:0;z-index:9998;margin:0;padding:8px 12px;'
          + 'background:#0b1f24;color:#9fe3d6;font:11px/1.5 monospace;max-width:46ch;white-space:pre-wrap;opacity:.9';
        document.body.appendChild(el);
      }
      el.textContent = trace.join('\n');
    } catch (e) { /* 忽略 */ }
  }

  async function boot() {
    step('boot:start');
    applyTheme();
    paintMasthead();
    paintTabbar();
    bindInteractions();          // 先让站点活过来
    step('boot:shell painted + interactions bound');

    // 内容与行情并行加载；内容最多等 8 秒，超时也先把页面渲染出来
    const contentReady = window.Content.loadAll().catch((e) => {
      console.error('[content] 加载失败', e);
      return null;
    });
    const quotesReady = window.Quotes.load().catch(() => window.Quotes.state);

    await Promise.race([
      contentReady,
      new Promise((r) => setTimeout(r, 8000)),
    ]);
    step('boot:content ready ' + (window.Content.idx.list ? 'ok' : 'EMPTY'));

    if (!window.Content.idx.list) {
      const v = document.getElementById('view');
      if (v) {
        v.innerHTML = `<div class="empty"><div class="et">内容没能加载出来</div>
          <div class="ed">多半是网络或静态服务的问题，不是站点坏了。请刷新试试，或者到
          <a href="https://github.com/5777-wq/openfin-academy/issues/new" target="_blank" rel="noopener">Issue 区</a> 反馈。</div>
          <button class="btn ghost sm" onclick="location.reload()">重新加载</button></div>`;
      }
    }

    paintRail();
    paintTicker();
    step('boot:rail+ticker painted');

    // ⚠ 先把路由渲染出来，再等行情。
    // 行情源可能慢或不可达，但内容页绝不能等它——否则首屏会白着。
    window.Router.onRoute(route);
    window.addEventListener('hashchange', route);
    if (!location.hash) location.replace('#/');
    else route();
    step('boot:routed');

    // 内容到位后重渲染一次：深链进来时，首屏可能还没拿到文章与回放包
    contentReady.then(() => {
      if (window.Content.idx.list) route();
    });

    await quotesReady;
    paintTicker();
    paintGauges();
    step('boot:quotes ready');

    // 行情轮询
    setInterval(async () => {
      await window.Quotes.load();
      paintTicker();
      paintGauges();
    }, 30000);
  }

  /* ---------------- 交互绑定 ----------------
     必须在任何 await 之前完成：站点一加载出来就该能点、能搜、能切主题，
     不能等行情源返回才活过来。 */
  function bindInteractions() {
    window.TermDrawer.init();
    document.getElementById('btn-search').addEventListener('click', openPalette);
    document.getElementById('btn-keys').addEventListener('click', showKeys);
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    const pw = document.getElementById('palette-wrap');
    pw.addEventListener('click', (e) => { if (e.target === pw) closePalette(); });
    document.getElementById('palette-input').addEventListener('input', (e) => paintPalette(e.target.value));

    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.App = { NAV, openPalette, toggleTheme, showKeys };
})();
