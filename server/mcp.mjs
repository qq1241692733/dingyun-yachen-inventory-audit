/**
 * MCP 服务端 —— 对外提供给手机端 AI 助手（豆包 / 扣子 / 任意 MCP 客户端）。
 *
 * 协议：MCP 2025-06-18（向下兼容 2025-03-26 / 2024-11-05）
 * 传输：
 *   · Streamable HTTP —— POST /mcp（JSON-RPC）、GET /mcp（SSE 通知流）、DELETE /mcp（结束会话）
 *   · 旧版 HTTP+SSE —— GET /sse（推 endpoint 事件）、POST /messages?sessionId=（收请求）
 *   两套都实现，是因为各家手机助手的接入方式不统一：豆包/扣子系多用 Streamable HTTP，
 *   部分客户端仍只认旧版 SSE。同一个 server 同时挂两个入口，接哪家都不用改代码。
 *
 * 这里只做「协议 + 工具编排」，业务逻辑全在 domain.mjs，鉴权全在 index.mjs。
 */
import * as store from './store.mjs';
import * as D from './domain.mjs';

export const SERVER_INFO = {
  name: 'dingyun-yachen-inventory',
  title: '鼎运雅辰品质体验中心 · 库存与试衣服务',
  version: '1.0.0',
};

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07'];
export const LATEST_PROTOCOL = PROTOCOL_VERSIONS[0];

const text = (s) => ({ content: [{ type: 'text', text: s }] });
const fail = (s) => ({ content: [{ type: 'text', text: s }], isError: true });

/* ────────────────────────── 工具清单 ────────────────────────── */

const S = {
  str: (description, extra = {}) => ({ type: 'string', description, ...extra }),
  num: (description, extra = {}) => ({ type: 'number', description, ...extra }),
  int: (description, extra = {}) => ({ type: 'integer', description, ...extra }),
};

