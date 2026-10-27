/**
 * 鼎运雅辰品质体验中心 —— 对外服务（REST API + MCP + 前端静态托管）
 *
 * 一个端口同时提供三样东西：
 *   1. 门店系统前端（dist/ 静态文件）
 *   2. 前端用的 REST API（/api/*）
 *   3. 给手机端 AI 助手用的 MCP 服务（/mcp 与 /sse）
 *
 * 启动：  node server/index.mjs            （默认端口 3020）
 *        PORT=3020 MCP_AUTH=on node server/index.mjs
 *
 * 环境变量
 *   PORT        监听端口，默认 3020
 *   HOST        监听地址，默认 0.0.0.0（局域网可访问）
 *   MCP_AUTH    off 关闭 MCP 鉴权（仅本机调试用）；默认开启
 *   API_AUTH    on  让 /api/* 也要求 token（把服务暴露到公网时必须开）
 *   MCP_TOKEN   手动指定 token；默认自动生成并存在 server/data/token.txt
 */
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import * as store from './store.mjs';
import * as D from './domain.mjs';
import { handleBatch, TOOLS, SERVER_INFO, LATEST_PROTOCOL } from './mcp.mjs';
import { log, describeLogging, startLogMaintenance, logConfig } from './logger.mjs';
import { installHttpLogging, logBusinessReject } from './http_log.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const TOKEN_FILE = path.join(store.DATA_DIR, 'token.txt');

const PORT = Number(process.env.PORT || 3020);
const HOST = process.env.HOST || '0.0.0.0';
const MCP_AUTH = (process.env.MCP_AUTH || 'on').toLowerCase() !== 'off';
const API_AUTH = (process.env.API_AUTH || 'off').toLowerCase() === 'on';

/* ────────────────────────── 鉴权 ────────────────────────── */

function loadToken() {
  if (process.env.MCP_TOKEN) return process.env.MCP_TOKEN.trim();
  try {
    const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (t) return t;
  } catch {
    /* 首次运行，下面生成 */
  }
  const t = crypto.randomBytes(18).toString('base64url');
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, `${t}\n`, 'utf8');
  return t;
}
const TOKEN = loadToken();

function presentedToken(req) {
  const auth = req.get('authorization') || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  const h = req.get('x-mcp-token') || req.get('x-api-token');
  if (h) return String(h).trim();
  if (req.query?.token) return String(req.query.token).trim();
  return '';
}

function tokenOk(req) {
  const given = presentedToken(req);
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAuth(kind) {
  return (req, res, next) => {
    const need = kind === 'mcp' ? MCP_AUTH : API_AUTH;
    if (!need) return next();
    // 通过鉴权的请求把"谁在调"记进日志上下文——排查时能区分
    // "测试平台在调"和"手机端 AI 在调"，这是两类完全不同的故障面。
    if (tokenOk(req)) {
      const who = presentedToken(req) === process.env.MCP_TOKEN && process.env.MCP_TOKEN ? 'env-token' : 'file-token';
      req.log?.info('鉴权通过', { event: 'auth.pass', kind, tokenSource: who });
      return next();
    }
    req.log?.warn('鉴权失败（令牌缺失或错误）', { event: 'auth.fail', kind, status: 401 });
    res.status(401).json({
      ok: false,
      error: 'UNAUTHORIZED',
      message: `缺少或错误的访问令牌。请在请求头带上 Authorization: Bearer <token>（令牌见服务端启动日志与 server/data/token.txt）。`,
    });
  };
}

/* ────────────────────────── SSE 通道 ────────────────────────── */

/** 旧版 SSE 传输的会话表：sessionId → { res, alive } */
const sseSessions = new Map();

function openSse(res, { endpointEvent } = {}) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  if (endpointEvent) res.write(`event: endpoint\ndata: ${endpointEvent}\n\n`);
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* 连接已断，next tick 会清理 */
    }
  }, 25_000);
  res.on('close', () => clearInterval(ping));
  return ping;
}

/* ────────────────────────── 应用 ────────────────────────── */

const app = express();
app.disable('x-powered-by');
app.set('etag', false);

