/* views/path.js —— 新手路径：8 课，把基础打完 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);

  function render(view) {
    const plan = window.Content.pathPlan();
    if (!plan || !plan.lessons || !plan.lessons.length) {
      view.innerHTML = `<div class="empty"><div class="et">路径正在编排</div>
        <div class="ed">新手路径是本站的主线之一，内容还在写。</div></div>`;
      return;
    }

    const done = plan.lessons.filter((l) => window.Store.isDone(l.id)).length;
    const pct = Math.round((done / plan.lessons.length) * 100);

    view.innerHTML = `
      <div class="art-head">
        <div class="eyebrow">新手路径 · ${plan.lessons.length} 课 · 约 ${plan.totalMinutes || 0} 分钟</div>
        <h1 style="font-size:var(--t-hero);letter-spacing:-.015em;margin-bottom:var(--s-3)">${esc(plan.title || '从零开始')}</h1>
        <p class="art-dek">${esc(plan.dek || '')}</p>
      </div>

      <div class="panel" style="margin-bottom:var(--s-6)">
        <div style="display:flex;align-items:baseline;gap:var(--s-3);margin-bottom:10px">
          <span class="num" style="font-size:24px;color:var(--gold)">${done}<span class="muted" style="font-size:14px">/${plan.lessons.length}</span></span>
          <span class="small muted">课已完成</span>
          <span class="small muted" style="margin-left:auto">${pct}%</span>
        </div>
        <div class="meter gold"><i style="width:${pct}%"></i></div>
      </div>

      <div class="entries">
        ${plan.lessons.map((l, i) => {
          const ok = window.Store.isDone(l.id);
          return `<div class="entry" style="grid-template-columns:auto 1fr auto;align-items:center">
            <button class="btn ghost sm" data-lesson="${esc(l.id)}" style="width:30px;height:30px;padding:0;justify-content:center;border-radius:50%;${ok ? 'background:var(--down);border-color:var(--down);color:#fff' : ''}">
              ${ok ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>' : '<span class="num" style="font-size:11px">' + (i + 1) + '</span>'}
            </button>
            <span>
              <span class="e-t" style="${ok ? 'color:var(--ink-3)' : ''}">${esc(l.title)}</span>
              <span class="e-d">${esc(l.dek || '')}</span>
            </span>
            <span class="e-m">${l.minutes ? l.minutes + ' min' : ''}</span>
          </div>`;
        }).join('')}
      </div>`;

    view.querySelectorAll('[data-lesson]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-lesson');
        const now = !window.Store.isDone(id);
        window.Store.setDone(id, now);
        render(view);
      });
    });
  }

  window.PathView = { render };
})();
