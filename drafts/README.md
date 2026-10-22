# drafts/ —— 术语库写作稿

这里是**写作稿**，不是权威数据。

- `content/_meta/glossary.json` 是**权威版本**（编译产物 `data/content/glossary.json` 由它生成）。
- 本目录下的 `.txt` 是纯文本稿，方便批量写词条：几百条 JSON 直接手写容易丢引号。
- 合并脚本：`_scripts/merge-terms.mjs`（格式见脚本头部注释）。

```bash
node _scripts/merge-terms.mjs drafts/batch2.txt drafts/batch3.txt
node _scripts/build-content.mjs
node _test/run-all.mjs && node _test/render-test.mjs
```

合并是幂等的：同一个 id 再合并一次会覆盖，不会产生重复条目。

稿子里的引号请用中文引号「」——直引号会在 JSON 里变成转义，脚本会把它们统一转成中文引号。

## ⚠ 别整批 merge（2026-10 核实过）

**`drafts/` 里的稿子比 `content/_meta/glossary.json` 旧。**
213 条术语里有 39 条在稿子里没有这条、或者缺字段（比如 `kw` 整条没有）。
对涉及的 batch 跑一次整批 merge，**这 39 条会被回退成稿子里的样子**——
字段直接丢失，不是覆盖成旧值。

所以：

- **只 merge 你真的改过的那几条。** 把要改的条目摘成一个临时稿再合：
  ```bash
  node _scripts/merge-terms.mjs drafts/_tmp-merge.txt   # 只放你改的那几条
  ```
  合完把临时稿删掉。
- 改完跑 `node _test/run-all.mjs`——有一条断言会比对「术语库源与产物逐字段一致」，
  少字段就会报出来。

长期要根治，得先把这 39 条补回稿子里；在那之前，整批 merge 是有风险的。
