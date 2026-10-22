/* components/era-timeline.js —— 时代横轴（首页签名元素）
   这个站的本质是「时间 × 资产 × 事件」，所以首页的主导航是一条时间轴，
   而不是一排栏目按钮。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  /** 时代节点定义：分两带——近代与更早，各自有独立刻度 */
  const DEFAULT_BANDS = [
    {
      label: '近代', range: '2000 – 2026', eras: [
        { year: '2000', label: '互联网泡沫', stat: '纳指 -78%', href: '#/cycles/2000-dotcom',
          tip: '叙事先于盈利，估值先行崩塌。之后用了整整五年才回到起点。' },
        { year: '2008', label: '次贷危机', stat: '标普 -57%', href: '#/crisis/2008',
          tip: '房价、CDS、银行股、美股、美债——危机沿着资产负债表一路传导。' },
        // 这三个年代还没有专文：不能指向不存在的文章（点了只会「没找到这篇文章」），
        // 改成站内真实存在的、同一件事的词条页／文章页。
        { year: '2013', label: '缩减恐慌', stat: '标普 -6%', href: '#/term/monetary-policy',
          tip: '央行怎么说话，市场就能怎么抖。史上最温和的一次「崩盘」。' },
        { year: '2020', label: '疫情熔断', stat: '标普 -34%', href: '#/term/circuit-breaker',
          tip: '10 个交易日的极速下跌，流动性危机而非基本面危机。' },
        { year: '2022', label: '暴力加息', stat: '纳指 -33%', href: '#/concepts/inflation',
          tip: '40 年最狠通胀，利率从 0 拉到 5%，成长股被杀估值。' },
        // 「现在」这个节点指向本轮真正在跑的东西：算力产业链
        { year: '2026', label: 'AI 周期', stat: '进行中', href: '#/chains/ai', now: true,
          tip: '本轮由算力资本开支驱动。哪些像 2000，哪些不像——用数据来比。' },
      ],
    },
    {
      label: '更早', range: '1987 – 1998', eras: [
        { year: '1987', label: '黑色星期一', stat: '标普 -20.5%', href: '#/crisis/1987',
          tip: '一天跌掉五分之一，没有预警，也没有解释。' },
        { year: '1990', label: '日本泡沫', stat: '日经 -63%', href: '#/crisis/1990',
          tip: '跌了三年才跌完。慢刀子割肉，才是最难受的那种。' },
        { year: '1994', label: '比索危机', stat: '美债 7.9%', href: '#/crisis/1994',
          tip: '一个小国引发的美元紧缩，代价由全世界分摊。' },
        { year: '1998', label: '亚洲金融危机', stat: '恒指 -60%', href: '#/crisis/1998',
          tip: '同一年，恒指单日 -13.7%，LTCM 逼得美联储下场救火。' },
      ],
    },
  ];

  function renderBand(band, opts) {
    const list = band.eras;
    const y0 = Number(list[0].year);
    const y1 = Number(list[list.length - 1].year);
    const span = Math.max(1, y1 - y0);

    const nodes = list.map((e, i) => {
      const y = Number(String(e.year).slice(0, 4));
      const pos = ((y - y0) / span) * 100;
      // 端点稍微内缩，避免节点贴边被裁
      const left = 6 + pos * 0.88;
      // 相邻年份（如 2020 / 2022）标签会相撞：奇偶交替下移一行
      const lane = i % 2 ? ' lane-1' : '';
      return `<a class="era-node${lane}${e.now ? ' now' : ''}" href="${esc(e.href)}" style="left:${left.toFixed(2)}%">
        <span class="en-tip"><b>${esc(e.year)} · ${esc(e.label)}</b><span>${esc(e.tip)}</span></span>
        <span class="en-year">${esc(e.year)}</span>
        <span class="en-dot"></span>
        <span class="en-stem"></span>
        <span class="en-label">${esc(e.label)}</span>
        <span class="en-stat">${esc(e.stat)}</span>
      </a>`;
    }).join('');

    return `<div class="era-band">
      <div class="era-band-head">
        <span class="era-band-label">${esc(band.label)}</span>
        <span class="era-band-range num">${esc(band.range)}</span>
        ${opts && opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ''}
      </div>
      <div class="era-axis">
        <div class="axis-line"></div>
        <div class="axis-fill" data-fill></div>
        ${nodes}
      </div>
    </div>`;
  }

  function render(container, bands) {
    if (!container) return;
    const list = bands && bands.length ? bands : DEFAULT_BANDS;
    container.innerHTML = list.map((band, i) => renderBand(band, {
      hint: i === 0 ? '悬停看一句话，点进去看完整复盘' : '',
    })).join('');

    // 金线随"当前时代"填充
    container.querySelectorAll('.era-axis').forEach((axis) => {
      const fill = axis.querySelector('[data-fill]');
      const nowNode = axis.querySelector('.era-node.now');
      if (fill && nowNode) fill.style.width = parseFloat(nowNode.style.left) + '%';
    });
  }

  window.EraTimeline = { render, DEFAULT_BANDS, DEFAULT_ERAS: DEFAULT_BANDS[0].eras };
})();
