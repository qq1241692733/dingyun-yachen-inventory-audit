import React, { useMemo, useState } from 'react';
import { InventoryItem, SaleOrder, AuditReport, Franchisee, FittingEvent } from '../types/inventory';
import {
  buildActivityFeed,
  countByKind,
  formatWhen,
  ActivityEntry,
  ActivityKind,
  ActivityTone,
} from '../utils/activityFeed';
import {
  ArrowRight,
  FileCheck,
  X,
  CheckCircle2,
  Clock,
  User,
  Tag,
  Hash,
  PackagePlus,
  ReceiptText,
  ArrowRightLeft,
  ClipboardCheck,
  Layers,
  Shirt,
  Undo2,
  BadgeCheck,
} from 'lucide-react';

const TONE_DOT: Record<ActivityTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-text-4',
};
const TONE_TEXT: Record<ActivityTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-text-3',
};
const KIND_ICON: Record<ActivityKind, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  INBOUND: PackagePlus,
  OUTBOUND: ReceiptText,
  BORROW: ArrowRightLeft,
  RETURN: ArrowRightLeft,
  AUDIT: ClipboardCheck,
  RENEWAL: Layers,
  FITTING_TAKE: Shirt,
  FITTING_RETURN: Undo2,
  FITTING_PURCHASED: BadgeCheck,
};

const TABS: { key: ActivityKind | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '全部' },
  { key: 'INBOUND', label: '入库' },
  { key: 'OUTBOUND', label: '出库' },
  { key: 'BORROW', label: '借调' },
  { key: 'FITTING_TAKE', label: '试衣' },
  { key: 'AUDIT', label: '审计' },
];

interface LatestActivityFeedProps {
  items: InventoryItem[];
  salesOrders: SaleOrder[];
  auditReports: AuditReport[];
  franchisees: Franchisee[];
  /** 试衣事件：借出 / 归还 / 成交，均不影响库存，但要出现在流水里 */
  fittingEvents?: FittingEvent[];
  onNavigateToAudit?: () => void;
  onNavigateToBorrow?: () => void;
  onNavigateToFitting?: () => void;
  /** 首屏先显示多少条，其余折叠（避免把下方"合伙人货权"挤出第二屏） */
  initialVisible?: number;
  /** 区块序号（静室用序号替代装饰线做路径指引） */
  sectionIndex?: string;
}

/* Hallmark · component: activity-ledger (N4 流水账) · genre: editorial · theme: Quiet Room
 * 结构角色：把「进出货记录」与「最近动态」合并成一条真实流水账。
 * V2 的同一位置是 5 条硬编码假数据；V3 改为从 items / salesOrders /
 * auditReports / franchisees 派生，并支持分类切换（全部 · 入库 · 出库 · 借调 · 审计）。
 * 行结构：分类点 → 一行说清"谁+做了什么" → 货值 → 时间与状态。
 * states: default · hover · focus-visible · active(tab) · disabled(不适用) · loading(不适用) · error(不适用) · success(不适用)
 */
