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
    { id: 'terms',    path: '/terms',         label: '术语库',     n: '07' },
    { id: 'data',     path: '/data',          label: '速查表',     n: '08' },
    { id: 'path',     path: '/path',          label: '新手路径',   n: '★' },
  ];

  const TABS = [
    { path: '/',         label: '首页',   icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
    { path: '/concepts', label: '概念',   icon: 'M4 5h16M4 12h16M4 19h10' },
    { path: '/terms',    label: '术语',   icon: 'M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z' },
    { path: '/crisis',   label: '复盘',   icon: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5' },
    { path: '/chains',   label: '产业链', icon: 'M4 4v16h16M8 15l3-4 3 2 4-6' },
    { path: '/search',   label: '搜索',   icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5' },
  ];

  let currentKey = '';

  /* ---------------- 报头 ---------------- */
  function paintMasthead() {
    const d = document.getElementById('mh-date');
    if (d) d.textContent = F().cnDateWithWeek(F().today());

    // 报头右上角：行情终端入口。只给名字和链接，不写"姊妹站"这类关系称呼。
    const sister = document.getElementById('mh-sister');
    if (sister) {
      sister.textContent = 'OpenFinLens ↗';
      sister.href = 'https://5777-wq.github.io/openfinlens/';
      sister.target = '_blank';
      sister.rel = 'noopener';
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
    // 三组：栏目（六大栏目）· 查词（术语库与速查表）· 开始（新手路径）
    // 「查词」这一组是后加的——术语库 189 条、速查表十张表是站内最大的两块内容，
    // 之前只挂在正文链接里，左栏没有入口，等于把一半内容藏起来了。
    const groups = [
      { label: '栏目', items: NAV.slice(0, 7) },
      { label: '查词', items: NAV.slice(7, 9) },
      { label: '开始', items: [NAV[9]] },
    ];
    rail.innerHTML = groups.map((g) => `
      <div class="rail-group">
        <div class="rail-label">${esc(g.label)}</div>
        ${g.items.map((it) => {
          // 产业链的条目来自 vendor（10 条链），不是内容索引
          let count = null;
          if (it.id === 'terms') {
            count = Object.keys((window.Content && window.Content.glossary && window.Content.glossary()) || {}).length;
          } else if (it.id === 'data') {
            count = (window.TermView && window.TermView.CATS ? window.TermView.CATS : []).length;
          } else if (it.section === 'chains') {
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
      <div class="rail-sister lens-only">
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
    const prevKey = currentKey;
    if (key !== currentKey) {
      window.Router.stashScroll(currentKey);
      currentKey = key;
    }

    const { route: r, params, query } = m;
    const path = window.Router.parse(location.hash).path;

    // 静态骨架是"首页的样子"。深链进别的页面时先换成中性占位，
    // 否则用户会先看到一段首页内容，然后突然变成危机列表。
    const viewEl = document.getElementById('view');
    if (viewEl && viewEl.dataset.skeleton === '1' && r.id !== 'home') {
      viewEl.innerHTML = `<div class="empty" style="padding:var(--s-8) 0">
        <div class="skel" style="height:22px;width:34%;margin:0 auto 16px"></div>
        <div class="skel" style="height:13px;width:58%;margin:0 auto 9px"></div>
        <div class="skel" style="height:13px;width:44%;margin:0 auto"></div>
      </div>`;
    }

    /* 每次路由换一个**新的容器节点**给视图用。
       为什么：assets / crisis 的渲染是 async（要先等 JSON），而用户在这期间
       可能已经切到别的页面。以前所有路由共用同一个 #view，旧页面的 await 回来后
       直接 view.innerHTML = ... —— 于是 URL 显示 A 页、页面上却是 B 页的内容。
       换成独立容器后，旧页面的异步结果写进的是**已经被换掉的旧容器**，屏幕上看不见。
       这是不改各个视图文件就能修掉竞态的办法。 */
    const host = document.createElement('div');
    host.className = 'route-host';
    view.innerHTML = '';
    view.appendChild(host);

    const errHtml = (e) => `<div class="empty"><div class="et">这一页出了点问题</div>
        <div class="ed">${esc(e && e.message ? e.message : String(e))}</div>
        <a class="btn ghost sm" href="#/">回首页</a></div>`;

    let pending = null;
    try {
      switch (r.id) {
        case 'home': pending = window.HomeView.render(host); break;
        case 'concepts': pending = window.ListView.render(host, 'concepts'); break;
        case 'concept': pending = window.ArticleView.render(host, 'concepts', params.id); break;
        case 'assets': pending = window.AssetsView.renderIndex(host); break;
        case 'cycles': pending = window.ListView.render(host, 'cycles'); break;
        case 'family': pending = window.ListView.render(host, 'family'); break;
        case 'family-one': pending = window.ArticleView.render(host, 'family', params.id); break;
        case 'chains': pending = window.ChainView.renderList(host); break;
        case 'path': pending = window.PathView.render(host); break;
        case 'terms': pending = window.TermView.renderIndex(host); break;
        case 'data': pending = window.TermView.renderDataSheet(host, query); break;
        case 'term': pending = window.TermView.render(host, params.id, query); break;
        case 'search': pending = window.SearchView.render(host, query.q || ''); break;
        case 'crisis':
          if (params.id) pending = window.CrisisView.renderDetail(host, params.id);
          else pending = window.CrisisView.renderList(host);
          break;
        case 'crisis-one': pending = window.CrisisView.renderDetail(host, params.id); break;
        case 'asset': pending = window.AssetsView.renderDetail(host, params.id); break;
        case 'chain': pending = window.ChainView.renderDetail(host, params.id); break;
        case 'cycle': pending = window.ArticleView.render(host, 'cycles', params.id); break;
        default:
          pending = window.ListView.render(host, 'concepts');
      }
    } catch (e) {
      console.error('[render]', e);
      host.innerHTML = errHtml(e);
    }

    // 视图是 async 的时候，上面的 try/catch 抓不到它内部的异常——
    // 异常会变成 unhandledRejection，用户看到的是**上一次的残页**而不是错误页，
    // 同时 index.html 的全局兜底会在屏幕底部压一条永不消失的红色调试条。
    if (pending && typeof pending.then === 'function') {
      pending.catch((e) => {
        console.error('[render]', e);
        if (!host.isConnected) return;   // 已经切走，这一页不在屏幕上了
        host.innerHTML = errHtml(e);
      });
    }

    applyLensSetting(false);   // 跨站链接总开关：每次重画都要跟着当前设置走
    markActive(path);
    document.title = (r.title && r.title !== '首页' ? r.title + ' · ' : '') + '白话金融';
    // 滚动位置：先恢复（用**离开时**的 key），再决定要不要归零。
    // 以前是「先恢复、再无条件 scrollTo(0,0)」——恢复的结果 100% 被覆盖，
    // 浏览器后退回长文时会被强行拉回顶部。
    window.Router.restoreScroll(prevKey);
    if (r.id !== 'search' && key !== prevKey) window.scrollTo(0, 0);
  }

  /* ---------------- 命令面板 ----------------
     面板底部写着「↑↓ 选择 / ⏎ 打开 / Esc 关闭」，那这三条就必须真的能用。
     以前只有鼠标能点：↑↓ 不动、⏎ 不开、Esc 只把输入框 blur 一下（面板还留在屏幕上，
     读者以为已经关了）。这一版把三件事补齐，并把焦点还给打开它的那个元素。 */
  let paletteItems = [];
  let paletteSel = 0;
  let paletteLastFocus = null;

  function isPaletteOpen() {
    const wrap = document.getElementById('palette-wrap');
    return !!(wrap && wrap.classList.contains('on'));
  }

  function openPalette() {
    const wrap = document.getElementById('palette-wrap');
    const input = document.getElementById('palette-input');
    paletteLastFocus = document.activeElement;
    wrap.classList.add('on');
    input.value = '';
    paintPalette('');
    input.focus();
  }
  function closePalette() {
    const wrap = document.getElementById('palette-wrap');
    if (!wrap || !wrap.classList.contains('on')) return;
    wrap.classList.remove('on');
    // 焦点还回去：面板是 display:none，焦点会自动掉到 body，
    // 键盘用户下一次 Tab 得从页面最顶部重新走一遍。
    if (paletteLastFocus && document.contains(paletteLastFocus) && paletteLastFocus.focus) {
      try { paletteLastFocus.focus(); } catch (e) { /* 元素已经没了就算了 */ }
    }
    paletteLastFocus = null;
  }

  /** ↑↓ 移动选中项 */
  function paletteMove(d) {
    if (!paletteItems.length) return;
    const n = Math.min(paletteItems.length, 40);
    paletteSel = (paletteSel + d + n) % n;
    const list = document.getElementById('palette-list');
    if (!list) return;
    list.querySelectorAll('.pl-item').forEach((el, i) => el.classList.toggle('sel', i === paletteSel));
    const cur = list.querySelector('.pl-item.sel');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  /** ⏎ 打开选中项 */
  function paletteEnter() {
    const it = paletteItems[paletteSel];
    if (!it) return;
    closePalette();
    it.go();
  }

  function paintPalette(q) {
    const list = document.getElementById('palette-list');
    const key = String(q || '').trim().toLowerCase();
    const r = window.SearchView.search(key);
    const items = [];
    r.terms.forEach((t) => items.push({ g: '术语', t: t.term, s: t.one || '', go: () => window.TermDrawer.open(t.id) }));
    r.articles.forEach((a) => items.push({ g: '文章', t: a.title, s: a.dek || '', go: () => window.Router.go('/' + a.section + '/' + a.id) }));
    r.assets.forEach((a) => items.push({ g: '标的', t: a.name, s: '', go: () => window.Router.go('/assets') }));
    paletteItems = items;
    paletteSel = 0;

    if (!items.length) {
      list.innerHTML = `<div class="pl-group">无结果</div><div class="pl-item muted">换个词试试，或者按 Esc 关闭</div>`;
      return;
    }
    let lastG = null, html = '';
    items.slice(0, 40).forEach((it, i) => {
      if (it.g !== lastG) { html += `<div class="pl-group">${esc(it.g)}</div>`; lastG = it.g; }
      html += `<div class="pl-item${i === 0 ? ' sel' : ''}" data-i="${i}" role="option" aria-selected="${i === 0}">
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

  /* ---------------- 站点设置（抽屉） ----------------
     两个开关：夜间皮肤、去行情终端的链接。设置只存在本机，不联网。 */
  function showSettings() {
    const dark = window.Store.get('theme') === 'night';
    const lens = window.Cross ? window.Cross.enabled() : true;
    document.getElementById('drawer-title').textContent = '站点设置';
    document.getElementById('drawer-body').innerHTML = `
      <div class="set-row">
        <div>
          <div class="set-k">夜间皮肤</div>
          <div class="set-h">报头的月亮按钮也能切</div>
        </div>
        <button class="switch ${dark ? 'on' : ''}" id="swTheme" role="switch" aria-checked="${dark}" aria-label="夜间皮肤"></button>
      </div>
      <div class="set-row">
        <div>
          <div class="set-k">去行情终端的链接</div>
          <div class="set-h">关掉后，术语页与标的页不再出现「去看历史数据」和「回到 OpenFinLens」，报头的入口也一起消失</div>
        </div>
        <button class="switch ${lens ? 'on' : ''}" id="swLens" role="switch" aria-checked="${lens}" aria-label="去行情终端的链接"></button>
      </div>
      <p class="set-note">设置只存在这台设备上（localStorage），不联网、不上传、没有统计。</p>`;
    document.getElementById('drawer-foot').innerHTML = '<span>白话金融 OpenFin Academy</span>';
    const drawer = document.getElementById('drawer');
    drawer.classList.add('on');
    document.getElementById('scrim').classList.add('on');

    document.getElementById('swTheme').addEventListener('click', () => { toggleTheme(); showSettings(); });
    document.getElementById('swLens').addEventListener('click', () => {
      const next = !(window.Cross ? window.Cross.enabled() : true);
      window.Store.set('lens', next);
      applyLensSetting(true);
      showSettings();
    });
  }

  /** 跨站链接总开关：报头的入口 + 左栏卡片 + 各页的跳转条一起开关 */
  function applyLensSetting(rerender) {
    const on = window.Cross ? window.Cross.enabled() : true;
    const sister = document.getElementById('mh-sister');
    if (sister) sister.hidden = !on;
    document.querySelectorAll('.lens-only').forEach((n) => { n.hidden = !on; });
    if (rerender) route();   // 当前页重画：跳转条要跟着出现/消失
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
  let pendingG = 0;   // 「G 然后 H」的第一下：G
  function onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      // 命令面板开着的时候，键盘归它管（↑↓ 选、⏎ 开、Esc 关）
      if (isPaletteOpen()) {
        if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); paletteMove(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); paletteMove(-1); return; }
        if (e.key === 'Enter') { e.preventDefault(); paletteEnter(); return; }
        return;
      }
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
    // G 然后 H 回首页（快捷键面板里写着这一条，就得真的能用）
    const k = e.key.toLowerCase();
    if (k === 'g' && !e.metaKey && !e.ctrlKey) { pendingG = Date.now(); return; }
    if (k === 'h' && !e.metaKey && !e.ctrlKey && pendingG && Date.now() - pendingG < 1500) {
      pendingG = 0;
      e.preventDefault();
      window.Router.go('/');
      return;
    }
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
    applyLensSetting(false);
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
    applyLensSetting(false);   // 左栏那张终端卡片也要跟着开关走
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
    document.getElementById('btn-settings').addEventListener('click', showSettings);
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
