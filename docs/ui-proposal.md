# 模拟市场练习平台 · 界面方案 v0.1

> 参考样本：AmplifyME Market Simulation（Morgan Stanley 品牌实例截图）
> 范围：单局练习的实时界面 + 结算复盘界面
> 状态：**待评审**（本文只定界面，不含后端实现细节）

---

## 1. 目标与约束

| 约束 | 具体值 | 对界面的影响 |
|---|---|---|
| 单局时长 | 3 周行情压缩为 30 分钟，约 15 个交易日，**每交易日 ≈ 2 分钟** | 必须支持高倍速自动推进、事件自动暂停、随时可操作 |
| 决策密度 | 40–60 个决策点 | 下单/报价 ≤ 3 次点击完成；快捷键必备 |
| 角色 | 投行做市台（MM）+ 资管主动交易台（AM） | 同一骨架，仅中栏与左栏局部换面板 |
| 设备 | 桌面优先，1440–1920 | 最小 1280×800，不做移动端 |
| 信息密度 | 终端级 | 12px 基准字号、28px 行高、等宽数字 |

**五条设计原则**

1. **密度优先，焦点唯一**：屏幕上信息多，但同一时刻只有"当前该看的"被高亮。
2. **数字可扫读**：等宽字体、右对齐、千分位；涨跌只用一套色。
3. **一切可回放**：界面上任何动作都落成带时间戳的事件，供复盘逐帧重放。
4. **不打断**：普通事件只提示，不弹窗；仅"重大事件"允许暂停。
5. **评分延迟披露**：中途只给过程信号与风险警告，终局才出完整分数，避免刷分和引导作弊。

---

## 2. 布局总览

```
+--------------------------------------------------------------------------------------------------------------+
| [A] Morgan Stanley   Realised 260,843  Unrealised 0  Net Exp 0  Total 260,843     [P][1x][?]                 |
+--------------------------------------------------------------------------------------------------------------+
+----------------------------+  +------------------------------------------+  +--------------------------------+
| 1  MARKET WATCH            |  | 4  TRADE TICKET                          |  | 7  EVENT FEED                  |
|----------------------------|  |------------------------------------------|  |--------------------------------|
| TICKER      LAST    %CHG   |  | Book [AZN v]   Valid [45]s               |  | 09:32 MACRO*** Fed cuts rates  |
| TSCO      317.91  +1.83    |  | Bid 715.0     Offer 791.0                |  | 09:35 NOTE  ** Manage mkt risk |
| NFLX      537.53  +9.14    |  | BidVol 10000  OfferVol 10000             |  | 09:41 TSLA  *** CFO AI invest  |
| TSLA      197.12  +0.37    |  | [        SEND QUOTE        ]             |  | 09:44 DUOL  **  France scrutiny|
| AZN       802.99 -10.51    |  | Notional 802,989   Comm 4,015            |  | 09:47 MACRO*** US CB decision  |
| DUOL      281.37 +14.12    |  | [LIVE QUOTES]  [OLD QUOTES]              |  | 10:05 NOTE  *   Compete quotes |
+----------------------------+  +------------------------------------------+  +--------------------------------+
+----------------------------+  +------------------------------------------+  +--------------------------------+
| 2  BOOK  |  CHAT (MM)      |  | 5  CHART                                 |  | 8  SCORE PANEL                 |
|----------------------------|  |------------------------------------------|  |--------------------------------|
| ASK 793.0    1200          |  | [Line][Candle] 1m 5m 15m 30m All         |  | Composite     72   P62         |
| ASK 792.5     800          |  |           .-.                            |  | Returns     [######----]       |
| ASK 791.0     650          |  |      .-. /   \      .-.                  |  | Discipline  [########--]       |
|   -- spread 1.0 --         |  |     /   X     \____/   \___              |  | Reaction    [###-------]       |
| BID 789.5     900          |  |         ^event      ^event               |  | Resilience  [#####-----]       |
| BID 789.0    1500          |  | VOL #################                    |  | Next event  00:12              |
+----------------------------+  +------------------------------------------+  +--------------------------------+
+--------------------------------------------------------------------------------------------------------------+
| CLOCK 10:32:15 | DAY 3/15 | RUNNING | WS OK | keys B/S Q SPACE                                               |
+--------------------------------------------------------------------------------------------------------------+
```

**三栏分工**（按你要求的"左行情报价 / 中下单持仓 / 右事件评分"）

| 栏 | 职责 | 面板 |
|---|---|---|
| 左 30% | **信息输入**：市场现在什么样 | 1 行情看板 · 2 盘口/询价 |
| 中 44% | **决策与结果**：我怎么下、下完怎么样 | 4 下单台 · 5 图表 · 6 持仓/流水 |
| 右 34% | **态势与评估**：发生了什么、我做得如何 | 7 事件流 · 8 评分 |
| 顶栏 | 全局账本与时钟控制 | P&L 条 + 暂停/倍速/帮助 |
| 底栏 | 局面状态 | 模拟时钟 · 第 N/15 天 · 连接状态 · 快捷键 |

> 说明：ASCII 里第 6 区（持仓/流水）放在 4、5 之间不便于画，实际实现中它是中栏底部一个可切换 Tab 区（持仓 | 挂单 | 成交），高度约 220px。

---

## 3. 区域细则

### 1) MARKET WATCH 行情看板

- **字段**：代码 / 最新价 / 涨跌幅（%/绝对值可切） / 迷你走势（sparkline，可选）
- **交互**：单击切换"当前标的"，驱动中栏下单台与图表；支持搜索过滤（AmplifyME 顶部有 `Search keywords`）
- **角色差异**：无
- **状态**：空（未开始）、涨/跌着色、停牌/无报价置灰

