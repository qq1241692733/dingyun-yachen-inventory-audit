import React, { useMemo } from 'react';
import {
  InventoryItem,
  Partner,
  SaleOrder,
  Franchisee,
  AuditReport,
  FittingEvent,
  PendingSale,
} from '../types/inventory';
import { LatestActivityFeed } from './LatestActivityFeed';
import {
  ArrowRight,
  ArrowRightLeft,
  ClipboardCheck,
  Users,
  Building2,
  CheckCircle2,
  CalendarClock,
} from 'lucide-react';

interface InventoryStructureOverviewProps {
  items: InventoryItem[];
  partners: Partner[];
  salesOrders: SaleOrder[];
  franchisees?: Franchisee[];
  auditReports?: AuditReport[];
  /** 试衣事件：进动态流水，也用于「今日待办」里的滞留提醒 */
  fittingEvents?: FittingEvent[];
  /** 手机端登记成交、等待双签的销售单 */
  pendingSales?: PendingSale[];
  selectedPartnerFilter: string;
  onSelectPartnerFilter: (partnerId: string) => void;
  selectedBrandFilter: string;
  onSelectBrandFilter: (brand: string) => void;
  onClickBorrowCard: () => void;
  onNavigateToAudit?: () => void;
  onNavigateToFranchisee?: () => void;
  onNavigateToPartners?: () => void;
  onNavigateToFitting?: () => void;
  onOpenFittingTake?: () => void;
  onOpenInbound?: () => void;
  onOpenSale?: () => void;
  onOpenAuditModal?: () => void;
  onConfirmReturn?: (order: SaleOrder) => void;
  onOpenFranchiseeRenewalModal?: (franchisee: Franchisee) => void;
  isMonthlyMandatoryDone?: boolean;
}

/* 业务基准日（与 PRD 一致）—— 所有"剩几天 / 超期几天"以它为准 */
const BUSINESS_DATE = '2026-09-14';

/** 试衣借出超过这个小时数，就进「今日待办」提醒店长收尾 */
const OVERDUE_HOURS = 8;

/* 品牌色阶：单一色相阶梯 + 靛色标记最大占比者。
   账本的图表也应当是「墨与靛」，不做四色撞色。
   数值永远以文字并列（不得仅靠颜色传达信息）。 */
const BRAND_RAMP: Record<string, { bar: string; label: string }> = {
  Laca: { bar: 'var(--color-text-3)', label: 'text-text-2' },
  蕾薇尔: { bar: 'var(--color-accent)', label: 'text-text' },
  悦己集: { bar: 'var(--color-text-4)', label: 'text-text-2' },
  悦维膳: { bar: 'var(--color-border-2)', label: 'text-text-2' },
  古澜美: { bar: 'var(--color-border)', label: 'text-text-3' },
};

