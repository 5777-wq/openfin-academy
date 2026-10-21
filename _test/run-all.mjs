#!/usr/bin/env node
/* run-all.mjs —— node 直跑测试（无浏览器、无网络依赖）
   用法：node _test/run-all.mjs */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; failures.push(name + (extra ? '  →  ' + extra : '')); }
}

function eq(name, actual, expected) {
  ok(name, Object.is(actual, expected), `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

function near(name, actual, expected, tol = 1e-6) {
  ok(name, typeof actual === 'number' && Math.abs(actual - expected) <= tol,
    `期望 ≈${expected}，实际 ${actual}`);
}

/* ---------- 在 vm 里加载浏览器侧模块（它们是 window 风格的 IIFE） ---------- */
function loadScripts(files) {
  const sandbox = { window: {}, console, Math, Date, JSON, Map, Set, Number, String, Array, Object };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    const code = readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  }
  return sandbox.window;
}

/* ============================================================
   1. 纯函数引擎层
   ============================================================ */
{
  const W = loadScripts([
    'js/engine/series.js',
    'js/engine/percentile.js',
    'js/engine/drawdown.js',
    'js/engine/spread.js',
    'js/engine/similarity.js',
    'js/engine/analogy.js',
  ]);
  const S = W.Engine.series, P = W.Engine.percentile, D = W.Engine.drawdown;
  const SP = W.Engine.spread, SIM = W.Engine.similarity, AN = W.Engine.analogy;

  // --- series ---
  const pts = [
    { t: '2024-01-31', v: 100 }, { t: '2024-02-29', v: 110 },
    { t: '2024-03-31', v: 90 }, { t: '2024-04-30', v: 120 },
  ];
  eq('series.valueAt 命中精确日期', S.valueAt(pts, '2024-03-31'), 90);
  eq('series.valueAt 取最近的前值（step-hold）', S.valueAt(pts, '2024-03-15'), 110);
  eq('series.valueAt 早于全部数据返回 null', S.valueAt(pts, '2023-01-01'), null);
  eq('series.valueFrom 取最近的后值', S.valueFrom(pts, '2024-03-15'), 90);
  eq('series.slice 区间切片', S.slice(pts, '2024-02-01', '2024-03-31').length, 2);
  eq('series.normalize 起点=100', S.normalize(pts)[0].v, 100);
  near('series.normalize 末点=120%', S.normalize(pts)[3].v, 120, 1e-9);
  near('series.change 区间涨跌', S.change(pts), 20, 1e-9);

  const al = S.align(pts, [{ t: '2024-01-31', v: 1 }, { t: '2024-04-30', v: 2 }]);
  eq('series.align 公共日期数', al.dates.length, 2);
  eq('series.align 保留各自原值', al.a[1], 120);

  // --- percentile ---
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  near('percentile 中位数的分位是 50', P.percentile(vals, 5.5), 50, 1e-9);
  near('percentile 最小值的分位是 10', P.percentile(vals, 1), 10, 1e-9);
  near('percentile 最大值的分位是 100', P.percentile(vals, 10), 100, 1e-9);
  eq('percentile 空数组返回 null', P.percentile([], 5), null);
  eq('percentile.band 极高位', P.band(95).label, '历史极高位');
  eq('percentile.band 极低位', P.band(5).label, '历史极低位');

  // --- drawdown ---
  const ddPts = [
    { t: '1', v: 100 }, { t: '2', v: 120 }, { t: '3', v: 60 }, { t: '4', v: 90 },
  ];
  const md = D.maxDrawdown(ddPts);
  near('drawdown.maxDrawdown = 50%', md.pct, 50, 1e-9);
  eq('drawdown.maxDrawdown 起点', md.from, '2');
  eq('drawdown.maxDrawdown 终点', md.to, '3');
  const ds = D.drawdownSeries(ddPts);
  eq('drawdown.drawdownSeries 峰值处为 0', ds[1].v, 0);
  near('drawdown.drawdownSeries 谷底为 -50%', ds[2].v, -50, 1e-9);

  // --- spread ---
  const curve = [
    { y: 0.25, label: '3月', value: 4.7 }, { y: 2, label: '2年', value: 4.2 },
    { y: 10, label: '10年', value: 4.4 }, { y: 30, label: '30年', value: 4.6 },
  ];
  const sh = SP.curveShape(curve);
  eq('spread.curveShape 识别倒挂', sh.shape, 'inverted');
  ok('spread.curveShape 倒挂时 inverted=true', sh.inverted === true);
  const flatCurve = [{ y: 0.25, value: 4.0 }, { y: 10, value: 4.5 }];
  eq('spread.curveShape 识别正常', SP.curveShape(flatCurve).shape, 'normal');
  const trulyFlat = [{ y: 0.25, value: 4.0 }, { y: 10, value: 4.05 }];
  eq('spread.curveShape 识别平坦（利差<15bp）', SP.curveShape(trulyFlat).shape, 'flat');
  const sp = SP.spread(curve, 10, 2);
  near('spread.spread 10年-2年 = 20bp', sp.bp, 20, 1e-9);
  near('spread.goldOilRatio', SP.goldOilRatio(2000, 50), 40, 1e-9);
  near('spread.realRate', SP.realRate(4, 3), 1, 1e-9);

  // --- similarity ---
  const st = SIM.stats([1, 2, 3, 4, 5]);
  near('similarity.stats mean', st.mean, 3, 1e-9);
  near('similarity.stats std', st.std, Math.sqrt(2), 1e-9);
  eq('similarity.zscore 均值处为 0', SIM.zscore(3, 3, 1.4142), 0);

  // --- analogy ---
  const cmp = AN.compare(
    { valuation: 80, liquidity: 60, narrative: 90, profit: 40, breadth: 30, structure: 50 },
    { valuation: 75, liquidity: 55, narrative: 95, profit: 35, breadth: 25, structure: 70 },
  );
  eq('analogy.compare 用了全部六个维度', cmp.usedDimensions, 6);
  ok('analogy.compare 相似度在 0-100', cmp.similarity >= 0 && cmp.similarity <= 100);
  const diffs = AN.differences(cmp);
  eq('analogy.differences 覆盖全部维度', diffs.length, 6);
  ok('analogy.differences 按差异降序', diffs[0].diff >= diffs[diffs.length - 1].diff);
  const partial = AN.compare({ valuation: 50 }, { valuation: 50 });
  eq('analogy.compare 缺数据时只算已有维度', partial.usedDimensions, 1);
  eq('analogy.compare 缺数据时 similarity 仍有值', partial.similarity, 100);
}

/* ============================================================
   2. 格式化层
   ============================================================ */
{
  const W = loadScripts(['js/site/format.js']);
  const F = W.Fmt;
  eq('fmt.cnDate', F.cnDate('2026-10-21'), '2026年10月21日');
  eq('fmt.cnDateShort', F.cnDateShort('2026-10-21'), '10月21日');
  eq('fmt.cnDateWithWeek', F.cnDateWithWeek('2026-10-21'), '10月21日 周三');
  eq('fmt.num null → --', F.num(null), '--');
  eq('fmt.num 千分位', F.num(12345.678, 2), '12,345.68');
  eq('fmt.pct 正号', F.pct(1.234), '+1.23%');
  eq('fmt.pct 负号', F.pct(-1.234), '-1.23%');
  eq('fmt.dir 上升', F.dir(0.1), 'up');
  eq('fmt.dir 下降', F.dir(-0.1), 'down');
  eq('fmt.dir 持平', F.dir(0), 'flat');
  eq('fmt.esc 转义尖括号', F.esc('<b>'), '&lt;b&gt;');
  ok('fmt.md 生成段落', F.md('第一段\n\n第二段').includes('<p>第二段</p>'));
  ok('fmt.md 生成标题', F.md('## 标题').includes('<h2>标题</h2>'));
  ok('fmt.md 生成列表', F.md('- 甲\n- 乙').includes('<li>甲</li>'));
}

/* ============================================================
   3. 术语卡：正文标记注入
   ============================================================ */
{
  const W = loadScripts(['js/site/format.js', 'js/components/term-card.js']);
  const glossary = { 'risk-free-rate': { term: '无风险利率', one: '尺子' } };
  const marked = W.TermCard.markTerms('参见[[risk-free-rate|无风险利率]]与[[unknown-x]]。', glossary);
  ok('term-card 已知术语渲染成可点锚点', marked.includes('data-term="risk-free-rate"'));
  ok('term-card 显示文本被保留', marked.includes('>无风险利率</span>'));
  ok('term-card 未知术语不注入', !marked.includes('data-term="unknown-x"'));
  const card = W.TermCard.render({ term: 'X', one: '一句话', metaphor: '比喻', number: '数字', pit: '坑' });
  ok('term-card 四段齐全', card.includes('一句话') && card.includes('比喻') && card.includes('数字') && card.includes('坑'));
}

/* ============================================================
   4. 数据契约：注册表与产物必须一致
   ============================================================ */
{
  const mapPath = path.join(ROOT, 'data', 'series-map.json');
  if (existsSync(mapPath)) {
    const map = JSON.parse(await readFile(mapPath, 'utf8'));
    ok('series-map 至少登记 8 条序列', (map.series || []).length >= 8, `实际 ${(map.series || []).length}`);
    for (const s of map.series || []) {
      const p = path.join(ROOT, 'data', 'history', s.id + '.json');
      ok(`series-map 的 ${s.id} 有对应产物文件`, existsSync(p));
      if (existsSync(p)) {
        const j = JSON.parse(await readFile(p, 'utf8'));
        ok(`${s.id} 产物点数与注册表一致`, j.points.length === s.count,
          `产物 ${j.points.length} vs 注册表 ${s.count}`);
        ok(`${s.id} 产物有来源标注`, !!j.source);
        ok(`${s.id} 序列首末日期合法`, /^\d{4}-\d{2}-\d{2}$/.test(j.points[0].t) && /^\d{4}-\d{2}-\d{2}$/.test(j.points[j.points.length - 1].t));
      }
    }
  } else {
    ok('series-map 存在', false, 'data/series-map.json 不存在，先跑 collect-history.mjs');
  }

  // 危机回放包
  const crisisPath = path.join(ROOT, 'data', 'history', 'crisis-2008.json');
  if (existsSync(crisisPath)) {
    const c = JSON.parse(await readFile(crisisPath, 'utf8'));
    ok('crisis-2008 至少 4 条序列', c.series.length >= 4, `实际 ${c.series.length}`);
    ok('crisis-2008 事件标注非空', (c.events || []).length >= 8);
    ok('crisis-2008 每条序列都有数据点', c.series.every((s) => s.points && s.points.length > 0));
    const keys = c.series.map((s) => s.key);
    ok('crisis-2008 含标普500', keys.includes('SPX'));
    ok('crisis-2008 含黄金', keys.includes('GC00Y'));
    ok('crisis-2008 含原油', keys.includes('CL00Y'));
    ok('crisis-2008 含美债10Y', keys.includes('US10Y'));
    ok('crisis-2008 含 VIX', keys.includes('VIX'));
    // 事件日期必须落在时间轴内
    const first = c.dates[0], last = c.dates[c.dates.length - 1];
    ok('crisis-2008 所有事件日期在时间轴范围内',
      c.events.every((e) => e.t >= first.slice(0, 7) && e.t.slice(0, 7) <= last.slice(0, 7)),
      `轴 ${first} → ${last}`);
  }
}

/* ============================================================
   5. 内容契约：索引与正文必须一致
   ============================================================ */
{
  const idxPath = path.join(ROOT, 'data', 'content', 'index.json');
  if (existsSync(idxPath)) {
    const idx = JSON.parse(await readFile(idxPath, 'utf8'));
    ok('内容索引至少 6 篇', (idx.items || []).length >= 6, `实际 ${(idx.items || []).length}`);
    for (const it of idx.items || []) {
      const p = path.join(ROOT, 'data', 'content', it.id + '.json');
      ok(`内容 ${it.id} 有正文产物`, existsSync(p));
      if (existsSync(p)) {
        const a = JSON.parse(await readFile(p, 'utf8'));
        ok(`${it.id} 正文非空`, (a.body || '').length > 200);
        ok(`${it.id} 有 title`, !!a.title);
        ok(`${it.id} 有 dataAsOf`, !!a.dataAsOf);
      }
    }
    // 术语库
    const gPath = path.join(ROOT, 'data', 'content', 'glossary.json');
    if (existsSync(gPath)) {
      const g = JSON.parse(await readFile(gPath, 'utf8'));
      const terms = Object.keys(g.terms || {});
      ok('术语库至少 12 条', terms.length >= 12, `实际 ${terms.length}`);
      for (const [id, t] of Object.entries(g.terms || {})) {
        ok(`术语 ${id} 有 term`, !!t.term);
        ok(`术语 ${id} 有 one`, !!t.one);
        ok(`术语 ${id} 有 pit`, !!t.pit);
      }
      // 正文里引用的术语必须存在
      for (const it of idx.items || []) {
        const a = JSON.parse(await readFile(path.join(ROOT, 'data', 'content', it.id + '.json'), 'utf8'));
        const refs = [...String(a.body || '').matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1]);
        for (const r of refs) {
          ok(`${it.id} 引用的术语「${r}」在术语库中`, !!(g.terms || {})[r]);
        }
      }
    }
  }
}

/* ============================================================
   6. vendor 契约
   ============================================================ */
{
  const headPath = path.join(ROOT, 'vendor', 'HEAD');
  ok('vendor/HEAD 存在', existsSync(headPath));
  if (existsSync(headPath)) {
    const h = await readFile(headPath, 'utf8');
    ok('vendor/HEAD 记录了上游 commit', /# commit: [0-9a-f]{7,}/.test(h), h.slice(0, 120));
  }
  for (const f of ['core/utils.js', 'core/universe.js', 'core/explain.js', 'core/industry-chains.js']) {
    ok(`vendor/${f} 已同步`, existsSync(path.join(ROOT, 'vendor', f)));
  }
}

/* ---------- 汇总 ---------- */
console.log('');
console.log(`通过 ${pass} 条，失败 ${fail} 条`);
if (failures.length) {
  console.log('');
  failures.forEach((f) => console.log('  ✗ ' + f));
}
process.exit(fail ? 1 : 0);
