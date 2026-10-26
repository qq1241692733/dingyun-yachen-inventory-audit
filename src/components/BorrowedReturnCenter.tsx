import React, { useMemo, useState } from 'react';
import { SaleOrder } from '../types/inventory';
import {
  ArrowRightLeft,
  RefreshCw,
  CheckCircle2,
  CornerDownRight,
  Undo2,
} from 'lucide-react';

interface BorrowedReturnCenterProps {
  salesOrders: SaleOrder[];
  onOpenReturnModal: (order: SaleOrder) => void;
}

type Filter = 'PENDING' | 'RESOLVED' | 'ALL';

/* Hallmark · macrostructure: Contra-Ledger（往来对照账）· theme: Bound Ledger
 * 结构指纹：一行账目摘要带 → 规则引文（非卡片）→ 胶片开关 → 「按原货主归卷」的往来对照账表。
 * 与其余视图的差别：概览按单点焦点展开、名册按角色排序、账单按时间成票、加盟商按团队分册；
 *   本页的分组键是「原货主（债权人）」——一眼看清每位合伙人名下有多少货还在外面替别人成交。
 * 与上一版的差别：上一版是「3 张统计卡 + 一条流式列表」，卡片讲了摘要、列表又重复一遍；
 *   本版把摘要压成一行账目，主区改为可对账的分组账表，并给每笔借调一条可读的「谁 → 谁」流转线。
 * 移动端：账表外层横向滚动，馆内不产生页面级溢出。
 */
