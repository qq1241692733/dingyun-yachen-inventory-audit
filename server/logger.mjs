/**
 * 结构化日志 —— 参照大厂（阿里/字节/Google）落地的可观测性规范。
 *
 * ## 为什么要有这个文件
 *
 * 改造前的现状：全项目 `console.*` 只有 3 处（启动横幅 / shutdown / 错误兜底）。
 * 一次失败的接口调用，**服务端不留下任何可查的东西**——业务拒绝走的是
 * `{ok:false, code, message}` 返回值而不是 `throw`，连 error handler 都不经过。
 * 后果：测试同学排查失败时，只能看到客户端拿到的响应体，看不到"请求到了服务端
 * 之后发生了什么"，于是无法判断是**被测服务的问题**还是**测试脚本的问题**。
 *
 * 本模块立的就是这条规矩：**每一次请求、每一次业务拒绝、每一个错误，都留一行可查的证据。**
 *
 * ## 规范要点（对齐业界通行做法）
 *
 * 1. **单行 JSON（JSON Lines）**，不 pretty-print —— 采集器/`grep`/`jq` 都能直接处理，
 *    多行日志会把一条记录拆成多行，检索时对不上。
 * 2. **时间戳 ISO8601 + 毫秒 + UTC**（`2026-10-12T10:31:02.441Z`）—— 跨机器/跨时区可比对。
 * 3. **日志分级**：debug < info < warn < error < fatal，按级别过滤，默认 info。
 * 4. **必带关联 ID**：`requestId`（单请求）/ `traceId` + `spanId`（跨服务链路，W3C 口径）。
 * 5. **字段名稳定**（见下方 FIELDS 说明）—— 字段名一改，下游的检索规则全废。
 * 6. **敏感信息脱敏**：`authorization` / `token` / `password` 等一律掩码，**绝不落明文**。
 * 7. **按天滚动 + 保留期可配**（默认 7 天）—— 见下方"落盘与保留"。
 * 8. **错误单独一份**（`error-*.log`）—— 排查时不必在几十万行 info 里捞错误。
 *
 * ## 落盘与保留
 *
 * ```
 * server/logs/
 *   app-2026-10-12.log      ← 全量（info 及以上）
 *   error-2026-10-12.log    ← 仅 warn/error/fatal
 * ```
 *
 * ⚠️ 用 `appendFileSync` 而不是写流（`createWriteStream`）：
 * 本服务是门店级规模（单机、低并发），同步 append 对 `O_APPEND` 是原子的，
 * **进程崩溃也不会丢日志**——对"排查用的证据"来说，丢日志比略微阻塞严重得多。
 * 若将来 QPS 上来了，再换缓冲写流（那时要额外处理退出时 flush）。
 *
 * ## 配置（改这几行就够，全部可用环境变量覆盖）
 *
 * | 变量 | 默认 | 说明 |
 * | :--- | :--- | :--- |
 * | `DY_LOG_LEVEL` | `info` | 最低输出级别：debug/info/warn/error/fatal |
 * | `DY_LOG_DIR` | `server/logs` | 日志目录（可用绝对路径挂到数据盘） |
 * | `DY_LOG_RETENTION_DAYS` | `7` | 全量日志保留天数（**改这一行即可调整保留策略**） |
 * | `DY_LOG_ERROR_RETENTION_DAYS` | `14` | 错误日志保留天数（错误更值钱，默认留更久） |
 * | `DY_LOG_CONSOLE` | `on` | 是否同时打到 stdout（生产可关，容器里通常留着） |
 * | `DY_LOG_SERVICE` | `dingyun-inventory` | 服务名，多服务共库时用于过滤 |
 *
 * ## 字段清单（稳定契约，改动需同步更新知识库 24 篇）
 *
 * | 字段 | 类型 | 说明 |
 * | :--- | :--- | :--- |
 * | `ts` | string | ISO8601 UTC，毫秒精度 |
 * | `level` | string | debug/info/warn/error/fatal |
 * | `msg` | string | 人类可读的一句话 |
 * | `service` / `version` / `env` | string | 服务名 / 版本 / 环境 |
 * | `event` | string | 事件类型，如 `http.request` / `http.response` / `business.reject` |
 * | `requestId` | string | **单请求唯一 ID**（⚠️ 排查的主键） |
 * | `traceId` / `spanId` | string | 跨服务链路 ID（W3C traceparent 口径） |
 * | `method` / `route` / `status` / `durationMs` | — | HTTP 维度 |
 * | `operator` / `channel` / `action` / `detail` | string | 业务维度（经手人/通道/动作） |
 * | `err` | object | 仅错误时出现：`{type, code, message, stack}` |
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/* ────────────────────────── 配置 ────────────────────────── */