### 2) BOOK / CHAT 盘口与客户询价

- **盘口**：五档买卖、价差、成交量；点击价格带出下单台价格（MM/AM 都可用）
- **CHAT（仅 MM）**：同屏左侧是参与者列表（Deal Room / IB Room / 各 AM 席位），右侧是消息流；客户消息形如 `price to sell 1000 DUOL`，点击即带出报价单
- **切换方式**：同一面板内 Tab 切换，MM 默认落在 CHAT，AM 隐藏该 Tab
- **状态**：无客户消息时的空态提示"暂无询价"

### 3) TRADE TICKET 下单台（**双角色差异最大的一块**）

**MM · 报价模式**

| 字段 | 说明 |
|---|---|
| 标的 | 下拉/搜索，默认取当前选中 |
| 有效期 | `Valid for N seconds`（45s 起），倒计时到 0 自动撤单 |
| 买价 / 卖价 | Bid（Client Sell）/ Offer（Client Buy），带盘口偏离提示 |
| 买量 / 卖量 | 数量，超库存限额时标黄并可强平 |
| 名义金额 / 佣金 | 实时计算 |
| `SEND QUOTE` | 提交双边报价；成功后进入 `LIVE QUOTES` 列表 |

下方 `LIVE QUOTES / OLD QUOTES` 两个 Tab，列出已发出报价的状态（IF / SECURITY / BID VOL / BID / OFFER / OFFER VOL / VALID FOR / 状态）。

**AM · 下单模式**

| 字段 | 说明 |
|---|---|
| 方向 | BUY / SELL（快捷键 B / S） |
| 数量 | 数量或名义金额，支持 % 仓位 |
| 订单类型 | 市价 / 限价 / 止损 |
| 限价 | 仅限价/止损时启用 |
| 预估成本 | 滑点 + 佣金 + 冲击成本估算，下单前展示 |
| 提交 | 单击提交；"二次确认"作为可开关设置 |

### 4) CHART 图表

- 两种模式：**分时线 / K 线**；周期 1m / 5m / 15m / 30m / All（与"每 2 分钟 = 1 交易日"的压缩节奏对应）
- **事件标记**：在时间轴上画竖虚线 + 图标，复盘时点击可跳到事件详情
- 参考线：当日最高/最低（对应 AmplifyME 的 Maximum / Minimum 虚线）
- 成交量柱在底部
- 当前持仓均价线、成交点标记（三角）

### 5) POSITIONS / BLOTTER 持仓与流水（中栏底部 Tab）

| Tab | 字段 |
|---|---|
| 持仓 | 证券 / 净仓 / 均价 / 市值 / 未实现盈亏 / 已实现盈亏 / 总盈亏 |
| 挂单 | 时间 / 方向 / 数量 / 价格 / 状态 / 撤单按钮 |
| 成交 | 时间 / 方向 / 数量 / 成交价 / 手续费 / 对应订单 |
| 归因（AM，结算后才有数据） | 配置 / 选择 / 择时 三段贡献 |

MM 的持仓额外显示：**库存（Inventory）**、库存限额使用率、对冲状态。

### 6) EVENT FEED 事件流

- 每条：`时间 · 类别 · 影响等级 · 标题`，点击展开正文
- 类别色：`MACRO`（宏观，紫）/ `NOTE`（指引，灰）/ 个股代码（蓝）/ `EARNINGS`（财报，橙）
- 影响等级 1–3 星，3 星事件触发右栏高亮 + 提示音 +（可选）自动暂停
- MM 专属指引会混在里面（如 "provision fast and competitive quotes"），这是角色任务提示，不是市场新闻——用不同底色区分

### 7) SCORE PANEL 评分面板

- 顶部：**综合分 + 百分位**（`72 / P62`）
- 中部：4–6 条维度进度条（收益 / 纪律 / 反应 / 韧性 …），**中途只显示等级不给精确值**
- 底部：下一个事件的倒计时 `Next event 00:12` —— 兼具"练习节奏提示"作用
- 违规时在此面板弹红色条（如"超过单标的上限"），并计入纪律分

### 8) 顶栏 / 底栏

- 顶栏 P&L 条：`Realised P&L / Unrealised P&L / Net Exposure / Commission / Total P&L`
- 顶栏右侧：暂停、倍速（1x/2x/5x/10x）、帮助、用户名与桌台（`Deng Yiming / IB-S`）
- 底栏：模拟时钟、`DAY 3/15`、运行状态、WS 连接指示、快捷键提示

---

## 4. 双角色差异映射

| 区域 | 投行做市台 MM | 资管主动交易台 AM |
|---|---|---|
| 左栏面板 2 | 盘口 + **客户询价聊天** | 盘口 + 深度 |
| 中栏下单台 | **双边报价**（Bid/Offer/有效期） | **单边下单**（方向/数量/类型） |
| 中栏持仓 | 含库存与对冲 | 含组合权重与敞口 |
| 右栏评分 | 价差捕获 / 库存风险 / 逆向选择 / 报价可用率 | 风险调整收益 / 回撤 / 纪律 / 响应 |
| 顶栏指标 | 额外显示库存利用率、报价在险时长 | 额外显示净敞口、杠杆、VaR |
| 时钟默认倍速 | 较慢（报价需要反应时间） | 较快（跨日组合决策） |

实现上：一个 `<AppShell>`，通过 `roleConfig` 决定渲染哪些面板与字段，**不写两套页面**。

---

## 5. 关键交互与状态