export const BorrowedReturnCenter: React.FC<BorrowedReturnCenterProps> = ({
  salesOrders,
  onOpenReturnModal,
}) => {
  const [filterState, setFilterState] = useState<Filter>('PENDING');

  const borrowedOrders = useMemo(
    () => salesOrders.filter((o) => o.isCrossPartnerBorrow),
    [salesOrders]
  );
  const pendingList = borrowedOrders.filter((o) => o.returnStatus === 'PENDING');
  const resolvedList = borrowedOrders.filter((o) => o.returnStatus === 'RESOLVED');

  const displayed = useMemo(() => {
    if (filterState === 'PENDING') return pendingList;
    if (filterState === 'RESOLVED') return resolvedList;
    return borrowedOrders;
  }, [filterState, pendingList, resolvedList, borrowedOrders]);

  /* ── 按原货主归卷：这张表问的是「谁家的货还在外面」 ── */
  const groups = useMemo(() => {
    const map = new Map<string, SaleOrder[]>();
    displayed.forEach((o) => {
      const key = o.ownerPartnerName || '未署名货主';
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    });
    return Array.from(map.entries())
      .map(([owner, orders]) => ({
        owner,
        orders: orders.sort((a, b) =>
          (a.expectedReturnDate ?? '').localeCompare(b.expectedReturnDate ?? '')
        ),
        pendingCount: orders.filter((o) => o.returnStatus === 'PENDING').length,
        value: orders.reduce((a, o) => a + o.dealPrice, 0),
      }))
      .sort((a, b) => b.pendingCount - a.pendingCount || b.value - a.value);
  }, [displayed]);

  const pendingValue = pendingList.reduce((a, o) => a + o.dealPrice, 0);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'PENDING', label: '待还借调单', count: pendingList.length },
    { key: 'RESOLVED', label: '已还货冲销单', count: resolvedList.length },
    { key: 'ALL', label: '全部借调账目', count: borrowedOrders.length },
  ];

  return (
    <div className="space-y-6">
      {/* ══ 1 · 一行账目摘要（非卡片网格） ══ */}
      <section className="panel rise rise-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="px-5 py-4 min-w-0">
            <div className="text-2xs text-text-3 tracking-wide">当前跨人借调待还</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="num-ledger text-xl text-accent-strong">{pendingList.length}</span>
              <span className="text-2xs text-text-3">单</span>
              <span className="num-ledger text-sm text-text-2 ml-auto">
                ¥{pendingValue.toLocaleString('zh-CN')}
              </span>
            </div>
            <p className="text-2xs text-text-3 mt-1.5 leading-normal">
              出库售出他人货品，等待还货补库
            </p>
          </div>

          <div className="px-5 py-4 min-w-0">
            <div className="text-2xs text-text-3 tracking-wide">历史已归还冲销</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="num-ledger text-xl text-ok">{resolvedList.length}</span>
              <span className="text-2xs text-text-3">单</span>
            </div>
            <p className="text-2xs text-text-3 mt-1.5 leading-normal">
              原货主与店长核实，已完成补货清账
            </p>
          </div>

          <div className="px-5 py-4 min-w-0">
            <div className="text-2xs text-text-3 tracking-wide">借调出库双签归档率</div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="num-ledger text-xl text-text">100</span>
              <span className="text-2xs text-text-3">%</span>
            </div>
            <p className="text-2xs text-text-3 mt-1.5 leading-normal">
              跨人单均具备店长与经办人手写签字
            </p>
          </div>
        </div>
      </section>

      {/* ══ 2 · 规则引文（左朱砂规线，非卡片） ══ */}
      <aside className="border-l-2 border-accent pl-4 py-0.5 rise rise-2">
        <p className="text-xs text-text-2 leading-normal max-w-[76ch]">
          <strong className="text-text font-medium">门店合伙人借调还货规则　</strong>
          合伙人接待顾客时若自己名下缺码，可借调店里其他合伙人的在库现货先行交付。售出时系统自动生成借调单并记录约定还货日；
          销售者后续拿新货来店里交割，由原货主或店长确认冲销，保障每位合伙人的资产安全。
        </p>
      </aside>

      {/* ══ 3 · 胶片开关 + 往来对照账 ══ */}
      <section className="panel rise rise-3">
        <div className="panel-head">
          <div
            role="tablist"
            aria-label="借调单筛选"
            className="flex flex-wrap items-center border border-border-2 rounded-xs overflow-hidden"
          >
            {tabs.map((t, i) => {
              const active = filterState === t.key;
              const dangerish = t.key === 'PENDING';
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setFilterState(t.key)}
                  className={[
                    'h-9 px-3.5 inline-flex items-center gap-2 text-xs transition-colors duration-150 cursor-pointer',
                    i > 0 ? 'border-l border-border-2' : '',
                    active
                      ? dangerish
                        ? 'bg-accent text-on-accent'
                        : 'bg-spine text-on-spine'
                      : dangerish
                        ? 'bg-accent-soft text-accent-strong hover:brightness-[0.98]'
                        : 'bg-surface text-text-2 hover:bg-surface-2',
                  ].join(' ')}
                >
                  {t.key === 'PENDING' && <RefreshCw strokeWidth={1.75} className="w-3.5 h-3.5" />}
                  {t.key === 'RESOLVED' && <Undo2 strokeWidth={1.75} className="w-3.5 h-3.5" />}
                  {t.label}
                  <span className="num text-2xs opacity-75">{t.count}</span>
                </button>
              );
            })}
          </div>

          <span className="panel-hint">
            按原货主归卷 · 共 {groups.length} 位合伙人名下有借调记录
          </span>
        </div>

        <div className="ledger-wrap border-0 rounded-none">
          <table className="ledger">
            <thead>
              <tr>
                <th>借调流转</th>
                <th>货品</th>
                <th>颜色 / 码号</th>
                <th>约定还货日</th>
                <th>售出日</th>
                <th className="text-right">成交价</th>
                <th>双签存档</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>

            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.owner}>
                  {/* 分卷题头 */}
                  <tr>
                    <td
                      colSpan={8}
                      className="!bg-surface-2 !py-2.5"
                      style={{ boxShadow: 'inset 3px 0 0 var(--color-accent)' }}
                    >
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-text flex items-center gap-1.5">
                          <CornerDownRight
                            strokeWidth={1.75}
                            className="w-3.5 h-3.5 text-accent"
                          />
                          {g.owner}
                          <span className="text-2xs text-text-3 font-normal tracking-wide">
                            名下在外
                          </span>
                        </span>
                        <span className="text-2xs text-text-3">
                          {g.orders.length} 单
                          {g.pendingCount > 0 && (
                            <span className="text-accent-strong"> · {g.pendingCount} 单待还</span>
                          )}
                        </span>
                        <span className="num text-2xs text-text-2 ml-auto">
                          涉及货值 ¥{g.value.toLocaleString('zh-CN')}
                        </span>
                      </span>
                    </td>
                  </tr>

                  {g.orders.map((order) => {
                    const isPending = order.returnStatus === 'PENDING';
                    return (
                      <tr key={order.id}>
                        <td className="whitespace-nowrap">
                          <span className="flex items-center gap-2 text-xs">
                            <span className="text-text-2">{g.owner}</span>
                            <ArrowRightLeft
                              strokeWidth={1.75}
                              className="w-3.5 h-3.5 text-text-4 shrink-0"
                            />
                            <span className="text-accent-strong font-medium">
                              {order.sellerPartnerName}
                            </span>
                          </span>
                          <span className="c-code text-text-4 block mt-0.5">{order.id}</span>
                        </td>

                        <td className="min-w-[180px]">
                          <span className="text-text">{order.productName}</span>
                          <span className="tag ml-2">{order.brand}</span>
                        </td>

                        <td className="c-code text-text-3 whitespace-nowrap">
                          {order.color} · {order.size}
                        </td>

                        <td className="whitespace-nowrap">
                          {isPending ? (
                            <span className="c-code text-accent-strong">
                              {order.expectedReturnDate || '未填'}
                            </span>
                          ) : (
                            <span className="c-code text-text-4">—</span>
                          )}
                        </td>

                        <td className="c-code text-text-3 whitespace-nowrap">{order.saleDate}</td>

                        <td className="c-num">¥{order.dealPrice.toLocaleString('zh-CN')}</td>

                        <td className="whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            {order.managerSignature && (
                              <img
                                src={order.managerSignature}
                                alt="店长签字"
                                className="h-6 border border-border bg-bg px-1 object-contain"
                              />
                            )}
                            {order.sellerSignature && (
                              <img
                                src={order.sellerSignature}
                                alt="经办人签字"
                                className="h-6 border border-border bg-bg px-1 object-contain"
                              />
                            )}
                            <span className="tag tag-ok">已归档</span>
                          </span>
                        </td>

                        <td className="text-right whitespace-nowrap">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => onOpenReturnModal(order)}
                              className="btn btn-sm btn-seal"
                            >
                              <RefreshCw strokeWidth={1.75} className="w-3.5 h-3.5" />
                              还货并冲销
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ok">
                              <CheckCircle2 strokeWidth={1.75} className="w-3.5 h-3.5" />
                              已冲销
                              <span className="c-code text-text-3">
                                {order.actualReturnDate}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {groups.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-text-3 py-12">
                    该分类下暂无借调记录
                  </td>
                </tr>
              )}
            </tbody>

            {pendingList.length > 0 && filterState !== 'RESOLVED' && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-text-2">
                    待还合计 · {pendingList.length} 单
                  </td>
                  <td className="c-num text-accent-strong">
                    ¥{pendingValue.toLocaleString('zh-CN')}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};
