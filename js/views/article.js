/* views/article.js —— 通用文章阅读器
   适用：货币与利率 / 标的百科 / 周期镜鉴 / 家庭理财 的详情页 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  function render(view, section, id) {
    const art = window.Content.article(id);
    if (!art) {
      view.innerHTML = `<div class="empty"><div class="et">没找到这篇文章</div>
        <div class="ed">它可能还没写，或者链接变了。</div>
        <a class="btn ghost sm" href="#/">回首页</a></div>`;
      return;
    }

    const glossary = window.Content.glossary();
    let html = F().md(art.body || '');
    html = window.TermCard.markTerms(html, glossary);

    // 编译产物是扁平结构（{ id, title, dek, body, ... }）；保留对嵌套 meta 的兼容
    const m = art.meta || art;
    // related 里混着两种 id：文章 id 与术语 id。
    // 只查文章索引的话，术语型 related 会整块查不到——页面上「接着读」直接消失，还一声不响。
    // 所以先查文章，再查术语库，两边都没有才丢掉。
    const related = (m.related || [])
      .map((rid) => {
        const id = String(rid);
        const a = window.Content.meta(id);
        if (a) {
          return {
            href: `#/${a.section}/${a.id}`, title: a.title || id,
            dek: a.dek || '', min: a.readMinutes || null,
          };
        }
        const t = window.Content.term(id);
        if (t) {
          return {
            href: `#/term/${encodeURIComponent(id)}`, title: t.term || id,
            dek: t.one || '', min: null,
          };
        }
        return null;
      })
      .filter(Boolean);

    view.innerHTML = `
      <article class="art-head">
        <div class="eyebrow">${esc(sectionName(section))} ${m.difficulty ? '· 难度 ' + m.difficulty + '/5' : ''}</div>
        <h1>${esc(m.title || '')}</h1>
        ${m.dek ? `<p class="art-dek">${esc(m.dek)}</p>` : ''}
        <div class="art-meta">
          ${m.readMinutes ? `<span>阅读约 ${m.readMinutes} 分钟</span><span class="msep">·</span>` : ''}
          <span>数据截至 ${esc(m.dataAsOf || '—')}</span>
          ${m.updatedAt ? `<span class="msep">·</span><span>更新于 ${esc(m.updatedAt)}</span>` : ''}
          <span class="msep">·</span>
          <button class="btn ghost sm" id="art-bookmark" style="height:24px;padding:0 8px;margin:-1px 0">${bookmarkLabel(m.id)}</button>
        </div>
      </article>

      <div class="disclaimer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        <span>本文只讲机制和数据，不构成投资建议。数据来自第三方公开接口，有延迟、会出错。</span>
      </div>

      ${(m.points && m.points.length) ? `
        <div class="panel" style="margin-bottom:var(--s-6);background:var(--sheet-2)">
          <div class="eyebrow" style="margin-bottom:10px">本文要点</div>
          <ol style="margin:0;padding-left:1.2em">
            ${m.points.map((p) => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}
          </ol>
        </div>` : ''}

      <div class="prose">${html}</div>

      ${(m.tags && m.tags.length) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--s-6)">
        ${m.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}

      ${related.length ? `
        <section style="margin-top:var(--s-7)">
          <div class="eyebrow">接着读</div>
          <div class="entries">
            ${related.map((c) => `<a class="entry" href="${esc(c.href)}">
              <span><span class="e-t">${esc(c.title)}</span><span class="e-d">${esc(c.dek || '')}</span></span>
              <span class="e-m">${c.min ? c.min + ' min' : ''}</span></a>`).join('')}
          </div>
        </section>` : ''}

      <section class="lens-only" style="margin-top:var(--s-7)">
        <div class="panel" style="display:flex;gap:var(--s-4);align-items:center;flex-wrap:wrap">
          <div style="flex:1 1 240px">
            <div class="eyebrow">想看此刻的行情</div>
            <p class="small muted" style="margin:0">这篇文章讲的是原理。想知道今天的价格和涨跌幅，去 OpenFinLens 看实时行情。</p>
          </div>
          <a class="btn ghost sm" href="https://5777-wq.github.io/openfinlens/" target="_blank" rel="noopener">打开实时看板 ↗</a>
        </div>
      </section>`;

    const bm = document.getElementById('art-bookmark');
    if (bm) {
      bm.addEventListener('click', () => {
        const added = window.Store.toggleBookmark(m.id);
        bm.textContent = added ? '已收藏 ★' : '收藏';
        toast(added ? '已收藏' : '已取消收藏');
      });
    }

    window.Store.pushRecent(m.id);
  }

  function bookmarkLabel(id) {
    return window.Store.isBookmarked(id) ? '已收藏 ★' : '收藏';
  }

  function sectionName(section) {
    return ({
      concepts: '货币与利率', assets: '标的百科', crisis: '危机复盘',
      chains: '产业链图谱', cycles: '周期与镜鉴', family: '家庭理财',
    })[section] || '';
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('on'), 1800);
  }

  window.ArticleView = { render, toast, sectionName };
})();