**时钟控制**：`Space` 暂停 / 继续；`1–4` 切倍速；事件可配置"命中即暂停"。暂停时全屏加半透明遮罩与 `PAUSED` 角标，但面板仍可查看（不允许下单）。

**报价有效期**：提交后倒计时条，剩 10s 变黄、剩 3s 变红，归零自动撤并记入"超时未成交"统计。

**事件提醒三档**：L1 灰点（仅列表）/ L2 黄闪（列表+顶部提示条）/ L3 红闪 + 声音 + 可选暂停 + 图表打标。

**快捷键**：`B` 买、`S` 卖、`Q` 报价、`Esc` 取消当前表单、`Space` 暂停、`1–4` 倍速、`Tab` 在面板间跳转、`?` 帮助。

**结算流程**：时间到 → `SETTLING` 遮罩 → 结算动画 → 全屏报告页（成绩卡 + 曲线 + 决策时间轴 + 行为标签 + 逐笔明细）→ `再练一局 / 换场景`。

**异常态**：WS 断线（顶部黄条 + 自动重连，期间禁下单）、引擎暂停（灰屏）、限额触发（红条 + 快捷"减仓"按钮）。

---

## 6. 视觉规范

**色板（深色终端风）**

| Token | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#0A101C` | 页面底 |
| `--bg-1` | `#0F1826` | 面板底 |
| `--bg-2` | `#16233A` | 表头 / hover |
| `--line` | `#223049` | 分隔线 / 边框 |
| `--text-1` | `#E8EEF9` | 主文本 |
| `--text-2` | `#93A4BF` | 次文本 / 表头 |
| `--text-3` | `#5E708C` | 禁用 / 辅助 |
| `--up` | `#2ECC8F` | 涨 / 买 |
| `--down` | `#FF5C6C` | 跌 / 卖 |
| `--accent` | `#4C8DFF` | 主按钮 / 选中 |
| `--warn` | `#F5A623` | 限额 / 倒计时告警 |
| `--event-macro` | `#B57BFF` | 宏观事件 |

**字体**：UI 用 Inter / PingFang SC / Microsoft YaHei；**所有数字用等宽** JetBrains Mono 并开 `font-variant-numeric: tabular-nums`。

**密度**：基准 12px；表格行高 28px；面板标题栏 32px；面板间距 8px；圆角 4px。

**数字格式**：价格 2 位小数；金额千分位；百分比 2 位带符号；涨跌用色 + 可选箭头（不用红绿之外的第三色）。

---

## 7. 前端架构

**建议选型**（可换，但建议先按这套开工）

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | React 19 + TypeScript | 生态成熟，组件化适合多面板 |
| 构建 | Vite | 启动快、HMR |
| 样式 | Tailwind CSS + CSS 变量 | 密集布局迭代快，色板用变量便于换主题 |
| 状态 | Zustand（按域切片） | 高频 tick 场景轻量、无 Provider 嵌套 |
| 表格 | TanStack Table + 虚拟滚动 | 流水可能上千行 |
| 图表 | lightweight-charts | TradingView 开源版，K 线/marker 开箱即用 |
| 实时 | 原生 WebSocket + 自建重连 | 不引额外依赖 |
| 测试 | Vitest + Testing Library + MSW | 与 AGENTS.md 的"每改必测"要求对齐 |

**组件树**

```
<App>
├── <TopBar>            Brand · PnLStrip · ClockControls · UserMenu
├── <Workspace>         CSS Grid: 30% / 44% / 34%
│   ├── <LeftRail>      <MarketWatch/> <BookPanel/> | <ClientChat/> (MM)
│   ├── <CenterRail>    <TradeTicket/> <ChartPanel/> <PositionTabs/>
│   └── <RightRail>     <EventFeed/> <ScorePanel/>
└── <StatusBar>         SimClock · DayCounter · Connection · HotkeyHint
<Modal> SettleReport · Help · RiskAlert
```

**状态切片**：`session`（时钟/倍数/暂停/天数）、`market`（报价/盘口/K线）、`portfolio`（持仓/挂单/成交/PnL）、`events`、`score`、`ui`（选中标的/布局/弹窗）。

---

## 8. 数据契约（界面 ↔ 模拟引擎）

**连接**：`WS /ws/session/{id}`，首帧 `snapshot` 全量，之后增量。

| 帧类型 | 方向 | 关键字段 |
|---|---|---|
| `snapshot` | S→C | `clock, instruments[], book, positions[], orders[], fills[], news[], score` |
| `tick` | S→C | `sym, bid, ask, last, vol, ts` |
| `book` | S→C | `sym, bids[[px,qty]…], asks[[px,qty]…]` |
| `news` | S→C | `id, ts, tag, impact(1-3), title, body` |
| `fill` | S→C | `orderId, sym, side, qty, px, fee` |
| `score` | S→C | `composite, percentile, dims{...}` |
| `clock` | S→C | `simTime, dayIndex, speed, paused` |
| `order` / `quote` | C→S | 下单/报价请求 |
| `clockCtl` | C→S | `pause / resume / speed / nextDay` |

**REST**：`GET /api/session/{id}/state`（重连补偿）、`GET /api/session/{id}/report`（结算报告）、`POST /api/session`（开局）。

**原则**：所有帧带单调递增 `seq`；前端以 `seq` 去重；断线重连后用 `state` 对齐。

---

## 9. 分期实施

| 期 | 内容 | 验收标准 |
|---|---|---|
| **P0** | 静态骨架：三栏 + 顶底栏 + 全部面板（假数据/空态） | 1280 与 1920 下无溢出；可切换 MM/AM 壳；组件测试通过 |
| **P1** | 接引擎：时钟控制、行情流、下单/报价、成交、持仓、P&L | 能完整跑完一局 15 天；断线重连不丢状态 |
| **P2** | 事件流、评分面板、结算报告、复盘回放 | 报告数值与引擎重算一致；回放可逐帧 |
| **P3** | 打磨：快捷键、音效、可拖拽分栏、主题 | 无阻断性缺陷 |

