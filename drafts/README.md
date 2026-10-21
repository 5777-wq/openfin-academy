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
