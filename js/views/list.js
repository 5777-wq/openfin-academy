/* views/list.js —— 栏目索引页（货币与利率 / 标的百科 / 周期 / 家庭理财 共用） */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  const INTRO = {
    concepts: {
      eyebrow: '栏目 01 · 货币与利率',
      title: '一切资产定价的尺子',
      dek: '从"钱存在哪"到"为什么美债收益率是全球无风险利率"。这一栏是全站的地基——后面所有栏目都会回到这里。',
    },
    assets: {
      eyebrow: '栏目 03 · 标的百科',
      title: '每个标的，一页讲完',
      dek: '黄金、白银、原油、纳指、标普、A股、恒生、国债……每页固定四段：这是什么、为什么涨跌、历史最疯和最惨的五次、什么人适合。',
    },
    cycles: {
      eyebrow: '栏目 05 · 周期与镜鉴',
      title: '今天在哪一格，历史上有谁走过',
      dek: '不预测，只对照。把当前的处境和历史做六维度逐项比较，明确写出哪里像、哪里不像。',
    },
    family: {
      eyebrow: '栏目 06 · 家庭理财',
      title: '给家里人的那份说明书',
      dek: '闲钱怎么分、期限怎么配、房贷怎么被利率影响、常见骗局的识别。写给第一次认真管钱的人。',
    },
    chains: {
      eyebrow: '栏目 04 · 产业链图谱',
      title: '从上游到下游，谁在赚钱',
      dek: 'AI 算力链、半导体、新能源车、光伏……每条链拆成环节，环节强弱实时算给你看。',
    },
  };

  function render(view, section) {
    const intro = INTRO[section] || { eyebrow: '', title: '', dek: '' };
    const items = window.Content.bySection(section);
    const cards = items.map((c) => `
      <a class="entry" href="#/${section}/${c.id}">
        <span>
          <span class="e-t">${esc(c.title)}</span>
          <span class="e-d">${esc(c.dek || '')}</span>
          ${c.tags && c.tags.length ? `<span class="e-tags">${c.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>` : ''}
        </span>
        <span class="e-m">${c.readMinutes ? c.readMinutes + ' min' : ''}</span>
      </a>`).join('');

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">${esc(intro.eyebrow)}</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">${esc(intro.title)}</h1>
        <p class="art-dek">${esc(intro.dek)}</p>
      </div>
      <div class="entries">${cards || '<div class="empty"><div class="et">这一栏还在写</div><div class="ed">内容正在补充中。</div></div>'}</div>`;
  }

  window.ListView = { render, INTRO };
})();
