/* engine/instrument.js —— 标的的历史读数（纯函数，node 可测）
   输入一条月线序列，输出读者真正关心的几个数：现在多少、峰值多少、谷底多少、
   从峰到谷跌了多少、近一年涨跌。
   这些数全部由数据算出，页面里不手写——手写的数字会悄悄过期。 */
(function () {
  'use strict';

  /** 往前推 n 个月的日期键 */
  function monthsBefore(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
  }

  /** 序列 → 关键读数 */
  function stats(series) {
    if (!series || !Array.isArray(series.points) || !series.points.length) return null;
    const pts = series.points;
    const first = pts[0];
    const last = pts[pts.length - 1];

    let peak = first, trough = first;
    for (const p of pts) {
      if (p.v > peak.v) peak = p;
      if (p.v < trough.v) trough = p;
    }

    // 近一年：取「一年前那个月」的点
    const key1y = monthsBefore(last.t, 12);
    let y1 = null;
    for (const p of pts) { if (p.t <= key1y) y1 = p; else break; }

    // 近三年
    const key3y = monthsBefore(last.t, 36);
    let y3 = null;
    for (const p of pts) { if (p.t <= key3y) y3 = p; else break; }

    const pct = (a, b) => (a && b ? (a.v / b.v - 1) * 100 : null);

    return {
      from: first.t,
      to: last.t,
      count: pts.length,
      last: last,
      peak: peak,
      trough: trough,
      dropPct: (trough.v / peak.v - 1) * 100,   // 峰谷跌幅（负数）
      chg1y: pct(last, y1),
      chg3y: pct(last, y3),
      chgAll: pct(last, first),
      unadj: /未复权/.test(String(series.kind || '')) || /未复权/.test(String(series.source || '')),
    };
  }

  window.Engine = window.Engine || {};
  window.Engine.instrument = { stats, monthsBefore };
})();
