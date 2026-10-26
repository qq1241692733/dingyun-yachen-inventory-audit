/**
 * 鼎运雅辰品质体验中心 —— REST API 接口文档生成器
 *
 * 输出三种格式的接口文档（JSON）：
 *   1. OpenAPI 3.1.x     → api-docs/openapi-3.1.json
 *   2. OpenAPI 3.0.x     → api-docs/openapi-3.0.json
 *   3. Swagger 2.0       → api-docs/swagger-2.0.json
 *
 * 唯一权威源：本文件下方的 SCHEMAS 与 PATHS。
 * 新增 / 修改接口时只需改这里，然后重跑：npm run openapi
 *
 * 运行：node server/scripts/generate-openapi.mjs
 *
 * 格式差异处理：
 *   · OpenAPI 3.1 —— 可空字段用 JSON Schema 2020-12 写法 type: ["string","null"]
 *   · OpenAPI 3.0 —— 可空字段用 nullable: true
 *   · Swagger 2.0 —— 可空字段用 x-nullable: true；requestBody 转为 in: body 参数；
 *                    媒体类型收敛为 consumes / produces；删掉 schema 内 example
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'api-docs');

const SERVER = {
  title: '鼎运雅辰品质体验中心 · 对外服务 API',
  version: '1.0.0',
  description: [
    '鼎运雅辰品质体验中心门店系统的对外 REST API，覆盖库存、试衣、销售、合伙人、加盟商等业务。',
    '',
    '服务同时提供：',
    '- REST API（本文档描述，/api/*）',
    '- MCP 服务（/mcp、/sse、/messages，JSON-RPC 2.0，供手机端 AI 助手接入）',
    '- 前端静态页面（/）',
    '',
    '鉴权说明：',
    '- MCP 端点默认要求 Bearer Token（请求头 `Authorization: Bearer <token>`，令牌见服务端启动日志与 server/data/token.txt）；',
    '- REST API 默认不鉴权（供局域网内前端页面直连），如需暴露公网请设环境变量 `API_AUTH=on`，开启后与 MCP 相同的 Bearer 校验生效。',
    '',
    '通用响应包裹：',
    '```json',
    '{ "ok": true, ...业务字段 }',
    '{ "ok": false, "code": "业务错误码", "message": "人话描述" }',
    '```',
    '',
    '通用错误码：400 BAD_JSON（请求体不是合法 JSON）、401 UNAUTHORIZED（令牌缺失/错误，仅开启鉴权时）、404 NOT_FOUND、500 INTERNAL（服务内部错误）。业务拒绝均以 HTTP 400（或 404）返回 `ok:false` + 业务 `code`。',
    '',
    '接口清单由 server/scripts/generate-openapi.mjs 从 server/index.mjs 手工同步生成，修改接口后请重新执行 `npm run openapi`。',
  ].join('\n'),
};

/* ────────────────────────── 共享 Schema ──────────────────────────
 * 统一使用「OpenAPI 3.0 风格 + nullable 标记」编写，由三个渲染器分别转换。
 * nullable: true 表示该字段可能为 null。
 */

const enumStatus = { AVAILABLE: '在库可用', SOLD: '已售出', BORROWED_SOLD: '借调已售', RETURNED: '已归还' };