> 按 AGENTS.md：每期完成都要有对应测试（P0 组件与布局测试、P1 数据契约与重连测试、P2 数值一致性与回放测试），全绿后再交付。

---

## 10. 与 AmplifyME 样本的差异（有意为之）

| 项 | AmplifyME | 本方案 | 原因 |
|---|---|---|---|
| 评分 | 主要结算后出报告 | **常驻右栏评分面板** | 练习需要即时反馈节奏 |
| 图表 | 右下角，较小 | 中栏主区，最大 | 事件驱动判断更依赖图表 |
| 事件流 | 顶部中部，无分级 | 右栏 + 影响等级 + 事件标记上图 | 支撑"响应速度/重要度过滤"评分 |
| 持仓 | 右上 | 中栏底部 Tab | 让右栏让给评分 |
| 客户聊天 | 左下固定 | 与盘口同 Tab，仅 MM | 节省空间，角色化 |

---

## 11. 待确认（已全部确认，结论见 §12）

1. 界面语言：中文 / 英文 / 中英双语？
2. 最低分辨率按 1280 够吗，还是需要支持 1024 宽平板？
3. MM 的**客户聊天**第一版就要，还是先做"系统派单询价"简化版？
4. 评分面板：中途显示等级（本方案）还是完全不显示、只给风险警告？
5. 下一步是否先做一版**可点击的 HTML 静态原型**（mock 数据、无引擎）给你确认手感？

---

## 12. 决策落地记录（P0 骨架已实现）

用户确认（m00067 / m00069）后落地的结论：

| # | 问题 | 结论 |
|---|---|---|
| 1 | 界面语言 | **全英文**：所有标签、按钮、提示、状态均为英文；代码注释与文档内部说明保持中文 |
| 2 | 评分面板 | **默认隐藏**：顶栏 `SCORE` 按钮与右栏 teaser 打开抽屉，`ESC` 或点击遮罩关闭 |
| 3 | 客户聊天 | **不做**，改为**系统派单**：左栏 `DISPATCH`（MM）/ `CLIENT FLOW`（Sales），点击直接装填票据 |
| 4 | 分辨率 | 桌面优先 1280+，1080 以下横向滚动，不做移动端 |
| 5 | 原型 | 直接做**可运行骨架**（React + Vite）替代静态 HTML |

技术偏差（相对 §7 建议）：

- 不使用 Tailwind / Zustand / TanStack Table / lightweight-charts，改为**纯 CSS 变量 + 原生 table + 手写 SVG 图表**；运行期依赖仅 `react`、`react-dom`，后续接引擎时再按需引入。
- 评分维度首版取 6 个：Returns、Discipline、Reaction、Resilience、Trade management、Adaptability。

P0 已交付：

- **入口** `src/screens/RoleSelect.tsx`：Sales / Market Maker 两张独立入口卡，选完进入主界面，主界面可 `EXIT DESK` 返回。
- **主界面** `src/screens/Terminal.tsx`：顶栏 P&L 条 + 三栏 8 面板 + 底部状态栏 + 评分抽屉。
- **组件**：`TopBar`、`MarketWatch`、`BookPanel`、`DispatchPanel`、`TradeTicket`（双角色同一组件）、`ChartPanel`、`PositionsPanel`、`EventFeed`、`ScoreDrawer`、`StatusBar`、`PanelHeader`。
- **测试** `src/test/app.test.tsx`：角色入口、票据切换、派单装填、评分抽屉显隐、下单/报价确认、BOOK Tab 切换。

---

## 13. P1 落地记录（模拟时钟 + tick 行情）

用户要求（m00351）：把 mock 数据换成**可推进的模拟时钟 + tick 行情流**，价格像真实盘口一样跳动，持仓与 P&L 实时更新。

### 13.1 时间压缩参数

| 参数 | 值 | 说明 |
|---|---|---|
| `TICK_MS` | 250 | 真实时间每 250ms 推进一帧 |
| `SESSION_DAYS` | 15 | 3 周 × 5 交易日 |
| `DAY_SECONDS` | 23,400 | 每个模拟交易日 09:30→16:00 |
| `SESSION_SECONDS` | 351,000 | 15 天总模拟秒数 |
| `SIM_SECONDS_PER_TICK` | 48.75 | 351,000 ÷ (30 分钟 ÷ 250ms) → **30 分钟跑完 3 周** |
| `SPEEDS` | 1x / 2x / 4x | 每帧步进 1 / 2 / 4 个 tick |

### 13.2 引擎（纯函数）

- `src/engine/rng.ts`：mulberry32 种子随机，随机游标存在 state 里，`step()` 无外部副作用。
- `src/engine/scenario.ts`：5 个标的（sigma / spread / lot）、12 条新闻模板（带 `offset`、`shock`）、6 个客户席位、派单话术。
- `src/engine/simulation.ts`：`createSession(seed)` / `stepSession(state)` / `advanceSession` / `sendQuote` / `fillClientOrder` / `declineDispatch` / `togglePause` / `cycleSpeed`，以及 `selectInstruments` / `selectPnl` / `selectBook` / `selectSeries` / `selectSessionMeta` 等选择器。
- 每 tick 顺序：到点新闻入库并施加价格冲击（冲击按 `sigma/0.0018` 做 beta 放大）→ 每标的价格随机游走（1.2% 概率 6σ 跳价）→ 重建五档盘口（半价差按 bps）→ 报价倒计时与成交（客户 SELL 打 bid / BUY 抬 offer，82% 概率成交，扣 0.5% 佣金）→ 派单过期与补发（TTL 9000 模拟秒）→ 15 个交易日后 `CLOSED`。
- `src/hooks/useSimulation.ts`：250ms `setInterval` 驱动，所有写操作经同一 `latest` ref，避免 React 闭包读到旧 state。

