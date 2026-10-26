/**
 * HTTP 可观测性中间件 —— 请求 ID 注入 + 访问日志 + 错误日志。
 *
 * 与 `logger.mjs` 的分工：`logger.mjs` 只负责"写一行结构化日志"，
 * 本文件负责"在 HTTP 生命周期里的哪几个点写"。
 *
 * ## 为什么访问日志必须记在这些点上
 *
 * 排查一次失败的接口调用，需要回答三个问题，缺一不可：
 *
 * | 问题 | 由哪条日志回答 |
 * | :--- | :--- |
 * | 请求到没到服务端？ | `http.request`（收到请求时立刻记，**在处理器之前**） |
 * | 服务端返回了什么？ | `http.response`（响应完成时记，带 status / durationMs） |
 * | 业务为什么拒绝？ | `business.reject`（`ok:false` 时记，带 code/message） |
 *
 * ⚠️ 第三条是改造前的**最大盲区**：`domain.mjs` 用 `{ok:false, code, message}`
 * **返回**而不是 `throw`，永远不经过 Express 的 error handler，
 * 所以「货品不存在」「已在试衣间」这类业务拒绝在服务端**零痕迹**。
 * 必须由 `sendResult()` 主动记账（见 `index.mjs`）。
 *
 * ## 关联 ID（链路追踪）
 *
 * - **入站**：`X-Request-Id` / `traceparent`（W3C），没有就自己生成 —— 见 `logger.resolveRequestIds`
 * - **响应**：**回写** `X-Request-Id` 和 `traceparent` 响应头。
 *   这一步是"链路自证"的关键：调用方（AI 测试平台）拿到同一个 ID，
 *   就知道"我在服务端日志里按这个 ID 一定能找到这次请求"；
 *   拿不到，就说明服务端没按规范来，调用方可以据此降级为"按时间窗 + 路径"定位。
 */
import crypto from 'node:crypto';

import { child, resolveRequestIds } from './logger.mjs';

/** 不记访问日志的路径（探活/静态资源会把日志刷满，且无排查价值） */
const SILENT_PATHS = [/^\/health$/, /^\/api\/meta$/, /^\/mcp\/manifest$/, /^\/favicon\.ico$/];
const isStaticAsset = (p) => /\.(?:css|js|map|png|jpe?g|svg|gif|ico|woff2?|webp)$/i.test(p);

/**
 * 安装可观测性中间件。**必须在所有路由之前 `app.use()`**，
 * 否则 `res.on('finish')` 挂不上、耗时也算不准。
 *
 * @param {import('express').Express} app
 */
export function installHttpLogging(app) {
  // ① 关联 ID：注入到 req，并立刻回写响应头
  app.use((req, res, next) => {
    const ids = resolveRequestIds(req);
    req.ids = ids;

    // W3C traceparent 需要 32 位 trace-id + 16 位 span-id
    res.setHeader('X-Request-Id', ids.requestId);
    res.setHeader('traceparent', `00-${ids.traceId}-${ids.spanId}-01`);

    const start = process.hrtime.bigint();
    const reqLog = child({
      requestId: ids.requestId,
      traceId: ids.traceId,
      spanId: ids.spanId,
      method: req.method,
      route: req.path,
      // 经手人/通道：业务日志里也要，放这里一次带上
      operator: decodeHeaderText(req.get('x-operator')),
    });
    req.log = reqLog;

    const silent = SILENT_PATHS.some((re) => re.test(req.path)) || (req.method === 'GET' && isStaticAsset(req.path));

    if (!silent) {
      // ② 收到请求（在处理器之前）—— 哪怕处理器挂了，也能证明"请求到了"
      reqLog.info('收到请求', { event: 'http.request', query: redactQuery(req.query) });
    }

    // ③ 响应完成
    res.on('finish', () => {
      if (silent) return;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      // content-length 由不同写入方式设置时类型不一致（有时 number 有时 string），
      // 统一成 number —— 字段类型稳定是"能用 SQL/ES 直接聚合"的前提。
      const rawLen = res.getHeader('content-length');
      const length = rawLen === undefined ? null : Number(rawLen);
      const fields = {
        event: 'http.response',
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        length: Number.isFinite(length) ? length : null,
      };
      // 5xx 是服务端自己的问题，用 error；4xx 是调用方/业务问题，用 warn
      if (res.statusCode >= 500) reqLog.error('响应完成（服务端错误）', fields);
      else if (res.statusCode >= 400) reqLog.warn('响应完成（客户端或业务错误）', fields);
      else reqLog.info('响应完成', fields);
    });

    next();
  });
}

/**
 * 记录一次业务拒绝（`ok:false`）。
 *
 * 由 `sendResult()` 调用 —— 这是补齐"业务拒绝零痕迹"盲区的那一笔。
 * 用 warn 级：它**不是服务端故障**（不该进 error 档当告警），
 * 但**是失败排查必须的证据**（所以不能是 info 被级别过滤掉）。
 *
 * @param {import('express').Request} req
 * @param {{code?:string, message?:string}} result mutator/domain 返回的拒绝结果
 * @param {number} status 实际返回的 HTTP 状态码
 */
export function logBusinessReject(req, result, status) {
  const log = req.log;
  if (!log) return;
  log.warn(result?.message || '业务拒绝', {
    event: 'business.reject',
    status,
    code: result?.code || 'REJECTED',
    // domain 层拒绝时常回带可选清单（如 takeForFitting 的 candidates），一并记下便于复盘
    detail: pickDetail(result),
  });
}

/** 从拒绝结果里挑出"给人以判断"的小字段，不要把整个 state 记进去 */
function pickDetail(result) {
  if (!result || typeof result !== 'object') return null;
  const out = {};
  for (const k of ['detail', 'candidates', 'item', 'inventoryItemId', 'barcode', 'fittingId', 'productId']) {
    if (result[k] !== undefined) out[k] = result[k];
  }
  return Object.keys(out).length ? out : null;
}

/**
 * 还原请求头里的非 ASCII 文本（如经手人姓名）。
 *
 * HTTP 头部按规范是 latin1，Node 也按 latin1 解出来，
 * 所以客户端发 UTF-8 字节时「李四」会变成「æŽå››」。
 * 这里把 latin1 字节重新按 UTF-8 解一遍；解不通（说明客户端发的本来就是
 * ASCII，或用的是 GBK 等别的编码）就保留原值，绝不丢信息。
 */
function decodeHeaderText(v) {
  if (!v || typeof v !== 'string') return null;
  if (!/[\u0080-ÿ]/.test(v)) return v; // 纯 ASCII，无需处理
  const bytes = Buffer.from(v, 'latin1');
  // 首选 UTF-8（浏览器/现代客户端的实际编码）
  const utf8 = bytes.toString('utf8');
  if (!utf8.includes('�')) return utf8;
  // 解不出 UTF-8，再试 GBK（Windows 中文环境的老客户端）
  try {
    const gbk = new TextDecoder('gbk', { fatal: true }).decode(bytes);
    if (gbk && !gbk.includes('�')) return gbk;
  } catch {
    /* 环境不支持 gbk，忽略 */
  }
  // 都解不通：保留原始 latin1 值，绝不丢信息
  return v;
}

/** query 里可能带 token（本项目令牌三种携带方式之一就是 `?token=`），必须脱敏 */
function redactQuery(query) {
  if (!query || typeof query !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(query)) {
    out[k] = /token|key|secret|password/i.test(k) ? '***' : v;
  }
  return out;
}