const SCHEMAS = {
  ApiEnvelope: {
    type: 'object',
    properties: {
      ok: { type: 'boolean', description: '操作是否成功' },
    },
  },
  ApiError: {
    type: 'object',
    description: '失败响应（HTTP 400/404/401/500 或业务拒绝）',
    properties: {
      ok: { type: 'boolean', description: '恒为 false' },
      code: { type: 'string', description: '机器可读错误码，如 ITEM_NOT_FOUND、SIGNATURE_REQUIRED' },
      message: { type: 'string', description: '面向用户的错误说明' },
      candidates: {
        type: 'array',
        nullable: true,
        description: '部分错误附带候选清单（如试衣借出歧义时的可选项）',
        items: { $ref: '#/components/schemas/Candidate' },
      },
    },
  },
  Candidate: {
    type: 'object',
    properties: {
      inventoryId: { type: 'string' },
      barcode: { type: 'string' },
      size: { type: 'string' },
      color: { type: 'string' },
      owner: { type: 'string' },
    },
  },

  /* —— 数据仓实体（server/data/seed.json 结构）—— */
  Catalog: {
    type: 'object',
    description: '商品目录条目',
    properties: {
      id: { type: 'string', example: 'laca-bra-gold' },
      brand: { type: 'string', example: 'Laca' },
      category: { type: 'string', example: '美体内衣' },
      name: { type: 'string', example: '调整型文胸' },
      color: { type: 'string', example: '金色' },
      regularSizes: { type: 'array', items: { type: 'string' }, example: ['75B', '80B'] },
      customSizes: { type: 'array', nullable: true, items: { type: 'string' } },
      price: { type: 'number', example: 1880 },
      unit: { type: 'string', example: '件' },
    },
  },
  InventoryItem: {
    type: 'object',
    description: '库存货品（一件一码）',
    properties: {
      id: { type: 'string', example: 'INV-202608-1001' },
      barcode: { type: 'string', example: 'SN2026081001' },
      productId: { type: 'string', example: 'laca-bra-gold' },
      productName: { type: 'string', example: '调整型文胸' },
      brand: { type: 'string', example: 'Laca' },
      category: { type: 'string', example: '美体内衣' },
      color: { type: 'string', example: '金色' },
      size: { type: 'string', example: '75B' },
      price: { type: 'number', example: 1880 },
      ownerPartnerId: { type: 'string', example: 'p-01' },
      ownerPartnerName: { type: 'string', example: '付蓉 (店长)' },
      entryDate: { type: 'string', example: '2026-08-10 10:30', description: '入库时间（YYYY-MM-DD HH:mm）' },
      entryOperator: { type: 'string', example: '付蓉 (店长)' },
      status: { type: 'string', enum: Object.keys(enumStatus), description: Object.entries(enumStatus).map(([k, v]) => `${k}=${v}`).join('；') },
      soldDate: { type: 'string', nullable: true, description: '售出时间，未售出为 null' },
      soldByPartnerId: { type: 'string', nullable: true },
      soldByPartnerName: { type: 'string', nullable: true },
      isBorrowedSale: { type: 'boolean', nullable: true, description: '是否借调销售（货权人与销售人不同）' },
      expectedReturnDate: { type: 'string', nullable: true },
      saleOrderId: { type: 'string', nullable: true, example: 'SO-202609-0001' },
    },
  },
  InventoryRecord: {
    type: 'object',
    description: '库存查询返回的台账记录（含状态中文标签与试衣信息）',
    properties: {
      inventoryId: { type: 'string' },
      barcode: { type: 'string' },
      productName: { type: 'string' },
      brand: { type: 'string' },
      category: { type: 'string' },
      size: { type: 'string' },
      color: { type: 'string' },
      price: { type: 'number' },
      owner: { type: 'string', description: '货权合伙人姓名' },
      ownerId: { type: 'string' },
      entryDate: { type: 'string' },
      status: { type: 'string', enum: Object.keys(enumStatus) },
      statusLabel: { type: 'string', description: '状态中文标签' },
      fitting: {
        type: 'object',
        nullable: true,
        description: '若正在试衣则返回试衣信息，否则为 null',
        properties: {
          fittingId: { type: 'string' },
          customer: { type: 'string' },
          since: { type: 'string', description: '借出时间' },
        },
      },
      soldDate: { type: 'string', nullable: true },
    },
  },
  FittingEvent: {
    type: 'object',
    description: '试衣事件。注意业务约定：试衣借出/归还不修改库存状态，只记事件',
    properties: {
      id: { type: 'string', example: 'FIT-202609-0001' },
      inventoryItemId: { type: 'string' },
      barcode: { type: 'string' },
      productId: { type: 'string' },
      productName: { type: 'string' },
      brand: { type: 'string' },
      category: { type: 'string' },
      color: { type: 'string' },
      size: { type: 'string' },
      price: { type: 'number' },
      ownerPartnerId: { type: 'string' },
      ownerPartnerName: { type: 'string' },
      customerName: { type: 'string', description: '客户姓名，可空' },
      customerPhone: { type: 'string', description: '客户电话，可空' },
      takenAt: { type: 'string', description: '借出时间' },
      takenBy: { type: 'string', description: '经手人' },
      status: { type: 'string', enum: ['FITTING', 'RETURNED', 'PURCHASED'], description: 'FITTING=试衣中 RETURNED=已归还 PURCHASED=已成交' },
      resolvedAt: { type: 'string', nullable: true, description: '结案时间' },
      resolvedBy: { type: 'string', nullable: true },
      note: { type: 'string' },
      source: { type: 'string', enum: ['MCP', 'WEB'], description: '登记来源' },
      saleOrderId: { type: 'string', nullable: true },
      hoursElapsed: { type: 'number', nullable: true, description: '借出至今小时数（仅 /api/fitting 返回）' },
      overdue: { type: 'boolean', nullable: true, description: '试衣是否超 8 小时（仅 /api/fitting 返回）' },
    },
  },
  PendingSale: {
    type: 'object',
    description: '待签销售单（试衣成交后生成，需电脑端双人电子签名后正式出库）',
    properties: {
      id: { type: 'string', example: 'PS-202609-0001' },
      fittingId: { type: 'string' },
      inventoryItemId: { type: 'string' },
      barcode: { type: 'string' },
      productName: { type: 'string' },
      brand: { type: 'string' },
      category: { type: 'string' },
      color: { type: 'string' },
      size: { type: 'string' },
      price: { type: 'number' },
      dealPrice: { type: 'number', description: '成交价' },
      ownerPartnerId: { type: 'string' },
      ownerPartnerName: { type: 'string' },
      sellerPartnerId: { type: 'string' },
      sellerPartnerName: { type: 'string' },
      customerName: { type: 'string' },
      customerPhone: { type: 'string' },
      createdAt: { type: 'string' },
      createdBy: { type: 'string' },
      note: { type: 'string' },
      source: { type: 'string', enum: ['MCP', 'WEB'] },
      status: { type: 'string', enum: ['PENDING', 'SIGNED'], description: 'PENDING=待签 SIGNED=已双签出库' },
      signedAt: { type: 'string', nullable: true },
      saleOrderId: { type: 'string', nullable: true },
    },
  },
  SalesOrder: {
    type: 'object',
    description: '销售出库单（双人电子签名后生成）',
    properties: {
      id: { type: 'string', example: 'SO-202609-0001' },
      inventoryItemId: { type: 'string' },
      barcode: { type: 'string' },
      productName: { type: 'string' },
      brand: { type: 'string' },
      category: { type: 'string' },
      color: { type: 'string' },
      size: { type: 'string' },
      price: { type: 'number' },
      dealPrice: { type: 'number' },
      ownerPartnerId: { type: 'string' },
      ownerPartnerName: { type: 'string' },
      sellerPartnerId: { type: 'string' },
      sellerPartnerName: { type: 'string' },
      saleDate: { type: 'string', description: '销售时间' },
      isCrossPartnerBorrow: { type: 'boolean', description: '是否借调销售' },
      expectedReturnDate: { type: 'string', nullable: true },
      returnStatus: { type: 'string', nullable: true, enum: ['PENDING', 'RESOLVED'], description: '借调还货状态，非借调为 null' },
      actualReturnDate: { type: 'string', nullable: true },
      managerSignature: { type: 'string', description: '店长电子签名（data URL）' },
      sellerSignature: { type: 'string', description: '销售人电子签名（data URL）' },
      managerName: { type: 'string' },
      remarks: { type: 'string' },
    },
  },
  Partner: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'p-01' },
      name: { type: 'string', example: '付蓉 (店长)' },
      phone: { type: 'string' },
      role: { type: 'string', example: '店长' },
      joinDate: { type: 'string', example: '2024-01-10' },
    },
  },
  Franchisee: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'FC-001' },
      name: { type: 'string' },
      phone: { type: 'string' },
      teamName: { type: 'string' },
      rentAmount: { type: 'number' },
      paymentDate: { type: 'string' },
      expireDate: { type: 'string' },
      notes: { type: 'string', nullable: true },
      renewalHistory: {
        type: 'array',
        nullable: true,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            franchiseeId: { type: 'string' },
            franchiseeName: { type: 'string' },
            renewDate: { type: 'string' },
            amount: { type: 'number' },
            previousExpireDate: { type: 'string' },
            newExpireDate: { type: 'string' },
            managerName: { type: 'string' },
            managerSignature: { type: 'string' },
            franchiseeSignature: { type: 'string' },
            notes: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  AuditReport: {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'AUD-202608-31' },
      auditDate: { type: 'string' },
      auditType: { type: 'string', enum: ['MONTHLY', 'WEEKLY', 'DAILY'], description: '月度全盘 / 周抽检 / 日盘' },
      isMandatoryMonthly: { type: 'boolean' },
      totalSystemCount: { type: 'number', description: '账存数量' },
      totalPhysicalCount: { type: 'number', description: '实存数量' },
      discrepancyCount: { type: 'number', description: '差异件数' },
      status: { type: 'string', enum: ['COMPLETED'] },
      inspectorName: { type: 'string' },
      managerName: { type: 'string' },
      inspectorSignature: { type: 'string' },
      managerSignature: { type: 'string' },
      summary: { type: 'string' },
      createdAt: { type: 'string' },
      items: { type: 'array', items: { type: 'object', additionalProperties: true } },
    },
  },
  OpLogEntry: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      at: { type: 'string' },
      channel: { type: 'string', enum: ['WEB', 'MCP'] },
      operator: { type: 'string' },
      action: { type: 'string' },
      detail: { type: 'string' },
    },
  },
  State: {
    type: 'object',
    description: '数据仓全量状态（唯一真源 server/data/store.json）',
    properties: {
      revision: { type: 'number', description: '数据修订号，每次变更 +1' },
      updatedAt: { type: 'string', description: 'ISO 8601 时间' },
      source: { type: 'string', description: '数据来源：seed / empty / frontend' },
      catalogs: { type: 'array', items: { $ref: '#/components/schemas/Catalog' } },
      items: { type: 'array', items: { $ref: '#/components/schemas/InventoryItem' } },
      partners: { type: 'array', items: { $ref: '#/components/schemas/Partner' } },
      salesOrders: { type: 'array', items: { $ref: '#/components/schemas/SalesOrder' } },
      auditReports: { type: 'array', items: { $ref: '#/components/schemas/AuditReport' } },
      franchisees: { type: 'array', items: { $ref: '#/components/schemas/Franchisee' } },
      fittingEvents: { type: 'array', items: { $ref: '#/components/schemas/FittingEvent' } },
      pendingSales: { type: 'array', items: { $ref: '#/components/schemas/PendingSale' } },
      opLog: { type: 'array', items: { $ref: '#/components/schemas/OpLogEntry' } },
    },
  },

  /* —— 查询结果 —— */
  InventoryPage: {
    type: 'object',
    properties: {
      total: { type: 'number', description: '符合条件总数' },
      returned: { type: 'number', description: '本页返回条数' },
      offset: { type: 'number' },
      limit: { type: 'number' },
      inStockTotal: { type: 'number', description: '全仓在库总数' },
      items: { type: 'array', items: { $ref: '#/components/schemas/InventoryRecord' } },
    },
  },
  StockSummary: {
    type: 'object',
    properties: {
      scope: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          brand: { type: 'string' },
          category: { type: 'string' },
        },
      },
      inStockCount: { type: 'number', description: '在库件数' },
      inStockValue: { type: 'number', description: '在库货值（按标价合计）' },
      fittingNowCount: { type: 'number', description: '当前试衣中件数' },
      byBrand: {
        type: 'array',
        nullable: true,
        description: '按品牌分组（by=all|brand 时返回）',
        items: { $ref: '#/components/schemas/GroupStat' },
      },
      byCategory: {
        type: 'array',
        nullable: true,
        description: '按品类分组（by=all|category 时返回）',
        items: { $ref: '#/components/schemas/GroupStat' },
      },
      byOwner: {
        type: 'array',
        nullable: true,
        description: '按货权合伙人分组（by=all|owner 时返回，附试衣中数）',
        items: { $ref: '#/components/schemas/OwnerStat' },
      },
    },
  },
  GroupStat: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      count: { type: 'number' },
      value: { type: 'number' },
    },
  },
  OwnerStat: {
    type: 'object',
    properties: {
      key: { type: 'string' },
      label: { type: 'string' },
      count: { type: 'number' },
      value: { type: 'number' },
      fittingNow: { type: 'number' },
    },
  },
  ActivityEntry: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['INBOUND', 'OUTBOUND_SALE', 'FITTING_TAKE', 'FITTING_RETURN', 'FITTING_PURCHASED', 'INVENTORY_AUDIT', 'MCP_OP'],
      },
      at: { type: 'string' },
      title: { type: 'string' },
      detail: { type: 'string' },
    },
  },
  HealthInfo: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      service: { type: 'object', additionalProperties: true, description: '服务信息（名称/版本）' },
      revision: { type: 'number' },
      protocol: { type: 'string', description: 'MCP 协议版本' },
      tools: { type: 'number', description: 'MCP 工具数量' },
      uptimeSec: { type: 'number' },
    },
  },
  MetaInfo: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      service: { type: 'object', additionalProperties: true },
      revision: { type: 'number' },
      source: { type: 'string' },
      updatedAt: { type: 'string' },
      llm: {
        type: 'object',
        properties: {
          streamableHttp: { type: 'string' },
          legacySse: { type: 'string' },
          messages: { type: 'string' },
          manifest: { type: 'string' },
          authRequired: { type: 'boolean' },
          protocol: { type: 'string' },
        },
      },
      tools: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' } } } },
    },
  },
};