// ⭐ 可观测性中间件必须**最先**挂：它要注入 requestId、回写响应头、
// 并在 res.on('finish') 里算耗时。挂在 CORS/body 解析之后的话，
// 这两类请求（含 OPTIONS 预检、body 解析失败）就没有访问日志了。
installHttpLogging(app);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    // X-Request-Id / traceparent 必须在白名单里：跨域场景下浏览器会拦掉
    // 未授权的自定义头，不带它的话调用方（AI 测试平台）**发不出链路 ID**，
    // 服务端就只能自己生成、两边对不上，"按 ID 查日志"直接失效。
    'Content-Type, Authorization, Accept, Last-Event-ID, Mcp-Session-Id, MCP-Protocol-Version, X-MCP-Token, X-API-Token, X-Request-Id, X-Operator, traceparent'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    // 暴露出去，浏览器里的调用方才能**读到**服务端回的 requestId，自证链路成立
    'Mcp-Session-Id, MCP-Protocol-Version, X-Request-Id, traceparent'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(
  express.json({
    limit: '24mb',
    type: ['application/json', 'application/*+json', 'text/json'],
  })
);
// MCP 客户端有时不带 Content-Type，宽容一点
app.use(express.text({ limit: '24mb', type: ['text/plain', 'application/jsonl'] }));

function parseBody(req) {
  if (req.body == null || req.body === '') return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function sendResult(res, r, extra = {}) {
  if (!r.ok) {
    const status = r.code === 'NOT_FOUND' ? 404 : 400;
    // ⭐ 补上改造前最大的盲区：domain 层用 `{ok:false}` **返回**而非 throw，
    // 业务拒绝从不经过 error handler，服务端因此零痕迹。这里主动记一笔。
    // 用 `res.req`（Express 提供的反向引用）拿 req，免得改 13 处调用点。
    logBusinessReject(res.req, r, status);
    return res.status(status).json({ ok: false, ...r });
  }
  res.json({ ok: true, ...r, ...extra });
}

/* ────────────────────────── 健康检查 & 元信息 ────────────────────────── */

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: SERVER_INFO,
    revision: store.getRevision(),
    protocol: LATEST_PROTOCOL,
    tools: TOOLS.length,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('/api/meta', (req, res) => {
  // ⚠️ source/updatedAt 各取一次 getState() 会触发两次整仓深拷贝，
  //    解构一次拿全，避免把只读两个标量的请求放大成两次快照。
  const { source, updatedAt } = store.getState();
  res.json({
    ok: true,
    service: SERVER_INFO,
    revision: store.getRevision(),
    source,
    updatedAt,
    llm: {
      streamableHttp: '/mcp',
      legacySse: '/sse',
      messages: '/messages',
      manifest: '/mcp/manifest',
      authRequired: MCP_AUTH,
      protocol: LATEST_PROTOCOL,
    },
    // 日志策略对外可见：运维/测试一眼确认"保留几天、写到哪、什么级别"，
    // 不必登机器翻文件（也是 §日志规范 的自我暴露）。
    logging: logConfig(),
    tools: TOOLS.map((t) => ({ name: t.name, title: t.title })),
  });
});

/* ────────────────────────── MCP ────────────────────────── */

// 人类可读的工具清单（调试 / 给豆包接入时贴配置用）
app.get('/mcp/manifest', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    ok: true,
    server: SERVER_INFO,
    protocolVersion: LATEST_PROTOCOL,
    endpoints: {
      streamableHttp: `${base}/mcp`,
      legacySse: `${base}/sse`,
      legacyMessages: `${base}/messages`,
    },
    auth: MCP_AUTH
      ? { type: 'bearer', header: 'Authorization: Bearer <token>', note: '令牌见服务端启动日志 / server/data/token.txt' }
      : { type: 'none', note: '当前已关闭鉴权（MCP_AUTH=off），仅建议本机调试使用' },
    tools: TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
});

