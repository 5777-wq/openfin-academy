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

    // 收益率类序列：单位是 %。
    // 收益率的「涨跌」不能按百分比算——从 5% 跌到 2% 是跌了 60%（百分比），
    // 但读者要看的是「跌了 3 个百分点」。口径写错，数字就骗人。
    // 回放器早就分开了（js/components/replay-player.js 的 isYield），这里跟它同一把尺子。
    const isRate = String(series.unit || '') === '%';

    return {
      from: first.t,
      to: last.t,
      count: pts.length,
      last: last,
      peak: peak,
      trough: trough,
      isRate: isRate,
      dropPct: (trough.v / peak.v - 1) * 100,   // 峰谷跌幅（负数）
      spreadPp: isRate ? peak.v - trough.v : null,            // 峰谷变动（个百分点）
      chg1y: pct(last, y1),
      chg1yBp: isRate && y1 ? (last.v - y1.v) * 100 : null,    // 近一年变动（基点）
      chg3y: pct(last, y3),
      chgAll: pct(last, first),
      unadj: /未复权/.test(String(series.kind || '')) || /未复权/.test(String(series.source || '')),
    };
  }

  window.Engine = window.Engine || {};
  window.Engine.instrument = { stats, monthsBefore };
})();