/**
 * 读一个 `.env`（若存在）到 `process.env`，**不覆盖**已有的真实环境变量。
 *
 * 为什么不无脑用 dotenv：本项目历史上从不加载 `.env`（`dotenv` 只在 package.json
 * 里挂着）。这里做**最小、可预期**的加载——真实环境变量永远优先（12-factor），
 * `.env` 只作缺省补充。这样"改保留策略"既能改 `.env`，也能改启动脚本的 env。
 */
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return; // 没有 .env 是正常情况
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // 去掉成对的引号（.env 常见写法 KEY="value"）
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const normLevel = (v) => (LEVELS[String(v || '').toLowerCase()] ? String(v).toLowerCase() : 'info');

const CONFIG = {
  level: normLevel(process.env.DY_LOG_LEVEL || 'info'),
  dir: process.env.DY_LOG_DIR
    ? path.resolve(process.env.DY_LOG_DIR)
    : path.join(HERE, 'logs'),
  appRetentionDays: Math.max(1, Number(process.env.DY_LOG_RETENTION_DAYS) || 7),
  errorRetentionDays: Math.max(1, Number(process.env.DY_LOG_ERROR_RETENTION_DAYS) || 14),
  console: (process.env.DY_LOG_CONSOLE || 'on').toLowerCase() !== 'off',
  service: process.env.DY_LOG_SERVICE || 'dingyun-inventory',
  version: process.env.DY_LOG_VERSION || '2.0.0',
  env: process.env.NODE_ENV || 'development',
};

/* ────────────────────────── 脱敏 ────────────────────────── */

/** 需要掩码的键（小写匹配）。命中即替换为 `***`，**绝不落明文**。 */
const SECRET_KEYS = new Set([
  'authorization',
  'token',
  'mcp_token',
  'x-mcp-token',
  'x-api-token',
  'api_token',
  'access_token',
  'refresh_token',
  'password',
  'passwd',
  'secret',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'gemini_api_key',
]);

/**
 * 递归脱敏一个对象（返回新对象，不改原对象）。
 * 深度上限防环/防巨型对象把日志撑爆；超深直接标记。
 */