// —— Streamable HTTP ——
app.post('/mcp', requireAuth('mcp'), async (req, res) => {
  const parseError = () =>
    res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });

  // 空报文按 MCP 规范回 400，而不是 200 包一个错误体（部分客户端只认状态码）。
  // 注意：express.json() 会把空 body 解析成 {}，所以"空对象"也要算空报文。
  const b0 = req.body;
  const isEmpty =
    b0 == null ||
    (typeof b0 === 'string' && !b0.trim()) ||
    (typeof b0 === 'object' && !Array.isArray(b0) && Object.keys(b0).length === 0);
  if (isEmpty) return parseError();

  const body = parseBody(req);
  if (!body || (typeof body !== 'object' && !Array.isArray(body))) return parseError();
  const ctx = { channel: 'MCP' };
  const sessionId = req.get('mcp-session-id') || crypto.randomUUID();
  res.setHeader('Mcp-Session-Id', sessionId);

  const results = await handleBatch(body, ctx);

  // 纯通知：按规范回 202 且无 body
  if (!results.length) return res.status(202).end();

  const payload = Array.isArray(body) ? results : results[0];
  res.setHeader('MCP-Protocol-Version', LATEST_PROTOCOL);
  res.json(payload);
});

// —— GET /mcp：SSE 通知流（部分客户端会先 GET）——
app.get('/mcp', requireAuth('mcp'), (req, res) => {
  openSse(res);
  const unsubscribe = store.subscribe((meta) => {
    try {
      res.write(
        `event: message\ndata: ${JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/message',
          params: { level: 'info', logger: 'inventory', data: { revision: meta.revision, action: meta.action } },
        })}\n\n`
      );
    } catch {
      /* 连接断了就算了 */
    }
  });
  res.on('close', unsubscribe);
});

app.delete('/mcp', requireAuth('mcp'), (req, res) => res.json({ ok: true }));

// —— 旧版 HTTP+SSE 传输 ——
app.get('/sse', requireAuth('mcp'), (req, res) => {
  const sessionId = crypto.randomUUID();
  sseSessions.set(sessionId, res);
  openSse(res, { endpointEvent: `/messages?sessionId=${sessionId}` });
  req.on('close', () => sseSessions.delete(sessionId));
});

app.post('/messages', requireAuth('mcp'), async (req, res) => {
  const sessionId = String(req.query.sessionId || '');
  const channel = sseSessions.get(sessionId);
  if (!channel) {
    return res.status(404).json({ ok: false, message: '会话不存在或已结束，请重新连接 /sse' });
  }
  res.status(202).end();
  const results = await handleBatch(parseBody(req), { channel: 'MCP' });
  for (const r of results) {
    try {
      channel.write(`event: message\ndata: ${JSON.stringify(r)}\n\n`);
    } catch {
      /* 连接断了 */
    }
  }
});

/* ────────────────────────── REST：读 ────────────────────────── */

app.get('/api/state', requireAuth('api'), (req, res) => {
  const s = store.getState();
  res.json({ ok: true, ...s });
});

app.get('/api/revision', requireAuth('api'), (req, res) => {
  res.json({ ok: true, revision: store.getRevision(), updatedAt: store.getState().updatedAt });
});

app.get('/api/inventory', requireAuth('api'), (req, res) => {
  const q = req.query;
  const r = D.queryInventory(store.getState(), {
    q: q.q || q.query || '',
    brand: q.brand || '',
    category: q.category || '',
    owner: q.owner || '',
    status: q.status || 'AVAILABLE',
    fittingScope: q.fitting || 'all',
    limit: Math.min(500, Number(q.limit) || 50),
    offset: Number(q.offset) || 0,
    sort: q.sort || 'entryDesc',
  });
  res.json({ ok: true, ...r });
});

app.get('/api/stock-summary', requireAuth('api'), (req, res) => {
  res.json({ ok: true, ...D.queryStockSummary(store.getState(), { by: req.query.by || 'all' }) });
});

app.get('/api/fitting', requireAuth('api'), (req, res) => {
  res.json({ ok: true, events: D.listFitting(store.getState(), { status: req.query.status || 'ALL', limit: 200 }) });
});

app.get('/api/pending-sales', requireAuth('api'), (req, res) => {
  res.json({ ok: true, pendingSales: D.listPendingSales(store.getState(), { status: req.query.status || 'ALL', limit: 200 }) });
});

