# 架构设计

> 状态：设计基线 v1（2026-10-21）
> 继承 OpenFinLens 的铁律：**零构建、零运行时新库、零后端、无假数据**。

## 0. 三条不可让步的原则

1. **零构建。** 仓库里没有 `package.json` 依赖，没有打包步骤。`index.html` 双击就能跑，CI 只做校验不做编译（内容编译是可选的辅助，产物已提交）。
2. **网络调用只在 `js/sources/`。** 业务逻辑只在 `js/engine/`，视图只做编排。这条边界让引擎层可以 node 直跑测试。
3. **不编造。** 拿不到的数据写"拿不到"，不用别处凑，不插值，不画假线。

## 1. 分层

```
浏览器（纯客户端）
├── js/sources/        网络调用的唯一合法位置
│   ├── quotes.js      东财 ulist 批量报价（报价条 + 首页仪表）
│   └── history.js     读 data/history/*.json 静态产物
├── js/engine/         纯计算层，无 DOM 无网络
│   ├── series.js      序列对齐 / 切片 / 归一化 / 波动率
│   ├── percentile.js  历史分位
│   ├── drawdown.js    回撤
│   ├── spread.js      曲线形态 / 利差 / 金油比 / 实际利率
│   ├── similarity.js  历史对照仪（z 分数 + 欧氏距离 Top-K）
│   └── analogy.js     六维度类比打分
├── js/components/     签名交互（无业务判断）
│   ├── era-timeline.js 时代横轴
│   ├── term-card.js    四段式术语卡
│   ├── term-drawer.js  术语抽屉
│   ├── replay-player.js 危机回放器
│   └── chain-heat.js   产业链环节强弱
├── js/views/          栏目视图（编排视图组件 + 引擎）
├── js/site/           本站自研：格式化、内容加载
├── js/router.js       哈希路由
├── js/app.js          启动、导航、键盘、主题
└── vendor/            ← 从 OpenFinLens 单向同步，勿手改
```

## 2. 数据流

```
内容流：content/*.md ──build-content.mjs──▶ data/content/*.json ──▶ 浏览器
数据流：官方/公开源 ──collect-history.mjs（GH Actions 定时）──▶ data/history/*.json ──▶ 浏览器
实时流：浏览器 ──▶ js/sources/quotes.js ──▶ 东财（主源）
                                                └─失败──▶ localStorage 缓存 ──▶ 降级角标
```

**海外源不在浏览器里请求。** 美国财政部和 CBOE 的数据由采集脚本拉下来存成静态 JSON，所以国内访问不受影响。

## 3. 降级策略

| 层 | 行为 |
|---|---|
| 主源成功 | 正常显示，右下角标数据源名 |
| 主源失败 → 缓存 | 显示缓存值 + "降级"角标 + 缓存时间 |
| 缓存也没有 | 显示 `--`，**绝不白屏** |

## 4. vendor 同步机制

- **单向**：OpenFinLens 是上游，本站只读。
- `_scripts/sync-core.mjs` 按白名单复制纯逻辑层（utils / universe / explain / industry-chains / engine / lightweight-charts），不复制任何 UI。
- `vendor/HEAD` 记录上游 commit SHA，CI 校验它是否与上游一致。
- **不要直接改 `vendor/`**——下次同步会被覆盖。站点自研的补丁放 `js/site/`。

## 5. 路由

哈希路由，纯静态免构建，每个页面可独立分享：

```
#/                    首页
#/concepts            货币与利率      #/concepts/:id
#/crisis              危机复盘        #/crisis/:id
#/assets              标的百科        #/assets/:id
#/chains              产业链图谱      #/chains/:id
#/cycles              周期与镜鉴      #/cycles/:id
#/family              家庭理财
#/path                新手路径
#/search?q=...        搜索结果
```

浏览器前进后退可用；每页滚动位置会被记住并在返回时恢复。

## 6. 键盘与可达性

- 全程键盘可达：Tab 焦点有可见轮廓（`outline: 2px solid var(--gold)`）
- `/` 与 `⌘K` 打开命令面板，`?` 打开快捷键面板，`←/→` 控制回放器
- `prefers-reduced-motion: reduce` 时全部动效关闭
- 移动端：左栏收成底部标签栏，回放器降级为单资产 + 事件列表
- 打印样式：`css/` 内保留打印友好规则，家庭理财模板可直接打印

## 7. 性能

- 无框架、无打包、无运行时新库
- 图表库 lightweight-charts 已 vendored 到 `lib/`
- 长历史走静态 JSON，浏览器只读需要的文件
- 报价条 30 秒轮询一次，回放器数据加载即用，不轮询

## 8. 测试策略

`node _test/run-all.mjs` —— node 直跑，不需要浏览器、不需要网络。

| 组 | 覆盖 |
|---|---|
| 引擎层 | 序列对齐、分位、回撤、曲线形态、相似度、类比打分的构造用例对账 |
| 格式化 | 日期、数字、百分比、方向色、markdown 子集 |
| 术语卡 | 正文标记注入、已知/未知术语分流 |
| 数据契约 | `series-map.json` 与 `data/history/*.json` 的点数、来源、日期格式必须一致 |
| 危机包 | 必须含 SPX / 黄金 / 原油 / 美债10Y / VIX 五条序列，事件日期必须落在时间轴内 |
| 内容契约 | 索引与正文产物一致；正文里 `[[术语id]]` 引用的术语必须在术语库中 |
| vendor | `vendor/HEAD` 必须记录上游 commit；关键 vendor 文件必须存在 |
