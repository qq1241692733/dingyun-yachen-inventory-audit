# 鼎运雅辰品质体验中心 · 运营与合伙人库存审计系统

> **V2.0「装订账本」** ｜ React 19 + Vite 6 + Tailwind CSS 4 + Node.js / Express

高端体验会所与全球 2,700+ 会所联盟示范店的**合伙人库存审计中台**。

17 位合伙人独立货权，货由店长统一保管清点；卖货时自己名下缺码，可借调他人在库现货先行交付、
之后补新货冲销归还；所有关键动作都要求**双人手写签字**存证，形成可追溯的审计链条。

---

## 功能一览

系统以七种「结构」组织七个核心视图，而不是简单的标签页切换：

| 视图 | 结构 | 说明 |
| :--- | :--- | :--- |
| 库存总览 | Stat-Led | 单焦点关键数字 |
| 库存台账 | Register | 逐件表 + 表尾合计，可从总览下钻 |
| 销售账单 | Workbench | 票根 + 票面票据流 |
| 借调流转 | Contra-Ledger | 按原货主归卷 |
| 审计中心 | Dossier | 卷宗脊 + 收合摊开 |
| 合伙人名册 | Catalogue | 名册表 + 表尾合计 |
| 加盟商房租 | Index-First | 倒计时带 + 双栏索引 |
| 原始电子表格 | Spreadsheet | Excel 多 Sheet 视图（逻辑保留） |

其他能力：

- **双人手写签字**：入库、出库、借调、归还等关键动作通过 `SignaturePad` 留痕。
- **审计动态**：由业务数据自动派生，不依赖人工补录。
- **深链**：`?view=OVERVIEW` / `SALES` / `BORROW` / `AUDIT` / `PARTNERS` / `FRANCHISEES` / `SPREADSHEET`。
- **主题切换**：多套视觉令牌（明 / 暗）在运行时切换。
- **REST API + MCP**：同一端口同时提供前端、REST API 与 MCP 服务，便于手机端 AI 助手接入。
- **结构化日志**：请求日志与业务日志可观测、可脱敏、自动清理。

---

## 技术栈

- **前端**：React 19、Vite 6、TypeScript、Tailwind CSS 4、Motion、lucide-react
- **后端**：Node.js（ESM）、Express 4、文件型数据存储
- **质量**：TypeScript 类型检查、Python pytest 业务用例、运行时自检脚本

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（前端热更新，端口 3001）
npm run dev

# 3. 构建 + 启动对外服务（默认端口 3020，同时托管 dist/、/api、/mcp）
npm run build
npm run server
```

Windows 下也可以直接双击 `start-lan.bat`：自动构建并以局域网可访问的方式启动预览（端口 3010）。

> **注意**：局域网访问时请使用系统安装的 Node.js，而不是某些托管版 Node。
> 托管版可能自带入站防火墙规则，导致本机可访问、局域网被静默拦截。

### 环境变量

参考 `.env.example`。服务不会自动读取其中注释以外的配置，实际生效方式二选一：
复制为 `.env`，或直接设置环境变量（真实环境变量优先级更高）。

| 变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PORT` | `3020` | 服务监听端口 |
| `HOST` | `0.0.0.0` | 监听地址，默认局域网可访问 |
| `MCP_AUTH` | `on` | MCP 鉴权开关，`off` 仅建议本机调试 |
| `API_AUTH` | `off` | 设为 `on` 后 `/api/*` 也要求令牌（暴露到公网时必须开启） |
| `MCP_TOKEN` | 自动生成 | 手动指定访问令牌；否则首次启动生成并写入 `server/data/token.txt` |
| `DY_LOG_LEVEL` | `info` | 日志级别：`debug` / `info` / `warn` / `error` / `fatal` |
| `DY_LOG_DIR` | `server/logs/` | 日志落盘目录 |
| `DY_LOG_RETENTION_DAYS` | `7` | 应用日志保留天数 |
| `DY_LOG_ERROR_RETENTION_DAYS` | `14` | 错误日志保留天数 |
| `DY_LOG_CONSOLE` | `on` | 是否同时输出到控制台 |
| `DY_LOG_SERVICE` | `dingyun-inventory` | 日志中的服务名 |
| `DY_LOG_VERSION` | `2.0.0` | 日志中记录的服务版本 |

### 接口鉴权

MCP 端点默认要求 Bearer Token：

```http
Authorization: Bearer <token>
```

令牌来源：启动日志、`server/data/token.txt`，或环境变量 `MCP_TOKEN`。

---

## 项目结构

```
├── src/
│   ├── index.css              ★ 设计令牌层 + 组件原子件（视觉唯一真源）
│   ├── App.tsx                外壳、全局状态、深链
│   ├── types/inventory.ts     业务实体定义
│   ├── data/                  演示种子数据
│   ├── utils/                 审计日志、账本分组、API 客户端、主题
│   └── components/            业务组件
├── server/
│   ├── index.mjs              静态托管 + REST API + MCP + 鉴权
│   ├── store.mjs              文件型数据存储
│   ├── domain.mjs             业务规则
│   ├── mcp.mjs                MCP 工具定义
│   ├── logger.mjs             结构化日志
│   ├── http_log.mjs           HTTP 请求日志与脱敏
│   ├── data/                  种子数据与运行时数据
│   └── scripts/               种子构建、OpenAPI 生成
├── tests/qa/                  pytest 业务用例
├── index.html
├── vite.config.ts
├── package.json
└── start-lan.bat              一键局域网演示
```

---

## 可用脚本

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | 启动 Vite 开发服务器（端口 3001） |
| `npm run build` | 构建生产包到 `dist/` |
| `npm run preview` | 本地预览构建结果 |
| `npm run server` | 启动 Node 服务（静态托管 + API + MCP，默认 3020） |
| `npm run seed` | 从业务数据构建种子文件 |
| `npm run openapi` | 生成 OpenAPI / Swagger 描述文件到 `api-docs/`（本地生成，不纳入仓库） |
| `npm run lint` | TypeScript 类型检查 |
| `pytest tests/qa` | 运行业务验收用例 |

---

## 开发约定

1. **视觉改动先改令牌**：任何颜色、字号、圆角、动效的调整，先修改 `src/index.css` 的令牌层，再动组件。
   组件中直接写裸 hex、裸 `font-family`、`text-[13px]` 等任意值都视为缺陷。
2. **业务规则集中在 `server/domain.mjs`**，数据结构定义在 `src/types/inventory.ts`，避免在组件内复制业务判断。
3. **签名与留痕不可绕过**：`SignaturePad` 的签名逻辑、审计留痕链路属于硬约束。
4. **本地数据与密钥不入库**：`server/data/token.txt`、日志目录、`.env` 已在 `.gitignore` 中排除。