app.get('/api/activity', requireAuth('api'), (req, res) => {
  res.json({ ok: true, activity: D.recentActivity(store.getState(), { limit: Math.min(200, Number(req.query.limit) || 60) }) });
});

// 前端实时刷新用的 SSE
app.get('/api/events', requireAuth('api'), (req, res) => {
  openSse(res);
  res.write(`event: revision\ndata: ${JSON.stringify({ revision: store.getRevision() })}\n\n`);
  const unsubscribe = store.subscribe((meta) => {
    try {
      res.write(`event: revision\ndata: ${JSON.stringify({ revision: meta.revision, action: meta.action, channel: meta.channel })}\n\n`);
    } catch {
      /* ignore */
    }
  });
  res.on('close', unsubscribe);
});

/* ────────────────────────── REST：写 ────────────────────────── */

const web = (req) => ({
  channel: 'WEB',
  operator: req.get('x-operator') || parseBody(req).operator || '付蓉 (店长)',
});

app.put('/api/state', requireAuth('api'), (req, res) => {
  const body = parseBody(req);
  const r = store.replaceState(body, {
    channel: 'WEB',
    operator: req.get('x-operator') || '付蓉 (店长)',
    action: body.source === 'reset' ? 'state.reset' : 'state.sync',
  });
  res.json({ ok: true, ...r });
});

app.post('/api/reset', requireAuth('api'), (req, res) => {
  res.json({ ok: true, ...store.resetToSeed() });
});

app.post('/api/inbound', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.inbound(s, { ...b, operator: b.operator || '付蓉 (店长)' }), { ...web(req), action: 'inbound' }));
});

app.post('/api/fitting/take', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(
    res,
    store.mutate((s) => D.takeForFitting(s, { ...b, operator: b.operator || '付蓉 (店长)', channel: 'WEB' }), {
      ...web(req),
      action: 'fitting.take',
      detail: `${b.item || b.inventoryItemId || b.barcode || ''}`,
    })
  );
});

app.post('/api/fitting/return', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.returnFromFitting(s, { ...b, operator: b.operator || '付蓉 (店长)' }), { ...web(req), action: 'fitting.return' }));
});

app.post('/api/fitting/purchase', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.intendPurchase(s, { ...b, operator: b.operator || '付蓉 (店长)', channel: 'WEB' }), { ...web(req), action: 'fitting.purchase' }));
});

// 兼容 /api/fitting/:id/return 这类写法
app.post('/api/fitting/:id/return', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.returnFromFitting(s, { ...b, fittingId: req.params.id, operator: b.operator || '付蓉 (店长)' }), { ...web(req), action: 'fitting.return' }));
});
app.post('/api/fitting/:id/purchase', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.intendPurchase(s, { ...b, fittingId: req.params.id, operator: b.operator || '付蓉 (店长)', channel: 'WEB' }), { ...web(req), action: 'fitting.purchase' }));
});

app.post('/api/sale', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.recordSale(s, b), { ...web(req), action: 'sale.outbound', detail: b.inventoryItemId || b.barcode || '' }));
});

app.post('/api/return-order', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.returnOrder(s, b), { ...web(req), action: 'sale.return', detail: b.orderId || '' }));
});

app.post('/api/audit', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.recordAudit(s, b.report || b), { ...web(req), action: 'audit' }));
});

app.post('/api/partner', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.addPartner(s, b), { ...web(req), action: 'partner.add', detail: b.name }));
});

app.post('/api/franchisee', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.addFranchisee(s, b), { ...web(req), action: 'franchisee.add', detail: b.name }));
});

app.post('/api/franchisee/renew', requireAuth('api'), (req, res) => {
  const b = parseBody(req);
  sendResult(res, store.mutate((s) => D.renewFranchisee(s, b.id, b.renewal || b), { ...web(req), action: 'franchisee.renew', detail: b.id }));
});

