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

## 稿子与正库的同步（2026-10-23 已回填）

历史上稿子落后于正库：213 条术语里，稿子覆盖 168 条，其中 95 条缺字段
（`kw` / `lens` / `name` 这些后来才加的），整批 merge 会把字段丢掉。
2026-10-23 用 `_scripts/sync-drafts.mjs` 把稿子全部回填成正库内容，现在：

- **整批 merge 是空操作**，不会回退任何字段。自检：`node _scripts/sync-drafts.mjs --verify`。
- 另有 45 条只在正库、稿子里没有（不受 merge 影响，但如果想「以稿子重建正库」就得先补进稿子）。
- 同一个 id 出现在多个 batch 文件里（历史上打补丁留下的）：**一次 merge 传多个含同一 id 的文件会报「重复 id」**，
  这是保护不是 bug；分开传或只传你改的那个文件。

**改了正库里的词条（直接编辑 JSON 或打 patch）之后，记得跑一次回填，让稿子跟上：**

```bash
node _scripts/sync-drafts.mjs          # 正库 → 稿子
node _scripts/sync-drafts.mjs --verify # 确认整批 merge 仍是空操作
```

新词条仍然走稿子：写进 `batch16.txt` 这样的新文件再 merge。
