import React from 'react';
import {
  Layers,
  ReceiptText,
  ArrowRightLeft,
  ClipboardCheck,
  Users,
  Building2,
  Table2,
  Shirt,
} from 'lucide-react';

export type NavKey =
  | 'OVERVIEW'
  | 'FITTING'
  | 'SALES'
  | 'BORROW'
  | 'AUDIT'
  | 'PARTNERS'
  | 'FRANCHISEES'
  | 'SPREADSHEET';

interface NavItem {
  key: NavKey;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  count?: number;
  tone?: 'warn' | 'danger';
  tag?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface SideNavProps {
  activeNav: NavKey;
  onNavigate: (key: NavKey) => void;
  salesCount: number;
  pendingBorrowCount: number;
  auditCount: number;
  monthlyAuditDue: boolean;
  partnerCount: number;
  franchiseeCount: number;
  urgentFranchiseeCount: number;
  auditPeriod: string;
  /** 正在试衣、尚未归还也未成交的件数 */
  fittingCount?: number;
  /** 手机端登记成交、等待双签的销售单数 */
  pendingSaleCount?: number;
}

/* Hallmark · component: side-rail (N3) · genre: editorial · theme: Quiet Room
 * 结构角色：V3「静室」的左侧导航 —— 浅色纸面 + 一条竖向发丝线。
 * V2 的深色磁青书脊换成纸白：左侧导航更舒适，同时把"深色"这个强元素整块让出去，
 * 于是右侧内容第一次成了主角。
 * 信息完整度不降：分组 / 说明 / 计数 / 待办标记全部保留。
 * states: default · hover · focus-visible · active · disabled(不适用) · loading(不适用) · error(不适用) · success(不适用)
 */
export const SideNav: React.FC<SideNavProps> = ({
  activeNav,
  onNavigate,
  salesCount,
  pendingBorrowCount,
  auditCount,
  monthlyAuditDue,
  partnerCount,
  franchiseeCount,
  urgentFranchiseeCount,
  auditPeriod,
  fittingCount = 0,
  pendingSaleCount = 0,
}) => {
  const groups: NavGroup[] = [
    {
      label: '总账',
      items: [
        { key: 'OVERVIEW', label: '门店综合概览', hint: '货权 · 货值 · 流转', icon: Layers },
        {
          key: 'SALES',
          label: '销售出库账单',
          hint: '双签票据存证',
          icon: ReceiptText,
          count: salesCount,
        },
      ],
    },
    {
      label: '流转与风控',
      items: [
        {
          key: 'FITTING',
          label: '试衣间',
          hint: '客户试穿 · 轻登记免签',
          icon: Shirt,
          count: fittingCount,
          tag: pendingSaleCount > 0 ? `${pendingSaleCount} 张待签` : undefined,
          tone: pendingSaleCount > 0 ? 'warn' : undefined,
        },
        {
          key: 'BORROW',
          label: '跨人借调流转',
          hint: '待还追踪与冲销',
          icon: ArrowRightLeft,
          count: pendingBorrowCount,
          tone: 'warn',
        },
        {
          key: 'AUDIT',
          label: '审计中心',
          hint: '日报 · 周报 · 月度全盘',
          icon: ClipboardCheck,
          count: auditCount,
          tag: monthlyAuditDue ? '待强制' : undefined,
          tone: monthlyAuditDue ? 'danger' : undefined,
        },
      ],
    },
    {
      label: '档案',
      items: [
        { key: 'PARTNERS', label: '合伙人名册', hint: '货权归属与资产', icon: Users, count: partnerCount },
        {
          key: 'FRANCHISEES',
          label: '加盟商与房租',
          hint: '年度续费与到期预警',
          icon: Building2,
          count: franchiseeCount,
          tag: urgentFranchiseeCount > 0 ? `${urgentFranchiseeCount} 家待续` : undefined,
          tone: urgentFranchiseeCount > 0 ? 'danger' : undefined,
        },
      ],
    },
    {
      label: '工具',
      items: [
        { key: 'SPREADSHEET', label: '原始电子表格', hint: '长辈模式 · 双向同步', icon: Table2 },
      ],
    },
  ];

  return (
    <nav
      aria-label="主导航"
      className="no-print nav-surface hidden lg:flex w-[236px] shrink-0 flex-col"
    >
      {/* ── 品牌区：靛色印章 + 全称。深色只剩这一个 40px 方块 ── */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="w-10 h-10 shrink-0 grid place-items-center border border-accent bg-accent-soft"
          >
            <span className="font-display text-lg leading-none text-accent-strong">鼎</span>
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="font-display text-base leading-tight text-text">鼎运雅辰</div>
            <div className="mt-0.5 text-2xs leading-tight text-text-4">品质体验中心</div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-2xs tracking-wider text-text-4 uppercase">运营与合伙人</div>
          <div className="text-2xs tracking-wider text-text-4 uppercase">库存审计系统</div>
        </div>
      </div>

      {/* ── 导航分册 ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="nav-group-label px-2 mb-2 uppercase">{g.label}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const active = activeNav === it.key;
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => onNavigate(it.key)}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'w-full text-left px-2.5 py-2 flex items-start gap-2.5 transition-colors duration-150 cursor-pointer',
                        'border-l-2',
                        active
                          ? 'bg-accent-faint border-accent'
                          : 'border-transparent hover:bg-nav-2 hover:border-border-2',
                      ].join(' ')}
                    >
                      <Icon
                        strokeWidth={1.6}
                        className={[
                          'w-4 h-4 mt-0.5 shrink-0',
                          active ? 'text-accent' : 'text-text-4',
                        ].join(' ')}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={[
                              'text-sm leading-snug',
                              active ? 'text-accent-strong font-medium' : 'text-text-2',
                            ].join(' ')}
                          >
                            {it.label}
                          </span>
                          {typeof it.count === 'number' && (
                            <span className="num text-2xs text-text-4 ml-auto">{it.count}</span>
                          )}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className="text-2xs leading-snug text-text-4">{it.hint}</span>
                          {it.tag && (
                            <span
                              className={[
                                'text-2xs px-1 border leading-none py-[1px]',
                                it.tone === 'danger'
                                  ? 'text-danger border-danger/30 bg-danger-soft'
                                  : it.tone === 'warn'
                                    ? 'text-warn border-warn/30 bg-warn-soft'
                                    : 'text-text-3 border-border-2',
                              ].join(' ')}
                            >
                              {it.tag}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* ── 侧栏底部：账期与风控签署人 ── */}
      <div className="px-5 py-4 border-t border-border">
        <div className="text-2xs tracking-wider text-text-4">账期</div>
        <div className="num mt-0.5 text-sm text-text-2">{auditPeriod}</div>
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-2xs tracking-wider text-text-4">风控签署人</div>
          <div className="mt-0.5 text-sm text-text-2">付蓉</div>
          <div className="text-2xs text-text-4">店长 / 首席风控官</div>
        </div>
      </div>
    </nav>
  );
};