export const LatestActivityFeed: React.FC<LatestActivityFeedProps> = ({
  items,
  salesOrders,
  auditReports,
  franchisees,
  fittingEvents = [],
  onNavigateToAudit,
  onNavigateToBorrow,
  onNavigateToFitting,
  initialVisible = 6,
  sectionIndex = '03',
}) => {
  const [tab, setTab] = useState<ActivityKind | 'ALL'>('ALL');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<ActivityEntry | null>(null);

  const feed = useMemo(
    () => buildActivityFeed({ items, salesOrders, auditReports, franchisees, fittingEvents }),
    [items, salesOrders, auditReports, franchisees, fittingEvents]
  );
  const counts = useMemo(() => countByKind(feed), [feed]);

  const filtered = useMemo(
    () =>
      tab === 'ALL'
        ? feed
        : tab === 'FITTING_TAKE'
          ? // 「试衣」页签把借出/归还/成交三类合成一条线看，符合店长的实际关注点
            feed.filter((e) => e.kind === 'FITTING_TAKE' || e.kind === 'FITTING_RETURN' || e.kind === 'FITTING_PURCHASED')
          : feed.filter((e) => e.kind === tab),
    [feed, tab]
  );
  const tabCount = (key: ActivityKind | 'ALL') =>
    key === 'ALL'
      ? feed.length
      : key === 'FITTING_TAKE'
        ? counts.FITTING_TAKE + counts.FITTING_RETURN + counts.FITTING_PURCHASED
        : counts[key];
  const visible = showAll ? filtered : filtered.slice(0, initialVisible);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="panel-index panel-index-accent">{sectionIndex} / 最近动态 · 进出货记录</div>
            <h2 className="panel-title mt-1.5">刚刚发生了什么</h2>
          </div>
          <span className="panel-hint">
            共 <span className="num">{feed.length}</span> 条真实流水 · 点击任意一条查看双签凭证
            {onNavigateToFitting && (
              <button
                type="button"
                onClick={onNavigateToFitting}
                className="ml-3 text-accent hover:text-accent-strong transition-colors duration-150 cursor-pointer inline-flex items-center gap-1"
              >
                试衣间
                <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5" />
              </button>
            )}
            {onNavigateToAudit && (
              <button
                type="button"
                onClick={onNavigateToAudit}
                className="ml-3 text-accent hover:text-accent-strong transition-colors duration-150 cursor-pointer inline-flex items-center gap-1"
              >
                完整审计流水
                <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        </div>

        {/* 分类切换：全部 / 入库 / 出库 / 借调 / 审计 */}
        <div className="px-4 lg:px-6 border-b border-border flex flex-wrap items-center gap-x-5 gap-y-1">
          {TABS.map((t) => {
            const n = tabCount(t.key);
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setShowAll(false);
                }}
                aria-pressed={active}
                className={[
                  'py-2.5 text-xs border-b-2 -mb-px transition-colors duration-150 cursor-pointer',
                  active
                    ? 'border-accent text-accent-strong font-medium'
                    : 'border-transparent text-text-3 hover:text-text hover:border-border-2',
                ].join(' ')}
              >
                {t.label}
                <span className="num ml-1.5 text-2xs text-text-4">{n}</span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 lg:px-6 py-10 text-center">
            <p className="text-sm text-text-3">该分类下暂无流水记录</p>
            <p className="mt-1 text-xs text-text-4">办理一次入库 / 出库 / 审计后，记录会自动出现在这里</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((e) => {
              const Icon = KIND_ICON[e.kind];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="w-full text-left px-4 lg:px-6 py-3.5 flex flex-wrap items-start gap-x-4 gap-y-2 hover:bg-accent-faint transition-colors duration-150 cursor-pointer group"
                  >
                    {/* 分类 */}
                    <span className="w-[92px] shrink-0 flex items-center gap-1.5 pt-0.5">
                      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[e.tone]}`} />
                      <Icon strokeWidth={1.6} className="w-3.5 h-3.5 text-text-4 shrink-0" />
                      <span className="text-2xs text-text-3 whitespace-nowrap">{e.kindLabel}</span>
                    </span>

                    {/* 一行说清发生了什么 */}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-text group-hover:text-accent-strong transition-colors">
                          {e.title}
                        </span>
                        {e.dualSigned && <span className="tag tag-ok">双签</span>}
                      </span>
                      <span className="mt-1 block text-xs text-text-3 truncate">{e.detail}</span>
                    </span>

                    {/* 货值 */}
                    <span className="shrink-0 w-[104px] text-right pt-0.5">
                      {typeof e.amount === 'number' && e.amount > 0 ? (
                        <span className="num block text-sm text-text-2">
                          ¥{Math.round(e.amount).toLocaleString('zh-CN')}
                        </span>
                      ) : (
                        <span className="text-2xs text-text-4">—</span>
                      )}
                    </span>

                    {/* 时间与状态 */}
                    <span className="shrink-0 w-[132px] text-right pt-0.5">
                      <span className="num block text-xs text-text-3">{formatWhen(e.date, e.time)}</span>
                      <span
                        className={`block mt-0.5 text-2xs truncate ${TONE_TEXT[e.tone]}`}
                        title={e.statusText}
                      >
                        {e.statusText}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > initialVisible && (
          <div className="px-4 lg:px-6 py-3 border-t border-border">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="btn btn-quiet btn-sm w-full sm:w-auto"
            >
              {showAll ? '收起' : `展开全部 ${filtered.length} 条`}
            </button>
          </div>
        )}
      </section>

      {/* ── 业务凭据与审计存证（双签） ── */}
      {selected && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
          <div className="modal-card w-full max-w-lg">
            <div className="modal-head">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 shrink-0 grid place-items-center bg-accent-soft border border-accent-line text-accent-strong">
                  <FileCheck strokeWidth={1.6} className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-base text-text">业务凭据与审计存证</h4>
                  <p className="text-xs text-text-3 num">
                    {selected.kindLabel} · {formatWhen(selected.date, selected.time)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="关闭"
                className="btn btn-quiet btn-sm shrink-0"
              >
                <X strokeWidth={1.75} className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="p-3.5 bg-surface-2 border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="panel-index">动态内容</span>
                  <span className={`text-2xs ${TONE_TEXT[selected.tone]}`}>{selected.statusText}</span>
                </div>
                <div className="mt-1.5 text-base text-text">{selected.title}</div>
                <div className="mt-1 text-xs text-text-3">{selected.detail}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-surface-2 border border-border">
                  <div className="text-xs text-text-3 flex items-center gap-1.5">
                    <User strokeWidth={1.6} className="w-3.5 h-3.5" />
                    经办店长
                  </div>
                  <div className="mt-1 text-sm text-text">{selected.operator}</div>
                </div>

                <div className="p-3 bg-surface-2 border border-border">
                  <div className="text-xs text-text-3 flex items-center gap-1.5">
                    <Tag strokeWidth={1.6} className="w-3.5 h-3.5" />
                    涉及人员 / 货主
                  </div>
                  <div className="mt-1 text-sm text-text">
                    {selected.participants.filter((p) => p !== selected.operator).join(' · ') || '—'}
                  </div>
                </div>

                <div className="p-3 bg-surface-2 border border-border">
                  <div className="text-xs text-text-3 flex items-center gap-1.5">
                    <Hash strokeWidth={1.6} className="w-3.5 h-3.5" />
                    货品
                  </div>
                  <div className="mt-1 text-sm text-text">{selected.itemName || '—'}</div>
                </div>

                <div className="p-3 bg-surface-2 border border-border">
                  <div className="text-xs text-text-3">涉及货值</div>
                  <div className="mt-1 text-sm num text-text">
                    {typeof selected.amount === 'number' && selected.amount > 0
                      ? `¥${Math.round(selected.amount).toLocaleString('zh-CN')}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-surface-2 border border-border flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-text-3">
                  专属条码 / 单据号
                  <span className="num text-text-2 ml-1.5">{selected.barcode || 'SYSTEM-VERIFIED'}</span>
                </span>
                <span className="text-2xs text-text-4 flex items-center gap-1">
                  <Clock strokeWidth={1.6} className="w-3 h-3" />
                  流水号 <span className="num">{selected.id}</span>
                </span>
              </div>

              {selected.notes && (
                <div className="p-3 bg-accent-faint border border-accent-line">
                  <div className="text-xs text-accent-strong mb-0.5">业务见证说明</div>
                  <div className="text-xs text-text-2 leading-normal">{selected.notes}</div>
                </div>
              )}

              {/* 双签存证 */}
              <div className="p-3.5 border border-border space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-text-2 flex items-center gap-1.5">
                    <CheckCircle2 strokeWidth={1.6} className="w-4 h-4 text-ok" />
                    双人手写签字电子存证
                  </span>
                  <span className={selected.dualSigned ? 'tag tag-ok' : 'tag tag-warn'}>
                    {selected.dualSigned ? '已签署入档' : '未完成双签'}
                  </span>
                </div>

                {selected.dualSigned ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border border-border p-2.5 bg-surface-2 text-center">
                      <div className="text-xs text-text-3 mb-1.5">店长签名</div>
                      <div className="h-11 grid place-items-center bg-surface border border-border font-display text-base italic text-text">
                        {selected.operator?.split(' ')[0] || '付蓉'}
                      </div>
                    </div>
                    <div className="border border-border p-2.5 bg-surface-2 text-center">
                      <div className="text-xs text-text-3 mb-1.5">合伙人 / 经办人签名</div>
                      <div className="h-11 grid place-items-center bg-surface border border-border font-display text-base italic text-text">
                        {selected.participants.filter((p) => p !== selected.operator).join(' · ') ||
                          selected.operator}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-3">
                    本条流水为系统自动登记的入库记录，不涉及双人签字；其后的每一次出库与审计均强制双签。
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {selected.kind === 'BORROW' && selected.tone === 'warn' && onNavigateToBorrow ? (
                  <button
                    type="button"
                    className="btn btn-seal btn-sm"
                    onClick={() => {
                      setSelected(null);
                      onNavigateToBorrow();
                    }}
                  >
                    去办理还货冲销
                  </button>
                ) : onNavigateToAudit ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => {
                      setSelected(null);
                      onNavigateToAudit();
                    }}
                  >
                    在审计动态中定位
                  </button>
                ) : null}
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