export const TOOLS = [
  {
    name: 'query_inventory',
    title: '查询库存',
    description:
      '查询门店在库货品（默认只查「在库可用」的）。支持按商品名/条码/尺码/品牌/品类/货权合伙人筛选。返回每件的库存编号、条码、货权归属、入库时间、以及是否正在试衣中。',
    inputSchema: {
      type: 'object',
      properties: {
        query: S.str('关键词，可填商品名、条码、库存编号、颜色或尺码，例如「精油」「SN202609...」「75B」'),
        brand: S.str('品牌：Laca / 蕾薇尔 / 悦己集 / 悦维膳 / 古澜美'),
        category: S.str('品类：美体内衣 / 运动套装 / 精油护肤 / 营养健康'),
        owner: S.str('货权归属的合伙人姓名，例如「付蓉」'),
        status: S.str('库存状态，默认 AVAILABLE（在库可用）。可填 all 查全部，或 SOLD（已售出）等', { default: 'AVAILABLE' }),
        fitting: S.str('筛选试衣状态：in=正在试衣中，out=不在试衣中，all=不限', { enum: ['in', 'out', 'all'], default: 'all' }),
        limit: S.int('返回条数，默认 20，最多 100', { default: 20, minimum: 1, maximum: 100 }),
        offset: S.int('分页偏移，默认 0', { default: 0, minimum: 0 }),
      },
    },
  },
  {
    name: 'query_stock_summary',
    title: '库存汇总',
    description:
      '库存的整体情况：在库总件数、在库总货值、当前试衣中件数，并按品牌 / 品类 / 货权合伙人分组统计。适合回答「现在库存有多少」「谁名下货最多」这类问题。',
    inputSchema: {
      type: 'object',
      properties: {
        by: S.str('分组维度：brand / category / owner / all', { enum: ['brand', 'category', 'owner', 'all'], default: 'all' }),
        owner: S.str('只看某位合伙人名下的货'),
        brand: S.str('只看某个品牌'),
        category: S.str('只看某个品类'),
      },
    },
  },
  {
    name: 'find_item',
    title: '按条码或名称查货',
    description: '用条码 / 库存编号 / 商品名精确定位货品，返回匹配到的每一件（含是否在库、是否正在试衣中、货权归属）。扫码枪或手输条码时用这个。',
    inputSchema: {
      type: 'object',
      properties: {
        query: S.str('条码（如 SN20260912341）、库存编号（INV-202609-...）或商品名'),
      },
      required: ['query'],
    },
  },
  {
    name: 'query_partners',
    title: '查询合伙人名册',
    description: '列出所有合伙人及其在库件数、货值、试衣中件数。登记入库或试衣需要指定货权人时，先用这个确认姓名怎么写。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_inbound_records',
    title: '查入库记录',
    description: '查历史入库记录，按「日」聚合（每天入库多少件、涉及哪些商品、谁经手的）。',
    inputSchema: {
      type: 'object',
      properties: {
        from: S.str('起始日期 YYYY-MM-DD'),
        to: S.str('结束日期 YYYY-MM-DD'),
        limit: S.int('返回天数，默认 20', { default: 20, minimum: 1, maximum: 200 }),
      },
    },
  },
  {
    name: 'list_outbound_records',
    title: '查出库记录',
    description: '查销售出库记录（含货权人、销售人、成交价、是否跨合伙人借调、是否已完成双人电子签名）。',
    inputSchema: {
      type: 'object',
      properties: {
        from: S.str('起始日期 YYYY-MM-DD'),
        to: S.str('结束日期 YYYY-MM-DD'),
        limit: S.int('返回条数，默认 20', { default: 20, minimum: 1, maximum: 200 }),
      },
    },
  },
  {
    name: 'inbound_stock',
    title: '入库登记',
    description:
      '新货入库：把合伙人拿来的货登记进库存，系统会为每一件生成独立库存编号与条码。需要商品名/编号 + 货权合伙人 + 数量。',
    inputSchema: {
      type: 'object',
      properties: {
        product: S.str('商品名称或编号，例如「蕾薇尔 塑身衣」或目录 ID'),
        owner: S.str('货权归属合伙人姓名，例如「付蓉」'),
        quantity: S.int('入库件数，默认 1', { default: 1, minimum: 1, maximum: 200 }),
        size: S.str('尺码 / 规格，例如 75B、30mL、M。不填则取该商品的默认规格'),
        color: S.str('颜色，不填则取商品默认色'),
        entryDate: S.str('入库时间，格式 YYYY-MM-DD HH:mm，不填则为当前时间'),
        operator: S.str('经手人，默认「付蓉 (店长)」', { default: '付蓉 (店长)' }),
      },
      required: ['product', 'owner'],
    },
  },
  {
    name: 'take_for_fitting',
    title: '试衣借出登记',
    description:
      '【最重要】客户要试衣服、店长从货架取货时用这个登记。注意：这只记录一条试衣事件，**不会修改库存状态**，货仍然算该合伙人的在库货。客户不买就调 return_from_fitting，买了就调 intend_purchase。',
    inputSchema: {
      type: 'object',
      properties: {
        item: S.str('货品：条码 / 库存编号 / 商品名（如「精油」）。若有同名多件，可只填商品名让系统提示选择'),
        customerName: S.str('客户称呼，例如「王女士」或「尾号 8823」'),
        customerPhone: S.str('客户手机号（可选）'),
        operator: S.str('经手人，默认「付蓉 (店长)」', { default: '付蓉 (店长)' }),
        note: S.str('备注（可选）'),
      },
      required: ['item'],
    },
  },
  {
    name: 'list_fitting',
    title: '试衣中清单',
    description: '列出正在试衣间、尚未归还也未成交的货品。默认只列未处理的；也可查历史。超过 8 小时未处理会标记 overdue。',
    inputSchema: {
      type: 'object',
      properties: {
        status: S.str('FITTING=未处理（默认）/ RETURNED=已归还 / PURCHASED=已成交 / ALL=全部', { default: 'FITTING' }),
        limit: S.int('返回条数，默认 20', { default: 20, minimum: 1, maximum: 100 }),
      },
    },
  },
  {
    name: 'return_from_fitting',
    title: '试衣归还（客户不购买）',
    description:
      '客户试完不买、把货放回货架时用这个。它会把那条试衣事件标记为「已归还」并消除掉，**同样不产生任何出库记录、不修改库存状态** —— 因为这件货从头到尾就没离开过库存账。',
    inputSchema: {
      type: 'object',
      properties: {
        fittingId: S.str('试衣事件编号（FIT-...），最精确'),
        item: S.str('或直接给商品名 / 客户名，系统从未处理的试衣里匹配'),
        operator: S.str('经手人，默认「付蓉 (店长)」', { default: '付蓉 (店长)' }),
        note: S.str('备注，例如「尺码偏小」'),
      },
    },
  },
  {
    name: 'intend_purchase',
    title: '客户成交（转待签销售单）',
    description:
      '客户试衣后决定购买时用这个。它会生成一张「待签销售单」，货品仍保持在不库状态；**正式出库必须由店长在电脑端完成双人电子签名**，签名完成后才算真正出库。适合手机端先记一笔、回到电脑前再签。',
    inputSchema: {
      type: 'object',
      properties: {
        fittingId: S.str('试衣事件编号（FIT-...），最精确'),
        item: S.str('或直接给商品名 / 客户名'),
        customerName: S.str('客户称呼'),
        seller: S.str('销售人（业绩归属）合伙人姓名，默认取试衣经手人'),
        dealPrice: S.num('成交价，不填按商品指导价'),
        operator: S.str('经手人，默认「付蓉 (店长)」', { default: '付蓉 (店长)' }),
        note: S.str('备注（可选）'),
      },
    },
  },
  {
    name: 'list_pending_sales',
    title: '待签销售单',
    description: '列出手机端已登记成交、但还没在电脑端完成双人电子签名出库的销售单。',
    inputSchema: {
      type: 'object',
      properties: {
        status: S.str('PENDING=待签（默认）/ SIGNED=已签 / ALL=全部', { default: 'PENDING' }),
        limit: S.int('返回条数，默认 20', { default: 20, minimum: 1, maximum: 100 }),
      },
    },
  },
  {
    name: 'recent_activity',
    title: '最近动态',
    description: '最近的进出库、试衣、审计动态，按时间倒序。适合回答「今天店里都发生了什么」。',
    inputSchema: {
      type: 'object',
      properties: { limit: S.int('返回条数，默认 15', { default: 15, minimum: 1, maximum: 100 }) },
    },
  },
];