### 13.3 界面变化

- `StatusBar` 增加 `PAUSE/RESUME`、`SPEED 1x/2x/4x`，状态圆点随 RUNNING/PAUSED/CLOSED 变色；快捷键 `SPACE` 暂停、`1/2/4` 调速度。
- `MarketWatch` 每 tick 用 `lastMove` 闪烁涨跌底色；`ChartPanel` 周期按钮真实切片最近 N 个 tick（1M/5M/15M/30M/1H/ALL），成交量柱按 `maxVolume` 归一，事件竖线随头条推进出现。
- `EventFeed` 新头条自动滚到底部；`PositionsPanel` 显示实时 `UNREALISED P&L`。
- `TradeTicket`：报价/限价在未手工编辑前**跟随实时盘口**，避免挂出被行情甩开的价；MM 下方是 `LIVE` / `OLD` 报价 Tab，状态随 tick 变 `FILLED` / `EXPIRED`；Sales 下方改为 `RECENT FILLS`（时间/标的/方向/数量/价格/费用/成交号）。

### 13.4 测试

- `src/engine/simulation.test.ts`（20 例）：时钟与日期滚动、收盘、暂停/倍速、盘口不交叉、滚动窗口、同种子确定性、新闻揭示与冲击、派单到达、持仓 mark-to-market、PnL 公式、平仓实现盈利、反手均价、成交扣佣、非法单与交叉报价拒单。
- `src/test/app.test.tsx`（16 例）：统一用 **fake timers + `fireEvent`**（`userEvent` 在 fake timers 下的内部 `setTimeout` 会挂住，见下），覆盖入口、hash 深链、时钟推进、暂停恢复、品种切换、派单装填、评分抽屉、报价/下单/切 Tab。
## 14. 开局初始仓位（P1.1 追加）

选完角色后多了一步 **Opening book** 设置页（`src/screens/SessionSetup.tsx`），两种开局：

| 模式 | 行为 |
|---|---|
| `FLAT`（默认） | 空仓、零 P&L、$20M 交易预算全额可用 |
| `CUSTOM BOOK` | 每个标的可填开仓数量（负数=空头）与均价，默认价取开盘参考价 |

- 初始仓位**按填写的均价入账**，所以 P&L 从 0 起算；它与 $20M 交易预算是两笔账 —— 初始仓位的资金在开局即已备好，只有真正交易时现金才变动。
- 引擎侧：`createSession(seed, openingBook)`，`OpeningPosition { symbol, netQty, avgPrice }`，非法/为零的行会被过滤；`normaliseOpeningBook()` 负责校验。
- `RESTART` 会**沿用同一份初始仓位**、换新种子重开；`EXIT DESK` 回到角色选择，重新配置。
- 深链 `#sales` / `#market-maker` 跳过设置页，直接空仓开台（方便截图与分享）。
- 测试：引擎 3 例（初始仓位写入、非法行过滤、carried 仓位 mark-to-market）+ UI 4 例（默认平仓、自定义仓位带入且不动现金、RESTART 重放初始仓位、返回角色选择）。

## 15. P2：决策遥测 → 实时评分 → 结算报告

### 15.1 动机

评分抽屉此前是 `src/data/mock.ts` 里的死数据（composite 72 / P62）。P2 把它换成从本局真实决策里算出来的分数，
并在 15 个交易日跑完时给出结算报告。

### 15.2 遥测层 `src/engine/telemetry.ts`

| 记录 | 字段 | 写入时机 |
|---|---|---|
| `QuoteRecord` | `id/symbol/tick/ourSpread/marketSpread/responseTicks/rfqId` | `sendQuote` 成功时（`responseTicks` 由 RFQ 创建 tick 差算出，手工报价为 `null`） |
| `FillRecord` | `id/symbol/side/qty/price/mid/edge/notional/fee/tick` | 报价成交或 `fillClientOrder` 成功时（`edge` = 买入 `mid-price`、卖出 `price-mid`） |
| `ExposureSample` | `tick/gross/net/pnl` | 每个 tick（`EXPOSURE_LIMIT = 480` 滚动窗口） |
| `NewsReaction` | `id/tick/traded` | 头条入库；20 tick 内有成交则标记 `traded` |

维护 `peakPnl` 与 `maxDrawdown`；各数组有上限（报价/成交 240、敞口 480、新闻 24），内存不随 30 分钟线性增长。

### 15.3 评分口径 `src/engine/scoring.ts`

| 维度 | 公式 | 无数据时 |
|---|---|---|
| `RETURNS` | `50 + 50·tanh(total/20_000)` | 50 |
| `DISCIPLINE` | `100·exp(-|ln(avgQuoteWidth/marketWidth/1.6)|) - declineRate·25` | 50（没报过价） |
| `REACTION` | `100 - 2.5·median(responseTicks)` | 50（没回应过派单） |
| `RESILIENCE` | `100 - 30·maxDrawdown/$20M` | 50（没持仓过） |
| `TRADE MANAGEMENT` | `100 - 400·avgGrossExposure/$20M` | 50（没持仓过） |
| `ADAPTABILITY` | `35 + 65·(headlinesTradedInto/headlines)` | 50（没新闻） |

