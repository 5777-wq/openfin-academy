/* engine/drawdown.js —— 回撤（纯函数） */
(function () {
  'use strict';

  /** 最大回撤（%，正数表示回撤幅度） */
  function maxDrawdown(points) {
    if (!points || points.length < 2) return null;
    let peak = null, worst = 0, at = null, peakAt = null, troughAt = null;
    for (let i = 0; i < points.length; i++) {
      const v = points[i].v;
      if (v === null || v === undefined) continue;
      if (peak === null || v > peak) { peak = v; peakAt = points[i].t; }
      const dd = peak ? ((v / peak) - 1) * 100 : 0;
      if (dd < worst) { worst = dd; at = points[i].t; troughAt = peakAt; }
    }
    return { pct: Math.abs(worst), from: troughAt, to: at };
  }

  /** 逐点回撤序列（% ≤ 0） */
  function drawdownSeries(points) {
    if (!points) return [];
    let peak = null;
    return points.map((p) => {
      const v = p.v;
      if (v === null || v === undefined) return { t: p.t, v: null };
      if (peak === null || v > peak) peak = v;
      return { t: p.t, v: peak ? ((v / peak) - 1) * 100 : 0 };
    });
  }

  /** 修复（recover）所需涨幅：从最低点回到前高需要涨多少 % */
  function recoverNeeded(points) {
    const md = maxDrawdown(points);
    if (!md) return null;
    const last = points[points.length - 1];
    if (!last || !last.v) return null;
    let peak = null;
    points.forEach((p) => { if (p.v != null && (peak === null || p.v > peak)) peak = p.v; });
    if (!peak) return null;
    return ((peak / last.v) - 1) * 100;
  }

  window.Engine = window.Engine || {};
  window.Engine.drawdown = { maxDrawdown, drawdownSeries, recoverNeeded };
})();
