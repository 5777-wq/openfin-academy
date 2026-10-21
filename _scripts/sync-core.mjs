#!/usr/bin/env node
/* sync-core.mjs —— 从 OpenFinLens 单向同步共享代码到 vendor/
   用法：
     node _scripts/sync-core.mjs                 # 自动找相邻目录
     node _scripts/sync-core.mjs --src <path>   # 指定源目录
     node _scripts/sync-core.mjs --src <git-url> # 从 GitHub 拉
   同步是单向的：OpenFinLens 是上游，本站只读。改 vendor 会在下次同步被覆盖。 */
import { readFile, writeFile, mkdir, copyFile, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'vendor');
const UPSTREAM = 'https://github.com/5777-wq/openfinlens.git';

/** 白名单：只同步纯逻辑层，不带任何 UI */
const FILES = [
  ['js/utils.js',                  'core/utils.js'],
  ['js/data/universe.js',          'core/universe.js'],
  ['js/data/explain.js',           'core/explain.js'],
  ['js/data/industry-chains.js',   'core/industry-chains.js'],
  ['js/engine/types.js',           'core/engine/types.js'],
  ['js/engine/geo.js',             'core/engine/geo.js'],
  ['js/engine/news-engine.js',     'core/engine/news-engine.js'],
  ['js/engine/event-engine.js',    'core/engine/event-engine.js'],
  ['js/engine/impact-engine.js',   'core/engine/impact-engine.js'],
  ['lib/lightweight-charts.standalone.production.js', 'lib/lightweight-charts.standalone.production.js'],
];

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function resolveSource() {
  const given = arg('--src');
  if (given) {
    if (/^https?:\/\//.test(given) || /\.git$/.test(given)) {
      const tmp = path.join(ROOT, '.tmp-upstream');
      await rm(tmp, { recursive: true, force: true });
      console.log(`[sync] 克隆上游 ${given}`);
      await exec('git', ['clone', '--depth', '1', given, tmp]);
      return tmp;
    }
    if (!existsSync(given)) throw new Error(`源目录不存在：${given}`);
    return path.resolve(given);
  }
  // 自动找：相邻目录里带 js/data/industry-chains.js 的那个
  const parent = path.dirname(ROOT);
  const cands = ['global-fin-dashboard', 'openfinlens', 'OpenFinLens'];
  for (const c of cands) {
    const p = path.join(parent, c);
    if (existsSync(path.join(p, 'js/data/industry-chains.js'))) return p;
  }
  if (existsSync(path.join(parent, 'js/data/industry-chains.js'))) return parent;
  throw new Error('找不到上游目录，请用 --src 指定');
}

async function headSha(dir) {
  try {
    const { stdout } = await exec('git', ['-C', dir, 'rev-parse', 'HEAD']);
    return stdout.trim();
  } catch (e) { return 'unknown'; }
}

async function main() {
  const src = await resolveSource();
  const sha = await headSha(src);
  console.log(`[sync] 上游：${src}`);
  console.log(`[sync] commit：${sha}`);

  let copied = 0, skipped = 0;
  for (const [from, to] of FILES) {
    const s = path.join(src, from);
    const d = path.join(VENDOR, to);
    if (!existsSync(s)) { console.warn(`[sync] 跳过（上游无此文件）：${from}`); skipped++; continue; }
    await mkdir(path.dirname(d), { recursive: true });
    await copyFile(s, d);
    copied++;
  }

  // 记录来源
  const head = [
    '# vendor 目录由 _scripts/sync-core.mjs 自动生成，勿手改。',
    `# source: ${src}`,
    `# upstream: ${UPSTREAM}`,
    `# commit: ${sha}`,
    `# synced: ${new Date().toISOString()}`,
    '',
  ].join('\n');
  await writeFile(path.join(VENDOR, 'HEAD'), head, 'utf8');

  console.log(`[sync] 完成：同步 ${copied} 个文件，跳过 ${skipped} 个`);
}

main().catch((e) => { console.error('[sync] 失败：', e.message); process.exit(1); });