const DAY = 86400000;
const daysFromBase = (dateStr?: string): number | null => {
  if (!dateStr) return null;
  const t = new Date(`${dateStr.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - new Date(`${BUSINESS_DATE}T00:00:00`).getTime()) / DAY);
};

type TodoTone = 'danger' | 'warn' | 'neutral';

interface TodoRow {
  id: string;
  kind: string;
  who: string;
  what: string;
  dueLabel: string;
  days: number | null;
  tone: TodoTone;
  actionLabel: string;
  action: () => void;
}

const TODO_DOT: Record<TodoTone, string> = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  neutral: 'bg-text-4',
};
const TODO_TEXT: Record<TodoTone, string> = {
  danger: 'text-danger',
  warn: 'text-warn',
  neutral: 'text-text-3',
};

/* Hallmark · macrostructure: Stat-Led · theme: Quiet Room
 * 结构指纹（V3 按管理动线重排）：
 *   01 会所整体情况 —— 1 主 + 4 次，非等高聚焦
 *   02 今日待办     —— 待还货与到期房租合并成一条"需盖印"清单，每行带动作
 *   03 最近动态     —— 真实进出货流水（独立组件，支持分类切换）
 *   04 合伙人货权   —— 名册式，店长置顶
 *   05 品牌库存构成 —— 横向条形台账
 * 说明：全局"常用操作"（入库 / 出库双签 / 发起清点）已移到常驻抬头，避免首页重复一组按钮。
 * 移动端：320 / 375 / 414 / 768 四档零横向溢出；网格轨道一律 minmax(0,1fr)。
 */
export const InventoryStructureOverview: React.FC<InventoryStructureOverviewProps> = ({
  items,
  partners,
  salesOrders,
  franchisees = [],
  auditReports = [],
  fittingEvents = [],
  pendingSales = [],
  selectedPartnerFilter,
  onSelectPartnerFilter,
  selectedBrandFilter,
  onSelectBrandFilter,
  onClickBorrowCard,
  onNavigateToAudit,
  onNavigateToFranchisee,
  onNavigateToPartners,
  onNavigateToFitting,
  onOpenFittingTake,
  onConfirmReturn,
  onOpenFranchiseeRenewalModal,
  isMonthlyMandatoryDone,
}) => {
  /* ── 计算：全部取自真实 state，不编造任何指标 ── */
  const inStock = useMemo(() => items.filter((i) => i.status === 'AVAILABLE'), [items]);
  const totalInStock = inStock.length;
  const totalValue = inStock.reduce((a, i) => a + i.price, 0);
  const avgPrice = totalInStock ? Math.round(totalValue / totalInStock) : 0;

  const pendingBorrows = useMemo(
    () => salesOrders.filter((o) => o.isCrossPartnerBorrow && o.returnStatus === 'PENDING'),
    [salesOrders]
  );

  const urgentFranchisees = useMemo(() => {
    const base = new Date(`${BUSINESS_DATE}T00:00:00`).getTime();
    return franchisees.filter((f) => {
      const d = Math.ceil((new Date(`${f.expireDate.slice(0, 10)}T00:00:00`).getTime() - base) / DAY);
      return d <= 30;
    });
  }, [franchisees]);

  /* 品牌分布 */
  const brandRows = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    inStock.forEach((i) => {
      const cur = map.get(i.brand) || { count: 0, value: 0 };
      cur.count += 1;
      cur.value += i.price;
      map.set(i.brand, cur);
    });
    const rows = Array.from(map.entries()).map(([brand, v]) => ({
      brand,
      ...v,
      pct: totalInStock ? (v.count / totalInStock) * 100 : 0,
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [inStock, totalInStock]);

  /* 合伙人货权：在库件数与货值 */
  const partnerRows = useMemo(() => {
    return partners
      .map((p) => {
        const own = inStock.filter((i) => i.ownerPartnerId === p.id);
        const lentOut = items.filter(
          (i) => i.ownerPartnerId === p.id && i.status === 'SOLD' && i.isBorrowedSale
        ).length;
        const borrowPending = salesOrders.filter(
          (o) => o.sellerPartnerId === p.id && o.isCrossPartnerBorrow && o.returnStatus === 'PENDING'
        ).length;
        return {
          partner: p,
          count: own.length,
          value: own.reduce((a, i) => a + i.price, 0),
          lentOut,
          borrowPending,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [partners, inStock, items, salesOrders]);

  const managerRow = partnerRows.find((r) => r.partner.role === '店长');
  const memberRows = partnerRows.filter((r) => r.partner.role !== '店长');
  const maxBrandValue = brandRows[0]?.value || 1;

  /* ── 01 · 会所整体情况：1 主 + 4 次 ── */
  const metrics = [
    {
      key: 'partners',
      icon: Users,
      label: '合伙人',
      value: `${partners.length}`,
      unit: '位',
      isNum: true,
      detail: '在册货主 · 货权各自独立',
      tone: 'plain' as const,
      onClick: onNavigateToPartners,
    },
    {
      key: 'franchisees',
      icon: Building2,
      label: '加盟商',
      value: `${franchisees.length}`,
      unit: '家',
      isNum: true,
      detail:
        urgentFranchisees.length > 0
          ? `${urgentFranchisees.length} 家进入续约窗口`
          : '房租均在有效期内',
      tone: urgentFranchisees.length > 0 ? ('danger' as const) : ('ok' as const),
      onClick: onNavigateToFranchisee,
    },
    {
      key: 'borrow',
      icon: ArrowRightLeft,
      label: '跨人借调待还',
      value: `${pendingBorrows.length}`,
      unit: '单',
      isNum: true,
      detail: pendingBorrows.length > 0 ? '售出他人货品 · 须补货冲销' : '借贷关系已全部闭环',
      tone: pendingBorrows.length > 0 ? ('warn' as const) : ('ok' as const),
      onClick: onClickBorrowCard,
    },
    {
      key: 'audit',
      icon: ClipboardCheck,
      label: '本月强制全盘',
      value: isMonthlyMandatoryDone ? '已双签' : '未完成',
      unit: '',
      isNum: false,
      detail: `月度全盘 ${auditReports.length} 份记录在册`,
      tone: isMonthlyMandatoryDone ? ('ok' as const) : ('danger' as const),
      onClick: onNavigateToAudit,
    },
  ];

  /* ── 02 · 今日待办：待还货 + 到期房租 + 试衣收尾，合并为一条"需处理"清单 ── */
  const todos = useMemo<TodoRow[]>(() => {
    const rows: TodoRow[] = [];

    pendingBorrows.forEach((o) => {
      const d = daysFromBase(o.expectedReturnDate);
      rows.push({
        id: `todo-borrow-${o.id}`,
        kind: '待还货',
        who: `${o.sellerPartnerName} → ${o.ownerPartnerName}`,
        what: `${o.brand} ${o.productName} ${o.size} · 售出他人货品待补还`,
        dueLabel: d === null ? '未约定还货日' : d < 0 ? `已超期 ${-d} 天` : `剩 ${d} 天`,
        days: d,
        tone: d === null ? 'warn' : d < 0 ? 'danger' : d <= 7 ? 'warn' : 'neutral',
        actionLabel: '办理还货冲销',
        action: () => onConfirmReturn?.(o),
      });
    });

    urgentFranchisees.forEach((f) => {
      const d = daysFromBase(f.expireDate);
      rows.push({
        id: `todo-rent-${f.id}`,
        kind: '房租到期',
        who: f.name,
        what: `${f.teamName} · 年度房租 ¥${f.rentAmount.toLocaleString('zh-CN')} 待续签`,
        dueLabel: d === null ? '日期缺失' : d < 0 ? `已到期 ${-d} 天` : `剩 ${d} 天`,
        days: d,
        tone: d === null ? 'warn' : d < 0 ? 'danger' : d <= 15 ? 'warn' : 'neutral',
        actionLabel: '双签续费',
        action: () => onOpenFranchiseeRenewalModal?.(f),
      });
    });

    // 试衣收尾：滞留未处理最要紧（货可能还在试衣间，也可能已经放回但忘了登记）
    const now = Date.now();
    fittingEvents
      .filter((f) => f.status === 'FITTING')
      .forEach((f) => {
        const hours = (now - new Date(String(f.takenAt).replace(' ', 'T')).getTime()) / 36e5;
        if (!Number.isFinite(hours) || hours < OVERDUE_HOURS) return;
        const days = Math.floor(hours / 24);
        rows.push({
          id: `todo-fitting-${f.id}`,
          kind: '试衣待收尾',
          who: f.customerName || f.ownerPartnerName,
          what: `${f.productName} ${f.size}${f.color ? ` / ${f.color}` : ''} · 已借出 ${Math.floor(hours)} 小时未处理`,
          dueLabel: days >= 1 ? `滞留 ${days} 天` : `滞留 ${Math.floor(hours)} 小时`,
          days: -days,
          tone: 'warn',
          actionLabel: '去试衣间处理',
          action: () => onNavigateToFitting?.(),
        });
      });

    // 待签销售单：手机端已登记成交，回电脑前签一下就闭环
    pendingSales
      .filter((p) => p.status === 'PENDING')
      .forEach((p) => {
        rows.push({
          id: `todo-pending-${p.id}`,
          kind: '待签销售单',
          who: p.customerName || p.ownerPartnerName,
          what: `${p.productName} ${p.size} · 成交 ¥${p.dealPrice.toLocaleString('zh-CN')}（${p.source === 'MCP' ? '手机端' : '电脑端'}登记）`,
          dueLabel: '待双签出库',
          days: -1,
          tone: 'warn',
          actionLabel: '去双签出库',
          action: () => onNavigateToFitting?.(),
        });
      });

    return rows.sort((a, b) => {
      const av = a.days === null ? 9999 : a.days;
      const bv = b.days === null ? 9999 : b.days;
      return av - bv;
    });
  }, [pendingBorrows, urgentFranchisees, fittingEvents, pendingSales, onConfirmReturn, onOpenFranchiseeRenewalModal, onNavigateToFitting]);

  return (
    <div className="space-y-8">
      {/* ══ 01 · 会所整体情况 ══ */}
      <section className="panel rise rise-1">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="panel-index panel-index-accent">01 / 会所整体情况</div>
            <h2 className="panel-title mt-1.5">在库资产与人员规模</h2>
          </div>
          <span className="panel-hint">
            全部取自台账实时计算 · 基准核验日 <span className="num">{BUSINESS_DATE}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* 焦点：在库指导货值 —— 全页唯一的大字时刻 */}
          <div className="p-5 lg:p-6 border-b lg:border-b-0 lg:border-r border-border">
            <div className="kicker">在库指导货值</div>
            <div className="mt-3">
              <span className="num text-4xl leading-none text-text">
                ¥{totalValue.toLocaleString('zh-CN')}
              </span>
            </div>
            <p className="meta mt-3">
              在库 <span className="num text-text-2">{totalInStock}</span> 件 · 分属{' '}
              <span className="num text-text-2">{partners.length}</span> 位合伙人独立货权
            </p>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-x-6 gap-y-2.5">
              <div>
                <div className="text-2xs text-text-4">单件均价</div>
                <div className="num mt-1 text-base text-text-2">
                  ¥{avgPrice.toLocaleString('zh-CN')}
                </div>
              </div>
              <div>
                <div className="text-2xs text-text-4">覆盖品牌</div>
                <div className="num mt-1 text-base text-text-2">{brandRows.length} 个</div>
              </div>
            </div>
          </div>

          {/* 次级指标：四格，发丝线分隔，不是四张卡 */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {metrics.map((m, i) => {
              const Icon = m.icon;
              const valueTone =
                m.tone === 'ok'
                  ? 'text-ok'
                  : m.tone === 'danger'
                    ? 'text-danger'
                    : m.tone === 'warn'
                      ? 'text-warn'
                      : 'text-text';
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={m.onClick}
                  className={[
                    'w-full text-left px-5 py-4 flex flex-col gap-1.5 transition-colors duration-150 cursor-pointer hover:bg-accent-faint',
                    'border-b border-border',
                    i % 2 === 0 ? 'sm:border-r' : '',
                    i >= metrics.length - 2 ? 'sm:border-b-0' : '',
                    i === metrics.length - 1 ? 'border-b-0' : '',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <Icon strokeWidth={1.6} className="w-4 h-4 text-text-4 shrink-0" />
                    <span className="text-2xs text-text-3 tracking-wide">{m.label}</span>
                    <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5 text-text-4 ml-auto shrink-0" />
                  </span>
                  <span className="flex items-baseline gap-1">
                    <span
                      className={[
                        'text-xl leading-tight',
                        valueTone,
                        m.isNum ? 'num' : 'font-display',
                      ].join(' ')}
                    >
                      {m.value}
                    </span>
                    {m.unit && <span className="text-2xs text-text-4">{m.unit}</span>}
                  </span>
                  <span className="text-xs text-text-3 truncate">{m.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ 02 · 今日待办：待还货 + 到期房租 ══ */}
      <section className="panel rise rise-2">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="panel-index panel-index-accent">02 / 今日待办</div>
            <h2 className="panel-title mt-1.5">需要你盖印的事</h2>
          </div>
          <span className="panel-hint">
            待还货 <span className="num">{pendingBorrows.length}</span> · 到期房租{' '}
            <span className="num">{urgentFranchisees.length}</span> · 每项均须店长与对方双签
          </span>
        </div>

        {todos.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-text-2 inline-flex items-center gap-2">
              <CheckCircle2 strokeWidth={1.6} className="w-4 h-4 text-ok" />
              当前没有需要盖章的事
            </p>
            <p className="mt-1.5 text-xs text-text-3">借调关系全部闭环，房租均在有效期内</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {todos.map((t) => (
              <li
                key={t.id}
                className="px-4 lg:px-6 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <span className="w-[92px] shrink-0 flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${TODO_DOT[t.tone]}`}
                  />
                  <span className="text-2xs text-text-3 whitespace-nowrap">{t.kind}</span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text">{t.who}</span>
                  <span className="mt-0.5 block text-xs text-text-3 truncate">{t.what}</span>
                </span>

                <span className={`shrink-0 num text-sm ${TODO_TEXT[t.tone]}`}>{t.dueLabel}</span>

                <button
                  type="button"
                  onClick={t.action}
                  className={[
                    'btn btn-sm shrink-0 ml-auto sm:ml-0',
                    t.tone === 'danger' ? 'btn-danger' : '',
                  ].join(' ')}
                >
                  <CalendarClock strokeWidth={1.6} className="w-3.5 h-3.5" />
                  {t.actionLabel}
                </button>
              </li>
            ))}
          </ul>
        )}

        {(onClickBorrowCard || onNavigateToFranchisee) && (
          <div className="px-4 lg:px-6 py-3 border-t border-border flex flex-wrap items-center gap-x-5 gap-y-2">
            {onClickBorrowCard && (
              <button
                type="button"
                onClick={onClickBorrowCard}
                className="btn btn-quiet btn-sm"
              >
                进入跨人借调流转
                <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5" />
              </button>
            )}
            {onNavigateToFranchisee && (
              <button
                type="button"
                onClick={onNavigateToFranchisee}
                className="btn btn-quiet btn-sm"
              >
                进入加盟商与房租
                <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* ══ 03 · 最近动态 · 进出货记录（真实流水） ══ */}
      <div className="rise rise-3">
        <LatestActivityFeed
          items={items}
          salesOrders={salesOrders}
          auditReports={auditReports}
          franchisees={franchisees}
          fittingEvents={fittingEvents}
          onNavigateToAudit={onNavigateToAudit}
          onNavigateToBorrow={onClickBorrowCard}
          onNavigateToFitting={onNavigateToFitting}
          sectionIndex="03"
        />
      </div>

      {/* ══ 04 · 合伙人货权归属：名册式（店长置顶 + 其余紧凑网格） ══ */}
      <section className="panel">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="panel-index panel-index-accent">04 / 合伙人</div>
            <h2 className="panel-title mt-1.5">货权归属与在库资产</h2>
          </div>
          <span className="panel-hint">
            <span className="num">{partners.length}</span> 位合伙人 · 点击查看名下在库货品
            {onNavigateToPartners && (
              <button
                type="button"
                onClick={onNavigateToPartners}
                className="ml-3 text-accent hover:text-accent-strong transition-colors duration-150 cursor-pointer"
              >
                查看完整名册
              </button>
            )}
          </span>
        </div>

        <div className="panel-body space-y-5">
          {/* 店长：置顶且唯一带靛色印记的主体 */}
          {managerRow && (
            <button
              type="button"
              onClick={() =>
                onSelectPartnerFilter(
                  selectedPartnerFilter === managerRow.partner.id ? '' : managerRow.partner.id
                )
              }
              aria-pressed={selectedPartnerFilter === managerRow.partner.id}
              className={[
                'w-full text-left flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 transition-colors duration-150 cursor-pointer',
                'border-l-2',
                selectedPartnerFilter === managerRow.partner.id
                  ? 'bg-accent-faint border-accent'
                  : 'bg-surface-2 border-accent hover:bg-surface-3',
              ].join(' ')}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="w-7 h-7 grid place-items-center border border-accent-line bg-accent-soft shrink-0"
                >
                  <span className="font-display text-sm leading-none text-accent-strong">
                    {managerRow.partner.name.charAt(0)}
                  </span>
                </span>
                <span>
                  <span className="block text-sm text-text">{managerRow.partner.name}</span>
                  <span className="block text-2xs text-accent-strong">店长 / 首席风控官</span>
                </span>
              </span>
              <span className="flex-1" />
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xs text-text-4">在库</span>
                <span className="num text-base text-text">{managerRow.count}</span>
                <span className="text-2xs text-text-4">件</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xs text-text-4">货值</span>
                <span className="num text-base text-text">
                  ¥{managerRow.value.toLocaleString('zh-CN')}
                </span>
              </span>
            </button>
          )}

          {/* 其余合伙人：紧凑名册网格，行底线分隔；借调标记仅在存在时渲染 */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6">
            {memberRows.map((r) => {
              const active = selectedPartnerFilter === r.partner.id;
              return (
                <li key={r.partner.id} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => onSelectPartnerFilter(active ? '' : r.partner.id)}
                    aria-pressed={active}
                    className={[
                      'w-full text-left px-2 py-3 flex items-center gap-3 transition-colors duration-150 cursor-pointer',
                      active ? 'bg-accent-faint' : 'hover:bg-accent-faint',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden="true"
                      className={[
                        'w-6 h-6 grid place-items-center border shrink-0 text-xs font-display',
                        active
                          ? 'border-accent-line text-accent-strong bg-accent-soft'
                          : 'border-border-2 text-text-4 bg-surface-2',
                      ].join(' ')}
                    >
                      {r.partner.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm text-text truncate">{r.partner.name}</span>
                        {r.borrowPending > 0 && (
                          <span className="tag tag-warn">
                            借入待还 <span className="num">{r.borrowPending}</span>
                          </span>
                        )}
                        {r.lentOut > 0 && (
                          <span className="tag">
                            被借出 <span className="num">{r.lentOut}</span>
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-baseline gap-3">
                        <span className="num text-xs text-text-2">
                          {r.count}
                          <span className="text-2xs text-text-4 ml-0.5">件</span>
                        </span>
                        <span className="num text-xs text-text-2">
                          ¥{r.value.toLocaleString('zh-CN')}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ══ 05 · 品牌库存构成 ══ */}
      <section className="panel">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="panel-index panel-index-accent">05 / 库存构成</div>
            <h2 className="panel-title mt-1.5">品牌分布</h2>
          </div>
          <span className="panel-hint">
            点击任意品牌筛选下方台账
            {selectedBrandFilter && (
              <button
                type="button"
                onClick={() => onSelectBrandFilter('')}
                className="ml-3 text-accent hover:text-accent-strong transition-colors duration-150 cursor-pointer"
              >
                清除筛选
              </button>
            )}
          </span>
        </div>
        <div className="panel-body">
          <ul className="space-y-1">
            {brandRows.map((r) => {
              const ramp = BRAND_RAMP[r.brand] || {
                bar: 'var(--color-border-2)',
                label: 'text-text-2',
              };
              const active = selectedBrandFilter === r.brand;
              return (
                <li key={r.brand}>
                  <button
                    type="button"
                    onClick={() => onSelectBrandFilter(active ? '' : r.brand)}
                    aria-pressed={active}
                    className={[
                      'w-full text-left grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[92px_minmax(0,1fr)_72px_104px_52px] items-center gap-x-4 gap-y-1.5 px-2 py-2 rounded-xs transition-colors duration-150 cursor-pointer',
                      active ? 'bg-accent-faint' : 'hover:bg-accent-faint',
                    ].join(' ')}
                  >
                    <span className={`text-sm ${active ? 'text-accent-strong' : 'text-text'}`}>
                      {r.brand}
                    </span>
                    {/* 条形：以最大值为 100% 基准，长度表达货值份额 */}
                    <span className="hidden sm:block h-2 bg-surface-2 relative" aria-hidden="true">
                      <span
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${Math.max((r.value / maxBrandValue) * 100, 1.5)}%`,
                          background: ramp.bar,
                        }}
                      />
                    </span>
                    <span className="num text-sm text-text-2 sm:text-right">
                      {r.count}
                      <span className="text-2xs text-text-4 ml-0.5">件</span>
                    </span>
                    <span className="num text-sm text-text sm:text-right">
                      ¥{r.value.toLocaleString('zh-CN')}
                    </span>
                    <span className="num text-xs text-text-4 sm:text-right">
                      {r.pct.toFixed(0)}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
};
