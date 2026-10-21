/* components/era-timeline.js —— 时代横轴（首页签名元素）
   这个站的本质是「时间 × 资产 × 事件」，所以首页的主导航是一条时间轴，
   而不是一排栏目按钮。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /** 时代节点定义：可从内容里覆盖，这里是默认集合 */
  const DEFAULT_ERAS = [
    { year: '2000', label: '互联网泡沫', stat: '纳指 -78%', href: '#/cycles/2000-dotcom',
      tip: '叙事先于盈利，估值先行崩塌。之后用了整整五年才回到起点。' },
    { year: '2008', label: '次贷危机', stat: '标普 -57%', href: '#/crisis/2008',
      tip: '房价、CDS、银行股、美股、美债——危机沿着资产负债表一路传导。' },
    { year: '2013', label: '缩减恐慌', stat: '标普 -6%', href: '#/crisis/2013',
      tip: '央行怎么说话，市场就能怎么抖。史上最温和的一次"崩盘"。' },
    { year: '2020', label: '疫情熔断', stat: '标普 -34%', href: '#/crisis/2020',
      tip: '10 个交易日的极速下跌，流动性危机而非基本面危机。' },
    { year: '2022', label: '暴力加息', stat: '纳指 -33%', href: '#/crisis/2022',
      tip: '40 年最狠通胀，利率从 0 拉到 5%，成长股被杀估值。' },
    { year: '2026', label: 'AI 周期', stat: '进行中', href: '#/cycles/ai-cycle', now: true,
      tip: '本轮由算力资本开支驱动。哪些像 2000，哪些不像——用数据来比。' },
  ];

  function render(container, eras) {
    if (!container) return;
    const list = eras && eras.length ? eras : DEFAULT_ERAS;
    const first = list[0], last = list[list.length - 1];
    const y0 = Number(String(first.year).slice(0, 4));
    const y1 = Number(String(last.year).slice(0, 4));
    const span = Math.max(1, y1 - y0);

    const nodes = list.map((e) => {
      const y = Number(String(e.year).slice(0, 4));
      const pos = ((y - y0) / span) * 100;
      // 端点稍微内缩，避免节点贴边被裁
      const left = 6 + pos * 0.88;
      return `<a class="era-node${e.now ? ' now' : ''}" href="${esc(e.href)}" style="left:${left.toFixed(2)}%">
        <span class="en-tip"><b>${esc(e.year)} · ${esc(e.label)}</b><span>${esc(e.tip)}</span></span>
        <span class="en-year">${esc(e.year)}</span>
        <span class="en-dot"></span>
        <span class="en-stem"></span>
        <span class="en-label">${esc(e.label)}</span>
        <span class="en-stat">${esc(e.stat)}</span>
      </a>`;
    }).join('');

    container.innerHTML = `
      <div class="era-head">
        <span class="eyebrow" style="margin:0">按时代进入</span>
        <span class="hint">悬停看一句话，点进去看完整复盘</span>
      </div>
      <div class="era-axis" id="era-axis">
        <div class="axis-line"></div>
        <div class="axis-fill" id="era-fill"></div>
        ${nodes}
      </div>`;

    // 金线随"当前时代"填充
    const fill = document.getElementById('era-fill');
    const nowNode = container.querySelector('.era-node.now');
    if (fill && nowNode) {
      const pos = parseFloat(nowNode.style.left) || 0;
      fill.style.width = pos + '%';
    }
  }

  window.EraTimeline = { render, DEFAULT_ERAS };
})();
