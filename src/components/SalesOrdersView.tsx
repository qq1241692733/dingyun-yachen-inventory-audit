import React, { useMemo, useState } from 'react';
import { SaleOrder } from '../types/inventory';
import {
  FileText,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  RefreshCw,
  Eye,
  X,
  UserRound,
  CornerDownRight,
} from 'lucide-react';

interface SalesOrdersViewProps {
  salesOrders: SaleOrder[];
  onOpenReturnModal: (order: SaleOrder) => void;
}

type Filter = 'ALL' | 'BORROWED_PENDING' | 'OWN_SALE';

/* Hallmark · macrostructure: Workbench（工作台 · 票据流）· theme: Bound Ledger
 * 结构指纹：胶片筛选 → 册首汇总条 → 通栏「票根 + 票面」两列票据流（非卡片网格）。
 * 与上一版的差别：上一版是 3 栏卡片网格里放 2 张卡，右侧 1/3 永久空转；本版票据通栏排布，无空转。
 * 票根左列以朱砂虚线分界，呼应「可撕存根」。
 * 移动端：票根列在 <640px 折叠到票面之上，通栏零横向溢出。
 */
export const SalesOrdersView: React.FC<SalesOrdersViewProps> = ({
  salesOrders,
  onOpenReturnModal,
}) => {
  const [activeTab, setActiveTab] = useState<Filter>('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<SaleOrder | null>(null);

  const pendingCount = useMemo(
    () => salesOrders.filter((o) => o.isCrossPartnerBorrow && o.returnStatus === 'PENDING').length,
    [salesOrders]
  );
  const ownCount = useMemo(
    () => salesOrders.filter((o) => !o.isCrossPartnerBorrow).length,
    [salesOrders]
  );

  const filtered = useMemo(() => {
    if (activeTab === 'BORROWED_PENDING')
      return salesOrders.filter((o) => o.isCrossPartnerBorrow && o.returnStatus === 'PENDING');
    if (activeTab === 'OWN_SALE') return salesOrders.filter((o) => !o.isCrossPartnerBorrow);
    return salesOrders;
  }, [salesOrders, activeTab]);

  const filteredTotal = filtered.reduce((a, o) => a + o.dealPrice, 0);

  const tabs: { key: Filter; label: string; count: number; warn?: boolean }[] = [
    { key: 'ALL', label: '全部销售账单', count: salesOrders.length },
    { key: 'BORROWED_PENDING', label: '跨人借调 · 待还货', count: pendingCount, warn: true },
    { key: 'OWN_SALE', label: '自有货源售出', count: ownCount },
  ];

  return (
    <div className="space-y-6">
      {/* ══ 1 · 筛选胶片 + 册首摘要 ══ */}
      <section className="panel">
        <div className="panel-body flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div
            role="tablist"
            aria-label="账单筛选"
            className="flex flex-wrap items-center border border-border-2 rounded-xs overflow-hidden"
          >
            {tabs.map((t, i) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={[
                    'h-9 px-3.5 inline-flex items-center gap-2 text-xs transition-colors duration-150 cursor-pointer',
                    i > 0 ? 'border-l border-border-2' : '',
                    active
                      ? t.warn
                        ? 'bg-accent text-on-accent'
                        : 'bg-spine text-on-spine'
                      : t.warn
                        ? 'bg-accent-soft text-accent-strong hover:brightness-[0.98]'
                        : 'bg-surface text-text-2 hover:bg-surface-2',
                  ].join(' ')}
                >
                  {t.warn && <Clock strokeWidth={1.75} className="w-3.5 h-3.5" />}
                  {t.label}
                  <span className="num text-2xs opacity-75">{t.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-3">本册单据</span>
              <span className="num-ledger text-base text-text">{filtered.length}</span>
              <span className="text-2xs text-text-3">笔</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-3">成交总额</span>
              <span className="num-ledger text-base text-text">
                ¥{filteredTotal.toLocaleString('zh-CN')}
              </span>
            </span>
            <span className="tag">
              <CheckCircle2 strokeWidth={1.75} className="w-3 h-3" />
              均具店长 + 销售者双签
            </span>
          </div>
        </div>
      </section>

      {/* ══ 2 · 票据流：通栏「票根 + 票面」 ══ */}
      {filtered.length === 0 ? (
        <section className="panel">
          <div className="py-14 text-center">
            <FileText strokeWidth={1.4} className="w-7 h-7 mx-auto text-text-4" />
            <p className="mt-3 text-sm text-text-3">暂无符合条件的销售记录</p>
          </div>
        </section>
      ) : (
        <ul className="space-y-3">
          {filtered.map((order, idx) => {
            const isPendingBorrow =
              order.isCrossPartnerBorrow && order.returnStatus === 'PENDING';
            const isResolvedBorrow =
              order.isCrossPartnerBorrow && order.returnStatus === 'RESOLVED';

            return (
              <li
                key={order.id}
                className={[
                  'panel',
                  idx < 5 ? `rise rise-${Math.min(idx + 1, 6)}` : '',
                  'grid grid-cols-1 sm:grid-cols-[132px_minmax(0,1fr)]',
                ].join(' ')}
              >
                {/* ── 票根：单号 / 日期 / 品类，朱砂虚线右侧分界 ── */}
                <div
                  className={[
                    'px-4 py-3.5 sm:py-4 flex sm:flex-col gap-x-4 gap-y-1.5 flex-wrap items-baseline',
                    'border-b sm:border-b-0 sm:border-r border-dashed',
                    isPendingBorrow ? 'border-accent-line bg-accent-faint' : 'border-border-2 bg-surface-2',
                  ].join(' ')}
                >
                  <span className="num text-xs text-text-2 w-full">{order.id}</span>
                  <span className="num text-2xs text-text-3 w-full">{order.saleDate}</span>
                  <span className="sm:mt-auto sm:pt-2">
                    {order.isCrossPartnerBorrow ? (
                      isPendingBorrow ? (
                        <span className="tag tag-seal">
                          <Clock strokeWidth={1.75} className="w-3 h-3" />
                          借调待还
                        </span>
                      ) : (
                        <span className="tag tag-ok">
                          <CheckCircle2 strokeWidth={1.75} className="w-3 h-3" />
                          已冲销
                        </span>
                      )
                    ) : (
                      <span className="tag">自有库存</span>
                    )}
                  </span>
                </div>

                {/* ── 票面 ── */}
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                    <div className="min-w-0">
                      <div className="text-base text-text wrap-anywhere">
                        <span className="text-text-3 text-sm">{order.brand} · </span>
                        {order.productName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-3">
                        <span>颜色 {order.color || '经典装'}</span>
                        <span className="w-px h-3 bg-border-2" aria-hidden="true" />
                        <span>
                          尺码 <span className="num text-text-2">{order.size}</span>
                        </span>
                        <span className="w-px h-3 bg-border-2" aria-hidden="true" />
                        <span className="num">条码 {order.barcode}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="num-ledger text-xl leading-none text-text">
                        ¥{order.dealPrice.toLocaleString('zh-CN')}
                      </div>
                      <div className="num text-2xs text-text-3 mt-1">
                        标价 ¥{order.price.toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>

                  {/* 货权流转：谁的货 → 谁卖的 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="text-2xs text-text-3">货主</span>
                      <span className="text-text-2">{order.ownerPartnerName}</span>
                    </span>
                    <CornerDownRight
                      strokeWidth={1.6}
                      className="w-3.5 h-3.5 text-text-4"
                      aria-hidden="true"
                    />
                    <span className="flex items-center gap-1.5">
                      <span className="text-2xs text-text-3">销售人</span>
                      <span className={isPendingBorrow ? 'text-accent-strong' : 'text-text'}>
                        {order.sellerPartnerName}
                      </span>
                    </span>
                    {order.isCrossPartnerBorrow && (
                      <span className="tag tag-warn">
                        <ArrowRightLeft strokeWidth={1.75} className="w-3 h-3" />
                        约定还货 {order.expectedReturnDate || '未约定'}
                      </span>
                    )}
                    {isResolvedBorrow && order.actualReturnDate && (
                      <span className="text-2xs text-ok">
                        已于 {order.actualReturnDate} 冲销
                      </span>
                    )}
                  </div>

                  {order.remarks && (
                    <p className="text-xs text-text-3 leading-relaxed border-l-2 border-border-2 pl-2.5">
                      {order.remarks}
                    </p>
                  )}

                  {/* 双签存根 + 动作 */}
                  <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="flex items-center gap-2">
                        <span className="text-2xs text-text-3">店长签</span>
                        {order.managerSignature ? (
                          <img
                            src={order.managerSignature}
                            alt="店长签名"
                            className="h-7 max-w-[76px] object-contain border border-border-2 bg-surface px-1"
                          />
                        ) : (
                          <span className="tag tag-danger">未签</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-2xs text-text-3">销售签</span>
                        {order.sellerSignature ? (
                          <img
                            src={order.sellerSignature}
                            alt="销售签名"
                            className="h-7 max-w-[76px] object-contain border border-border-2 bg-surface px-1"
                          />
                        ) : (
                          <span className="tag tag-danger">未签</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPendingBorrow && (
                        <button
                          type="button"
                          className="btn btn-sm btn-seal"
                          onClick={() => onOpenReturnModal(order)}
                        >
                          <RefreshCw strokeWidth={1.75} className="w-3.5 h-3.5" />
                          办理还货冲销
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => setSelectedReceipt(order)}
                      >
                        <Eye strokeWidth={1.6} className="w-3.5 h-3.5" />
                        查看凭证
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ══ 3 · 出库凭据单（票据放大版） ══ */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="出库销售凭据单"
        >
          <div className="modal-card w-full max-w-md">
            <div className="px-5 pt-5 pb-3 border-b-2 border-spine">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-text">门店出库销售凭据单</h3>
                  <span className="num block mt-1 text-xs text-text-3">
                    单号 {selectedReceipt.id}
                  </span>
                </div>
                <span className="num text-xs text-text-3 shrink-0">{selectedReceipt.saleDate}</span>
              </div>
            </div>

            <div className="p-5 space-y-0 overflow-y-auto">
              {(
                [
                  ['出库商品', `${selectedReceipt.brand} · ${selectedReceipt.productName}`],
                  ['尺码与规格', `${selectedReceipt.size}（${selectedReceipt.color || '标准'}）`],
                  ['货品独立条码', selectedReceipt.barcode, true],
                  ['货权所有人（谁的货）', selectedReceipt.ownerPartnerName],
                  ['销售经办人（谁卖的）', selectedReceipt.sellerPartnerName],
                ] as [string, string, boolean?][]
              ).map(([k, v, mono]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-4 py-2 border-b border-border"
                >
                  <span className="text-xs text-text-3 shrink-0">{k}</span>
                  <span className={`text-sm text-text text-right wrap-anywhere ${mono ? 'num' : ''}`}>
                    {v}
                  </span>
                </div>
              ))}

              <div className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-xs text-text-3">成交结算金额</span>
                <span className="num-ledger text-xl text-accent-strong">
                  ¥{selectedReceipt.dealPrice.toLocaleString('zh-CN')}
                </span>
              </div>

              {selectedReceipt.isCrossPartnerBorrow && (
                <div className="mt-1 px-3 py-2.5 border-l-2 border-accent bg-accent-faint">
                  <div className="text-2xs tracking-wide text-accent-strong">跨人借调约定</div>
                  <p className="mt-1 text-xs text-text-2 leading-relaxed">
                    借用「{selectedReceipt.ownerPartnerName}」在库货品，约定于{' '}
                    <span className="num text-text">
                      {selectedReceipt.expectedReturnDate || '未约定'}
                    </span>{' '}
                    前归还同款新货。
                  </p>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-border-2 grid grid-cols-2 gap-3">
                <div className="border border-border-2 bg-surface-2 px-2 py-3 text-center">
                  <span className="block text-2xs text-text-3 mb-2">店长核实签章</span>
                  <img
                    src={selectedReceipt.managerSignature}
                    alt="店长签"
                    className="h-10 mx-auto object-contain"
                  />
                </div>
                <div className="border border-border-2 bg-surface-2 px-2 py-3 text-center">
                  <span className="block text-2xs text-text-3 mb-2">销售者签署确认</span>
                  <img
                    src={selectedReceipt.sellerSignature}
                    alt="销售签"
                    className="h-10 mx-auto object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-border flex justify-end">
              <button type="button" className="btn" onClick={() => setSelectedReceipt(null)}>
                <X strokeWidth={1.75} className="w-3.5 h-3.5" />
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
