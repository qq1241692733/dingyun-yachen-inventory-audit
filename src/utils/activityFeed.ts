import { InventoryItem, SaleOrder, AuditReport, Franchisee, FittingEvent } from '../types/inventory';

/* ============================================================================
   动态流派生器 —— 「进出货记录 + 最近动态」的唯一数据源

   V2 的 LatestActivityFeed 是 5 条硬编码假数据：既不随真实操作更新，
   也无法回答"这周进了多少货、出了多少货"。
   V3 起改为从真实 state 派生：
     入库 → items.entryDate / entryOperator（按日聚合，见下方说明）
     出库 / 借调 / 还货 → salesOrders
     审计 → auditReports
     房租续约 → franchisees.renewalHistory
   —— 数据里没有的事情，界面上不会出现。

   为什么入库按"日"聚合而不是"件"：
     种子数据里每件货的 entryDate 是逐件随机的，不存在真实批次结构。
     若按件生成流水，首页会出现 371 条几乎同形的"付蓉（店长）入库 X 1 件"。
     真实门店的记账方式本就是"当日入库登记一批"，逐件明细在台账表里可查。
   ============================================================================ */

export type ActivityKind =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'BORROW'
  | 'RETURN'
  | 'AUDIT'
  | 'RENEWAL'
  | 'FITTING_TAKE'
  | 'FITTING_RETURN'
  | 'FITTING_PURCHASED';

export type ActivityTone = 'ok' | 'warn' | 'danger' | 'neutral';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  kindLabel: string;
  /** YYYY-MM-DD HH:mm */
  timestamp: string;
  date: string;
  time: string;
  /** 一行说清"谁 + 做了什么 + 多少" */
  title: string;
  detail: string;
  operator: string;
  participants: string[];
  itemName?: string;
  barcode?: string;
  amount?: number;
  /** 聚合类事件的明细行（入库当日各合伙人的件数），在详情弹层里展开 */
  breakdown?: string[];
  tone: ActivityTone;
  statusText: string;
  dualSigned: boolean;
  managerSignature?: string;
  userSignature?: string;
  notes?: string;
}

export const KIND_LABEL: Record<ActivityKind, string> = {
  INBOUND: '入库上架',
  OUTBOUND: '销售出库',
  BORROW: '借调流转',
  RETURN: '还货冲销',
  AUDIT: '审计清点',
  RENEWAL: '房租续约',
  FITTING_TAKE: '试衣借出',
  FITTING_RETURN: '试衣归还',
  FITTING_PURCHASED: '试衣成交',
};

/** 业务基准日（与 PRD 一致）—— "今天 / 昨天" 以它为准，避免演示数据出现"未来日期" */
const BUSINESS_DATE = '2026-09-14';

const pad = (n: number) => String(n).padStart(2, '0');

export function splitStamp(stamp: string): { date: string; time: string } {
  const s = (stamp || '').trim();
  if (!s) return { date: BUSINESS_DATE, time: '00:00' };
  if (s.includes(' ')) {
    const [d, t] = s.split(' ');
    return { date: d, time: (t || '00:00').slice(0, 5) };
  }
  return { date: s, time: '00:00' };
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 相对业务基准日的人话时间：今天 / 昨天 / 9 月 7 日 */
export function formatWhen(date: string, time: string): string {
  if (date === BUSINESS_DATE) return `今天 ${time}`;
  if (date === shiftDate(BUSINESS_DATE, -1)) return `昨天 ${time}`;
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!m || !d) return `${date} ${time}`;
  return `${m} 月 ${d} 日 ${time}`;
}

/** 只保留日期的版本，供"当日入库"这类聚合事件做行标题 */
export function formatDay(date: string): string {
  if (date === BUSINESS_DATE) return '今天';
  if (date === shiftDate(BUSINESS_DATE, -1)) return '昨天';
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (!m || !d) return date;
  return `${m} 月 ${d} 日`;
}

const money = (n: number) => `¥${Math.round(n).toLocaleString('zh-CN')}`;

/* ── 当日入库聚合（也供 utils/auditLogs.ts 复用，避免两处逻辑漂移） ── */
export interface InboundDay {
  date: string;
  /** 当日最晚一条入库时间，用作排序与显示 */
  time: string;
  qty: number;
  value: number;
  operator: string;
  stillInStock: boolean;
  productNames: string[];
  sampleBarcode: string;
  partnerBreakdown: { name: string; qty: number; value: number }[];
}