/* ────────────────────────── 静态托管（放在最后）────────────────────────── */

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, etag: false, maxAge: 0 }));
  app.get(/^\/(?!api\/|mcp|sse|messages|health).*/, (req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(
        `<h2>后端已就绪，但还没有前端产物</h2><p>先运行 <code>npm run build</code> 生成 dist/，或访问 <a href="/health">/health</a>、<a href="/mcp/manifest">/mcp/manifest</a> 查看服务状态。</p>`
      );
  });
}

/* ────────────────────────── 兜底错误处理 ────────────────────────── */

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    // 报文不是合法 JSON —— 多半是调用方（测试脚本）构造错了，属"可归因到脚本"的一类，
    // 但它**必须留痕**：否则排查时只会看到"400 但服务端什么都没记"。
    req.log?.warn('请求体不是合法 JSON', { event: 'http.bad_json', status: 400, err });
    return res.status(400).json({ ok: false, error: 'BAD_JSON', message: '请求体不是合法 JSON' });
  }
  // 真正未捕获异常：服务端自己的锅，error 级 + 完整 stack。
  // 注意 `err` 会经 logger 归一成 {type, code, message, stack} 并脱敏。
  req.log?.error('未捕获异常', { event: 'http.unhandled', status: 500, err });
  res.status(500).json({ ok: false, error: 'INTERNAL', message: err?.message || '服务内部错误' });
});

/* ────────────────────────── 启动 ────────────────────────── */

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === 'IPv4' && !ni.internal) out.push({ name, address: ni.address });
    }
  }
  return out;
}

store.load();

// 清理过期日志（启动时一次，此后每 6 小时一次）。保留期由 env 决定，见 logger.mjs。
const purged = startLogMaintenance();

const server = app.listen(PORT, HOST, () => {
  const rev = store.getRevision();
  const s = store.getState();

  // 启动本身要留痕：排查"服务什么时候重启过、当时是哪个版本、保留策略是什么"，
  // 只能靠这一条 —— 它也是日志文件的第一行，充当"日志格式版本"的锚点。
  log('info', '服务启动完成', {
    event: 'app.start',
    port: PORT,
    host: HOST,
    pid: process.pid,
    node: process.version,
    mcpAuth: MCP_AUTH,
    apiAuth: API_AUTH,
    revision: rev,
    logDir: logConfig().dir,
    retentionDays: logConfig().appRetentionDays,
    purgedFiles: purged,
  });

  const lines = [
    '',
    '  鼎运雅辰品质体验中心 · 对外服务已启动',
    `  ─────────────────────────────────────────────`,
    `  本机        http://127.0.0.1:${PORT}/`,
    ...lanAddresses().map((a) => `  局域网      http://${a.address}:${PORT}/   (${a.name})`),
    '',
    `  MCP 地址    http://<本机IP>:${PORT}/mcp   （Streamable HTTP，推荐）`,
    `              http://<本机IP>:${PORT}/sse   （旧版 SSE，兼容用）`,
    `  工具清单    http://127.0.0.1:${PORT}/mcp/manifest`,
    '',
    `  访问令牌    ${TOKEN}`,
    `  MCP 鉴权    ${MCP_AUTH ? '开启（请求头 Authorization: Bearer <令牌>）' : '⚠️ 已关闭（MCP_AUTH=off）'}`,
    `  API 鉴权    ${API_AUTH ? '开启' : '关闭（前端页面可直接读写；如需暴露公网请设 API_AUTH=on）'}`,
    '',
    `  数据修订号  r${rev} · 在库 ${s.items.filter((i) => i.status === 'AVAILABLE').length} 件 · 试衣中 ${s.fittingEvents.filter((f) => f.status === 'FITTING').length} 件 · 合伙人 ${s.partners.length} 位`,
    '',
    `  ${describeLogging()}${purged ? ` · 已清理 ${purged} 个过期文件` : ''}`,
    `  链路追踪    X-Request-Id / traceparent 已支持（响应头回传，可用它检索日志）`,
    '',
  ];
  console.log(lines.join('\n'));
});

function shutdown(signal) {
  log('info', '收到关闭信号，正在退出', { event: 'app.shutdown', signal });
  server.close(() => process.exit(0));
  // 兜底：连接未断时最多等 3 秒，避免进程卡住
  setTimeout(() => process.exit(0), 3000).unref?.();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
