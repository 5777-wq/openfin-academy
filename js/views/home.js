/* views/home.js —— 首页（时代横轴 hero + 实时仪表 + 今日一词） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  /** 仪表卡片：实时读数 + 一句"这是什么" */
  function gaugeCard(cfg) {
    const q = cfg.fetch();
    if (!q) {
      return `<div class="dpanel">
        <div class="dp-k">${esc(cfg.name)}</div>
        <div class="dp-v">--</div>
        <div class="dp-d muted">数据加载中</div>
      </div>`;
    }
    const d = F().dir(q.pct);
    const pctTxt = q.pct === null ? '--' : F().pct(q.pct);
    return `<div class="dpanel${cfg.hot ? ' hot' : ''}">
      <div class="dp-k">${esc(cfg.name)}${cfg.unit ? ` <span class="muted">${esc(cfg.unit)}</span>` : ''}</div>
      <div class="dp-v">${F().num(q.price, q.digits)}</div>
      <div class="dp-d ${d}">${pctTxt} <span class="muted">当日</span></div>
      ${cfg.href ? `<div class="dp-f">这是什么？→ <a href="${esc(cfg.href)}">${esc(cfg.link || '看解释')}</a></div>` : ''}
    </div>`;
  }

  const GAUGES = [
    { name: '美债 10 年期收益率', unit: '%', key: 'EM:171.US10Y', digits: 2, hot: true, href: '#/concepts/risk-free-rate', link: '为什么它是全球无风险利率' },
    { name: 'COMEX 黄金', unit: '美元/盎司', key: 'EM:101.GC00Y', digits: 1, href: '#/assets/gold', link: '黄金到底在防什么' },
    { name: '纳斯达克 100', unit: '', key: 'usNDX', digits: 2, href: '#/assets', link: '纳指为什么对利率最敏感' },
    { name: 'NYMEX 原油', unit: '美元/桶', key: 'EM:102.CL00Y', digits: 2, href: '#/assets', link: '原油是通胀的风向标' },
    { name: '美元指数', unit: '', key: 'EM:100.UDI', digits: 2, href: '#/concepts', link: '美元为什么是世界的锚' },
    { name: '上证指数', unit: '', key: 'sh000001', digits: 2, href: '#/assets', link: '大A 的「大盘」指什么' },
  ];

  /** 只重绘仪表区：行情到达时补上，不动整页 */
  function paintGauges() {
    const box = document.getElementById('home-gauges');
    if (!box) return;
    const G = window.Quotes;
    box.innerHTML = GAUGES.map((g) => gaugeCard({
      name: g.name, unit: g.unit, digits: g.digits, hot: g.hot, href: g.href, link: g.link,
      fetch: () => G.get(g.key),
    })).join('');
  }

  function render(view) {
    const G = window.Quotes;

    const glossary = window.Content.glossary();
    const termIds = Object.keys(glossary);
    const pick = termIds.length ? termIds[Math.floor(Math.random() * termIds.length)] : null;
    const termHtml = pick ? window.TermCard.render(Object.assign({ id: pick }, glossary[pick])) : '';

    const latestCrisis = window.Content.bySection('crisis').slice(0, 2);
    const latestConcept = window.Content.bySection('concepts').slice(0, 3);

    view.innerHTML = `
      <section class="panel flush" style="border:0;background:transparent;padding:0">
        <div class="art-head" style="margin-bottom:var(--s-5)">
          <div class="eyebrow">${esc(F().cnDateWithWeek(F().today()))} · 第 ${Math.ceil((Date.now() - Date.UTC(2026,0,1)) / 86400000)} 天</div>
          <h1 style="font-size:var(--t-hero);line-height:1.32;letter-spacing:-.015em;margin-bottom:var(--s-3)">
            把美债收益率、黄金、纳指、原油、A股<br>讲成你听得懂的话。
          </h1>
          <p class="art-dek">零后端、零密钥、零构建的金融科普站。每一句都能点开看真实数据，每一场危机都能拖动时间轴回放。</p>
          <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-top:var(--s-4)">
            <a class="btn" href="#/path">从零开始 · 8 课</a>
            <a class="btn ghost" href="#/crisis">看一场危机复盘</a>
            <a class="btn ghost" href="#/concepts">查一个概念</a>
          </div>
        </div>
        <div id="home-era"></div>
      </section>

      <section style="margin-top:var(--s-7)">
        <div class="eyebrow">实时仪表 <span class="muted" id="gauge-src" style="margin-left:auto;text-transform:none;letter-spacing:0"></span></div>
        <div class="gauges" id="home-gauges"></div>
      </section>

      <section style="margin-top:var(--s-7)">
        <div class="eyebrow">今日一词</div>
        ${termHtml || '<div class="empty"><div class="et">术语库正在补充</div></div>'}
      </section>

      <section style="margin-top:var(--s-7)">
        <div class="eyebrow">先把基础打完</div>
        <div class="entries">
          ${latestConcept.map((c) => entryRow(c)).join('')}
        </div>
      </section>

      <section style="margin-top:var(--s-7)">
        <div class="eyebrow">以史为鉴</div>
        <div class="entries">
          ${latestCrisis.map((c) => entryRow(c)).join('')}
        </div>
      </section>

      <section class="lens-only" style="margin-top:var(--s-7)">
        <div class="panel" style="display:flex;gap:var(--s-4);align-items:center;flex-wrap:wrap">
          <div style="flex:1 1 260px">
            <div class="eyebrow">实时行情终端</div>
            <h3 class="h3" style="margin-bottom:6px">OpenFinLens · 实时行情终端</h3>
            <p class="small muted" style="margin:0">想看此刻的盘口、热力图和全球事件地图？去 OpenFinLens。数据同源，视角互补。</p>
          </div>
          <a class="btn teal" href="https://5777-wq.github.io/openfinlens/" target="_blank" rel="noopener">打开实时看板 ↗</a>
        </div>
      </section>`;

    // 时代横轴
    const eraBox = document.getElementById('home-era');
    if (eraBox) window.EraTimeline.render(eraBox);

    // 仪表：先画占位，行情到了再补
    paintGauges();

    // 仪表数据源标注
    const src = document.getElementById('gauge-src');
    if (src && window.Quotes.state.source) {
      src.textContent = `来源 ${window.Quotes.state.source} · ${window.Quotes.state.degraded ? '（降级：缓存数据）' : '实时'}`;
    }
  }

  function entryRow(c) {
    return `<a class="entry" href="#/${c.section}/${c.id}">
      <span>
        <span class="e-t">${esc(c.title)}</span>
        <span class="e-d">${esc(c.dek || '')}</span>
      </span>
      <span class="e-m">${c.readMinutes ? c.readMinutes + ' min' : ''} <span class="tag">${esc(c.tag || '')}</span></span>
    </a>`;
  }

  window.HomeView = { render, paintGauges };
})();