权重 25/20/15/15/15/10，`percentile = clamp(5 + composite·0.9, 1, 99)`。**空局六维全 50** —— 什么都不做拿不到高分，
这是刻意的（否则"不交易"会被算成满分纪律）。

### 15.4 界面

- `ScoreDrawer` 从 `scoreSession(state)` 取数，副标题写明"实时读本局遥测"，两列紧凑布局。
- 收盘时 `Terminal` 自动弹 `SettlementReport`：hero 是 TOTAL P&L 拆解；FLOW（成交数、hit ratio、平均/最好/最差 edge、
  报价数、报价宽度 vs 市场）；RISK & RESPONSE（peak P&L、max drawdown、平均 gross、收盘净敞口、中位响应、头条响应率）；
  评分区（composite、percentile、六维 meter）；底部一行 coaching（挑最强项与最弱项给建议）。
- 状态栏收盘时钉在 `16:00:00`（`formatClock` 在 15 天边界会回绕成 09:30:00），并隐藏 PAUSE 按钮避免出现 `CLOSED CLOSED`。

### 15.5 行情节奏与费率修正

- `PRICE_UPDATE_TICKS` 4 → 2 → **1**（0.25 秒一跳，盘口连续变化），`CHART_POINTS`/`HISTORY_POINTS`
  **480**（1 根 ≈ 48.75 模拟秒，一个交易日 480 根）；`FLOW_CHANCE` 0.45 → **0.92**、流动 bps 上调并加入 sweep 事件，让曲线连续起伏而不是一段段平线。
- `COMMISSION_RATE` 0.005 → **0.0005**。原 50bps/边 下，`BUY 2,000 @803.22 → SELL 2,000 @810.78` 毛利 15,120 被 16,140
  的佣金吃成 −1,020；5bps 下同一笔来回净赚约 13,506。
- 测试：`src/engine/scoring.test.ts` 10 例（遥测记录、edge 方向、结算统计、空局中性、六维边界、盈利/亏损局 returns 对照），
  `simulation.test.ts` 增现金/节奏/收盘断言，总计 69 例全绿。
## 16. P2.5：事件驱动价格 + 价格磁带（m01435）

### 16.1 需求

- 组里其他人也要能练：**一个链接分享**或独立软件，打开即玩。
- 新闻改成**事件驱动**：利好/利空按股票分别推动价格偏移，而不是简单扰动随机数。
- 波动再细：**每次价格变动都要有明确的利好/利空来源**。

### 16.2 引擎模型（`src/engine/simulation.ts`）

- 价格 = Σ 具名驱动，不再有裸噪声。每次行情刷新（`PRICE_UPDATE_TICKS = 1`，0.25 秒）计算：
  `netBps = Σ(已释放的新闻冲量 bps × direction) + 微观流动 bps × direction`，
  再 `last = round2(max(0.01, last × (1 + netBps / 10000)))`。
- **新闻冲量** `PriceImpulse{ id, label, direction, bps, ttl, hint }`：头条到点后按标的生成，
  幅度 = `driftBps × volScale(sigma)`（`volScale = clamp(sigma / 0.0018, 0.7, 1.8)`），
  宏观消息对所有 `SYMBOLS` 生成、每个名字按各自波动率放大。每帧释放 `DRIFT_RELEASE = 0.25`，
  `ttl` 24 帧（≈12 秒）耗尽；剩余 < 0.5bps 丢弃。
- **微观流动** `FLOW_EVENTS`（`src/engine/scenario.ts`）：buy flow / sell pressure / ETF bid / short cover /
  retail bid / profit take / index flow / block print，按 `weight` 抽取；`bps` 6–24，乘以
  `(0.7 + sizeRoll × 0.8) × volScale`，所以每 0.5 秒一定有一个可命名的来源。
- `PriceChangeRecord` 记到 `SimulationState.priceTape`（上限 `PRICE_TAPE_LIMIT = 180`）：
  `{ id: PX-<tick>-<symbol>, tick, time, symbol, price, pct, bps, direction, drivers[] }`；
  `drivers` 按 bps 降序取前 `MAX_PRICE_DRIVERS = 3`，`instrument.driver` 取与净方向一致的最大驱动。
- 盘口：`headlineBps ≥ FORCED_REBOOK_BPS (12)` 或 mid 移动 ≥ `BOOK_MIN_MOVE_BPS (8)` 才重挂，
  否则沿用旧簿只更新 `bookMid`，避免整屏闪烁。
- 剧本 `NEWS_TEMPLATES` 重写为 20 条，每条带 `short`（磁带短标签）、`direction`、`symbol`、
  `driftBps`（±35–110bps，宏观对全市场）；另有中性 NOTE 只进新闻流不动价格。
- 删除 `PRICE_VOL_PER_UPDATE` 与高斯/跳价随机项（跳价并由 block print / 宏观头条替代）。

### 16.3 界面

- 右栏新增 **7 PRICE TAPE**（`src/components/PriceTape.tsx`）：每行 时间 / 标的 / 涨跌% / 驱动 chip，
  行左侧按方向染绿/红，点行切标的；只显示 `|bps| ≥ 10` 或含 headline 驱动的记录，最多 7 行。
- **1 MARKET WATCH** 的 `TYPE` 列换成 `DRIVER`：箭头 + 短标签 + title 完整说明；表格改 `table-layout: fixed`，
  三列宽度 52/56/88px，1280 下仍不裁切。
- **8 EVENT FEED** 每条加 `▲ BULLISH` / `▼ BEARISH` 徽标（`NewsItem.direction`），中性 NOTE 不显示。
- 面板编号顺延：EVENT FEED 7 → 8。