/* 通用成功响应：{ ok: true, ...业务字段 } */
function okRes(desc, schemaRef, extra = {}) {
  const res = {
    description: desc,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean', example: true } },
        },
      },
    },
  };
  if (schemaRef) {
    res.content['application/json'].schema = { type: 'object', properties: { ok: { type: 'boolean' }, ...extra } };
    res.content['application/json'].schema.properties = { ...res.content['application/json'].schema.properties };
    res.content['application/json'].schema.additionalProperties = { $ref: schemaRef };
  } else if (Object.keys(extra).length) {
    res.content['application/json'].schema = {
      type: 'object',
      properties: { ok: { type: 'boolean' }, ...extra },
    };
  }
  return res;
}

/* 内联成功响应（给定字段） */
function inlineOk(desc, fields) {
  return {
    description: desc,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, ...fields },
        },
      },
    },
  };
}

const errRes = (desc) => ({ description: desc, content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } });

const auth = { description: 'Bearer Token 鉴权（API_AUTH=on 时生效；MCP 端点默认生效）' };
const bearerSecurity = [{ bearerAuth: [] }];

/* ────────────────────────── 路径定义 ──────────────────────────
 * method: { summary, description?, tags?, params?, body?, bodySchema?, bodyRequired?, responses, security?, produces? }
 */