function redact(value, depth = 0) {
  if (value == null) return value;
  if (depth > 6) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(k.toLowerCase())) {
      out[k] = '***';
    } else if (typeof v === 'string' && v.length > 2000) {
      // 单字段过长（如整个响应体）截断并标注，避免一条日志几十 KB
      out[k] = `${v.slice(0, 2000)}…[+${v.length - 2000}]`;
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

/* ────────────────────────── 滚动与保留 ────────────────────────── */

/** 本地日期 YYYY-MM-DD（按服务器本地日期切分，便于人肉对时） */
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let ready = false;
function ensureDir() {
  if (ready) return;
  fs.mkdirSync(CONFIG.dir, { recursive: true });
  ready = true;
}

/**
 * 日志系统自身的报错出口。
 *
 * ⚠️ 这里必须**限流**：如果日志目录不可写（如路径中间是个文件、磁盘满、无权限），
 * 每次写日志都会失败。不限流就会变成"每个请求往 stderr 刷一条"，
 * 进而把 stderr 重定向到的文件撑爆 —— 观测性问题被放大成稳定性问题。
 * 每 60 秒最多报一次，并带上被压制的次数。
 */
let lastWarnAt = 0;
let suppressed = 0;
function warnSelf(msg) {
  const now = Date.now();
  if (now - lastWarnAt < 60_000) {
    suppressed += 1;
    return;
  }
  const extra = suppressed ? `（此间另有 ${suppressed} 次同类失败被折叠）` : '';
  suppressed = 0;
  lastWarnAt = now;
  try {
    process.stderr.write(`[logger] ${msg}${extra}\n`);
  } catch {
    /* stderr 也写不出去就只能放弃，绝不能抛 */
  }
}

/** 实际落盘：一行 JSON 追加到当日文件；warn 及以上再额外写一份错误日志 */
function write(record) {
  const line = `${JSON.stringify(record)}\n`;
  const date = localDate();

  try {
    // ⚠️ ensureDir 必须在 try 里面：目录建不出来（ENOTDIR/EACCES/ENOSPC）时
    // 它会抛。放在 try 外曾让整个服务**启动即崩** —— 日志写不出去不该是业务故障。
    ensureDir();
    fs.appendFileSync(path.join(CONFIG.dir, `app-${date}.log`), line, 'utf8');
    // warn 也是"需要人看一眼"的信号，一并进错误档，排查时只翻一份就够
    if (LEVELS[record.level] >= LEVELS.warn) {
      fs.appendFileSync(path.join(CONFIG.dir, `error-${date}.log`), line, 'utf8');
    }
  } catch (e) {
    // ⚠️ 日志系统自身失败**绝不能拖垮业务**：回落到 stderr，然后继续。
    ready = false; // 允许下次重试建目录（比如权限被修复后能自愈）
    warnSelf(`写日志失败: ${e?.message || e}`);
  }

  if (CONFIG.console) {
    // stdout 保持人类可读（便于直接看终端），文件里才是完整 JSON
    const lv = record.level.toUpperCase().padEnd(5);
    process.stdout.write(`${record.ts} ${lv} ${record.msg}${record.status ? ` status=${record.status}` : ''}${record.requestId ? ` rid=${record.requestId}` : ''}\n`);
  }
}

/**
 * 清理过期日志。**幂等、可重复执行**，启动时跑一次，之后每 6 小时一次。
 *
 * 保留策略只由 `CONFIG.*RetentionDays` 决定 —— "快速修改保留期"改 env 即刻生效，
 * 不需要动代码、不需要清目录。
 */
export function cleanupOldLogs() {
  let removed = 0;
  try {
    ensureDir();
    const now = Date.now();
    const rules = [
      { prefix: 'app-', days: CONFIG.appRetentionDays },
      { prefix: 'error-', days: CONFIG.errorRetentionDays },
    ];
    for (const name of fs.readdirSync(CONFIG.dir)) {
      const rule = rules.find((r) => name.startsWith(r.prefix) && name.endsWith('.log'));
      if (!rule) continue;
      const datePart = name.slice(rule.prefix.length, -4); // 去掉前缀与 .log
      const fileDate = Date.parse(`${datePart}T00:00:00`);
      if (Number.isNaN(fileDate)) continue;
      const ageDays = (now - fileDate) / 86_400_000;
      if (ageDays > rule.days) {
        fs.unlinkSync(path.join(CONFIG.dir, name));
        removed += 1;
      }
    }
  } catch (e) {
    process.stderr.write(`[logger] 清理旧日志失败: ${e?.message || e}\n`);
  }
  return removed;
}

/* ────────────────────────── 关联 ID ────────────────────────── */

/**
 * 从入站请求解析关联 ID。
 *
 * 优先级（对齐业界链路追踪做法）：
 *   1. `X-Request-Id` —— 调用方（如测试平台）传入，**这是链路贯通的关键**
 *   2. `traceparent`（W3C）—— 解析出 trace-id / span-id
 *   3. 都没有 → 自己生成（**绝不空手**，否则这一行日志无法被关联）
 *
 * 返回值同时用于：写日志、回写响应头（让调用方自证链路成立）。
 */
export function resolveRequestIds(req) {
  const headerRid = (req.get?.('x-request-id') || '').trim();
  const traceparent = (req.get?.('traceparent') || '').trim();

  let traceId = '';
  let spanId = '';
  // W3C traceparent: 00-<32hex trace-id>-<16hex parent-id>-<flags>
  const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i.exec(traceparent);
  if (m) {
    traceId = m[1].toLowerCase();
    spanId = m[2].toLowerCase();
  }

  const requestId = headerRid || (traceId ? `${traceId.slice(0, 16)}-${crypto.randomUUID().slice(0, 8)}` : crypto.randomUUID());
  if (!traceId) traceId = crypto.randomUUID().replace(/-/g, '');

  return {
    requestId,
    traceId,
    spanId: spanId || crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    /** 调用方是否带了 ID（用于判断"链路是谁发起的"） */
    inbound: Boolean(headerRid || m),
  };
}

/* ────────────────────────── 对外 API ────────────────────────── */

/**
 * 写一条日志。
 *
 * @param {string} level  debug/info/warn/error/fatal
 * @param {string} msg    人类可读的一句话
 * @param {object} fields 结构化字段（requestId / status / err 等）
 */
export function log(level, msg, fields = {}) {
  const lv = normLevel(level);
  if (LEVELS[lv] < LEVELS[CONFIG.level]) return;

  const { err, ...rest } = fields || {};
  const record = {
    ts: new Date().toISOString(),
    level: lv,
    msg: String(msg ?? ''),
    service: CONFIG.service,
    version: CONFIG.version,
    env: CONFIG.env,
    ...redact(rest),
  };
  if (err) record.err = redact(normalizeErr(err));

  write(record);
}

/** 把任意 throw 出来的东西归一成 `{type, code, message, stack}` */
function normalizeErr(err) {
  if (err == null) return { type: 'Error', message: 'unknown error' };
  if (typeof err === 'string') return { type: 'Error', message: err };
  return {
    type: err.name || err.constructor?.name || 'Error',
    code: err.code || err.errno || undefined,
    message: err.message || String(err),
    stack: typeof err.stack === 'string' ? err.stack.split('\n').slice(0, 12).join('\n') : undefined,
  };
}

/**
 * 生成一个"绑定了固定字段"的子 logger —— 请求级日志用它，
 * 这样每条日志都自动带上 `requestId`，不必在每个调用点手写。
 *
 * @example
 *   const reqLog = logger.child({ requestId: rid, method: 'POST', route: '/api/fitting/take' });
 *   reqLog.info('收到响应', { status: 200, durationMs: 12 });
 */
export function child(bindings = {}) {
  const base = redact(bindings);
  return {
    debug: (msg, fields) => log('debug', msg, { ...base, ...fields }),
    info: (msg, fields) => log('info', msg, { ...base, ...fields }),
    warn: (msg, fields) => log('warn', msg, { ...base, ...fields }),
    error: (msg, fields) => log('error', msg, { ...base, ...fields }),
    fatal: (msg, fields) => log('fatal', msg, { ...base, ...fields }),
    child: (more) => child({ ...base, ...more }),
  };
}

/** 当前配置快照（给 `/api/meta` 展示，便于运维确认策略生效） */
export function logConfig() {
  return {
    level: CONFIG.level,
    dir: CONFIG.dir,
    retentionDays: CONFIG.appRetentionDays,
    errorRetentionDays: CONFIG.errorRetentionDays,
    console: CONFIG.console,
  };
}

/** 启动时的自检信息，写进启动横幅 */
export function describeLogging() {
  return `日志 ${CONFIG.dir} · 级别 ${CONFIG.level} · 保留 ${CONFIG.appRetentionDays} 天（错误 ${CONFIG.errorRetentionDays} 天）`;
}

/* ────────────────────────── 定期清理 ────────────────────────── */

/** 进程存活期间每 6 小时清一次过期日志；`unref` 保证不阻塞进程退出 */
export function startLogMaintenance() {
  const removed = cleanupOldLogs();
  const timer = setInterval(cleanupOldLogs, 6 * 3600 * 1000);
  timer.unref?.();
  return removed;
}

export const logger = { log, child, config: logConfig() };
export default logger;
