#!/usr/bin/env node
/* build-content.mjs —— content/*.md → data/content/*.json（零依赖）
   frontmatter 支持：key: value、key: [a, b, c]、key: "带引号"
   数组也支持多行 - item 形式。 */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'content');
const OUT = path.join(ROOT, 'data', 'content');

function parseScalar(v) {
  const s = String(v).trim();
  if (!s) return '';
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function parseValue(raw) {
  const v = String(raw).trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((x) => parseScalar(x));
  }
  return parseScalar(v);
}

/** 极简 frontmatter 解析 */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  const lines = m[1].split(/\r?\n/);
  let currentKey = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(parseScalar(item[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2];
    if (val.trim() === '') { meta[key] = []; currentKey = key; }
    else { meta[key] = parseValue(val); currentKey = null; }
  }
  return { meta, body: m[2] };
}

async function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of await readdir(dir)) {
    const p = path.join(dir, name);
    const st = await stat(p);
    if (st.isDirectory()) out.push(...await walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = await walk(SRC);
  const items = [];

  for (const f of files) {
    const raw = await readFile(f, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.id) {
      console.warn(`[build] 跳过（没有 id）：${path.relative(SRC, f)}`);
      continue;
    }
    const id = String(meta.id);
    const payload = Object.assign({}, meta, {
      id,
      section: meta.section || path.basename(path.dirname(f)),
      body: body.trim(),
    });
    await writeFile(path.join(OUT, id + '.json'), JSON.stringify(payload, null, 2), 'utf8');
    items.push({
      id,
      section: payload.section,
      title: meta.title || id,
      dek: meta.dek || '',
      tag: meta.tag || '',
      tags: meta.tags || [],
      readMinutes: meta.readMinutes || null,
      dataAsOf: meta.dataAsOf || null,
      difficulty: meta.difficulty || null,
      updatedAt: meta.updatedAt || null,
      file: path.relative(SRC, f).replace(/\\/g, '/'),
    });
    console.log(`[build] ${id}  ← ${path.relative(SRC, f)}`);
  }

  items.sort((a, b) => (a.section || '').localeCompare(b.section || '') || String(a.id).localeCompare(String(b.id)));
  // 产物必须确定性：不能带时间戳，否则 CI 的一致性校验每次都会误报
  await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ items }, null, 2), 'utf8');

  // 元数据目录里的 JSON 直接复制（术语库 / 新手路径）
  const metaDir = path.join(SRC, '_meta');
  if (existsSync(metaDir)) {
    for (const name of await readdir(metaDir)) {
      if (!name.endsWith('.json')) continue;
      const from = path.join(metaDir, name);
      const raw = await readFile(from, 'utf8');
      try {
        JSON.parse(raw);
      } catch (e) {
        const m = /position (\d+)/.exec(e.message);
        let where = '';
        if (m) {
          const lines = raw.slice(0, Number(m[1])).split(/\r?\n/);
          where = `（${name} 第 ${lines.length} 行附近）`;
        }
        throw new Error(`${name}${where} 不是合法 JSON：${e.message}\n`
          + '  提示：JSON 字符串里如果要引号，请用中文引号「」或""，不要用直引号 " "。');
      }
      await copyJson(from, path.join(OUT, name));
      console.log(`[build] ${name}（元数据）`);
    }
  }

  console.log(`[build] 完成：${items.length} 篇文章 → data/content/`);
}

async function copyJson(from, to) {
  const j = JSON.parse(await readFile(from, 'utf8'));
  await writeFile(to, JSON.stringify(j, null, 2), 'utf8');
}

main().catch((e) => { console.error('[build] 失败：', e.message); process.exit(1); });
