/* components/replay-player.js —— 危机回放器（签名交互）
   多资产同步时间轴 + 事件标注 + 可拖动游标。
   数据来自 data/history/crisis-*.json（真实采集，非模拟）。

   视觉契约（v2）：纵向必须「看得出跌了多少」
   —— 轨道加高，线不再挤成一条缝；
   —— 以「区间起点」为基准线，线上方填涨色、下方填跌色（红涨绿跌），
      面积大小直接等于涨跌多少；
   —— 峰值画金圈，从峰值到游标拉一条金色回撤段，那根斜线就是跌幅；
   —— 右栏三行：现价 / 相对起点 / 距峰值。
   收益率类序列一律用「个百分点」，价格类用「%」，两者不混用。 */
(function () {
  'use strict';

  const esc = (s) => window.Fmt.esc(s);
  const F = () => window.Fmt;

  // SVG 用户坐标系：0..100 见方，preserveAspectRatio="none" 拉满容器
  const VW = 100, VH = 100, VPAD = 5;

  let pkg = null, dates = [], idx = 0, playing = null, host = null;
  let pinned = null;   // 用户点选的事件：它的说明优先显示（游标离开 ±20 天后自动失效）
  let geoms = [];     // 每条序列的对齐值 + 画图几何（render 时算一次，setIdx 直接复用）
  let ro = null;      // 刻度标签避让用的观察器：离开页面必须断开，否则一直挂着

  /** 收益率类序列：单位是 %，变化用「百分点」而不是「百分比」 */
  const YIELD_RE = /^(US2Y|US3M|US5Y|US7Y|US10Y|US20Y|US30Y)$/;
  function isYield(s) { return s.unit === '%' || YIELD_RE.test(s.key); }

  /** 对齐到统一日期轴：每个日期取「当日或之前最近的一个值」；序列起点之前留空 */
  function align(points, axis) {
    const out = new Array(axis.length).fill(null);
    let j = 0, cur = null;
    for (let i = 0; i < axis.length; i++) {
      while (j < points.length && points[j].t <= axis[i]) { cur = points[j].v; j++; }
      out[i] = cur;
    }
    return out;
  }

  /**
   * 算一条序列的画图几何。
   * 纵轴按本序列自己的最高/最低铺满整行——这样各行之间可以直接比"跌了多少"。
   */
  function geomOf(vals) {
    const pts = [];
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v === null || v === undefined) continue;
      pts.push({ i, v });
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (pts.length < 2) return null;
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.08;
    min -= pad; max += pad;

    const n = vals.length;
    const X = (i) => (i / (n - 1)) * VW;
    const Y = (v) => VPAD + (1 - (v - min) / (max - min)) * (VH - VPAD * 2);

    let d = '';
    for (const p of pts) d += (d ? 'L' : 'M') + X(p.i).toFixed(2) + ' ' + Y(p.v).toFixed(2);

    const first = pts[0], last = pts[pts.length - 1];
    const baseY = Y(first.v);
    const areaD = d
      + 'L' + X(last.i).toFixed(2) + ' ' + baseY.toFixed(2)
      + 'L' + X(first.i).toFixed(2) + ' ' + baseY.toFixed(2) + 'Z';

    let peak = pts[0], trough = pts[0];
    for (const p of pts) {
      if (p.v > peak.v) peak = p;
      if (p.v < trough.v) trough = p;
    }

    return {
      vals, min, max, d, areaD, baseY, first, last, peak, trough, X, Y,
      peakX: X(peak.i), peakY: Y(peak.v),
      troughX: X(trough.i), troughY: Y(trough.v),
      baseX1: X(first.i), baseX2: X(last.i),
    };
  }

  /** 渲染整块回放器 */
  function render(container, data) {
    if (!container) return;
    stop();                       // 换包之前先把上一个实例彻底拆掉
    pkg = data;
    dates = (data.dates || []).slice();
    if (!dates.length) {
      container.innerHTML = `<div class="empty"><div class="et">这个回放包还没有数据</div>
        <div class="ed">历史序列需要先跑一次采集脚本（_scripts/collect-history.mjs）。</div></div>`;
      return;
    }
    idx = 0;
    host = container;
    geoms = (data.series || []).map((s) => geomOf(align(s.points, dates)));

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
          <div class="rp-legend">
            <span><i class="lg lg-base"></i>区间起点基准线</span>
            <span><i class="lg lg-peak"></i>峰值</span>
            <span><i class="lg lg-dd"></i>峰值到此刻的回撤</span>
            <span class="rp-legend-hint">右栏：现价 · 较起点 · 距峰值</span>
          </div>
          <p class="rp-hint">纵轴按每条序列自己的最高、最低铺满整行——行与行之间可以直接比跌幅。金圈是本区间内的最高点；「距峰值」＝现在离那个最高点还差多少。</p>
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
    range.addEventListener('input', (e) => { pause(); setIdx(Number(e.target.value)); });

    const play = document.getElementById('rp-play');
    play.addEventListener('click', () => { playing ? pause() : start(); });
  }

  function drawRows() {
    const box = document.getElementById('rp-rows');
    if (!box) return;
    const f = F();
    box.innerHTML = pkg.series.map((s, si) => {
      const g = geoms[si];
      if (!g) {
        return `<div class="rp-track rp-track-empty" data-key="${esc(s.key)}">
          <span class="rt-k">${esc(s.name)}</span><span class="rt-chart"></span>
          <span class="rt-v">--</span></div>`;
      }
      const yld = isYield(s);
      const tip = [
        '峰值 ' + f.num(g.peak.v, s.digits) + '（' + g.peak.t + '）',
        '谷值 ' + f.num(g.trough.v, s.digits) + '（' + g.trough.t + '）',
        '峰谷 ' + (yld
          ? (g.trough.v - g.peak.v).toFixed(2) + ' 个百分点'
          : f.pct((g.trough.v / g.peak.v - 1) * 100, 1)),
      ].join(' · ');

      return `<div class="rp-track" data-key="${esc(s.key)}" title="${esc(tip)}">
        <span class="rt-k">${esc(s.name)}${s.unit ? `<span class="rt-ku">${esc(s.unit)}</span>` : ''}</span>
        <span class="rt-chart">
          <svg class="rt-spark" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id="clip-${esc(s.key)}"><rect id="cliprect-${esc(s.key)}" x="0" y="0" width="0" height="${VH}"/></clipPath>
              <clipPath id="clipup-${esc(s.key)}"><rect x="0" y="0" width="${VW}" height="${g.baseY.toFixed(2)}"/></clipPath>
              <clipPath id="clipdn-${esc(s.key)}"><rect x="0" y="${g.baseY.toFixed(2)}" width="${VW}" height="${(VH - g.baseY).toFixed(2)}"/></clipPath>
            </defs>
            <path class="rt-area" d="${g.areaD}" fill="var(--fill-up)" clip-path="url(#clipup-${esc(s.key)})"/>
            <path class="rt-area" d="${g.areaD}" fill="var(--fill-down)" clip-path="url(#clipdn-${esc(s.key)})"/>
            <line class="rt-base" x1="${g.baseX1.toFixed(2)}" y1="${g.baseY.toFixed(2)}" x2="${g.baseX2.toFixed(2)}" y2="${g.baseY.toFixed(2)}"/>
            <path class="rt-future" d="${g.d}" fill="none" stroke="var(--ink-4)" stroke-width="1" vector-effect="non-scaling-stroke"/>
            <path class="rt-walked" d="${g.d}" fill="none" stroke="var(--teal)" stroke-width="1.4" vector-effect="non-scaling-stroke" clip-path="url(#clip-${esc(s.key)})"/>
            <path class="rt-dd" id="dd-${esc(s.key)}" d="" fill="none" stroke="var(--gold)" stroke-width="2" vector-effect="non-scaling-stroke" opacity="0"/>
            <line class="rt-cur" id="cur-${esc(s.key)}" x1="0" y1="0" x2="0" y2="${VH}" stroke="var(--gold)" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
          </svg>
          <span class="rt-peak" style="left:${(g.peakX / VW * 100).toFixed(3)}%;top:${(g.peakY / VH * 100).toFixed(3)}%"></span>
          <span class="rt-trough" style="left:${(g.troughX / VW * 100).toFixed(3)}%;top:${(g.troughY / VH * 100).toFixed(3)}%"></span>
          <span class="rt-now" id="now-${esc(s.key)}" style="left:0%;top:0%"></span>
        </span>
        <span class="rt-v" id="val-${esc(s.key)}" title="现价 · 较区间起点的涨跌 · 距区间内最高点的回撤">--</span>
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
      return `<button class="rp-mark" data-i="${i}" style="left:${p.toFixed(2)}%"
        title="${esc(ev.t + ' ' + ev.title)}"><i></i><span>${esc(ev.t.slice(0, 7))}</span></button>`;
    }).join('');
    box.querySelectorAll('.rp-mark').forEach((b) => {
      b.addEventListener('click', () => {
        const ev = pkg.events[Number(b.dataset.i)];
        jumpTo(ev.t);
      });
    });
    scheduleMarkLayout(box);
  }

  /**
   * 事件标签避让：事件挨得近时月份会叠字。
   * 先量出每个标签的真实像素位置，再把和前一个保留标签打架的藏起来——刻度线本身留着，
   * 标签只是次要信息，悬停仍有完整日期。
   */
  function layoutMarks(box) {
    if (!box) return;
    const items = [];
    box.querySelectorAll('.rp-mark').forEach((m) => {
      const span = m.querySelector('span');
      if (!span) return;
      span.style.visibility = '';
      const r = span.getBoundingClientRect();
      if (!r || !r.width) return;
      items.push({ span, left: r.left, right: r.right });
    });
    let lastRight = -Infinity;
    for (const it of items) {
      if (it.left < lastRight + 8) it.span.style.visibility = 'hidden';
      else lastRight = it.right;
    }
  }

  function scheduleMarkLayout(box) {
    const run = () => {
      // 宿主已经不在页面上了：观察器也别再挂着
      if (!mounted()) {
        if (ro) { try { ro.disconnect(); } catch (e) { /* 忽略 */ } ro = null; }
        return;
      }
      layoutMarks(box);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
    // 宽度变了要重新避让：桌面和手机能排下的标签数完全不同
    if (typeof ResizeObserver === 'function') {
      // 观察器要留着句柄：离开页面时 disconnect，否则它一直盯着已经不在页面上的节点
      try {
        if (ro) ro.disconnect();
        ro = new ResizeObserver(run);
        ro.observe(box);
      } catch (e) { /* 观察不了就算了 */ }
    }
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

  /** 跳到最接近的日期索引；若是点事件，锁定该事件的说明 */
  function jumpTo(t) {
    // 先找最近的事件并锁定：否则点"雷曼"却可能弹出更近的"AIG"说明
    let ev = null, evd = Infinity;
    (pkg.events || []).forEach((e) => {
      const dd = Math.abs(daysBetween(e.t, t));
      if (dd < evd) { evd = dd; ev = e; }
    });
    pinned = ev && evd <= 31 ? ev : null;

    let best = 0, bd = Infinity;
    dates.forEach((d, i) => {
      const dd = Math.abs(daysBetween(d, t));
      if (dd < bd) { bd = dd; best = i; }
    });
    pause();
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

    pkg.series.forEach((s, si) => {
      const g = geoms[si];
      if (!g) return;
      const yld = isYield(s);
      const v = g.vals[idx];
      const start = g.first.v;

      let chg = null, dd = null;
      if (v !== null && v !== undefined) {
        chg = yld ? (v - start) : ((v / start - 1) * 100);
        dd = yld ? (v - g.peak.v) : ((v / g.peak.v - 1) * 100);
      }

      const el = document.getElementById('val-' + s.key);
      if (el) {
        const chgTxt = chg === null ? '--'
          : (yld ? (chg > 0 ? '+' : '') + chg.toFixed(2) + 'pp' : f.pct(chg));
        const ddTxt = dd === null ? '--'
          : (yld ? (dd > 0 ? '+' : '') + dd.toFixed(2) + 'pp' : f.pct(dd));
        el.innerHTML = `<b>${f.num(v, s.digits)}</b>`
          + `<span class="d ${f.dir(chg)}">较起点 ${chgTxt}</span>`
          + `<span class="dd ${f.dir(dd)}">距峰值 ${ddTxt}</span>`;
      }

      const cur = document.getElementById('cur-' + s.key);
      const now = document.getElementById('now-' + s.key);
      const ddEl = document.getElementById('dd-' + s.key);
      const clip = document.getElementById('cliprect-' + s.key);

      if (v === null || v === undefined) {
        if (cur) cur.setAttribute('opacity', '0');
        if (now) now.style.opacity = '0';
        if (ddEl) ddEl.setAttribute('opacity', '0');
        return;
      }

      const x = (idx / (dates.length - 1)) * VW;
      const y = g.Y(v);

      if (cur) {
        cur.setAttribute('x1', x.toFixed(3));
        cur.setAttribute('x2', x.toFixed(3));
        cur.setAttribute('opacity', '1');
      }
      if (now) {
        now.style.left = (x / VW * 100).toFixed(3) + '%';
        now.style.top = (y / VH * 100).toFixed(3) + '%';
        now.style.opacity = '1';
      }
      // 回撤段：峰值 → 游标。那根斜线就是"跌了多少"。
      if (ddEl) {
        if (g.peak.i <= idx && v < g.peak.v) {
          ddEl.setAttribute('d', 'M' + g.peakX.toFixed(2) + ' ' + g.peakY.toFixed(2)
            + 'L' + x.toFixed(2) + ' ' + y.toFixed(2));
          ddEl.setAttribute('opacity', '1');
        } else {
          ddEl.setAttribute('opacity', '0');
        }
      }
      // 已走过部分高亮：用 clipPath 裁剪，比 dash 更稳
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
      // 用户点选的事件优先
      if (pinned) {
        const pd = Math.abs(daysBetween(pinned.t, d));
        if (pd <= 20) { hit = pinned; bestD = pd; }
      }
      if (!hit) {
        (pkg.events || []).forEach((ev) => {
          const dd = Math.abs(daysBetween(ev.t, d));
          if (dd < bestD) { bestD = dd; hit = ev; }
        });
      }
      if (hit && bestD <= 31) {
        note.innerHTML = `<b>${esc(hit.t)} · ${esc(hit.title)}</b>${hit.note ? ' —— ' + esc(hit.note) : ''}`;
      } else if (pkg.readings && pkg.readings[d]) {
        note.innerHTML = esc(pkg.readings[d]);
      } else {
        const ev0 = (pkg.events || [])[0];
        note.innerHTML = ev0
          ? `<span class="muted">把滑块拖到 ${esc(ev0.t)} 附近，看看「${esc(ev0.title)}」那天各资产的反应。</span>`
          : '<span class="muted">拖动滑块，看各资产在同一时刻的反应。</span>';
      }
    }
  }

  function start() {
    pause();
    const btn = document.getElementById('rp-play');
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    playing = setInterval(() => {
      // 页面已经换走了（宿主脱离文档）：别再空转，把定时器拆掉
      if (!mounted()) { stop(); return; }
      if (idx >= dates.length - 1) { pause(); return; }
      setIdx(idx + 1);
      const range = document.getElementById('rp-range');
      if (range) range.value = String(idx);
    }, 420);
  }

  /** 只停自动播放：包还在，滑块还能拖 */
  function pause() {
    if (playing) { clearInterval(playing); playing = null; }
    const btn = document.getElementById('rp-play');
    if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }

  /** 彻底停掉：定时器、观察器、宿主引用全清。
      离开危机页必须调用——不然 pkg/host 一直挂着，
      全局方向键会在别的页面继续 preventDefault，把默认行为吞掉。 */
  function stop() {
    pause();
    if (ro) { try { ro.disconnect(); } catch (e) { /* 忽略 */ } ro = null; }
    pkg = null; dates = []; idx = 0; host = null; geoms = []; pinned = null;
  }

  /** 回放器是否还「在页面上」：
      路由把视图整块换掉之后，宿主元素已经脱离文档，这时不算还挂着。 */
  function mounted() {
    if (!pkg || !host) return false;
    if (typeof host.isConnected === 'boolean' && !host.isConnected) return false;
    return true;
  }

  /** 页面上还有没有回放器（全局方向键用它来守卫） */
  function isActive() { return mounted(); }

  function step(delta) {
    if (!dates.length) return;
    pause();
    setIdx(idx + delta);
    const range = document.getElementById('rp-range');
    if (range) range.value = String(idx);
  }

  /** 全局键盘：←/→ 步进（仅当页面内有回放器且焦点不在输入框） */
  function onKey(e) {
    if (!mounted()) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  }

  window.ReplayPlayer = {
    render, jumpTo, step, onKey, pause, stop, reset: stop, isActive,
    get index() { return idx; },
  };
})();