/* ────────────────────────── 工具实现 ────────────────────────── */

function money(n) {
  return `¥${Number(n || 0).toLocaleString('zh-CN')}`;
}

function summarize(rows, max = 12) {
  return rows.slice(0, max).map((r) => ({
    ...r,
    _line: `${r.productName} ${r.size}${r.color ? `/${r.color}` : ''} · ${money(r.price)} · 货权 ${r.owner} · ${r.barcode}${r.fitting ? ` · 试衣中(${r.fitting.customer || '未知客户'})` : ''}`,
  }));
}

function inventoryText(result) {
  if (!result.items.length) return '没有查到符合条件的在库货品。';
  const head = `共 ${result.total} 件命中（门店在库合计 ${result.inStockTotal} 件），显示第 ${result.offset + 1}–${result.offset + result.returned} 条：`;
  const lines = summarize(result.items).map((r, i) => `${i + 1}. ${r._line}`);
  const tail = result.total > result.offset + result.returned ? `\n（还有 ${result.total - result.offset - result.returned} 条，可用 offset 继续翻页）` : '';
  return `${head}\n${lines.join('\n')}${tail}`;
}

const HANDLERS = {
  query_inventory(args, ctx) {
    const state = store.getState();
    const r = D.queryInventory(state, {
      q: args.query || '',
      brand: args.brand || '',
      category: args.category || '',
      owner: args.owner || '',
      status: args.status || 'AVAILABLE',
      fittingScope: args.fitting || 'all',
      limit: Math.min(100, Number(args.limit) || 20),
      offset: Math.max(0, Number(args.offset) || 0),
    });
    return {
      content: [{ type: 'text', text: inventoryText(r) }],
      structuredContent: { ...r, items: summarize(r.items, 100).map(({ _line, ...x }) => x) },
    };
  },

  query_stock_summary(args) {
    const state = store.getState();
    const s = D.queryStockSummary(state, { by: args.by || 'all', owner: args.owner, brand: args.brand, category: args.category });
    const lines = [
      `在库合计 ${s.inStockCount} 件，货值 ${money(s.inStockValue)}；当前试衣中 ${s.fittingNowCount} 件。`,
    ];
    if (s.byBrand) lines.push(`按品牌：${s.byBrand.map((g) => `${g.key} ${g.count}件/${money(g.value)}`).join('；')}`);
    if (s.byCategory) lines.push(`按品类：${s.byCategory.map((g) => `${g.key} ${g.count}件/${money(g.value)}`).join('；')}`);
    if (s.byOwner) {
      lines.push('按货权合伙人：');
      for (const g of s.byOwner.slice(0, 20)) lines.push(`  · ${g.key}：${g.count} 件 / ${money(g.value)}${g.fittingNow ? `（试衣中 ${g.fittingNow}）` : ''}`);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: s };
  },

  find_item(args) {
    const state = store.getState();
    const hits = D.findItems(state, args.query);
    if (!hits.length) return fail(`没有找到「${args.query}」。可以试试商品名（如「精油」「塑身衣」）或条码。`);
    const rows = hits.map((i) => D.toRecord(state, i));
    const lines = rows.slice(0, 20).map((r, i) => `${i + 1}. ${r.productName} ${r.size}${r.color ? `/${r.color}` : ''} · ${r.statusLabel} · 货权 ${r.owner} · 条码 ${r.barcode}${r.fitting ? ` · 试衣中（客户 ${r.fitting.customer || '未记'}）` : ''}`);
    return {
      content: [{ type: 'text', text: `匹配到 ${rows.length} 件：\n${lines.join('\n')}` }],
      structuredContent: { matched: rows.length, items: rows.slice(0, 20) },
    };
  },

  query_partners() {
    const state = store.getState();
    const list = state.partners.map((p) => {
      const mine = state.items.filter((i) => i.ownerPartnerId === p.id && i.status === 'AVAILABLE');
      const fitting = (state.fittingEvents || []).filter((f) => f.status === 'FITTING' && f.ownerPartnerId === p.id);
      return { name: p.name, role: p.role, phone: p.phone, inStockCount: mine.length, inStockValue: mine.reduce((a, i) => a + (i.price || 0), 0), fittingCount: fitting.length };
    });
    const lines = list.map((p) => `· ${p.name}（${p.role}）：在库 ${p.inStockCount} 件 / ${money(p.inStockValue)}${p.fittingCount ? `，试衣中 ${p.fittingCount}` : ''}`);
    return { content: [{ type: 'text', text: `共 ${list.length} 位合伙人：\n${lines.join('\n')}` }], structuredContent: { partners: list } };
  },

  list_inbound_records(args) {
    const state = store.getState();
    const rows = D.listInboundRecords(state, { from: args.from || '', to: args.to || '', limit: Math.min(200, Number(args.limit) || 20) });
    if (!rows.length) return text('该时间段内没有入库记录。');
    const lines = rows.map((d) => `· ${d.date}：入库 ${d.totalCount} 件 / ${money(d.totalValue)}，经手 ${d.operators.join('、')}；商品：${d.products.map((p) => `${p.name}×${p.count}`).join('、')}`);
    return { content: [{ type: 'text', text: `入库记录（按日聚合，共 ${rows.length} 天）：\n${lines.join('\n')}` }], structuredContent: { days: rows } };
  },

  list_outbound_records(args) {
    const state = store.getState();
    const rows = D.listOutboundRecords(state, { from: args.from || '', to: args.to || '', limit: Math.min(200, Number(args.limit) || 20) });
    if (!rows.length) return text('该时间段内没有销售出库记录。');
    const lines = rows.map((o) => `· ${o.saleDate} ${o.orderId}：${o.productName} ${o.size} · 成交 ${money(o.dealPrice)} · 货权 ${o.owner} / 销售 ${o.seller}${o.crossPartnerBorrow ? '（跨合伙人借调，待还货）' : ''} · ${o.dualSigned ? '已双签' : '未双签'}`);
    return { content: [{ type: 'text', text: `销售出库记录（${rows.length} 条）：\n${lines.join('\n')}` }], structuredContent: { orders: rows } };
  },

  inbound_stock(args) {
    const op = args.operator || '付蓉 (店长)';
    const r = store.mutate(
      (draft) => D.inbound(draft, {
        productName: args.product,
        ownerPartnerName: args.owner,
        quantity: args.quantity,
        size: args.size,
        color: args.color,
        entryDate: args.entryDate,
        operator: op,
      }),
      { channel: 'MCP', operator: op, action: 'inbound_stock', detail: `${args.product} ×${args.quantity || 1} → ${args.owner}` }
    );
    if (!r.ok) return fail(r.message);
    const first = r.created[0];
    return {
      content: [{ type: 'text', text: `${r.message}\n本批条码：${r.created.map((c) => c.barcode).join('、')}` }],
      structuredContent: { revision: r.revision, count: r.created.length, items: r.created, firstBarcode: first.barcode },
    };
  },

  take_for_fitting(args) {
    const op = args.operator || '付蓉 (店长)';
    const r = store.mutate(
      (draft) => D.takeForFitting(draft, { ...args, item: args.item, operator: op, channel: 'MCP' }),
      { channel: 'MCP', operator: op, action: 'fitting.take', detail: `${args.item}${args.customerName ? ` → ${args.customerName}` : ''}` }
    );
    if (!r.ok) {
      const extra = r.candidates ? `\n候选：\n${r.candidates.map((c) => `  · ${c.barcode} ${c.size}${c.color ? `/${c.color}` : ''}（货权 ${c.owner}）`).join('\n')}` : '';
      return fail(`${r.message}${extra}`);
    }
    return {
      content: [{ type: 'text', text: `${r.message}\n${r.reminder}` }],
      structuredContent: { revision: r.revision, fittingId: r.event.id, event: r.event, inventoryUnchanged: true },
    };
  },

  list_fitting(args) {
    const state = store.getState();
    const rows = D.listFitting(state, { status: args.status || 'FITTING', limit: Math.min(100, Number(args.limit) || 20) });
    if (!rows.length) return text(args.status === 'RETURNED' || args.status === 'PURCHASED' ? '没有相关试衣历史记录。' : '当前试衣间没有未处理的货品。');
    const lines = rows.map((f) => {
      const label = f.status === 'FITTING' ? '试衣中' : f.status === 'RETURNED' ? '已归还' : '已成交';
      return `· [${f.id}] ${f.productName} ${f.size}${f.color ? `/${f.color}` : ''} · ${label}${f.customerName ? ` · 客户 ${f.customerName}` : ''} · ${f.takenAt} 借出 by ${f.takenBy} · 货权 ${f.ownerPartnerName}${f.overdue ? ' ⚠️ 已超 8 小时未处理' : ''}`;
    });
    return { content: [{ type: 'text', text: `试衣记录（${rows.length} 条）：\n${lines.join('\n')}` }], structuredContent: { events: rows } };
  },

  return_from_fitting(args) {
    const op = args.operator || '付蓉 (店长)';
    const r = store.mutate(
      (draft) => D.returnFromFitting(draft, { ...args, operator: op }),
      { channel: 'MCP', operator: op, action: 'fitting.return', detail: `${args.fittingId || args.item || args.customerName || ''}` }
    );
    if (!r.ok) return fail(r.message);
    return {
      content: [{ type: 'text', text: r.message }],
      structuredContent: { revision: r.revision, fittingId: r.event.id, status: r.event.status, inventoryUnchanged: true },
    };
  },

  intend_purchase(args) {
    const op = args.operator || '付蓉 (店长)';
    const r = store.mutate(
      (draft) => D.intendPurchase(draft, { ...args, operator: op, channel: 'MCP' }),
      { channel: 'MCP', operator: op, action: 'fitting.purchase', detail: `${args.fittingId || args.item || ''}` }
    );
    if (!r.ok) return fail(r.message);
    return {
      content: [{ type: 'text', text: `${r.message}` }],
      structuredContent: {
        revision: r.revision,
        pendingSaleId: r.pendingSale?.id || null,
        pendingSale: r.pendingSale,
        // 重复登记成交时置 true：模型据此知道"已经记过了"，不必再建一张单
        alreadyDone: Boolean(r.alreadyDone),
        inventoryUnchanged: true,
        nextStep: '请在电脑端「销售出库」完成双人电子签名，签名后才正式出库。',
      },
    };
  },

  list_pending_sales(args) {
    const state = store.getState();
    const rows = D.listPendingSales(state, { status: args.status || 'PENDING', limit: Math.min(100, Number(args.limit) || 20) });
    if (!rows.length) return text('没有待签的销售单。');
    const lines = rows.map((p) => `· [${p.id}] ${p.productName} ${p.size} · 成交价 ${money(p.dealPrice)} · 货权 ${p.ownerPartnerName} / 销售 ${p.sellerPartnerName || '待定'}${p.customerName ? ` · 客户 ${p.customerName}` : ''} · ${p.createdAt} 登记（${p.source}）`);
    return { content: [{ type: 'text', text: `待签销售单（${rows.length} 张，需在电脑端双签）：\n${lines.join('\n')}` }], structuredContent: { pendingSales: rows } };
  },

  recent_activity(args) {
    const state = store.getState();
    const rows = D.recentActivity(state, { limit: Math.min(100, Number(args.limit) || 15) });
    const lines = rows.map((a) => `· ${a.at}【${a.kind}】${a.title} —— ${a.detail}`);
    return { content: [{ type: 'text', text: `最近动态（${rows.length} 条）：\n${lines.join('\n')}` }], structuredContent: { activity: rows } };
  },
};

