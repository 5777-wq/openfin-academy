#!/usr/bin/env node
/* merge-terms.mjs —— 把纯文本稿合并进术语库
   用法：node _scripts/merge-terms.mjs drafts/batch2.txt [--prune]
   稿子格式（每个词条一段，用 @@ id 开头）：

     @@ pe-ratio
     term: 市盈率
     alias: PE / P/E
     cat: data
     one: 一句话
     metaphor: 比喻
     number: 数字
     pit: 坑
     source: 出处
     sym: sh600519
     link: 读完整的一页 | #/concepts/x

   为什么要走文本稿：几百条词条直接写 JSON 太长，容易在写入时丢引号。
   文本稿里用「」代替直引号，脚本负责转成合法 JSON。 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = path.join(ROOT, 'content', '_meta', 'glossary.json');

/** 直引号 → 中文引号：JSON 字符串里嵌引号时最常见的翻车点 */
function smartQuotes(s) {
  return String(s).replace(/"/g, '「').replace(/"/g, '」');
}

function parseDraft(text) {
  const out = [];
  let cur = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;
    if (line.startsWith('@@ ')) {
      cur = { id: line.slice(3).trim(), _links: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key === 'link') {
      const p = val.lastIndexOf('|');
      if (p < 0) continue;
      cur._links.push({ text: val.slice(0, p).trim(), href: val.slice(p + 1).trim() });
      continue;
    }
    cur[key] = val;
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const prune = args.includes('--prune');
  if (!files.length) {
    console.error('用法：node _scripts/merge-terms.mjs <draft.txt> [...] [--prune]');
    process.exit(1);
  }

  const meta = JSON.parse(await readFile(META, 'utf8'));
  const terms = meta.terms || (meta.terms = {});

  let added = 0;
  let updated = 0;
  const seen = new Set();

  for (const f of files) {
    const p = path.isAbsolute(f) ? f : path.join(ROOT, f);
    const drafts = parseDraft(await readFile(p, 'utf8'));
    for (const d of drafts) {
      if (!d.id) continue;
      if (seen.has(d.id)) throw new Error(`稿子里有重复 id：${d.id}`);
      seen.add(d.id);

      const rec = { term: d.term || d.id, alias: d.alias || '' };
      if (d.alias) rec.alias = d.alias;
      else delete rec.alias;
      rec.cat = d.cat || 'basic';
      for (const k of ['one', 'name', 'metaphor', 'number', 'pit', 'source', 'sym', 'lens']) {
        if (d[k]) rec[k] = smartQuotes(d[k]);
      }
      if (d._links.length) rec.links = d._links.map((l) => ({ text: smartQuotes(l.text), href: l.href }));

      // patch: yes —— 只改稿子里写了的字段，其余保留原样。
      // 用来给老词条补一个字段（比如补「名称由来」），不必把整条重抄一遍。
      if (d.patch && terms[d.id]) {
        const base = terms[d.id];
        const merged = Object.assign({}, base);
        Object.keys(rec).forEach((k) => { merged[k] = rec[k]; });
        if (!d.cat) merged.cat = base.cat;   // 没写 cat 就别把老的分类冲掉
        terms[d.id] = merged;
        updated++;
        continue;
      }

      if (terms[d.id]) updated++; else added++;
      terms[d.id] = rec;
    }
  }

  // 分类顺序固定，避免每次提交顺序抖动
  const sorted = {};
  Object.keys(terms).sort().forEach((k) => { sorted[k] = terms[k]; });
  meta.terms = sorted;

  await writeFile(META, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`[merge] 新增 ${added} 条，更新 ${updated} 条，术语库共 ${Object.keys(sorted).length} 条`);
}

main().catch((e) => { console.error('[merge] 失败：', e.message); process.exit(1); });
