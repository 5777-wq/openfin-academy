/* components/term-drawer.js —— 术语抽屉（签名交互）
   读文章时遇到不懂的词，点一下右侧滑出解释，不离开当前阅读位置。 */
(function () {
  'use strict';

  let el, scrim, titleEl, bodyEl, footEl, lastFocus = null, onOpen = null;
  const esc = (s) => window.Fmt.esc(s);

  function init(opts) {
    el = document.getElementById('drawer');
    scrim = document.getElementById('scrim');
    titleEl = document.getElementById('drawer-title');
    bodyEl = document.getElementById('drawer-body');
    footEl = document.getElementById('drawer-foot');
    onOpen = (opts && opts.onOpen) || null;

    document.getElementById('drawer-close').addEventListener('click', close);
    scrim.addEventListener('click', close);

    // 抽屉关着的时候，它必须彻底退出可聚焦序列：
    // CSS 里是 visibility:hidden，这里再补一个 inert，并摘掉 role="dialog"——
    // 否则读屏会念出一个空的对话框。
    syncA11y();
    // 快捷键面板、站点设置也是直接加 .on 类打开的：用观察器跟着同步，别只盯着 open()
    if (typeof MutationObserver === 'function') {
      try { new MutationObserver(syncA11y).observe(el, { attributes: true, attributeFilter: ['class'] }); }
      catch (e) { /* 观察不了就算了，open()/close() 里也会同步 */ }
    }

    // 事件委托：正文里的术语锚点
    document.addEventListener('click', (e) => {
      const ref = e.target.closest('[data-term]');
      if (!ref) return;
      e.preventDefault();
      open(ref.getAttribute('data-term'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const ref = e.target.closest && e.target.closest('[data-term]');
      if (!ref) return;
      e.preventDefault();
      open(ref.getAttribute('data-term'));
    });
  }

  /** 开合状态 ↔ 无障碍属性：role="dialog" 只在打开时挂，关着就彻底不可聚焦 */
  function syncA11y() {
    if (!el) return;
    if (el.classList.contains('on')) {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.removeAttribute('inert');
    } else {
      el.removeAttribute('role');
      el.removeAttribute('aria-modal');
      el.setAttribute('inert', '');
    }
  }

  function open(termId) {
    if (!el) return;
    const t = window.Content.term(termId);
    lastFocus = document.activeElement;

    if (!t) {
      titleEl.textContent = '术语';
      bodyEl.innerHTML = `<div class="empty">
        <div class="et">这个词还没有收录</div>
        <div class="ed">术语库正在补充中。如果你就是知道答案的人，欢迎提一个 Issue 或 PR 把它写进来。</div>
        <a class="btn ghost sm" href="https://github.com/5777-wq/openfin-academy/issues/new" target="_blank" rel="noopener">去补充这个词 →</a>
      </div>`;
      footEl.innerHTML = '';
    } else {
      titleEl.textContent = t.term || termId;
      bodyEl.innerHTML = window.TermCard.render(t) + (t.links || []).map((l) => `
        <a class="entry" style="display:flex;gap:8px;padding:10px 0;border-bottom:1px solid var(--rule-2);color:var(--teal);font-size:13px" href="${esc(l.href)}">${esc(l.text)} →</a>`).join('');
      footEl.innerHTML = t.source
        ? `<span>出处：${esc(t.source)}</span>`
        : `<span>本站编写的通俗解释</span>`;
    }

    el.classList.add('on');
    scrim.classList.add('on');
    document.body.style.overflow = 'hidden';
    syncA11y();
    const closeBtn = document.getElementById('drawer-close');
    if (closeBtn) closeBtn.focus();
    if (onOpen) onOpen(termId);
  }

  function close() {
    if (!el) return;
    el.classList.remove('on');
    scrim.classList.remove('on');
    document.body.style.overflow = '';
    syncA11y();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* 忽略 */ } }
  }

  function isOpen() { return el && el.classList.contains('on'); }

  window.TermDrawer = { init, open, close, isOpen };
})();