/* ────────────────────────── 资源 ────────────────────────── */

const RESOURCES = [
  { uri: 'inventory://summary', name: '库存总览', description: '在库件数、货值、按品牌/品类/合伙人分布', mimeType: 'application/json' },
  { uri: 'inventory://fitting-active', name: '试衣中清单', description: '当前试衣间里未归还也未成交的货品', mimeType: 'application/json' },
  { uri: 'inventory://catalog', name: '商品目录', description: '门店经营的全部商品与规格', mimeType: 'application/json' },
  { uri: 'inventory://partners', name: '合伙人名册', description: '合伙人及其在库件数与货值', mimeType: 'application/json' },
];

function readResource(uri) {
  const state = store.getState();
  if (uri === 'inventory://summary') {
    return {
      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(D.queryStockSummary(state, { by: 'all' }), null, 2) }],
    };
  }
  if (uri === 'inventory://fitting-active') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(D.listFitting(state, { status: 'FITTING', limit: 100 }), null, 2) }] };
  }
  if (uri === 'inventory://catalog') {
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(state.catalogs, null, 2) }] };
  }
  if (uri === 'inventory://partners') {
    const partners = state.partners.map((p) => {
      const mine = state.items.filter((i) => i.ownerPartnerId === p.id && i.status === 'AVAILABLE');
      return { name: p.name, role: p.role, inStockCount: mine.length, inStockValue: mine.reduce((a, i) => a + (i.price || 0), 0) };
    });
    return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(partners, null, 2) }] };
  }
  throw new Error(`未知资源：${uri}`);
}