### 16.4 测试

- `simulation.test.ts` 新增 2 例（每次刷新都有具名 driver、磁带方向与 bps 同号；DUOL 的利空头条发布后
  价格下跌且头条已揭示），并把 `pendingNews.length` 上限断言从 12 改 20；引擎 30 例。
- `app.test.tsx` 新增 3 例（每个标的都有 DRIVER 且 title 含 bps、PRICE TAPE 可点行切标的、EVENT FEED 出现
  BULLISH/BEARISH 徽标）；UI 27 例。
- 总计 **81 例全绿**（engine 30 + scoring 10 + app 27 + launcher 7 + deploy 7）。

### 16.5 部署（由 deploy 队友交付，见 README「Publish a link」）

- `vite.config.ts` `base: './'`，dist 可在任意子路径与 `file://` 下工作。
- `npm run build:single`（`scripts/build-single.mjs`，零依赖）把 CSS/JS/favicon 内联成一个
  ~330 KB 的 `dist-single/index.html`，可直接发微信/邮件，双击即玩。
- GitHub Pages workflow（`.github/workflows/deploy.yml`）+ `netlify.toml`：推仓即出公网链接；
  哈希路由（`#sales` / `#market-maker`）不需要 SPA 重写规则。

### 固定种子分享链接（P2.6）

- 深链格式：`#sales?seed=20261112` / `#market-maker?seed=20261112`。`App.readDeepLink()` 解析 hash 里的 path 与 query，`seed` 只接受 1–9 位数字，解析失败退回随机种子。
- `Terminal` 收到 `seed` 后调用 `createSession(seed, openingBook)`；`useSimulation(initial, openingBook, fixedSeed)` 的 `restart()` 在固定种子下重放同一局，否则 `randomSeed()`。
- UI：TopBar 在固定种子时显示 `SHARED SEED` chip，RESTART 的 title 改为「重放同局」；状态栏 `SEED nnnnnn` 一直是权威值。
- 同一 seed 下新闻时间轴、盘口随机量与价格路径完全一致（引擎是纯函数），只有玩家动作会分叉 —— 这是「全组练同一道题」的前提。
- 测试：`src/test/app.test.tsx` 增加「pins a shared seed from the url hash」「replays the pinned seed when the desk is restarted」，总测试数 84。

## 17. 语言、三档时长与基准（P2.7）

### 需求

- 入口页可选语言：默认英文，可切中文。
- 入口页可选练习时长：5 / 15 / 30 分钟；选完再进台面。
- 台面顶栏显示本局剩余时间与档位，跑完自动结算。
- 分享链接要带语言与时长，保证全组同一道题。
- 结算报告加基准算法，显示是否跑赢基准。

### 实现

- `src/i18n.tsx`：`Language = 'en' | 'zh'`、`I18nProvider`、`useT()`；**英文原文即 key**，字典查不到回退英文；`fill()` 负责 `{var}` 插值，未包 Provider 的组件单测也走同一套插值。
- 字典分三份：`zh-chrome.ts`（入口页/初始持仓页/顶栏/状态栏/图表/评分抽屉/结算报告，约 140 条）、`zh-panels.ts`（八个台面面板，85 条，由 subagent 完成）、`zh-data.ts`（引擎动态字符串：12 个流动驱动、20 个头条短标签、6 条派单备注、新闻标签）。台面代号 `S&T · SALES` / `S&T · MARKET MAKING` 保留英文；头条正文保留英文（作为市场内容）。
- 时长档位在引擎层：`SessionMinutes = 5 | 15 | 30`、`simSecondsPerTick(minutes) = SESSION_SECONDS / ((minutes*60*1000)/TICK_MS)`（30→48.75、15→97.5、5→292.5 模拟秒/tick）。**tick 频率（250ms）不变**，只改每 tick 覆盖的模拟时间，因此短档不会变"平"，只是时间轴压缩，20 条头条仍全部播放。
- `createSession(seed, openingBook, { minutes })`；`SessionMeta` 增加 `minutes` 与 `timeLeftMs`；`selectSessionMeta` 在收盘时 `timeLeftMs = 0`。
- 顶栏 `TopBar` 增加 `TIME LEFT mm:ss` + `{n} MIN` 档位；≤30 秒变红。结算时 `Terminal` 检测 `status === 'CLOSED'` 自动打开结算报告。
- 深链：`#<role>?seed=…&lang=en|zh&minutes=5|15|30`，非法值回落默认（30 分钟 / 英文）；`#market-maker?seed=20261112&lang=zh&minutes=5` 即完整作业链接。
- 基准：`benchmark(state)` 把 `STARTING_CASH` 等权分给五只股票，按开盘价（`InstrumentState.openPrice`）买入并持有到收盘；结算统计新增 `benchmarkPnl / benchmarkReturnPct / alpha / beatsBenchmark`，`alpha = 总盈亏 − 基准盈亏`。报告里新增 `BENCHMARK · BUY & HOLD` 对比条与 `YOU BEAT THE BENCHMARK` / `BEHIND THE BENCHMARK`。
- 评分口径不变（六维 + composite + percentile），但 `coachingLine` 改为 `coachingSummary(state)` + `adviceFor(key)`，点评句可整体翻译。

### 测试与验收

