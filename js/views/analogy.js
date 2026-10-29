/* views/analogy.js —— 六维历史对照仪（#/analogy）
   把 2000 年互联网泡沫和本轮 AI 周期放在同一组轴上逐项比较。
   ⚠ 分数是编辑判断，不是行情数据；相似度是算术结果，不是概率，更不是预测。
   页面必须把这句话写在读者看得见的地方。
*/
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const CSS_ID = 'analogy-view-css';

  // 2000 年基准：编辑判断，依据是 content/cycles/2000-dotcom.md 的逐维表
  const BASE_2000 = { valuation: 85, liquidity: 60, narrative: 95, profit: 35, breadth: 25, structure: 55 };
  // 本轮 AI 默认：同样来自正文判断，可在页面上调
  const DEFAULT_NOW = { valuation: 70, liquidity: 55, narrative: 90, profit: 55, breadth: 35, structure: 65 };
  const ORDER = ['valuation', 'liquidity', 'narrative', 'profit', 'breadth', 'structure'];

  function ensureCss() {
    try {
      if (document.getElementById(CSS_ID)) return;
      const st = document.createElement('style');
      st.id = CSS_ID;
      st.textContent = ''
        + '.ana-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.9fr);gap:var(--s-5);align-items:start;}'
        + '@media (max-width:860px){.ana-grid{grid-template-columns:1fr;}}'
        + '.ana-dim{padding:var(--s-3) 0;border-top:1px solid var(--rule-2);}'
        + '.ana-dim:first-child{border-top:0;padding-top:0;}'
        + '.ana-dim-head{display:flex;align-items:baseline;gap:var(--s-2);flex-wrap:wrap;}'
        + '.ana-dim-name{font-size:var(--t-small);color:var(--ink);font-weight:600;}'
        + '.ana-dim-hint{font-size:var(--t-micro);color:var(--ink-3);}'
        + '.ana-row{display:grid;grid-template-columns:52px 1fr 40px;gap:var(--s-2);align-items:center;margin-top:7px;}'
        + '.ana-row span{font-family:var(--font-mono);font-size:10px;color:var(--ink-4);}'
        + '.ana-bar{height:7px;border-radius:4px;background:var(--rule-2);overflow:hidden;}'
        + '.ana-bar i{display:block;height:100%;border-radius:4px;}'
        + '.ana-bar.base i{background:var(--ink-4);}'
        + '.ana-bar.now i{background:var(--teal);}'
        + '.ana-row output{font-family:var(--font-mono);font-size:11px;color:var(--ink-2);text-align:right;}'
        + '.ana-slider{width:100%;margin-top:6px;accent-color:var(--teal);}'
        + '.ana-score{font-family:var(--font-mono);font-size:52px;line-height:1;color:var(--gold-text);letter-spacing:-.03em;}'
        + '.ana-score small{font-size:14px;color:var(--ink-3);letter-spacing:0;}'
        + '.ana-card{padding:var(--s-5);background:var(--sheet);border:1px solid var(--rule);border-radius:var(--r-2);}'
        + '.ana-list{margin:var(--s-3) 0 0;padding-left:1.1em;font-size:var(--t-small);line-height:1.9;color:var(--ink-2);}'
        + '.ana-pill{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:10px;background:var(--gold-soft);color:var(--gold-text);font-family:var(--font-mono);font-size:10.5px;}'
        + '.ana-caveat{margin:0 0 var(--s-5);padding:var(--s-3) var(--s-4);border-left:2px solid var(--gold);background:var(--gold-soft);font-size:var(--t-small);line-height:1.8;color:var(--ink-2);}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* 样式增强 */ }
  }

  function parseV(q) {
    const out = Object.assign({}, DEFAULT_NOW);
    const raw = String((q && q.v) || '').split(',').map((x) => Number(x));
    if (raw.length === ORDER.length && raw.every((n) => isFinite(n))) {
      ORDER.forEach((k, i) => { out[k] = Math.max(0, Math.min(100, Math.round(raw[i]))); });
    }
    return out;
  }

  function resultHtml(now) {
    const A = window.Engine && window.Engine.analogy;
    if (!A) return '<p class="muted">对照引擎没有加载，刷新页面再试。</p>';
    const cmp = A.compare(now, BASE_2000);
    const diffs = A.differences(cmp);
    const closest = diffs.slice().sort((a, b) => a.diff - b.diff).slice(0, 2);
    const far = diffs.slice().sort((a, b) => b.diff - a.diff).slice(0, 2);
    return '<div class="ana-card">'
      + '<div class="eyebrow">相似度（算术结果）</div>'
      + '<div class="ana-score">' + (cmp.similarity === null ? '--' : cmp.similarity) + ' <small>/ 100</small></div>'
      + '<p class="cmp-hint">六个维度差值的平均数换算而来。分数高只说明「和 2000 年的编辑打分更像」，不代表风险高、更不代表会重演。</p>'
      + '<div class="eyebrow" style="margin-top:var(--s-4)">最像的两项</div>'
      + '<ul class="ana-list">' + closest.map((d) => '<li><strong>' + esc(d.label) + '</strong>：差 ' + d.diff + ' 分，' + esc(d.verdict) + '</li>').join('') + '</ul>'
      + '<div class="eyebrow" style="margin-top:var(--s-4)">最不像的两项</div>'
      + '<ul class="ana-list">' + far.map((d) => '<li><strong>' + esc(d.label) + '</strong>：差 ' + d.diff + ' 分，' + esc(d.verdict) + '</li>').join('') + '</ul>'
      + '<div class="eyebrow" style="margin-top:var(--s-4)">逐维对照</div>'
      + '<ul class="ana-list">' + cmp.rows.map((r) => '<li>' + esc(r.dim.label) + '：2000 年 ' + (r.b === null ? '--' : r.b) + ' / 本轮 ' + (r.a === null ? '--' : r.a) + ' <span class="ana-pill">' + esc(r.verdict) + '</span></li>').join('') + '</ul>'
      + '</div>';
  }

  function render(view, query) {
    ensureCss();
    const A = window.Engine && window.Engine.analogy;
    if (!A) {
      view.innerHTML = '<div class="empty"><div class="et">对照引擎没有加载</div><div class="ed">刷新一次页面再试。</div></div>';
      return;
    }
    const now = parseV(query);
    const dims = A.DIMENSIONS;

    const dimHtml = dims.map((d) => {
      const key = d.key;
      const val = now[key];
      const base = BASE_2000[key];
      return '<div class="ana-dim" data-dim="' + key + '">'
        + '<div class="ana-dim-head"><span class="ana-dim-name">' + esc(d.label) + '</span><span class="ana-dim-hint">' + esc(d.hint) + '</span></div>'
        + '<div class="ana-row"><span>2000</span><span class="ana-bar base"><i style="width:' + base + '%"></i></span><output>' + base + '</output></div>'
        + '<div class="ana-row"><span>本轮</span><span class="ana-bar now"><i style="width:' + val + '%"></i></span><output id="ana-out-' + key + '">' + val + '</output></div>'
        + '<label class="sr-only" for="ana-' + key + '">' + esc(d.label) + '本轮打分</label>'
        + '<input class="ana-slider" id="ana-' + key + '" type="range" min="0" max="100" step="5" value="' + val + '" aria-valuetext="' + val + ' 分">'
        + '</div>';
    }).join('');

    view.innerHTML = '<div class="art-head">'
      + '<div class="eyebrow">工具箱 · 周期对照</div>'
      + '<h1 style="font-size:var(--t-h1);margin-bottom:var(--s-2)">本轮 AI 周期，像 2000 年吗？</h1>'
      + '<p class="art-dek">六个维度逐项对照。分数是编辑判断，不是行情指标；相似度是算术结果，不是预测。</p>'
      + '</div>'
      + '<p class="ana-caveat"><strong>这是算术，不是预测。</strong>分数由编辑根据公开事实打分，可以自己拖动查看结论怎么变。它不告诉你「接下来会怎样」，也不构成任何建议。</p>'
      + '<div class="ana-grid"><section class="panel" aria-label="六维打分">' + dimHtml + '</section><div id="ana-result">' + resultHtml(now) + '</div></div>'
      + ((window.Site && window.Site.disclaimer) ? window.Site.disclaimer.GENERIC : '');

    const result = view.querySelector('#ana-result');
    let timer = null;
    function sync() {
      const v = {};
      dims.forEach((d) => {
        const el = view.querySelector('#ana-' + d.key);
        v[d.key] = el ? Number(el.value) : now[d.key];
        const out = view.querySelector('#ana-out-' + d.key);
        if (out) out.textContent = String(v[d.key]);
        if (el) el.setAttribute('aria-valuetext', v[d.key] + ' 分');
      });
      if (result) result.innerHTML = resultHtml(v);
    }
    dims.forEach((d) => {
      const el = view.querySelector('#ana-' + d.key);
      if (!el) return;
      el.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(sync, 30);
      });
    });
  }

  window.AnalogyView = { render, BASE_2000, DEFAULT_NOW };
})();
