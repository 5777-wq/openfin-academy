/* views/home.js —— 首页（时代横轴 hero + 实时仪表 + 今日一词） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  /* ------------------------------------------------------------------
     动效样式（随视图注入一次）：
     1) 区块进场次序（stagger）：换页/首次渲染时各区块按 --h-sec-i 依次
        显影——「这东西从哪来」只回答这一次，滚动不触发、不回放；
     2) 仪表读数到达：只有「占位 → 真数据」这一次状态切换给淡入，
        数字本体永不动画（不滚动、不闪烁），30 秒轮询换数时屏幕静止。
     规则：只动 transform / opacity；时长缓动一律引用设计令牌并带兜底值；
     prefers-reduced-motion 下显式关闭（layout.css 的全局关闭是兜底，
     这里声明本表面自己的意图，避免 backwards 填充被 delay 拖住）。
     ------------------------------------------------------------------ */
  const MOTION_CSS = `
.h-sec {
  animation: h-sec-in var(--dur-2, 240ms) var(--ease-out, cubic-bezier(.16,1,.3,1)) backwards;
  animation-delay: calc(var(--dur-1, 140ms) * var(--h-sec-i, 0));
}
@keyframes h-sec-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
.dpanel.dp-arrive {
  animation: dp-arrive-in var(--dur-2, 240ms) var(--ease-out, cubic-bezier(.16,1,.3,1)) backwards;
}
@keyframes dp-arrive-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .h-sec, .dpanel.dp-arrive { animation: none; }
}
`;

  function ensureMotionCss() {
    if (document.getElementById('home-motion-css')) return;
    const el = document.createElement('style');
    el.id = 'home-motion-css';
    el.textContent = MOTION_CSS;
    (document.head || document.documentElement).appendChild(el);
  }

  /** 仪表卡片：实时读数 + 一句"这是什么"。
      dp-wait = 数据未到的占位卡（只作标记，供下一次 paintGauges 识别
      「占位 → 真数据」这一次状态切换）；dp-arrive = 刚拿到数的克制淡入。 */
  function gaugeCard(cfg) {
    const q = cfg.fetch();
    if (!q) {
      /* 加载失败之后这里一直写「数据加载中」——读者以为页面卡住了。
         行情源已经试过一轮还拿不到数，就直说连不上，别让人干等。 */
      const tried = !!(window.Quotes.state && window.Quotes.state.source);
      return `<div class="dpanel dp-wait" data-key="${esc(cfg.key)}">
        <div class="dp-k">${esc(cfg.name)}</div>
        <div class="dp-v">--</div>
        <div class="dp-d muted">${tried ? '行情暂时连不上' : '数据加载中'}</div>
      </div>`;
    }
    const d = F().dir(q.pct);
    const pctTxt = q.pct === null ? '--' : F().pct(q.pct);
    return `<div class="dpanel${cfg.hot ? ' hot' : ''}${cfg.arrive ? ' dp-arrive' : ''}" data-key="${esc(cfg.key)}">
      <div class="dp-k">${esc(cfg.name)}${cfg.unit ? ` <span class="muted">${esc(cfg.unit)}</span>` : ''}</div>
      <div class="dp-v">${F().num(q.price, q.digits)}</div>
      <div class="dp-d ${d}">${pctTxt} <span class="muted">当日</span></div>
      ${cfg.href ? `<div class="dp-f">这是什么？→ <a href="${esc(cfg.href)}">${esc(cfg.link || '看解释')}</a></div>` : ''}
    </div>`;
  }

  const GAUGES = [
    { name: '美债 10 年期收益率', unit: '%', key: 'EM:171.US10Y', digits: 2, hot: true, href: '#/term/risk-free-rate', link: '为什么它是全球无风险利率' },
    { name: 'COMEX 黄金', unit: '美元/盎司', key: 'EM:101.GC00Y', digits: 1, href: '#/assets/gold', link: '黄金到底在防什么' },
    { name: '纳斯达克综合指数', unit: '', key: 'usIXIC', digits: 2, href: '#/term/nasdaq', link: '纳指为什么对利率最敏感' },
    { name: 'NYMEX 原油', unit: '美元/桶', key: 'EM:102.CL00Y', digits: 2, href: '#/term/crude-oil', link: '原油是通胀的风向标' },
    { name: '美元指数', unit: '', key: 'EM:100.UDI', digits: 2, href: '#/term/dollar-index', link: '美元为什么是世界的锚' },
    { name: '上证指数', unit: '', key: 'sh000001', digits: 2, href: '#/term/sse-index', link: '大A 的「大盘」指什么' },
  ];

  /** 只重绘仪表区：行情到达时补上，不动整页。
      只有上一轮还是占位卡（dp-wait）的槽位，这次拿到数才淡入一次；
      之后轮询换数字是静默替换——数字本体永不动画。 */
  function paintGauges() {
    const box = document.getElementById('home-gauges');
    if (!box) return;
    const G = window.Quotes;
    const wasWaiting = new Set();
    if (typeof box.querySelectorAll === 'function') {
      box.querySelectorAll('.dpanel.dp-wait[data-key]').forEach((el) => {
        const k = el.getAttribute && el.getAttribute('data-key');
        if (k) wasWaiting.add(k);
      });
    }
    box.innerHTML = GAUGES.map((g) => gaugeCard({
      name: g.name, unit: g.unit, digits: g.digits, hot: g.hot, href: g.href, link: g.link,
      key: g.key, arrive: wasWaiting.has(g.key),
      fetch: () => G.get(g.key),
    })).join('');
  }

  /** 今天是本年的第几天（本地时区；1 月 1 日算第 1 天）
      原来写死 Date.UTC(2026,0,1)，2027 年起就会变成「第 366 天」并一直长下去。 */
  function dayOfYear(d) {
    const now = d || new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  }

  /** 今日一词：按当天日期做种子，同一天永远是同一个词。
      （原来用 Math.random()：内容加载完后 route() 会再渲染一次，
        读者眼睁睁看着词在自己眼前换掉。） */
  function pickTodayTerm(ids, date) {
    if (!ids || !ids.length) return null;
    const d = date || new Date();
    const seed = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    let h = 2166136261;                    // FNV-1a：同一个种子永远落到同一个词
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ids[(h >>> 0) % ids.length];
  }

  function render(view) {
    const G = window.Quotes;

    ensureMotionCss();

    // 区块进场序号：同一次渲染内递增，条件区块不出现就不占号
    let secI = 0;
    const si = () => `--h-sec-i:${secI++};`;

    const glossary = window.Content.glossary();
    const termIds = Object.keys(glossary);
    const pick = pickTodayTerm(termIds);
    // 今日一词：整张卡是一个链接。
    // 以前它是一张读得懂却点不动的卡片——读者读完想看完整解释，只能自己去搜一遍。
    const termHtml = pick
      ? `<a class="term-link" href="#/term/${encodeURIComponent(pick)}">
          ${window.TermCard.render(Object.assign({ id: pick }, glossary[pick]))}
          <span class="term-link-more">看完整解释 →</span>
        </a>`
      : '';

    const latestCrisis = window.Content.bySection('crisis').slice(0, 2);
    const latestConcept = window.Content.bySection('concepts').slice(0, 3);
    // 家庭理财：全站只有这一篇「给家里人看」的东西，
    // 但它没有入口——左栏第 06 项埋得深，手机上更是完全找不到。
    // 这里直接链到文章本身，不链栏目页：点了就知道会看到哪一篇。
    const family = window.Content.list().filter((a) => a.section === 'family');
    // 读懂财报：同样直接链文章，别让新栏目只有左栏一个入口
    const reports = window.Content.list().filter((a) => a.section === 'reports');

    view.innerHTML = `
      <section class="panel flush open h-sec" style="${si()}border:0;background:transparent;padding:0">
        <div class="art-head" style="margin-bottom:var(--s-5)">
          <div class="eyebrow">${esc(F().cnDateWithWeek(F().today()))} · 第 ${dayOfYear()} 天</div>
          <h1 style="font-size:var(--t-hero);line-height:1.32;letter-spacing:-.015em;margin-bottom:var(--s-3)">
            把美债收益率、黄金、纳指、原油、A股<br>讲成你听得懂的话。
          </h1>
          <p class="art-dek">零后端、零密钥、零构建的金融科普站。每一句都能点开看真实数据，每一场危机都能拖动时间轴回放。</p>
          <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;margin-top:var(--s-4)">
            <a class="btn" href="#/path">从零开始 · 8 课</a>
            <a class="btn ghost" href="#/terms?q=PE">查一个词（试试 PE）</a>
            <a class="btn ghost" href="#/crisis">看一场危机复盘</a>
            <a class="btn ghost" href="#/concepts">查一个概念</a>
          </div>
        </div>
        <div id="home-era"></div>
      </section>

      ${(window.Site && window.Site.disclaimer) ? window.Site.disclaimer.GENERIC : ''}

      <section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">实时仪表 <span class="muted" id="gauge-src" style="margin-left:auto;text-transform:none;letter-spacing:0"></span></div>
        <div class="gauges" id="home-gauges"></div>
      </section>

      <section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">今日一词</div>
        ${termHtml || '<div class="empty"><div class="et">术语库正在补充</div></div>'}
      </section>

      ${family.length ? `<section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">给家里人的那份说明书</div>
        <div class="entries">
          ${family.map((f) => `<a class="entry" href="#/family/${esc(f.id)}">
            <span>
              <span class="e-t">${esc(f.title)}</span>
              <span class="e-d">${esc(f.dek || '')}</span>
            </span>
            <span class="e-m">${f.readMinutes ? f.readMinutes + ' min' : ''} 读一篇 →</span>
          </a>`).join('')}
        </div>
      </section>` : ''}

      ${reports.length ? `<section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">读懂财报</div>
        <div class="entries">
          ${reports.map((f) => `<a class="entry" href="#/reports/${esc(f.id)}">
            <span>
              <span class="e-t">${esc(f.title)}</span>
              <span class="e-d">${esc(f.dek || '')}</span>
            </span>
            <span class="e-m">${f.readMinutes ? f.readMinutes + ' min' : ''} 读一篇 →</span>
          </a>`).join('')}
        </div>
      </section>` : ''}

      <section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">先把基础打完</div>
        <div class="entries">
          ${latestConcept.map((c) => entryRow(c)).join('')}
        </div>
      </section>

      <section class="h-sec" style="${si()}margin-top:var(--s-7)">
        <div class="eyebrow">以史为鉴</div>
        <div class="entries">
          ${latestCrisis.map((c) => entryRow(c)).join('')}
        </div>
      </section>

      <section class="lens-only h-sec" style="${si()}margin-top:var(--s-7)">
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
      src.textContent = '来源 ' + window.Quotes.state.source + ' · ' + window.Quotes.freshness();
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

  window.HomeView = { render, paintGauges, pickTodayTerm, dayOfYear };
})();