- 94 例全绿：engine 33（含档位 `simSecondsPerTick`、5 分钟档 1,200 tick 收盘与 `timeLeftMs` 归零、基准与手工计算一致、空仓跑输/跑赢基准的判定）+ scoring 10 + app 34（语言切换、时长带入台面并显示倒计时、深链 `lang/zh&minutes/5`、5 分钟档自动结算 + BENCHMARK）+ launcher 7 + deploy 10。
- 截图：`.tmp/tier-entry-en.png` / `.tmp/tier3-entry-zh.png`（入口双语 + 时长条）、`.tmp/tier-desk5.png`（5 分钟档顶栏 `TIME LEFT 04:56 5 MIN`）、`.tmp/tier2-desk-zh2.png` / `.tmp/tier3-desk-zh-1280.png`（中文台面，1280 不裁切）、`.tmp/tier3-report-zh.png`（中文结算报告含基准对比）。

## 18. 成交冲击与报价宽度（P2.8）

### 需求

- 自己的成交要推动价格：按成交金额给 3–10bps 冲击并衰减。
- 报价宽度要影响成交概率（引入逆向选择）。
- 另出一份带截图的中文新手指南 PDF。

### 成交冲击

- `src/engine/simulation.ts`：`FILL_IMPACT_MIN_BPS = 3`、`FILL_IMPACT_MAX_BPS = 10`、`FILL_IMPACT_FULL_NOTIONAL = 1_600_000`（成交额到 160 万美元用满 10bps）、`FILL_IMPACT_SHARE = 0.4`、`FILL_IMPACT_TTL = 12`。
- `export function fillImpactBps(notional)`：线性映射，低于 0 或超过满额都钳在 3/10bps。
- `applyFillImpact(instruments, symbol, ourSide, notional, tick)`：买入 direction=+1、卖出 −1；**四成立刻打进 `last`**（保证图上马上看到），剩余六成作为 `PriceImpulse{ label: 'your fill', source: 'fill', ttl: 12 }` 按 `DRIFT_RELEASE=25%` 逐帧释放。
- 接线：市价单成交（`fillClientOrder`）与报价被接受（`stepSession` 报价循环）都会调用；`selectPriceTape` 的过滤条件加了 `driver.source === 'fill'`，保证自己的成交一定会出现在 PRICE TAPE；`MARKET WATCH` 的 DRIVER 列同样会显示 `your fill`。
- 中文：`zh-data.ts` 增加 `'your fill': '你的成交'` 与提示句。

### 报价宽度 → 成交概率

- `LiveQuote` 增加 `spreadRatio`（报价价差 / 当时市场价差）与 `fillProbability`。
- `export function fillProbability(spreadRatio)`：`0.96 − 0.35 × (ratio − 1)`，钳在 0.12–0.96 → 1 倍约 96%、2 倍 61%、3 倍 26%、≥3.4 倍到底 12%。
- `sendQuote` 计算并写进报价；`stepSession` 判定成交从固定 0.82 改为 `roll < quote.fillProbability`。
- 报价单新增 `EST. FILL` 统计格（只对做市商显示，百分比实时随报价宽度变化），`COMMISSION_RATE` 也从组件里的错值 0.005 改为引用引擎常量 0.0005。

### 测试

- 新增 `src/engine/impact.test.ts`（7 例）：冲击映射边界与单调性、买/卖方向、四成立刻到价、剩余六成逐帧变小并在 16 帧内消失、`your fill` 出现在 PRICE TAPE、宽度概率曲线与钳位、`sendQuote` 写入的 `spreadRatio`/`fillProbability`。
- UI 新增“估算成交率”用例；**全量 102 例全绿**，`npm run build` 通过。`docs/beginner-guide.pdf`（12 页、A4 白底、6 张截图）同时复制到 `public/beginner-guide.pdf` 由站点直接提供（入口页底部有 “新手指南（PDF）” 链接）；`src/test/docs.test.ts` 校验两份文件存在、`%PDF-` 魔数、体积 >120KB、页数 ≥6，app 测试校验入口链接 href。加上后全量 **105 例**。

### 新手指南

- `docs/beginner-guide.pdf`：中文，白底 A4，含入口/开局持仓/做市台面/销售台面/结算报告五张截图，覆盖两个台面的玩法、行情驱动机制（新闻、流动、自己的成交冲击）、三档时长、快捷键、评分与基准、分享链接与常见问题。

## 19. 客户流与交易所两条腿（P2.9）

**需求**：客户流和自己主动买卖要区分开；银行端也能自己在交易所买卖（从客户买、去交易所卖，反过来也行），赚价差。

**实现**

- `Venue = 'client' | 'exchange'` 写进 `OrderRow` / `TradeRow` / `FillRecord`，台账与结算报告按来源拆分。
- 引擎新增 `exchangeLiquidity(levels)`、`walkBook(levels, qty)`（逐档加权均价，流动性不足返回 null）与 `tradeOnExchange(state, { symbol, side, qty })`：市价吃单，成交价取扫单均价，收 5bps 佣金，并对成交额施加 `applyFillImpact` 冲击；拒单覆盖数量、未知标的、盘口不足、现金不足。
- UI 新增 `ExchangeTicket`（面板 5）：`Best price` / `Est. avg price` / `BOOK SIZE` / `NOTIONAL` / `COMMISSION`，`BUY AT MARKET` / `SELL AT MARKET`；后续面板编号顺移（图表 6、账簿 7、价格带 8、事件流 9）。
- 台账：RECENT FILLS 与 BOOK 的 TRADES 增加 `VENUE` 徽标列（客户=蓝、交易所=橙）。
- 结算报告：FLOW 卡新增 `Venue split` 与 `Spread capture`（Σ edge×qty，负数标红）；`Hit ratio` / `Avg edge` 只统计客户流成交，避免主动吃单的负 edge 污染报价质量指标。
- 测试：`src/engine/exchange.test.ts` 9 例 + app 4 例（面板渲染、市价成交消息与徽标、客户徽标、中文标签），全量 118 例。