/* ────────────────────────── JSON-RPC 分发 ────────────────────────── */

const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
};

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function err(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

/**
 * 处理一条 JSON-RPC 消息。
 * 返回 null 表示这是通知（notification），不需要回包。
 */
export async function handleRpc(msg, ctx = {}) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
    return err(msg?.id ?? null, ERR.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request');
  }
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        const version = PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL;
        return ok(id, {
          protocolVersion: version,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
            logging: {},
          },
          serverInfo: SERVER_INFO,
          instructions:
            '这是「鼎运雅辰品质体验中心」的门店库存与试衣服务。\n' +
            '关键业务约定：客户试衣时用 take_for_fitting 登记 —— 它只记一条试衣事件，不会改动库存状态；' +
            '客户不买用 return_from_fitting 消除该事件（同样不影响库存）；客户要买用 intend_purchase 生成待签销售单，' +
            '正式出库必须由店长在电脑端完成双人电子签名。' +
            '查库存用 query_inventory / query_stock_summary，查货用 find_item，登记新货入库用 inbound_stock。\n' +
            '涉及合伙人姓名时先用 query_partners 确认，避免写错名字。',
        });
      }

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, { tools: TOOLS });

      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments || {};
        const handler = HANDLERS[name];
        if (!handler) return err(id, ERR.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
        const result = await handler(args, ctx);
        // tools/call 的业务失败按 MCP 规范走 isError，而不是 JSON-RPC error，
        // 这样模型能读到失败原因并自行纠正（比如换个商品名重试）
        return ok(id, result);
      }

      case 'resources/list':
        return ok(id, { resources: RESOURCES });

      case 'resources/read': {
        const uri = params?.uri;
        if (!uri) return err(id, ERR.INVALID_PARAMS, 'resources/read 需要 uri');
        return ok(id, readResource(uri));
      }

      case 'resources/templates/list':
        return ok(id, { resourceTemplates: [] });

      case 'prompts/list':
        return ok(id, { prompts: [] });

      case 'logging/setLevel':
        return ok(id, {});

      case 'completion/complete':
        return ok(id, { completion: { values: [], total: 0, hasMore: false } });

      // 客户端通知，一律静默接受
      case 'notifications/initialized':
      case 'notifications/cancelled':
      case 'notifications/roots/list_changed':
      case 'notifications/progress':
        return null;

      default:
        if (isNotification) return null;
        return err(id, ERR.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
  } catch (e) {
    if (isNotification) return null;
    return err(id, ERR.INTERNAL, e?.message || String(e));
  }
}

/** 批量请求（JSON-RPC batch） */
export async function handleBatch(body, ctx) {
  const items = Array.isArray(body) ? body : [body];
  const results = [];
  for (const m of items) {
    const r = await handleRpc(m, ctx);
    if (r) results.push(r);
  }
  return results;
}
