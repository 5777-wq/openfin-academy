/* components/replay-player.js —— 危机回放器（签名交互）
   多资产同步时间轴 + 事件标注 + 可拖动游标。
   数据来自 data/history/crisis-*.json（真实采集，非模拟）。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  let pkg = null, dates = [], idx = 0, playing = null, host = null, rafId = null;

  /** 折线 → SVG path（viewBox 0 0 100 30） */
  function sparkPath(values) {
    const vals = values.filter((v) => v !== null && v !== undefined);
    if (vals.length < 2) return '';
    let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;
    const n = values.length;
    let d = '', started = false;
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v === null || v === undefined) continue;
      const x = (i / (n - 1)) * 100;
      const y = 28 - ((v - min) / (max - min)) * 26;
      d += (started ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
      started = true;
    }
    return { d, min, max };
  }

  function aligned(series) {
    return dates.map((d) => {
      let v = null;
      for (let i = 0; i < series.points.length; i++) {
        if (series.points[i].t <= d) v = series.points[i].v; else break;
      }
      return v;
    });
  }

  /** 渲染整块回放器 */
  function render(container, data) {
    if (!container) return;
    pkg = data;
    dates = (data.dates || []).slice();
    if (!dates.length) {
      container.innerHTML = `<div class="empty"><div class="et">这个回放包还没有数据</div>
        <div class="ed">历史序列需要先跑一次采集脚本（_scripts/collect-history.mjs）。</div></div>`;
      return;
    }
    idx = 0;
    host = container;
    container.innerHTML = `
      <div class="replay">
        <div class="replay-head">
          <button class="rp-btn" id="rp-play" aria-label="播放">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <span class="rp-title">${esc(data.title || '危机回放')}</span>
          <span class="tag">${esc(data.freq === 'D' ? '日频' : '月频')}</span>
          <span class="rp-date" id="rp-date">—</span>
        </div>
        <div class="replay-body">
          <div id="rp-rows"></div>
          <div class="rp-scrub">
            <input type="range" id="rp-range" min="0" max="${dates.length - 1}" value="0" step="1" aria-label="时间轴">
            <div class="rp-marks" id="rp-marks"></div>
          </div>
          <div class="rp-note" id="rp-note"></div>
        </div>
        <div class="rp-events" id="rp-events"></div>
      </div>`;

    drawRows();
    drawMarks();
    drawEvents();
    setIdx(0);

    const range = document.getElementById('rp-range');
    range.addEventListener('input', (e) => { stop(); setIdx(Number(e.target.value)); });

    const play = document.getElementById('rp-play');
    play.addEventListener('click', () => { playing ? stop() : start(); });
  }

  function drawRows() {
    const box = document.getElementById('rp-rows');
    if (!box) return;
    box.innerHTML = pkg.series.map((s) => {
      const vals = aligned(s);
      const sp = sparkPath(vals);
      return `<div class="rp-track" data-key="${esc(s.key)}">
        <span class="rt-k">${esc(s.name)}</span>
        <svg class="rt-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id="clip-${esc(s.key)}"><rect id="cliprect-${esc(s.key)}" x="0" y="0" width="0" height="30"/></clipPath></defs>
          <path d="${sp.d}" fill="none" stroke="var(--ink-4)" stroke-width="1" vector-effect="non-scaling-stroke"/>
          <path d="${sp.d}" fill="none" stroke="var(--teal)" stroke-width="1.4" vector-effect="non-scaling-stroke"
                clip-path="url(#clip-${esc(s.key)})"/>
          <line x1="0" y1="0" x2="0" y2="30" stroke="var(--gold)" stroke-width="1" vector-effect="non-scaling-stroke" id="cur-${esc(s.key)}" opacity="0"/>
          <circle r="1.8" fill="var(--gold)" id="dot-${esc(s.key)}" opacity="0"/>
        </svg>
        <span class="rt-v" id="val-${esc(s.key)}">--</span>
      </div>`;
    }).join('');
  }

  function drawMarks() {
    const box = document.getElementById('rp-marks');
    if (!box || !pkg.events) return;
    const first = dates[0], last = dates[dates.length - 1];
    const span = Math.max(1, daysBetween(first, last));
    box.innerHTML = pkg.events.map((ev, i) => {
      const p = (daysBetween(first, ev.t) / span) * 100;
      if (p < 0 || p > 100) return '';
      return `<button class="rp-mark" data-i="${i}" style="left:${p.toFixed(2)}%">
        <i></i><span>${esc(ev.t.slice(0, 7))}</span></button>`;
    }).join('');
    box.querySelectorAll('.rp-mark').forEach((b) => {
      b.addEventListener('click', () => {
        const ev = pkg.events[Number(b.dataset.i)];
        jumpTo(ev.t);
      });
    });
  }

  function drawEvents() {
    const box = document.getElementById('rp-events');
    if (!box || !pkg.events) return;
    box.innerHTML = pkg.events.map((ev, i) => `
      <button class="rp-event" data-i="${i}">
        <span class="re-d">${esc(ev.t)}</span>
        <span class="re-t">${esc(ev.title)}</span>
      </button>`).join('');
    box.querySelectorAll('.rp-event').forEach((b) => {
      b.addEventListener('click', () => {
        const ev = pkg.events[Number(b.dataset.i)];
        jumpTo(ev.t);
      });
    });
  }

  function daysBetween(a, b) {
    const d1 = new Date(a + 'T00:00:00Z').getTime();
    const d2 = new Date(b + 'T00:00:00Z').getTime();
    return Math.round((d2 - d1) / 86400000);
  }

  /** 跳到最接近的日期索引 */
  function jumpTo(t) {
    let best = 0, bd = Infinity;
    dates.forEach((d, i) => {
      const dd = Math.abs(daysBetween(d, t));
      if (dd < bd) { bd = dd; best = i; }
    });
    stop();
    setIdx(best);
    const range = document.getElementById('rp-range');
    if (range) range.value = String(best);
  }

  function setIdx(i) {
    if (!dates.length) return;
    idx = Math.max(0, Math.min(dates.length - 1, i));
    const d = dates[idx];
    const f = F();

    const dateEl = document.getElementById('rp-date');
    if (dateEl) dateEl.textContent = d;

    pkg.series.forEach((s) => {
      const vals = aligned(s);
      const v = vals[idx];
      const start = vals[0];
      const el = document.getElementById('val-' + s.key);
      if (el) {
        const chg = (v !== null && start) ? ((v / start - 1) * 100) : null;
        el.innerHTML = `${f.num(v, s.digits)}<span class="d ${f.dir(chg)}">${chg === null ? '--' : f.pct(chg)}</span>`;
      }
      // 游标
      const x = (idx / (dates.length - 1)) * 100;
      const cur = document.getElementById('cur-' + s.key);
      const dot = document.getElementById('dot-' + s.key);
      if (cur) { cur.setAttribute('x1', x); cur.setAttribute('x2', x); cur.setAttribute('opacity', '1'); }
      if (dot) {
        const sp = sparkPath(vals);
        if (sp && v !== null) {
          const y = 28 - ((v - sp.min) / (sp.max - sp.min)) * 26;
          dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('opacity', '1');
        }
      }
      // 已走过部分高亮：用 clipPath 裁剪，比 dash 更稳
      const clip = document.getElementById('cliprect-' + s.key);
      if (clip) clip.setAttribute('width', x.toFixed(3));
    });

    // 事件高亮 + 说明
    const evBox = document.getElementById('rp-events');
    if (evBox && pkg.events) {
      evBox.querySelectorAll('.rp-event').forEach((b, i) => {
        const ev = pkg.events[i];
        const near = Math.abs(daysBetween(ev.t, d)) <= 20;
        b.classList.toggle('on', near);
      });
    }

    const note = document.getElementById('rp-note');
    if (note) {
      let hit = null, bestD = Infinity;
      (pkg.events || []).forEach((ev) => {
        const dd = Math.abs(daysBetween(ev.t, d));
        if (dd < bestD) { bestD = dd; hit = ev; }
      });
      if (hit && bestD <= 31) {
        note.innerHTML = `<b>${esc(hit.t)} · ${esc(hit.title)}</b>${hit.note ? ' —— ' + esc(hit.note) : ''}`;
      } else if (pkg.readings && pkg.readings[d]) {
        note.innerHTML = esc(pkg.readings[d]);
      } else {
        note.innerHTML = `<span class="muted">把滑块拖到 2008-09 附近，看看雷曼倒闭那天各资产的反应。</span>`;
      }
    }
  }

  function start() {
    stop();
    const btn = document.getElementById('rp-play');
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    playing = setInterval(() => {
      if (idx >= dates.length - 1) { stop(); return; }
      setIdx(idx + 1);
      const range = document.getElementById('rp-range');
      if (range) range.value = String(idx);
    }, 420);
  }

  function stop() {
    if (playing) { clearInterval(playing); playing = null; }
    const btn = document.getElementById('rp-play');
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }

  function step(delta) {
    if (!dates.length) return;
    stop();
    setIdx(idx + delta);
    const range = document.getElementById('rp-range');
    if (range) range.value = String(idx);
  }

  /** 全局键盘：←/→ 步进（仅当页面内有回放器且焦点不在输入框） */
  function onKey(e) {
    if (!pkg || !host) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  }

  window.ReplayPlayer = { render, jumpTo, step, onKey, stop, get index() { return idx; } };
})();