const PATHS = {
  '/health': {
    get: {
      summary: '健康检查',
      description: '服务存活与基本信息（协议版本、修订号、MCP 工具数）。无需鉴权。',
      tags: ['系统'],
      responses: { 200: okRes('服务健康信息', null, { service: { type: 'object' }, revision: { type: 'number' }, protocol: { type: 'string' }, tools: { type: 'number' }, uptimeSec: { type: 'number' } }) },
    },
  },

  '/api/meta': {
    get: {
      summary: '服务元信息',
      description: '返回服务信息、当前数据修订号、MCP 接入点与工具清单（标题）。',
      tags: ['系统'],
      responses: { 200: { description: '元信息', content: { 'application/json': { schema: { $ref: '#/components/schemas/MetaInfo' } } } } },
    },
  },

  '/mcp/manifest': {
    get: {
      summary: 'MCP 工具清单（人类可读）',
      description: '列出 MCP 服务接入地址、鉴权方式与全部工具（含 inputSchema）。供对接时贴配置用。',
      tags: ['MCP'],
      responses: { 200: { description: 'MCP 清单', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
    },
  },

  '/api/state': {
    get: {
      summary: '获取全量数据状态',
      description: '返回数据仓全量状态（库存、试衣、销售、合伙人、加盟商、审计、操作日志等）。前端首屏与刷新用。',
      tags: ['数据'],
      security: bearerSecurity,
      responses: {
        200: { description: '全量状态', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: { $ref: '#/components/schemas/State' } } } } },
        401: errRes('未授权'),
      },
    },
    put: {
      summary: '全量替换状态',
      description: '把前端本地数据整仓灌入（首次接管 / 电子表格全量同步）。只合并 items、partners、salesOrders、auditReports、franchisees、fittingEvents、pendingSales 七个数组，revision 自动 +1。',
      tags: ['数据'],
      security: bearerSecurity,
      body: { schemaRef: '#/components/schemas/State', required: true, description: '要灌入的状态（可只含需要覆盖的数组）' },
      responses: {
        200: inlineOk('替换成功', { revision: { type: 'number' }, state: { $ref: '#/components/schemas/State' } }),
        400: errRes('请求体非法'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/revision': {
    get: {
      summary: '获取数据修订号',
      description: '返回当前 revision 与 updatedAt，供客户端判断是否需要重新拉取数据。',
      tags: ['数据'],
      security: bearerSecurity,
      responses: {
        200: inlineOk('修订号', { revision: { type: 'number' }, updatedAt: { type: 'string' } }),
        401: errRes('未授权'),
      },
    },
  },

  '/api/inventory': {
    get: {
      summary: '库存查询',
      description: '按关键词/品牌/品类/货权人/状态/试衣范围分页查询库存台账，返回包含状态中文标签与试衣信息的记录。',
      tags: ['库存'],
      security: bearerSecurity,
      params: [
        { name: 'q', in: 'query', required: false, description: '关键词（商品名/条码/编号/颜色/尺码/品牌/品类/货权人模糊匹配）', schema: { type: 'string' } },
        { name: 'query', in: 'query', required: false, description: 'q 的别名', schema: { type: 'string' } },
        { name: 'brand', in: 'query', required: false, description: '品牌过滤', schema: { type: 'string' } },
        { name: 'category', in: 'query', required: false, description: '品类过滤', schema: { type: 'string' } },
        { name: 'owner', in: 'query', required: false, description: '货权合伙人（姓名或 id）', schema: { type: 'string' } },
        { name: 'status', in: 'query', required: false, description: '状态过滤，逗号分隔多个，默认 AVAILABLE', schema: { type: 'string', default: 'AVAILABLE', example: 'AVAILABLE,SOLD' } },
        { name: 'fitting', in: 'query', required: false, description: '试衣范围：all=全部 in=仅试衣中 out=仅未试衣', schema: { type: 'string', enum: ['all', 'in', 'out'], default: 'all' } },
        { name: 'limit', in: 'query', required: false, description: '每页条数（≤500）', schema: { type: 'integer', default: 50 } },
        { name: 'offset', in: 'query', required: false, description: '偏移量', schema: { type: 'integer', default: 0 } },
        { name: 'sort', in: 'query', required: false, description: '排序：entryDesc/entryAsc/priceDesc/priceAsc', schema: { type: 'string', enum: ['entryDesc', 'entryAsc', 'priceDesc', 'priceAsc'], default: 'entryDesc' } },
      ],
      responses: {
        200: okRes('分页库存台账', '#/components/schemas/InventoryPage'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/stock-summary': {
    get: {
      summary: '库存汇总',
      description: '按品牌/品类/货权人维度汇总在库件数与货值，含当前试衣中件数。',
      tags: ['库存'],
      security: bearerSecurity,
      params: [
        { name: 'by', in: 'query', required: false, description: '分组维度：all/brand/category/owner', schema: { type: 'string', enum: ['all', 'brand', 'category', 'owner'], default: 'all' } },
        { name: 'owner', in: 'query', required: false, description: '仅统计该货权人', schema: { type: 'string' } },
        { name: 'brand', in: 'query', required: false, description: '仅统计该品牌', schema: { type: 'string' } },
        { name: 'category', in: 'query', required: false, description: '仅统计该品类', schema: { type: 'string' } },
      ],
      responses: {
        200: okRes('库存汇总', '#/components/schemas/StockSummary'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting': {
    get: {
      summary: '试衣记录列表',
      description: '返回试衣事件（含借出时长 hoursElapsed 与是否超时 overdue）。',
      tags: ['试衣'],
      security: bearerSecurity,
      params: [
        { name: 'status', in: 'query', required: false, description: '状态过滤，逗号分隔，ALL=全部，默认 ALL', schema: { type: 'string', default: 'ALL' } },
        { name: 'limit', in: 'query', required: false, description: '条数上限（≤200）', schema: { type: 'integer', default: 200 } },
      ],
      responses: {
        200: inlineOk('试衣记录', { events: { type: 'array', items: { $ref: '#/components/schemas/FittingEvent' } } }),
        401: errRes('未授权'),
      },
    },
  },

  '/api/pending-sales': {
    get: {
      summary: '待签销售单列表',
      description: '返回待双签的销售单（试衣成交后生成）。',
      tags: ['销售'],
      security: bearerSecurity,
      params: [
        { name: 'status', in: 'query', required: false, description: '状态过滤，ALL=全部，默认 PENDING', schema: { type: 'string', default: 'PENDING' } },
        { name: 'limit', in: 'query', required: false, description: '条数上限（≤200）', schema: { type: 'integer', default: 200 } },
      ],
      responses: {
        200: inlineOk('待签销售单', { pendingSales: { type: 'array', items: { $ref: '#/components/schemas/PendingSale' } } }),
        401: errRes('未授权'),
      },
    },
  },

  '/api/activity': {
    get: {
      summary: '最近动态',
      description: '聚合入库、出库、试衣、审计、手机端操作等最近动态流，按时间倒序。',
      tags: ['数据'],
      security: bearerSecurity,
      params: [
        { name: 'limit', in: 'query', required: false, description: '条数上限（≤200）', schema: { type: 'integer', default: 60 } },
      ],
      responses: {
        200: inlineOk('动态列表', { activity: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } } }),
        401: errRes('未授权'),
      },
    },
  },

  '/api/events': {
    get: {
      summary: '实时事件流（SSE）',
      description: 'Server-Sent Events 长连接：建立后先推送一条 revision 事件，此后每次数据变更推送 revision 事件（含 action 与 channel）。前端据此自动刷新。',
      tags: ['数据'],
      security: bearerSecurity,
      responses: {
        200: { description: 'text/event-stream 事件流', content: { 'text/event-stream': { schema: { type: 'string' } } } },
        401: errRes('未授权'),
      },
    },
  },

  '/api/reset': {
    post: {
      summary: '重置数据仓',
      description: '用种子数据重建数据仓（revision 保持单调递增）。',
      tags: ['数据'],
      security: bearerSecurity,
      responses: {
        200: inlineOk('重置成功', { revision: { type: 'number' }, state: { $ref: '#/components/schemas/State' } }),
        401: errRes('未授权'),
      },
    },
  },

  '/api/inbound': {
    post: {
      summary: '入库登记',
      description: '新货入库（合伙人拿货进店）。按商品目录 + 货权合伙人生成一件一码的库存货品，可批量（quantity 1-200）。',
      tags: ['库存'],
      security: bearerSecurity,
      body: {
        required: true,
        description: '入库信息',
        schemaRef: '#/components/schemas/InboundRequest',
      },
      responses: {
        200: inlineOk('入库成功', {
          created: { type: 'array', items: { $ref: '#/components/schemas/InventoryItem' } },
          patch: { type: 'object' },
          message: { type: 'string' },
          revision: { type: 'number' },
        }),
        400: errRes('目录/合伙人/规格不存在等业务拒绝'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting/take': {
    post: {
      summary: '试衣借出登记',
      description: '客户试衣只记事件、不动库存状态（核心业务约定）。可按条码/编号/商品名定位；命中多件时需指定条码。',
      tags: ['试衣'],
      security: bearerSecurity,
      body: { required: true, description: '借出信息', schemaRef: '#/components/schemas/FittingTakeRequest' },
      responses: {
        200: inlineOk('借出登记成功', {
          event: { $ref: '#/components/schemas/FittingEvent' },
          patch: { type: 'object' },
          message: { type: 'string' },
          reminder: { type: 'string' },
          revision: { type: 'number' },
        }),
        400: errRes('未找到货品/已在试衣间/命中多件等业务拒绝（AMBIGUOUS 时附 candidates）'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting/return': {
    post: {
      summary: '试衣归还登记',
      description: '客户未购买，归还试衣。按 fittingId / 条码 / 商品名定位试衣记录。',
      tags: ['试衣'],
      security: bearerSecurity,
      body: { required: true, description: '归还信息', schemaRef: '#/components/schemas/FittingResolveRequest' },
      responses: {
        200: inlineOk('归还成功', { event: { $ref: '#/components/schemas/FittingEvent' }, patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('未找到试衣记录/已处理等业务拒绝'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting/purchase': {
    post: {
      summary: '试衣成交意向登记',
      description: '客户决定购买：试衣事件置为已成交，并生成待签销售单（真正出库仍需电脑端双人电子签名）。',
      tags: ['试衣', '销售'],
      security: bearerSecurity,
      body: { required: true, description: '成交信息', schemaRef: '#/components/schemas/FittingPurchaseRequest' },
      responses: {
        200: inlineOk('成交意向已登记', { pendingSale: { $ref: '#/components/schemas/PendingSale' }, patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('未找到试衣记录/已按归还处理等业务拒绝'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting/{id}/return': {
    post: {
      summary: '按试衣 ID 归还',
      description: '兼容写法：直接指定试衣记录 ID 归还。',
      tags: ['试衣'],
      security: bearerSecurity,
      params: [{ name: 'id', in: 'path', required: true, description: '试衣记录 ID（如 FIT-202609-0001）', schema: { type: 'string' } }],
      body: { required: false, description: '可附带 operator / returnedAt / note', schemaRef: '#/components/schemas/FittingResolveRequest' },
      responses: {
        200: inlineOk('归还成功', { event: { $ref: '#/components/schemas/FittingEvent' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('业务拒绝'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/fitting/{id}/purchase': {
    post: {
      summary: '按试衣 ID 登记成交',
      description: '兼容写法：直接指定试衣记录 ID 登记成交意向。',
      tags: ['试衣', '销售'],
      security: bearerSecurity,
      params: [{ name: 'id', in: 'path', required: true, description: '试衣记录 ID', schema: { type: 'string' } }],
      body: { required: false, description: '可附带 dealPrice / sellerPartnerId 等', schemaRef: '#/components/schemas/FittingPurchaseRequest' },
      responses: {
        200: inlineOk('成交意向已登记', { pendingSale: { $ref: '#/components/schemas/PendingSale' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('业务拒绝'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/sale': {
    post: {
      summary: '销售出库（双人电子签名）',
      description: '正式出库。必须同时提供店长与销售人的手写电子签名（风控必要项，HTTP 直调同样强制校验），否则拒绝。借调销售（货权人≠销售人）会建立还货待办。',
      tags: ['销售'],
      security: bearerSecurity,
      body: { required: true, description: '出库信息', schemaRef: '#/components/schemas/SaleRequest' },
      responses: {
        200: inlineOk('出库成功', { order: { $ref: '#/components/schemas/SalesOrder' }, patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('缺签名（SIGNATURE_REQUIRED）/货品不存在或不可售/销售人未找到等'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/return-order': {
    post: {
      summary: '借调还货冲销',
      description: '把借调销售的还货关系解除，并为原货主自动登记一件还库新商品。',
      tags: ['销售'],
      security: bearerSecurity,
      body: { required: true, description: '冲销信息', schemaRef: '#/components/schemas/ReturnOrderRequest' },
      responses: {
        200: inlineOk('冲销成功', { patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('销售单不存在/已冲销'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/audit': {
    post: {
      summary: '归档审计报告',
      description: '把一次盘点审计报告归档进数据仓（需带 id）。',
      tags: ['审计'],
      security: bearerSecurity,
      body: { required: true, description: '审计报告', schemaRef: '#/components/schemas/AuditReport' },
      responses: {
        200: inlineOk('归档成功', { patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('报告缺 id'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/partner': {
    post: {
      summary: '新增合伙人',
      description: '创建合伙人档案（重名会被拒绝）。',
      tags: ['合伙人'],
      security: bearerSecurity,
      body: { required: true, description: '合伙人信息', schemaRef: '#/components/schemas/PartnerRequest' },
      responses: {
        200: inlineOk('创建成功', { partner: { $ref: '#/components/schemas/Partner' }, patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('姓名为空/重名（DUPLICATE）'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/franchisee': {
    post: {
      summary: '新增加盟商',
      description: '创建加盟商档案（id 自动生成 FR-<时间戳>）。',
      tags: ['加盟商'],
      security: bearerSecurity,
      body: { required: true, description: '加盟商信息', schemaRef: '#/components/schemas/FranchiseeRequest' },
      responses: {
        200: inlineOk('创建成功', { franchisee: { $ref: '#/components/schemas/Franchisee' }, patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('名称为空'),
        401: errRes('未授权'),
      },
    },
  },

  '/api/franchisee/renew': {
    post: {
      summary: '加盟商续约',
      description: '完成一次房租续约：默认在原到期日（或今日）基础上 +1 年，生成续约记录并存证双人电子签名。',
      tags: ['加盟商'],
      security: bearerSecurity,
      body: { required: true, description: '续约信息', schemaRef: '#/components/schemas/FranchiseeRenewRequest' },
      responses: {
        200: inlineOk('续约完成', { patch: { type: 'object' }, message: { type: 'string' }, revision: { type: 'number' } }),
        400: errRes('加盟商不存在（NOT_FOUND）'),
        401: errRes('未授权'),
      },
    },
  },

  /* —— MCP 端点（JSON-RPC 2.0，非 REST；供参考）—— */
  '/mcp': {
    post: {
      summary: 'MCP Streamable HTTP（JSON-RPC 2.0）',
      description: 'MCP 协议入口：initialize / tools/list / tools/call 等。请求体为 JSON-RPC 2.0 消息（单条或批量数组）。默认要求 Bearer 鉴权。',
      tags: ['MCP'],
      security: bearerSecurity,
      body: { required: true, description: 'JSON-RPC 2.0 消息', schemaRef: '#/components/schemas/JsonRpcRequest' },
      responses: {
        200: { description: 'JSON-RPC 响应（单条或批量）', content: { 'application/json': { schema: { $ref: '#/components/schemas/JsonRpcResponse' } } } },
        202: { description: '通知类消息：已受理，无响应体' },
        400: { description: '解析错误（-32700）' },
        401: errRes('未授权'),
      },
    },
    get: {
      summary: 'MCP SSE 通知流',
      description: 'SSE 长连接，推送数据变更通知（notifications/message）。',
      tags: ['MCP'],
      security: bearerSecurity,
      responses: {
        200: { description: 'SSE 事件流', content: { 'text/event-stream': { schema: { type: 'string' } } } },
        401: errRes('未授权'),
      },
    },
    delete: {
      summary: '关闭 MCP 会话',
      description: '结束 MCP 会话。',
      tags: ['MCP'],
      security: bearerSecurity,
      responses: { 200: { description: '已关闭' } },
    },
  },

  '/sse': {
    get: {
      summary: 'MCP 旧版 SSE 传输（兼容）',
      description: '旧版 HTTP+SSE 传输：返回 event: endpoint 指向 /messages?sessionId=...。',
      tags: ['MCP'],
      security: bearerSecurity,
      responses: {
        200: { description: 'SSE 事件流', content: { 'text/event-stream': { schema: { type: 'string' } } } },
        401: errRes('未授权'),
      },
    },
  },

  '/messages': {
    post: {
      summary: 'MCP 旧版消息投递',
      description: '向 /sse 建立的会话投递 JSON-RPC 消息（需 query sessionId）。',
      tags: ['MCP'],
      security: bearerSecurity,
      params: [{ name: 'sessionId', in: 'query', required: true, description: '来自 /sse 的 endpoint 事件', schema: { type: 'string' } }],
      body: { required: true, description: 'JSON-RPC 2.0 消息', schemaRef: '#/components/schemas/JsonRpcRequest' },
      responses: {
        202: { description: '已受理，结果经 SSE 通道返回' },
        404: { description: '会话不存在或已结束' },
        401: errRes('未授权'),
      },
    },
  },
};

/* 请求体 schema 补充（避免 PATHS 内联太长） */
SCHEMAS.InboundRequest = {
  type: 'object',
  description: '入库登记请求',
  properties: {
    productId: { type: 'string', description: '目录商品 id（与 productName/catalog 三选一）', example: 'laca-bra-gold' },
    productName: { type: 'string', description: '商品名（模糊匹配目录）' },
    catalog: { type: 'string', description: '目录引用别名' },
    ownerPartnerId: { type: 'string', description: '货权合伙人 id（与 ownerPartnerName/owner 三选一）', example: 'p-01' },
    ownerPartnerName: { type: 'string', description: '货权合伙人姓名' },
    owner: { type: 'string', description: '货权别名' },
    quantity: { type: 'integer', description: '件数 1-200，默认 1', default: 1 },
    size: { type: 'string', description: '规格，需在目录可选规格内，默认目录首个规格', example: '75B' },
    color: { type: 'string', description: '颜色，默认取目录色' },
    entryDate: { type: 'string', description: '入库时间，默认当前' },
    operator: { type: 'string', description: '经手人，默认「付蓉 (店长)」' },
  },
};
SCHEMAS.FittingTakeRequest = {
  type: 'object',
  description: '试衣借出请求',
  properties: {
    inventoryItemId: { type: 'string', description: '货品 id' },
    barcode: { type: 'string', description: '条码（推荐，唯一）', example: 'SN2026081001' },
    item: { type: 'string', description: '货品引用别名' },
    productName: { type: 'string', description: '商品名（命中多件时会拒绝并要求指定条码）' },
    customerName: { type: 'string', description: '客户姓名' },
    customerPhone: { type: 'string', description: '客户电话' },
    takenAt: { type: 'string', description: '借出时间，默认当前' },
    operator: { type: 'string', description: '经手人，默认「付蓉 (店长)」' },
    note: { type: 'string', description: '备注' },
  },
};
SCHEMAS.FittingResolveRequest = {
  type: 'object',
  description: '试衣归还请求（归还/成交通用字段）',
  properties: {
    fittingId: { type: 'string', description: '试衣记录 id（指定则优先）' },
    inventoryItemId: { type: 'string' },
    barcode: { type: 'string' },
    item: { type: 'string' },
    productName: { type: 'string' },
    customerName: { type: 'string' },
    returnedAt: { type: 'string', description: '归还时间，默认当前' },
    operator: { type: 'string' },
    note: { type: 'string' },
  },
};
SCHEMAS.FittingPurchaseRequest = {
  type: 'object',
  description: '试衣成交意向请求',
  properties: {
    fittingId: { type: 'string' },
    inventoryItemId: { type: 'string' },
    barcode: { type: 'string' },
    item: { type: 'string' },
    productName: { type: 'string' },
    dealPrice: { type: 'number', description: '成交价，默认按标价' },
    sellerPartnerId: { type: 'string', description: '销售合伙人 id' },
    sellerPartnerName: { type: 'string', description: '销售合伙人姓名' },
    seller: { type: 'string', description: '销售别名' },
    customerName: { type: 'string' },
    customerPhone: { type: 'string' },
    at: { type: 'string', description: '登记时间，默认当前' },
    operator: { type: 'string' },
    note: { type: 'string' },
  },
};
SCHEMAS.SaleRequest = {
  type: 'object',
  description: '销售出库请求（双签必填）',
  required: ['managerSignature', 'sellerSignature', 'inventoryItemId'],
  properties: {
    inventoryItemId: { type: 'string', description: '货品 id（必填）' },
    barcode: { type: 'string', description: '货品条码（与 inventoryItemId 二选一）' },
    dealPrice: { type: 'number', description: '成交价，默认按标价' },
    sellerPartnerId: { type: 'string', description: '销售合伙人 id' },
    sellerPartnerName: { type: 'string', description: '销售合伙人姓名' },
    saleDate: { type: 'string', description: '销售时间，默认当前' },
    expectedReturnDate: { type: 'string', description: '借调销售时的预计还货日期' },
    managerSignature: { type: 'string', description: '店长手写电子签名（data URL，必填）' },
    sellerSignature: { type: 'string', description: '销售人手写电子签名（data URL，必填）' },
    managerName: { type: 'string', description: '店长姓名，默认「付蓉 (店长)」' },
    remarks: { type: 'string' },
  },
};
SCHEMAS.ReturnOrderRequest = {
  type: 'object',
  properties: {
    orderId: { type: 'string', description: '销售单 id（必填）', example: 'SO-202609-0001' },
    actualReturnDate: { type: 'string' },
    replenishBarcode: { type: 'string', description: '还库新商品条码，默认自动生成' },
    confirmedBy: { type: 'string', description: '确认人' },
    notes: { type: 'string' },
  },
};
SCHEMAS.PartnerRequest = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '合伙人姓名（必填）' },
    phone: { type: 'string' },
    role: { type: 'string', default: '合伙人' },
  },
};
SCHEMAS.FranchiseeRequest = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', description: '加盟商名称（必填）' },
    phone: { type: 'string' },
    teamName: { type: 'string' },
    rentAmount: { type: 'number', description: '房租金额' },
    paymentDate: { type: 'string' },
    expireDate: { type: 'string' },
    notes: { type: 'string' },
  },
};
SCHEMAS.FranchiseeRenewRequest = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', description: '加盟商 id（必填）' },
    newExpireDate: { type: 'string', description: '新到期日，默认在旧到期日/今日基础上 +1 年' },
    renewDate: { type: 'string' },
    managerName: { type: 'string' },
    managerSignature: { type: 'string' },
    franchiseeSignature: { type: 'string' },
    notes: { type: 'string' },
  },
};
SCHEMAS.JsonRpcRequest = {
  type: 'object',
  description: 'MCP 请求消息（JSON-RPC 2.0）。也支持批量数组。',
  properties: {
    jsonrpc: { type: 'string', const: '2.0' },
    id: { type: ['number', 'string', 'null'], description: '请求 id（通知可省略）' },
    method: { type: 'string', example: 'tools/call' },
    params: { type: 'object', additionalProperties: true },
  },
};
SCHEMAS.JsonRpcResponse = {
  type: 'object',
  description: 'MCP 响应消息（JSON-RPC 2.0）',
  properties: {
    jsonrpc: { type: 'string', const: '2.0' },
    id: { type: ['number', 'string', 'null'] },
    result: { type: 'object', additionalProperties: true },
    error: {
      type: 'object',
      nullable: true,
      properties: { code: { type: 'number' }, message: { type: 'string' }, data: { type: 'object', nullable: true } },
    },
  },
};

/* ────────────────────────── 渲染器 ────────────────────────── */

const REF_PREFIX = { v31: '#/components/schemas/', v30: '#/components/schemas/', v20: '#/definitions/' };

/** 递归把 3.0 风格 schema 转成 3.1（可空 → type 数组，删 nullable） */
function toV31(s) {
  if (Array.isArray(s)) return s.map(toV31);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'nullable') continue;
    out[k] = toV31(v);
  }
  if (s.nullable === true && typeof out.type === 'string') out.type = [out.type, 'null'];
  return out;
}

/** 2.0：递归处理（保留 nullable 但改名 x-nullable；删 example） */
function toV20Schema(s) {
  if (Array.isArray(s)) return s.map(toV20Schema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'example') continue; // 2.0 的 schema 不支持 example
    if (k === 'nullable') {
      if (v === true) out['x-nullable'] = true;
      continue;
    }
    if (k === 'const') {
      out.enum = [v];
      continue;
    }
    if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
      // 2.0 的共享定义挂在 #/definitions/ 下，$ref 前缀必须同步替换
      out.$ref = '#/definitions/' + v.split('/').pop();
      continue;
    }
    out[k] = toV20Schema(v);
  }
  return out;
}

function resolveRef(ref, target) {
  const key = ref.split('/').pop();
  return target[key];
}

function buildBase(version, openapiOrSwagger, targetSchemas, isV20) {
  const base = {
    openapi: openapiOrSwagger,
    info: {
      title: SERVER.title,
      version: SERVER.version,
      description: SERVER.description,
    },
    servers: isV20 ? undefined : [{ url: 'http://localhost:3020', description: '本机默认（PORT 可改）' }],
    tags: [
      { name: '系统', description: '健康检查与元信息' },
      { name: '数据', description: '全量状态 / 修订号 / 动态 / SSE' },
      { name: '库存', description: '库存查询、汇总与入库' },
      { name: '试衣', description: '试衣借出 / 归还 / 成交' },
      { name: '销售', description: '销售出库 / 还货冲销 / 待签单' },
      { name: '合伙人', description: '合伙人档案' },
      { name: '加盟商', description: '加盟商档案与续约' },
      { name: '审计', description: '盘点审计报告' },
      { name: 'MCP', description: 'MCP 协议端点（JSON-RPC 2.0）' },
    ],
    paths: {},
  };
  if (isV20) {
    base.swagger = openapiOrSwagger;
    delete base.openapi;
    delete base.servers;
    base.host = 'localhost:3020';
    base.basePath = '/';
    base.schemes = ['http'];
    base.consumes = ['application/json'];
    base.produces = ['application/json'];
    base.securityDefinitions = {
      bearerAuth: { type: 'apiKey', name: 'Authorization', in: 'header', description: '格式：Bearer <token>' },
    };
    base.definitions = {};
  } else {
    base.components = {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: '令牌见服务端启动日志与 server/data/token.txt' },
      },
      schemas: {},
    };
  }
  return base;
}

function buildV31() {
  const doc = buildBase('3.1.0', '3.1.0');
  const schemas = doc.components.schemas;
  for (const [name, s] of Object.entries(SCHEMAS)) schemas[name] = toV31(s);
  for (const [p, methods] of Object.entries(PATHS)) {
    doc.paths[p] = {};
    for (const [m, op] of Object.entries(methods)) {
      const out = {
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        security: op.security,
        responses: {},
      };
      if (op.params) {
        out.parameters = op.params.map((q) => ({ ...q, schema: toV31(q.schema) }));
      }
      if (op.body) {
        out.requestBody = {
          required: op.body.required !== false,
          description: op.body.description,
          content: { 'application/json': { schema: op.body.schemaRef ? { $ref: op.body.schemaRef } : toV31(op.body.schema || { type: 'object' }) } },
        };
      }
      for (const [code, r] of Object.entries(op.responses)) {
        const rr = { description: r.description || '' };
        if (r.content) {
          rr.content = {};
          for (const [ct, c] of Object.entries(r.content)) {
            rr.content[ct] = { schema: toV31(c.schema) };
          }
        }
        out.responses[code] = rr;
      }
      doc.paths[p][m] = out;
    }
  }
  return doc;
}

function buildV30() {
  const doc = buildBase('3.0.3', '3.0.3');
  const schemas = doc.components.schemas;
  for (const [name, s] of Object.entries(SCHEMAS)) schemas[name] = JSON.parse(JSON.stringify(s));
  for (const [p, methods] of Object.entries(PATHS)) {
    doc.paths[p] = {};
    for (const [m, op] of Object.entries(methods)) {
      const out = {
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        security: op.security,
        responses: {},
      };
      if (op.params) out.parameters = op.params.map((q) => ({ ...q, schema: JSON.parse(JSON.stringify(q.schema)) }));
      if (op.body) {
        out.requestBody = {
          required: op.body.required !== false,
          description: op.body.description,
          content: { 'application/json': { schema: op.body.schemaRef ? { $ref: op.body.schemaRef } : JSON.parse(JSON.stringify(op.body.schema || { type: 'object' })) } },
        };
      }
      for (const [code, r] of Object.entries(op.responses)) {
        const rr = { description: r.description || '' };
        if (r.content) {
          rr.content = {};
          for (const [ct, c] of Object.entries(r.content)) rr.content[ct] = { schema: JSON.parse(JSON.stringify(c.schema)) };
        }
        out.responses[code] = rr;
      }
      doc.paths[p][m] = out;
    }
  }
  return doc;
}

function buildV20() {
  const doc = buildBase('2.0', '2.0', null, true);
  const defs = doc.definitions;
  for (const [name, s] of Object.entries(SCHEMAS)) defs[name] = toV20Schema(s);
  for (const [p, methods] of Object.entries(PATHS)) {
    doc.paths[p] = {};
    for (const [m, op] of Object.entries(methods)) {
      const out = {
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        security: op.security,
        responses: {},
        consumes: ['application/json'],
        produces: ['application/json'],
      };
      // SSE 端点特殊处理
      const hasSSE = op.responses[200]?.content?.['text/event-stream'];
      if (hasSSE) out.produces = ['text/event-stream'];
      if (op.params) out.parameters = op.params.map((q) => ({ ...q, schema: toV20Schema(q.schema) }));
      if (op.body) {
        const name = `body_${p.replace(/[^a-zA-Z0-9]/g, '_')}_${m}`;
        out.parameters = out.parameters || [];
        out.parameters.push({
          name,
          in: 'body',
          required: op.body.required !== false,
          description: op.body.description,
          schema: op.body.schemaRef ? { $ref: toRef20(op.body.schemaRef) } : toV20Schema(op.body.schema || { type: 'object' }),
        });
      }
      for (const [code, r] of Object.entries(op.responses)) {
        let rr = { description: r.description || '' };
        if (r.content && r.content['application/json']?.schema) {
          rr.schema = toV20Schema(r.content['application/json'].schema);
        }
        out.responses[code] = rr;
      }
      doc.paths[p][m] = out;
    }
  }
  return doc;
}

function toRef20(ref) {
  return ref.replace('#/components/schemas/', '#/definitions/');
}

/* ────────────────────────── 写出与校验 ────────────────────────── */

fs.mkdirSync(OUT_DIR, { recursive: true });

const outputs = [
  { file: 'openapi-3.1.json', doc: buildV31() },
  { file: 'openapi-3.0.json', doc: buildV30() },
  { file: 'swagger-2.0.json', doc: buildV20() },
];

for (const { file, doc } of outputs) {
  const target = path.join(OUT_DIR, file);
  fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  // 校验 JSON 可回读
  const back = JSON.parse(fs.readFileSync(target, 'utf8'));
  const pathCount = Object.keys(back.paths || {}).length;
  const opCount = Object.values(back.paths || {}).reduce((a, ops) => a + Object.keys(ops).length, 0);
  const key = back.openapi ? `openapi=${back.openapi}` : `swagger=${back.swagger}`;
  console.log(`✔ ${file.padEnd(18)} ${key.padEnd(14)} paths=${pathCount}  operations=${opCount}  ${back.info?.title || ''}`);
}

console.log(`\n输出目录：${OUT_DIR}`);
console.log('重新生成：npm run openapi');
