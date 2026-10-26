/**
 * 领域逻辑 —— 库存 / 试衣 / 销售 / 审计。
 *
 * ⚠️ 全部是本项目最核心的一条业务约定：
 *   「试衣借出」与「试衣归还」**绝不修改 items[].status**。
 *   客户试衣只是把货从货架拿到试衣间，它不是出库，也不是销售。
 *   系统只记一条 fittingEvents 事件（谁、什么时候、拿了哪件、给谁试）。
 *   只有真正成交并完成双签，才会走 recordSale 把货置为 SOLD。
 *
 *   这样设计的直接好处：盘点时"试衣中"的货仍然算在某个合伙人名下，
 *   不会凭空消失在台账里；而店长在手机上记一笔，也不需要任何签署。
 *
 * 本文件不碰文件系统、不碰 HTTP —— 只对 state 做纯计算，便于单测与复用。
 */

/* ────────────────────────── 时间与 ID ────────────────────────── */

const pad = (n) => String(n).padStart(2, '0');

export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dayOf(s) {
  return String(s || '').slice(0, 10);
}
function monthKey(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
}

/** 按「前缀-年月-四位序号」生成 ID，序号从已有数据里推导，不会撞号 */
function nextId(prefix, list, when = new Date()) {
  const mk = monthKey(when);
  const re = new RegExp(`^${prefix}-${mk}-(\\d+)$`);
  let max = 0;
  for (const it of list || []) {
    const m = re.exec(String(it?.id || ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${mk}-${String(max + 1).padStart(4, '0')}`;
}

function itemIdentity(entryDate, salt, i, taken) {
  const mk = String(entryDate).slice(0, 7).replace('-', '');
  const tail = String(salt).slice(-4);
  let n = i + 1;
  let id = `INV-${mk}-${tail}${n}`;
  let barcode = `SN${mk}${tail}${n}`;
  while (taken.has(id) || taken.has(barcode)) {
    n += 1;
    id = `INV-${mk}-${tail}${n}`;
    barcode = `SN${mk}${tail}${n}`;
  }
  return { id, barcode };
}

/* ────────────────────────── 不变量校验（写盘前的最后一道闸） ────────────────────────── */

const ITEM_STATUSES = new Set(['AVAILABLE', 'SOLD', 'BORROWED_SOLD', 'RETURNED']);

/**
 * 统一不变量校验：所有写路径（mutate / replaceState / reset）在落盘前都跑一遍。
 *
 * 为什么集中在这一处而不是散在各个动作里：
 *   校验散在动作里，每加一个新动作都可能漏一条 —— 尤其 MCP 已把写权限
 *   开放给手机端 AI，写入方只会越来越多。写盘前统一把关，任何路径写进脏数据
 *   都会当场被拒，而不是等下次读出来才发现账对不上。
 *
 * 设计取舍：
 *   只断言「绝对不该出现」的硬约束（重复编号 / 悬空引用 / 非法状态 / revision 回退），
 *   不做业务合理性判断（价格高低、日期新旧）—— 后者是各动作自己的职责，
 *   放这里会把合法业务操作误杀。
 *
 * @param {object} draft 待落盘的完整 state
 * @param {number} prevRevision 写入前的 revision（用于断言单调性）
 * @returns {string[]} 违规清单；空数组 = 通过
 */
export function checkInvariants(draft, prevRevision) {
  const problems = [];
  const items = draft.items || [];

  // 1. 库存编号 / 条码：非空、全局唯一（逐件追溯的根基），状态合法
  const byId = new Map();
  const byBarcode = new Map();
  for (const it of items) {
    if (!it?.id) {
      problems.push('存在缺库存编号的货品');
      continue;
    }
    if (byId.has(it.id)) problems.push(`库存编号重复：${it.id}`);
    byId.set(it.id, it);
    if (!it.barcode) problems.push(`货品 ${it.id} 缺条码`);
    else if (byBarcode.has(it.barcode)) {
      problems.push(`条码重复：${it.barcode}（${byBarcode.get(it.barcode)} 与 ${it.id}）`);
    } else byBarcode.set(it.barcode, it.id);
    if (!ITEM_STATUSES.has(it.status)) problems.push(`货品 ${it.id} 状态非法：${String(it.status)}`);
  }

  // 2. 货权归属必须能落到合伙人名册上（防写进一个不存在的货主）
  const partnerIds = new Set((draft.partners || []).map((p) => p.id));
  for (const it of items) {
    if (it?.ownerPartnerId && !partnerIds.has(it.ownerPartnerId)) {
      problems.push(`货品 ${it.id} 的货主 ${it.ownerPartnerId} 不在合伙人名册中`);
    }
  }

  // 3. 事件引用不得悬空（items 含历史件，正常都应命中）
  for (const ev of draft.fittingEvents || []) {
    if (ev?.inventoryItemId && !byId.has(ev.inventoryItemId)) {
      problems.push(`试衣事件 ${ev.id} 指向不存在的货品 ${ev.inventoryItemId}`);
    }
  }
  for (const ps of draft.pendingSales || []) {
    if (ps?.inventoryItemId && !byId.has(ps.inventoryItemId)) {
      problems.push(`待签单 ${ps.id} 指向不存在的货品 ${ps.inventoryItemId}`);
    }
  }

  // 4. 一件货同一时刻最多一条在途试衣
  const activeFitting = new Map();
  for (const ev of draft.fittingEvents || []) {
    if (ev?.status !== 'FITTING') continue;
    if (activeFitting.has(ev.inventoryItemId)) {
      problems.push(`货品 ${ev.inventoryItemId} 存在多条在途试衣（${activeFitting.get(ev.inventoryItemId)} 与 ${ev.id}）`);
    } else activeFitting.set(ev.inventoryItemId, ev.id);
  }

  // 5. 各类单据编号唯一
  const uniqCheck = (list, label) => {
    const seen = new Set();
    for (const rec of list || []) {
      if (!rec?.id) continue;
      if (seen.has(rec.id)) problems.push(`${label}编号重复：${rec.id}`);
      seen.add(rec.id);
    }
  };
  uniqCheck(draft.salesOrders, '销售单');
  uniqCheck(draft.pendingSales, '待签单');
  uniqCheck(draft.fittingEvents, '试衣事件');
  uniqCheck(draft.auditReports, '审计报告');

  // 6. revision 必须比写入前更大（reset 也不许打回 1 —— 见 seedFromFile 的注释）
  if (Number.isFinite(prevRevision) && !(draft.revision > prevRevision)) {
    problems.push(`revision 必须单调递增（${prevRevision} → ${draft.revision}）`);
  }

  return problems;
}

/** 写盘前调用：有违规直接抛错，由 store 层转成「写入被拒」 */
export function assertInvariants(draft, prevRevision) {
  const problems = checkInvariants(draft, prevRevision);
  if (problems.length) {
    const err = new Error(
      `数据不变量校验未通过（${problems.length} 项）：${problems.slice(0, 5).join('；')}${problems.length > 5 ? ' 等' : ''}`,
    );
    err.code = 'INVARIANT_VIOLATED';
    err.problems = problems;
    throw err;
  }
}

/* ────────────────────────── 解析助手 ────────────────────────── */

export function resolvePartner(state, ref) {
  if (!ref) return null;
  const s = String(ref).trim();
  if (!s) return null;
  const exact = state.partners.find((p) => p.id === s || p.name === s);
  if (exact) return exact;
  const loose = state.partners.filter((p) => p.name.includes(s) || p.id.endsWith(s));
  if (loose.length === 1) return loose[0];
  // 「付蓉」要能命中「付蓉 (店长)」
  const cleaned = s.replace(/[（(].*?[)）]/g, '').trim();
  const byClean = state.partners.filter((p) => p.name.replace(/[（(].*?[)）]/g, '').trim() === cleaned);
  if (byClean.length === 1) return byClean[0];
  return null;
}

export function resolveCatalog(state, ref) {
  if (!ref) return null;
  const s = String(ref).trim();
  if (!s) return null;
  const exact = state.catalogs.find((c) => c.id === s || c.name === s);
  if (exact) return exact;
  const loose = state.catalogs.filter((c) => c.name.includes(s) || s.includes(c.name));
  if (loose.length === 1) return loose[0];
  if (loose.length > 1) {
    // 优先取名字最短（最贴近用户输入）的那个
    return [...loose].sort((a, b) => a.name.length - b.name.length)[0];
  }
  const byBrand = state.catalogs.filter((c) => c.brand === s || c.category === s);
  if (byBrand.length === 1) return byBrand[0];
  return null;
}

/** 找货：条码 / 库存编号 / 商品名（可多件命中） */
export function findItems(state, ref) {
  const s = String(ref || '').trim();
  if (!s) return [];
  const upper = s.toUpperCase();
  const byCode = state.items.filter(
    (i) => i.id.toUpperCase() === upper || i.barcode.toUpperCase() === upper
  );
  if (byCode.length) return byCode;
  return state.items.filter(
    (i) =>
      i.productName.includes(s) ||
      (i.color || '').includes(s) ||
      String(i.size) === s ||
      `${i.productName} ${i.size}`.includes(s)
  );
}

export function activeFittingOf(state, itemId) {
  return (state.fittingEvents || []).find((f) => f.inventoryItemId === itemId && f.status === 'FITTING') || null;
}

/* ────────────────────────── 查询 ────────────────────────── */

const STATUS_LABEL = {
  AVAILABLE: '在库可用',
  SOLD: '已售出',
  BORROWED_SOLD: '借调已售',
  RETURNED: '已归还',
};

export function toRecord(state, item) {
  const fitting = activeFittingOf(state, item.id);
  return {
    inventoryId: item.id,
    barcode: item.barcode,
    productName: item.productName,
    brand: item.brand,
    category: item.category,
    size: item.size,
    color: item.color || '',
    price: item.price,
    owner: item.ownerPartnerName,
    ownerId: item.ownerPartnerId,
    entryDate: item.entryDate,
    status: item.status,
    statusLabel: STATUS_LABEL[item.status] || item.status,
    fitting: fitting
      ? { fittingId: fitting.id, customer: fitting.customerName || '', since: fitting.takenAt }
      : null,
    soldDate: item.soldDate || null,
  };
}

export function queryInventory(state, opts = {}) {
  const {
    q = '',
    brand = '',
    category = '',
    owner = '',
    status = 'AVAILABLE',
    fittingScope = 'all', // all | in | out
    limit = 20,
    offset = 0,
    sort = 'entryDesc',
  } = opts;

  let rows = state.items.slice();

  if (status && status !== 'all') {
    const set = String(status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    rows = rows.filter((i) => set.includes(i.status));
  }
  if (brand) rows = rows.filter((i) => i.brand === brand || i.brand.includes(brand));
  if (category) rows = rows.filter((i) => i.category === category || i.category.includes(category));
  if (owner) {
    const p = resolvePartner(state, owner);
    const key = p ? p.name : String(owner);
    rows = rows.filter((i) => i.ownerPartnerName.includes(key) || i.ownerPartnerId === owner);
  }
  if (q) {
    const s = String(q).trim().toUpperCase();
    rows = rows.filter((i) =>
      [i.productName, i.barcode, i.id, i.color || '', String(i.size), i.brand, i.category, i.ownerPartnerName]
        .join(' ')
        .toUpperCase()
        .includes(s)
    );
  }
  if (fittingScope !== 'all') {
    rows = rows.filter((i) => {
      const inFitting = Boolean(activeFittingOf(state, i.id));
      return fittingScope === 'in' ? inFitting : !inFitting;
    });
  }

  const sorters = {
    entryDesc: (a, b) => String(b.entryDate).localeCompare(String(a.entryDate)),
    entryAsc: (a, b) => String(a.entryDate).localeCompare(String(b.entryDate)),
    priceDesc: (a, b) => b.price - a.price,
    priceAsc: (a, b) => a.price - b.price,
  };
  rows.sort(sorters[sort] || sorters.entryDesc);

  const total = rows.length;
  const page = rows.slice(offset, offset + limit).map((i) => toRecord(state, i));
  return {
    total,
    returned: page.length,
    offset,
    limit,
    inStockTotal: state.items.filter((i) => i.status === 'AVAILABLE').length,
    items: page,
  };
}

export function queryStockSummary(state, opts = {}) {
  const { by = 'all', owner = '', brand = '', category = '' } = opts;
  let rows = state.items.filter((i) => i.status === 'AVAILABLE');
  if (owner) {
    const p = resolvePartner(state, owner);
    const key = p ? p.name : String(owner);
    rows = rows.filter((i) => i.ownerPartnerName.includes(key));
  }
  if (brand) rows = rows.filter((i) => i.brand === brand);
  if (category) rows = rows.filter((i) => i.category === category);

  const group = (keyFn, label) => {
    const map = new Map();
    for (const i of rows) {
      const k = keyFn(i);
      if (!map.has(k)) map.set(k, { key: k, label, count: 0, value: 0 });
      const g = map.get(k);
      g.count += 1;
      g.value += i.price || 0;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  };

  const fittingRows = (state.fittingEvents || []).filter((f) => f.status === 'FITTING');

  return {
    scope: { owner: owner || '全部', brand: brand || '全部', category: category || '全部' },
    inStockCount: rows.length,
    inStockValue: rows.reduce((a, i) => a + (i.price || 0), 0),
    fittingNowCount: fittingRows.length,
    byBrand: by === 'all' || by === 'brand' ? group((i) => i.brand, '品牌') : undefined,
    byCategory: by === 'all' || by === 'category' ? group((i) => i.category, '品类') : undefined,
    byOwner:
      by === 'all' || by === 'owner'
        ? group((i) => i.ownerPartnerName, '货权合伙人').map((g) => ({
            ...g,
            fittingNow: fittingRows.filter((f) => f.ownerPartnerName === g.key).length,
          }))
        : undefined,
  };
}

/** 入库记录：按「日」聚合（371 件逐件随机的 entryDate，按件列会变成噪声） */
export function listInboundRecords(state, opts = {}) {
  const { from = '', to = '', limit = 40 } = opts;
  const map = new Map();
  for (const i of state.items) {
    const d = dayOf(i.entryDate);
    if (!d) continue;
    if (from && d < from) continue;
    if (to && d > to) continue;
    if (!map.has(d)) map.set(d, { date: d, count: 0, value: 0, products: new Map(), operators: new Set() });
    const g = map.get(d);
    g.count += 1;
    g.value += i.price || 0;
    g.products.set(i.productName, (g.products.get(i.productName) || 0) + 1);
    g.operators.add(i.entryOperator);
  }
  return [...map.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((g) => ({
      date: g.date,
      totalCount: g.count,
      totalValue: g.value,
      operators: [...g.operators],
      products: [...g.products.entries()].map(([name, count]) => ({ name, count })),
    }));
}

export function listOutboundRecords(state, opts = {}) {
  const { limit = 40, from = '', to = '' } = opts;
  return state.salesOrders
    .filter((o) => {
      const d = dayOf(o.saleDate);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .sort((a, b) => String(b.saleDate).localeCompare(String(a.saleDate)))
    .slice(0, limit)
    .map((o) => ({
      orderId: o.id,
      saleDate: o.saleDate,
      productName: o.productName,
      brand: o.brand,
      size: o.size,
      color: o.color || '',
      price: o.price,
      dealPrice: o.dealPrice,
      owner: o.ownerPartnerName,
      seller: o.sellerPartnerName,
      crossPartnerBorrow: Boolean(o.isCrossPartnerBorrow),
      returnStatus: o.returnStatus || null,
      dualSigned: Boolean(o.managerSignature && o.sellerSignature),
    }));
}

export function listFitting(state, opts = {}) {
  const { status = 'FITTING', limit = 50 } = opts;
  const set = String(status)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return (state.fittingEvents || [])
    .filter((f) => (set.includes('ALL') ? true : set.includes(f.status)))
    .sort((a, b) => String(b.takenAt).localeCompare(String(a.takenAt)))
    .slice(0, limit)
    .map((f) => {
      const hours = (Date.now() - new Date(f.takenAt.replace(' ', 'T')).getTime()) / 36e5;
      return {
        ...f,
        hoursElapsed: Number.isFinite(hours) ? Number(hours.toFixed(1)) : null,
        overdue: f.status === 'FITTING' && hours >= 8,
      };
    });
}

export function recentActivity(state, opts = {}) {
  const { limit = 30 } = opts;
  const out = [];

  for (const d of listInboundRecords(state, { limit: 60 })) {
    out.push({
      kind: 'INBOUND',
      at: `${d.date} 18:00`,
      title: `入库登记 ${d.totalCount} 件`,
      detail: `${d.operators.join('、')} · ${d.products.slice(0, 3).map((p) => `${p.name}×${p.count}`).join('、')}${d.products.length > 3 ? ' 等' : ''}`,
    });
  }
  for (const o of listOutboundRecords(state, { limit: 60 })) {
    out.push({
      kind: 'OUTBOUND_SALE',
      at: o.saleDate,
      title: `销售出库「${o.productName} ${o.size}」`,
      detail: `${o.seller} 售出 · 货权归 ${o.owner}${o.crossPartnerBorrow ? ' · 借调待还' : ''} · ¥${o.dealPrice}`,
    });
  }
  for (const f of state.fittingEvents || []) {
    out.push({
      kind: 'FITTING_TAKE',
      at: f.takenAt,
      title: `试衣借出「${f.productName} ${f.size}」`,
      detail: `${f.takenBy} 经手${f.customerName ? ` · 客户 ${f.customerName}` : ''} · 未出库，仅登记`,
    });
    if (f.resolvedAt && f.status === 'RETURNED') {
      out.push({
        kind: 'FITTING_RETURN',
        at: f.resolvedAt,
        title: `试衣归还「${f.productName} ${f.size}」`,
        detail: `${f.resolvedBy || ''} 经手 · 客户未购买，货已放回货架（库存状态全程未变动）`,
      });
    }
    if (f.resolvedAt && f.status === 'PURCHASED') {
      out.push({
        kind: 'FITTING_PURCHASED',
        at: f.resolvedAt,
        title: `试衣成交「${f.productName} ${f.size}」`,
        detail: `${f.customerName ? `客户 ${f.customerName} · ` : ''}待签署销售单${f.saleOrderId ? ` → ${f.saleOrderId}` : ''}`,
      });
    }
  }
  for (const r of state.auditReports || []) {
    out.push({
      kind: 'INVENTORY_AUDIT',
      at: `${r.auditDate} 20:00`,
      title: `${r.auditType === 'MONTHLY' ? '月度全盘' : r.auditType === 'WEEKLY' ? '周抽检' : '日盘'} ${r.id}`,
      detail: `账 ${r.totalSystemCount} / 实 ${r.totalPhysicalCount} · 差异 ${r.discrepancyCount} 件 · ${r.inspectorName}`,
    });
  }
  for (const h of state.opLog || []) {
    if (!h.action.startsWith('fitting')) continue;
    out.push({ kind: 'MCP_OP', at: h.at.slice(0, 16).replace('T', ' '), title: `手机端登记 · ${h.action}`, detail: `${h.operator} · ${h.detail}` });
  }

  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

/* ────────────────────────── 写入 ────────────────────────── */

/** 新货入库（合伙人拿货进店） */
export function inbound(state, input) {
  const {
    quantity = 1,
    size = '',
    color = '',
    entryDate = stamp(),
    operator = '付蓉 (店长)',
  } = input;

  const catalog = resolveCatalog(state, input.productId || input.productName || input.catalog);
  if (!catalog) {
    return {
      ok: false,
      code: 'CATALOG_NOT_FOUND',
      message: `没有找到商品「${input.productId || input.productName || ''}」。可用商品：${state.catalogs
        .slice(0, 8)
        .map((c) => c.name)
        .join('、')} 等 ${state.catalogs.length} 款`,
    };
  }
  const owner = resolvePartner(state, input.ownerPartnerId || input.ownerPartnerName || input.owner);
  if (!owner) {
    return {
      ok: false,
      code: 'PARTNER_NOT_FOUND',
      message: `没有找到货权合伙人「${input.ownerPartnerId || input.ownerPartnerName || input.owner || ''}」`,
    };
  }
  const sizeValue = String(size || catalog.regularSizes[0] || '').trim();
  if (sizeValue && catalog.regularSizes.length && !catalog.regularSizes.includes(sizeValue) && !(catalog.customSizes || []).includes(sizeValue)) {
    return {
      ok: false,
      code: 'SIZE_NOT_FOUND',
      message: `「${catalog.name}」没有 ${sizeValue} 这个规格，可选：${catalog.regularSizes.join(' / ')}`,
    };
  }
  const qty = Math.max(1, Math.min(200, Number(quantity) || 1));

  const taken = new Set();
  for (const i of state.items) {
    taken.add(i.id);
    taken.add(i.barcode);
  }
  const salt = Date.now();
  const created = [];
  for (let i = 0; i < qty; i++) {
    const { id, barcode } = itemIdentity(entryDate, salt, i, taken);
    taken.add(id);
    taken.add(barcode);
    created.push({
      id,
      barcode,
      productId: catalog.id,
      productName: catalog.name,
      brand: catalog.brand,
      category: catalog.category,
      size: sizeValue,
      color: color || catalog.color,
      price: catalog.price,
      ownerPartnerId: owner.id,
      ownerPartnerName: owner.name,
      entryDate,
      entryOperator: operator,
      status: 'AVAILABLE',
    });
  }
  state.items = [...created, ...state.items];

  return {
    ok: true,
    patch: { items: state.items },
    created,
    message: `入库成功：${owner.name} 名下【${catalog.name} ${sizeValue}】${qty} 件已登记，条码 ${created[0].barcode} 起。`,
  };
}

/** 试衣借出：只记事件，不动库存状态 */
export function takeForFitting(state, input) {
  const ref = input.inventoryItemId || input.barcode || input.item || input.productName;
  const matches = findItems(state, ref).filter((i) => i.status === 'AVAILABLE' && !activeFittingOf(state, i.id));
  if (!matches.length) {
    const raw = findItems(state, ref);
    if (raw.length && raw.every((i) => activeFittingOf(state, i.id))) {
      return { ok: false, code: 'ALREADY_IN_FITTING', message: `「${raw[0].productName} ${raw[0].size}」已经在试衣间了` };
    }
    if (raw.length && raw.every((i) => i.status !== 'AVAILABLE')) {
      return { ok: false, code: 'NOT_AVAILABLE', message: `「${raw[0].productName} ${raw[0].size}」当前状态为「${STATUS_LABEL[raw[0].status] || raw[0].status}」，不能取去试衣` };
    }
    return { ok: false, code: 'ITEM_NOT_FOUND', message: `没有找到可试衣的货品「${ref || ''}」` };
  }
  if (matches.length > 1 && !input.inventoryItemId && !input.barcode) {
    return {
      ok: false,
      code: 'AMBIGUOUS',
      message: `「${ref}」有 ${matches.length} 件在库，请指定其中一件（回复条码）`,
      candidates: matches.slice(0, 8).map((i) => ({ inventoryId: i.id, barcode: i.barcode, size: i.size, color: i.color, owner: i.ownerPartnerName })),
    };
  }

  const item = matches[0];
  const takenAt = input.takenAt || stamp();
  const ev = {
    id: nextId('FIT', state.fittingEvents),
    inventoryItemId: item.id,
    barcode: item.barcode,
    productId: item.productId,
    productName: item.productName,
    brand: item.brand,
    category: item.category,
    color: item.color || '',
    size: item.size,
    price: item.price,
    ownerPartnerId: item.ownerPartnerId,
    ownerPartnerName: item.ownerPartnerName,
    customerName: input.customerName || '',
    customerPhone: input.customerPhone || '',
    takenAt,
    takenBy: input.operator || '付蓉 (店长)',
    status: 'FITTING',
    note: input.note || '',
    source: input.channel === 'MCP' ? 'MCP' : 'WEB',
  };
  state.fittingEvents = [ev, ...(state.fittingEvents || [])];

  return {
    ok: true,
    patch: { fittingEvents: state.fittingEvents },
    event: ev,
    message: `已登记试衣：${item.productName} ${item.size}${item.color ? ` / ${item.color}` : ''}${ev.customerName ? ` → 客户 ${ev.customerName}` : ''}。库存状态未变动（仍为在库，货权归 ${item.ownerPartnerName}）。`,
    reminder: '若客户不购买，请登记「试衣归还」；若购买，请登记「客户成交」，随后在电脑端完成双人电子签名出库。',
  };
}

/** 试衣归还（客户不购买）：消除事件，库存状态依旧不动 */
export function returnFromFitting(state, input) {
  const ev = pickFitting(state, input);
  if (!ev) return { ok: false, code: 'FITTING_NOT_FOUND', message: `没有找到试衣记录「${input.fittingId || input.item || input.productName || ''}」` };
  if (ev.status !== 'FITTING') {
    return { ok: false, code: 'ALREADY_RESOLVED', message: `该试衣记录已处理（当前状态：${ev.status === 'RETURNED' ? '已归还' : '已成交'}）` };
  }
  const at = input.returnedAt || stamp();
  state.fittingEvents = state.fittingEvents.map((f) =>
    f.id === ev.id
      ? { ...f, status: 'RETURNED', resolvedAt: at, resolvedBy: input.operator || '付蓉 (店长)', note: [f.note, input.note].filter(Boolean).join(' | ') }
      : f
  );
  return {
    ok: true,
    patch: { fittingEvents: state.fittingEvents },
    event: state.fittingEvents.find((f) => f.id === ev.id),
    message: `试衣归还已登记：${ev.productName} ${ev.size} 已放回货架。客户未购买，全程未产生出库记录，${ev.ownerPartnerName} 的货权与在库数量均不变。`,
  };
}

/** 客户成交意向：置为已成交 + 生成待签销售单（真正出库仍需电脑端双签） */
export function intendPurchase(state, input) {
  const ev = pickFitting(state, input);
  if (!ev) return { ok: false, code: 'FITTING_NOT_FOUND', message: `没有找到试衣记录「${input.fittingId || input.item || input.productName || ''}」` };
  if (ev.status === 'RETURNED') return { ok: false, code: 'ALREADY_RETURNED', message: '该试衣记录已按「未购买归还」处理，如需成交请重新登记试衣' };
  if (ev.status === 'PURCHASED') {
    const existed = (state.pendingSales || []).find((p) => p.fittingId === ev.id);
    return {
      ok: true,
      patch: { pendingSales: state.pendingSales || [] },
      pendingSale: existed || null,
      alreadyDone: true,
      message: `该笔已登记过成交意向${existed ? `（待签单 ${existed.id}）` : ''}，请在电脑端完成双人电子签名出库。`,
    };
  }

  const seller = resolvePartner(state, input.sellerPartnerId || input.sellerPartnerName || input.seller) || resolvePartner(state, ev.takenBy);
  const at = input.at || stamp();
  const pending = {
    id: nextId('PS', state.pendingSales || []),
    fittingId: ev.id,
    inventoryItemId: ev.inventoryItemId,
    barcode: ev.barcode,
    productName: ev.productName,
    brand: ev.brand,
    category: ev.category,
    color: ev.color,
    size: ev.size,
    price: ev.price,
    dealPrice: Number(input.dealPrice) || ev.price,
    ownerPartnerId: ev.ownerPartnerId,
    ownerPartnerName: ev.ownerPartnerName,
    sellerPartnerId: seller?.id || '',
    sellerPartnerName: seller?.name || '',
    customerName: input.customerName || ev.customerName || '',
    customerPhone: input.customerPhone || ev.customerPhone || '',
    createdAt: at,
    createdBy: input.operator || ev.takenBy,
    note: input.note || '',
    source: input.channel === 'MCP' ? 'MCP' : 'WEB',
    status: 'PENDING',
  };

  state.pendingSales = [pending, ...(state.pendingSales || [])];
  state.fittingEvents = state.fittingEvents.map((f) =>
    f.id === ev.id ? { ...f, status: 'PURCHASED', resolvedAt: at, resolvedBy: pending.createdBy, customerName: pending.customerName || f.customerName } : f
  );

  return {
    ok: true,
    patch: { fittingEvents: state.fittingEvents, pendingSales: state.pendingSales },
    pendingSale: pending,
    message: `已登记成交意向：${ev.productName} ${ev.size}${pending.customerName ? ` → 客户 ${pending.customerName}` : ''}。待签销售单 ${pending.id} 已生成，货品仍为在库状态，请在电脑端完成双人电子签名后才会正式出库。`,
  };
}

function pickFitting(state, input) {
  const list = state.fittingEvents || [];
  if (input.fittingId) {
    const byId = list.find((f) => f.id === input.fittingId);
    if (byId) return byId;
  }
  const ref = input.inventoryItemId || input.barcode || input.item || input.productName;
  if (!ref) {
    // 只有一个未归还的，就直接用；多个则要求指明
    const open = list.filter((f) => f.status === 'FITTING');
    return open.length === 1 ? open[0] : null;
  }
  const exactItem = list.find((f) => f.inventoryItemId === ref || f.barcode === ref);
  if (exactItem && exactItem.status === 'FITTING') return exactItem;
  const open = list.filter((f) => f.status === 'FITTING');
  const matches = open.filter((f) => f.productName.includes(ref) || `${f.productName} ${f.size}`.includes(ref) || f.customerName.includes(ref));
  if (matches.length === 1) return matches[0];
  if (exactItem) return exactItem;
  if (matches.length > 1) return null;
  return open.length === 1 ? open[0] : null;
}

export function listPendingSales(state, opts = {}) {
  const { status = 'PENDING', limit = 50 } = opts;
  const set = String(status).split(',').map((s) => s.trim().toUpperCase());
  return (state.pendingSales || [])
    .filter((p) => (set.includes('ALL') ? true : set.includes(p.status)))
    .slice(0, limit);
}

/* ────────────────────────── 正式销售出库（双签）────────────────────────── */

/** 与前端 handleSubmitSale 同语义；额外负责回收试衣事件与待签单 */
export function recordSale(state, input) {
  // ⚠️ 双签是风控必要项：前端 OutboundSaleModal 会拦，但 HTTP/MCP 直调必须同样拦，
  // 否则绕过界面就能无签名出库（实测真的可以 —— 这就是三层验证抓出来的缺口）。
  if (!input.managerSignature) {
    return { ok: false, code: 'SIGNATURE_REQUIRED', message: '出库必须由店长完成手写电子签名（风控必要项，不能跳过）' };
  }
  if (!input.sellerSignature) {
    return { ok: false, code: 'SIGNATURE_REQUIRED', message: '出库必须由实际销售者完成手写电子签名（风控必要项，不能跳过）' };
  }

  const item = state.items.find((i) => i.id === input.inventoryItemId) || findItems(state, input.inventoryItemId || input.barcode)[0];
  if (!item) return { ok: false, code: 'ITEM_NOT_FOUND', message: `没有找到货品「${input.inventoryItemId || input.barcode || ''}」` };
  if (item.status !== 'AVAILABLE') return { ok: false, code: 'NOT_AVAILABLE', message: `「${item.productName} ${item.size}」当前为「${STATUS_LABEL[item.status] || item.status}」，不能再次出库` };

  const seller = resolvePartner(state, input.sellerPartnerId || input.sellerPartnerName);
  if (!seller) return { ok: false, code: 'PARTNER_NOT_FOUND', message: `没有找到销售人「${input.sellerPartnerId || input.sellerPartnerName || ''}」` };

  const isCross = item.ownerPartnerId !== seller.id;
  const saleDate = input.saleDate || stamp();
  const order = {
    id: nextId('SO', state.salesOrders, new Date(saleDate.replace(' ', 'T'))),
    inventoryItemId: item.id,
    barcode: item.barcode,
    productName: item.productName,
    brand: item.brand,
    category: item.category,
    color: item.color,
    size: item.size,
    price: item.price,
    dealPrice: Number(input.dealPrice ?? item.price),
    ownerPartnerId: item.ownerPartnerId,
    ownerPartnerName: item.ownerPartnerName,
    sellerPartnerId: seller.id,
    sellerPartnerName: seller.name,
    saleDate,
    isCrossPartnerBorrow: isCross,
    expectedReturnDate: isCross ? input.expectedReturnDate : undefined,
    returnStatus: isCross ? 'PENDING' : undefined,
    managerSignature: input.managerSignature || '',
    sellerSignature: input.sellerSignature || '',
    managerName: input.managerName || '付蓉 (店长)',
    remarks: input.remarks || '',
  };

  state.salesOrders = [order, ...state.salesOrders];
  state.items = state.items.map((i) =>
    i.id === item.id
      ? {
          ...i,
          status: 'SOLD',
          soldDate: saleDate,
          soldByPartnerId: seller.id,
          soldByPartnerName: seller.name,
          isBorrowedSale: isCross,
          expectedReturnDate: isCross ? input.expectedReturnDate : undefined,
          saleOrderId: order.id,
        }
      : i
  );

  // 回收试衣事件（若这单来自试衣成交）
  const patchExtra = {};
  const fit = activeFittingOf(state, item.id) || (state.fittingEvents || []).find((f) => f.inventoryItemId === item.id && f.status === 'PURCHASED' && !f.saleOrderId);
  if (fit) {
    state.fittingEvents = state.fittingEvents.map((f) => (f.id === fit.id ? { ...f, status: 'PURCHASED', resolvedAt: f.resolvedAt || saleDate, saleOrderId: order.id } : f));
    patchExtra.fittingEvents = state.fittingEvents;
  }
  if (Array.isArray(state.pendingSales)) {
    const before = state.pendingSales;
    state.pendingSales = before.map((p) => (p.inventoryItemId === item.id && p.status === 'PENDING' ? { ...p, status: 'SIGNED', signedAt: saleDate, saleOrderId: order.id } : p));
    if (state.pendingSales.some((p, i) => p !== before[i])) patchExtra.pendingSales = state.pendingSales;
  }

  return {
    ok: true,
    patch: { items: state.items, salesOrders: state.salesOrders, ...patchExtra },
    order,
    message: isCross
      ? `销售出库完成：${seller.name} 向 ${item.ownerPartnerName} 借调待还记录已建立，双人电子印鉴已锁定。`
      : `销售出库完成：${seller.name} 名下货品已出库，双人电子签名已生成。`,
  };
}

/** 还货冲销 */
export function returnOrder(state, input) {
  const order = state.salesOrders.find((o) => o.id === input.orderId);
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND', message: `没有找到销售单「${input.orderId || ''}」` };
  if (order.returnStatus === 'RESOLVED') return { ok: false, code: 'ALREADY_RESOLVED', message: '该借调已冲销完成' };

  const at = input.actualReturnDate || stamp();
  state.salesOrders = state.salesOrders.map((o) =>
    o.id === order.id
      ? {
          ...o,
          returnStatus: 'RESOLVED',
          actualReturnDate: at,
          remarks: o.remarks ? `${o.remarks} | 还货补齐: ${input.notes || ''}` : input.notes,
        }
      : o
  );

  const catalog = state.catalogs.find((c) => c.name === order.productName) || state.catalogs[0];
  const replenish = {
    id: `INV-RP-${Date.now()}`,
    barcode: input.replenishBarcode?.trim() || `SNRP${String(Date.now()).slice(-6)}`,
    productId: catalog?.id || '',
    productName: order.productName,
    brand: order.brand,
    category: catalog?.category || order.category,
    size: order.size,
    color: order.color,
    price: order.price,
    ownerPartnerId: order.ownerPartnerId,
    ownerPartnerName: order.ownerPartnerName,
    entryDate: at,
    entryOperator: input.confirmedBy || '付蓉 (店长)',
    status: 'AVAILABLE',
  };
  state.items = [replenish, ...state.items];

  return {
    ok: true,
    patch: { items: state.items, salesOrders: state.salesOrders },
    message: `还货冲销完成：借调关系已解除，已为原货主「${order.ownerPartnerName}」自动登记还库新商品。`,
  };
}

/* ────────────────────────── 其余实体 ────────────────────────── */

export function recordAudit(state, report) {
  if (!report?.id) return { ok: false, code: 'BAD_INPUT', message: '审计报告缺少编号' };
  state.auditReports = [report, ...state.auditReports];
  return { ok: true, patch: { auditReports: state.auditReports }, message: `审计报告 ${report.id} 已归档。` };
}

export function addPartner(state, input) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, code: 'BAD_INPUT', message: '合伙人姓名不能为空' };
  if (state.partners.some((p) => p.name === name)) return { ok: false, code: 'DUPLICATE', message: `合伙人「${name}」已存在` };
  const p = { id: `p-${Date.now()}`, name, phone: input.phone || '', role: input.role || '合伙人', joinDate: new Date().toISOString().slice(0, 10) };
  state.partners = [...state.partners, p];
  return { ok: true, patch: { partners: state.partners }, partner: p, message: `合伙人「${name}」档案已建立。` };
}

export function addFranchisee(state, input) {
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, code: 'BAD_INPUT', message: '加盟商名称不能为空' };
  const f = { ...input, id: `FR-${Date.now()}` };
  state.franchisees = [f, ...state.franchisees];
  return { ok: true, patch: { franchisees: state.franchisees }, franchisee: f, message: `加盟商「${name}」档案已建立。` };
}

export function renewFranchisee(state, id, renewal) {
  const target = state.franchisees.find((f) => f.id === id);
  if (!target) return { ok: false, code: 'NOT_FOUND', message: `没有找到加盟商「${id}」` };
  const prevExp = new Date(target.expireDate);
  const today = new Date();
  const base = prevExp.getTime() < today.getTime() ? today : prevExp;
  const next = new Date(base);
  next.setFullYear(next.getFullYear() + 1);
  const newExp = renewal?.newExpireDate || next.toISOString().slice(0, 10);
  const renewDate = renewal?.renewDate || new Date().toISOString().slice(0, 10);
  const rec = {
    id: `REC-${Date.now()}`,
    franchiseeId: target.id,
    franchiseeName: target.name,
    renewDate,
    amount: target.rentAmount || 4000,
    previousExpireDate: target.expireDate,
    newExpireDate: newExp,
    managerName: renewal?.managerName || '付蓉 (店长)',
    managerSignature: renewal?.managerSignature || '',
    franchiseeSignature: renewal?.franchiseeSignature || '',
    notes: renewal?.notes,
  };
  state.franchisees = state.franchisees.map((f) =>
    f.id === id
      ? { ...f, paymentDate: renewDate, expireDate: newExp, managerSignature: renewal?.managerSignature, franchiseeSignature: renewal?.franchiseeSignature, renewalHistory: [rec, ...(f.renewalHistory || [])] }
      : f
  );
  return { ok: true, patch: { franchisees: state.franchisees }, message: '房租续约完成，双人电子签名凭据已归档存证。' };
}