export function deriveInboundDays(items: InventoryItem[]): InboundDay[] {
  const byDate = new Map<string, InventoryItem[]>();
  items.forEach((it) => {
    const { date } = splitStamp(it.entryDate);
    const arr = byDate.get(date);
    if (arr) arr.push(it);
    else byDate.set(date, [it]);
  });

  const days: InboundDay[] = [];
  byDate.forEach((group, date) => {
    let latest = '00:00';
    const partnerMap = new Map<string, { qty: number; value: number }>();
    const productSet = new Set<string>();
    let value = 0;

    group.forEach((it) => {
      const { time } = splitStamp(it.entryDate);
      if (time > latest) latest = time;
      value += it.price;
      productSet.add(`${it.brand} ${it.productName}`);
      const cur = partnerMap.get(it.ownerPartnerName) || { qty: 0, value: 0 };
      cur.qty += 1;
      cur.value += it.price;
      partnerMap.set(it.ownerPartnerName, cur);
    });

    days.push({
      date,
      time: latest,
      qty: group.length,
      value,
      operator: group[0].entryOperator,
      stillInStock: group.some((i) => i.status === 'AVAILABLE'),
      productNames: Array.from(productSet),
      sampleBarcode: group[0].barcode,
      partnerBreakdown: Array.from(partnerMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.qty - a.qty),
    });
  });

  return days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export interface ActivityInput {
  items: InventoryItem[];
  salesOrders: SaleOrder[];
  auditReports: AuditReport[];
  franchisees: Franchisee[];
  /** 试衣事件：借出 / 归还 / 成交。这三类都不改动库存，所以单独立账 */
  fittingEvents?: FittingEvent[];
}

export function buildActivityFeed({
  items,
  salesOrders,
  auditReports,
  franchisees,
  fittingEvents = [],
}: ActivityInput): ActivityEntry[] {
  const list: ActivityEntry[] = [];

  /* ── 1 · 入库：按日聚合 ── */
  deriveInboundDays(items).forEach((d) => {
    const top = d.partnerBreakdown.slice(0, 3);
    list.push({
      id: `ACT-IN-${d.date}`,
      kind: 'INBOUND',
      kindLabel: KIND_LABEL.INBOUND,
      timestamp: `${d.date} ${d.time}`,
      date: d.date,
      time: d.time,
      title: `${formatDay(d.date)} 入库登记 ${d.qty} 件 · 涉及 ${d.partnerBreakdown.length} 位合伙人`,
      detail: `${top
        .map((p) => `${p.name} ${p.qty} 件`)
        .join(' · ')}${d.partnerBreakdown.length > top.length ? ` 等 ${d.partnerBreakdown.length} 位` : ''}`,
      operator: d.operator,
      participants: [d.operator, ...d.partnerBreakdown.map((p) => p.name)].filter(Boolean),
      itemName: `${d.productNames.length} 个货品 · ${d.productNames.slice(0, 2).join('、')}${
        d.productNames.length > 2 ? ' 等' : ''
      }`,
      barcode: `${d.qty} 个独立条码`,
      amount: d.value,
      breakdown: d.partnerBreakdown.map((p) => `${p.name} — ${p.qty} 件 · ${money(p.value)}`),
      tone: d.stillInStock ? 'ok' : 'neutral',
      statusText: d.stillInStock ? '在库保管中 · 账实相符' : '该批货品已全部售出出库',
      dualSigned: false,
      notes: `${formatDay(d.date)}共登记 ${d.partnerBreakdown.length} 位合伙人拿来入店的 ${d.qty} 件货品，货值合计 ${money(
        d.value
      )}，由 ${d.operator} 核验防伪吊牌并贴附独立条码后入柜保管。`,
    });
  });

  /* ── 2 · 出库 / 借调 / 还货：来自销售单据 ── */
  salesOrders.forEach((so) => {
    const { date, time } = splitStamp(so.saleDate);
    const signed = Boolean(so.managerSignature && so.sellerSignature);

    if (so.isCrossPartnerBorrow) {
      const pending = so.returnStatus === 'PENDING';
      list.push({
        id: `ACT-BRW-${so.id}`,
        kind: 'BORROW',
        kindLabel: KIND_LABEL.BORROW,
        timestamp: `${date} ${time}`,
        date,
        time,
        title: `${so.sellerPartnerName} 售出 ${so.ownerPartnerName} 名下 ${so.brand} ${so.size} 1 件 · 借调待还`,
        detail: '销售人借调他人货品交付客户，须补还同款给原货主',
        operator: so.managerName,
        participants: [so.managerName, so.sellerPartnerName, so.ownerPartnerName].filter(Boolean),
        itemName: `${so.brand} ${so.productName}（${so.size}${so.color ? ' / ' + so.color : ''}）`,
        barcode: so.barcode,
        amount: so.dealPrice,
        tone: pending ? 'warn' : 'ok',
        statusText: pending
          ? `借调未冲销 · 约定还货 ${so.expectedReturnDate || '待定'}`
          : '借调关系已冲销闭环',
        dualSigned: signed,
        managerSignature: so.managerSignature,
        userSignature: so.sellerSignature,
        notes: so.remarks,
      });

      if (so.returnStatus === 'RESOLVED' && so.actualReturnDate) {
        const r = splitStamp(so.actualReturnDate);
        list.push({
          id: `ACT-RET-${so.id}`,
          kind: 'RETURN',
          kindLabel: KIND_LABEL.RETURN,
          timestamp: `${r.date} ${r.time}`,
          date: r.date,
          time: r.time,
          title: `${so.sellerPartnerName} 已为 ${so.ownerPartnerName} 补还 ${so.brand} ${so.size} 1 件`,
          detail: '店长核验实物入库，借调关系解除，原货主在库数回补',
          operator: so.managerName,
          participants: [so.managerName, so.sellerPartnerName, so.ownerPartnerName].filter(Boolean),
          itemName: `${so.brand} ${so.productName}（${so.size}）`,
          amount: so.price,
          tone: 'ok',
          statusText: '借调已闭环 · 账实相符',
          dualSigned: true,
          managerSignature: so.managerSignature,
          userSignature: so.sellerSignature,
          notes: '还货补齐后借调关系解除，系统已为原货主自动登记还库现货。',
        });
      }
    } else {
      list.push({
        id: `ACT-OUT-${so.id}`,
        kind: 'OUTBOUND',
        kindLabel: KIND_LABEL.OUTBOUND,
        timestamp: `${date} ${time}`,
        date,
        time,
        title: `${so.sellerPartnerName} 售出名下 ${so.brand} ${so.size} 1 件`,
        detail: '自有货品出库交付客户，店长与销售人手写签名存证',
        operator: so.managerName,
        participants: [so.managerName, so.sellerPartnerName].filter(Boolean),
        itemName: `${so.brand} ${so.productName}（${so.size}${so.color ? ' / ' + so.color : ''}）`,
        barcode: so.barcode,
        amount: so.dealPrice,
        tone: signed ? 'ok' : 'warn',
        statusText: signed ? '双签存证完成' : '缺双签 · 待补签',
        dualSigned: signed,
        managerSignature: so.managerSignature,
        userSignature: so.sellerSignature,
        notes: so.remarks,
      });
    }
  });

  /* ── 3 · 审计清点 ── */
  auditReports.forEach((ar) => {
    const { date, time } = splitStamp(ar.createdAt || ar.auditDate);
    const diff = ar.discrepancyCount || 0;
    const typeLabel =
      ar.auditType === 'MONTHLY'
        ? '月度全盘强制审计'
        : ar.auditType === 'WEEKLY'
          ? '周度抽检审计'
          : '每日审计';
    list.push({
      id: `ACT-AUD-${ar.id}`,
      kind: 'AUDIT',
      kindLabel: KIND_LABEL.AUDIT,
      timestamp: `${date} ${time}`,
      date,
      time,
      title: `${typeLabel}完成 · ${diff === 0 ? '账实相符' : `差异 ${diff} 件`}`,
      detail: `系统 ${ar.totalSystemCount} 件 / 实盘 ${ar.totalPhysicalCount} 件，店长与审计监事实盘核对`,
      operator: ar.managerName,
      participants: [ar.managerName, ar.inspectorName].filter(Boolean),
      itemName: `全库盘点单 ${ar.id}`,
      tone: diff === 0 ? 'ok' : 'danger',
      statusText: diff === 0 ? '差异 0 件 · 账实 100% 相符' : `差异 ${diff} 件 · 需复核`,
      dualSigned: Boolean(ar.managerSignature && ar.inspectorSignature),
      managerSignature: ar.managerSignature,
      userSignature: ar.inspectorSignature,
      notes: ar.summary,
    });
  });

  /* ── 4 · 加盟商房租续约 ── */
  franchisees.forEach((f) => {
    (f.renewalHistory || []).forEach((rh) => {
      const s = splitStamp(rh.renewDate);
      const time = s.time === '00:00' ? '11:30' : s.time;
      list.push({
        id: `ACT-REN-${rh.id}`,
        kind: 'RENEWAL',
        kindLabel: KIND_LABEL.RENEWAL,
        timestamp: `${s.date} ${time}`,
        date: s.date,
        time,
        title: `${rh.franchiseeName} 缴纳年费 ${money(rh.amount)} · 房租双签续约`,
        detail: `有效期由 ${rh.previousExpireDate} 顺延至 ${rh.newExpireDate}`,
        operator: rh.managerName,
        participants: [rh.managerName, rh.franchiseeName].filter(Boolean),
        amount: rh.amount,
        tone: 'ok',
        statusText: `已续约至 ${rh.newExpireDate}`,
        dualSigned: Boolean(rh.managerSignature && rh.franchiseeSignature),
        managerSignature: rh.managerSignature,
        userSignature: rh.franchiseeSignature,
        notes: rh.notes,
      });
    });
  });

  /* ── 5 · 试衣：借出 / 归还 / 成交 ──
   * 这三类事件都不改动库存状态（试衣不是出库），所以它们只在动态流里出现，
   * 不会让台账件数发生变化。手机端 AI 助手登记的会带「手机端」标记。 */
  fittingEvents.forEach((f) => {
    const take = splitStamp(f.takenAt);
    const via = f.source === 'MCP' ? '手机端 AI 助手登记' : '电脑端登记';
    list.push({
      id: `ACT-FIT-TAKE-${f.id}`,
      kind: 'FITTING_TAKE',
      kindLabel: KIND_LABEL.FITTING_TAKE,
      timestamp: `${take.date} ${take.time}`,
      date: take.date,
      time: take.time,
      title: `${f.productName}（${f.size}${f.color ? ' / ' + f.color : ''}）取去试衣${f.customerName ? ` · 客户 ${f.customerName}` : ''}`,
      detail: `${via} · 货权仍归 ${f.ownerPartnerName}，未出库、未改库存`,
      operator: f.takenBy,
      participants: [f.takenBy, f.ownerPartnerName, f.customerName || ''].filter(Boolean),
      itemName: `${f.brand} ${f.productName}（${f.size}${f.color ? ' / ' + f.color : ''}）`,
      barcode: f.barcode,
      amount: f.price,
      tone: 'neutral',
      statusText: f.status === 'FITTING' ? '试衣中 · 尚未归还' : '已处理',
      dualSigned: false,
      notes: f.note,
    });

    if (f.status === 'RETURNED' && f.resolvedAt) {
      const r = splitStamp(f.resolvedAt);
      list.push({
        id: `ACT-FIT-RET-${f.id}`,
        kind: 'FITTING_RETURN',
        kindLabel: KIND_LABEL.FITTING_RETURN,
        timestamp: `${r.date} ${r.time}`,
        date: r.date,
        time: r.time,
        title: `${f.productName}（${f.size}）客户未购买 · 已放回货架`,
        detail: `${f.resolvedBy || f.takenBy} 经手 · 全程未产生出库记录，在库数量与货权归属均不变`,
        operator: f.resolvedBy || f.takenBy,
        participants: [f.resolvedBy || f.takenBy, f.ownerPartnerName, f.customerName || ''].filter(Boolean),
        itemName: `${f.brand} ${f.productName}（${f.size}）`,
        barcode: f.barcode,
        tone: 'ok',
        statusText: '试衣记录已消除 · 库存未变动',
        dualSigned: false,
        notes: f.note,
      });
    }

    if (f.status === 'PURCHASED') {
      const r = splitStamp(f.resolvedAt || f.takenAt);
      list.push({
        id: `ACT-FIT-BUY-${f.id}`,
        kind: 'FITTING_PURCHASED',
        kindLabel: KIND_LABEL.FITTING_PURCHASED,
        timestamp: `${r.date} ${r.time}`,
        date: r.date,
        time: r.time,
        title: `${f.productName}（${f.size}）客户决定购买${f.customerName ? ` · ${f.customerName}` : ''}`,
        detail: f.saleOrderId
          ? `已双签出库，销售单 ${f.saleOrderId}`
          : '已生成待签销售单 · 需在电脑端完成双人电子签名后才正式出库',
        operator: f.resolvedBy || f.takenBy,
        participants: [f.resolvedBy || f.takenBy, f.ownerPartnerName, f.customerName || ''].filter(Boolean),
        itemName: `${f.brand} ${f.productName}（${f.size}）`,
        barcode: f.barcode,
        amount: f.price,
        tone: f.saleOrderId ? 'ok' : 'warn',
        statusText: f.saleOrderId ? '已出库 · 双签存证' : '待签署销售单',
        dualSigned: Boolean(f.saleOrderId),
        notes: f.note,
      });
    }
  });

  list.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return list;
}

/** tab 用的分类计数 */
export function countByKind(list: ActivityEntry[]): Record<ActivityKind, number> {
  const base: Record<ActivityKind, number> = {
    INBOUND: 0,
    OUTBOUND: 0,
    BORROW: 0,
    RETURN: 0,
    AUDIT: 0,
    RENEWAL: 0,
    FITTING_TAKE: 0,
    FITTING_RETURN: 0,
    FITTING_PURCHASED: 0,
  };
  list.forEach((e) => {
    base[e.kind] += 1;
  });
  return base;
}
