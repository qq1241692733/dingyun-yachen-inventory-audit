import React, { useSyncExternalStore } from 'react';
import { PackagePlus, PenLine, ClipboardCheck, FileText, RotateCcw, Shirt, Smartphone, HardDriveDownload, LogOut } from 'lucide-react';
import type { NavKey } from './SideNav';
import { ThemeSwitcher } from './ThemeSwitcher';
import { getServerStatus, getServerBase, subscribeServer } from '../utils/apiServer';

/* 每册的「报表抬头」元数据 —— 让七个页面在抬头处就已经不同 */
const VIEW_META: Record<NavKey, { group: string; title: string; note: string }> = {
  OVERVIEW: {
    group: '总账',
    title: '门店综合概览',
    note: '一屏看全货权归属、在库货值与当日流转',
  },
  FITTING: {
    group: '流转与风控',
    title: '试衣间',
    note: '客户试穿只记一笔，不出库也不改库存；成交后才走双签',
  },
  SALES: {
    group: '总账',
    title: '销售出库账单',
    note: '每笔出库均附店长与销售人双人手写签名印鉴',
  },
  BORROW: {
    group: '流转与风控',
    title: '跨人借调流转',
    note: '借出 → 待还 → 补货冲销，借贷关系必须闭环',
  },
  AUDIT: {
    group: '流转与风控',
    title: '审计中心',
    note: '月度全盘强制大检与每日审计动态流水',
  },
  PARTNERS: {
    group: '档案',
    title: '合伙人名册',
    note: '合伙人名下在库资产与借调往来',
  },
  FRANCHISEES: {
    group: '档案',
    title: '加盟商与房租',
    note: '年度会所共享运营金 4,000 元 · 到期双签续约',
  },
  SPREADSHEET: {
    group: '工具',
    title: '原始电子表格',
    note: '长辈模式：直接改单元格，一键同步全系统',
  },
};

/** 后端连接状态：告诉店长「手机端能不能用」这件事 */
const ServerStatusPill: React.FC = () => {
  const status = useSyncExternalStore(subscribeServer, getServerStatus, getServerStatus);
  const base = useSyncExternalStore(subscribeServer, getServerBase, getServerBase);

  if (status === 'probing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs text-text-4">
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-text-4 animate-pulse" />
        正在连接服务…
      </span>
    );
  }
  if (status === 'offline') {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-2xs text-text-4"
        title="未找到后端服务，已退回浏览器本地存储模式：页面功能正常，但手机端 AI 助手登记的数据进不来。启动方式：npm run server"
      >
        <HardDriveDownload strokeWidth={1.8} className="w-3 h-3" />
        本机模式
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-2xs text-text-2"
      title={`已连接后端 ${base || '（同源）'} · 手机端 AI 助手的登记会实时同步到这里`}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />
      <Smartphone strokeWidth={1.8} className="w-3 h-3" />
      <span className="hidden sm:inline">手机端已连接</span>
    </span>
  );
};

interface HeaderProps {
  activeNav: NavKey;
  isMonthlyMandatoryDone: boolean;
  auditPeriod: string;
  totalInStock: number;
  totalValue: number;
  operatorName: string;
  onOpenInbound: () => void;
  onOpenSale: () => void;
  onOpenAudit: () => void;
  onResetDemoData: () => void;
  onOpenPrdDoc: () => void;
  /** V4：退出登录（账册安全门） */
  onLogout?: () => void;
  /** V3：待办计数直接挂在操作按钮上，让"最常用的操作"一眼知道有没有事 */
  pendingBorrowCount?: number;
  urgentFranchiseeCount?: number;
  /** V3.2：试衣轻登记 —— 手机端最高频的动作，必须放在全局操作区 */
  onOpenFittingTake?: () => void;
  onGoFitting?: () => void;
  fittingCount?: number;
  pendingSaleCount?: number;
}

/* Hallmark · component: page-masthead (N6 报表抬头) · genre: editorial · theme: Quiet Room
 * 结构角色：账册「报表抬头」。七个视图共用同一套抬头构件，
 * 但 kicker / 标题 / 说明三处内容各不相同，切换视图时抬头即变。
 * V3 变化：①操作按钮抬到与标题同级并加待办计数（"常用操作要方便明显"）
 *          ②状态由"带框色片"改为"细点 + 文字"（A 的状态语言）
 * states: default · hover · focus-visible · active · disabled · loading · error · success（由 .btn 原子件统一提供）
 */
export const Header: React.FC<HeaderProps> = ({
  activeNav,
  isMonthlyMandatoryDone,
  auditPeriod,
  totalInStock,
  totalValue,
  operatorName,
  onOpenInbound,
  onOpenSale,
  onOpenAudit,
  onResetDemoData,
  onOpenPrdDoc,
  onLogout,
  pendingBorrowCount = 0,
  urgentFranchiseeCount = 0,
  onOpenFittingTake,
  onGoFitting,
  fittingCount = 0,
  pendingSaleCount = 0,
}) => {
  const meta = VIEW_META[activeNav];

  return (
    <header className="no-print bg-surface border-b border-border-2">
      {/* ── 书眉：系统全称 + 账期，细一号 ── */}
      <div className="px-4 lg:px-8 h-9 flex items-center justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-xs text-text-2 truncate">
            鼎运雅辰品质体验中心
          </span>
          <span className="text-border-2" aria-hidden="true">
            /
          </span>
          <span className="text-2xs text-text-4 truncate">运营与合伙人库存审计系统</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* 服务连接状态：手机端 AI 助手是否已接上 */}
          <ServerStatusPill />
          <span className="text-border-2 hidden sm:inline" aria-hidden="true">
            |
          </span>
          {/* 外观：主题（静室/铜金）× 明暗。一键切换 + 面板细选 */}
          <ThemeSwitcher />
          <span className="text-border-2 hidden sm:inline" aria-hidden="true">
            |
          </span>
          <span className="text-2xs text-text-4 hidden sm:inline">
            签署人 <span className="text-text-2">{operatorName}</span>
          </span>
          <span className="text-border-2 hidden md:inline" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            onClick={onOpenPrdDoc}
            className="text-2xs text-text-4 hover:text-accent transition-colors duration-150 cursor-pointer inline-flex items-center gap-1"
          >
            <FileText strokeWidth={1.6} className="w-3 h-3" />
            <span className="hidden sm:inline">需求文档</span>
          </button>
          <button
            type="button"
            onClick={onResetDemoData}
            title="重置演示数据"
            className="text-2xs text-text-4 hover:text-danger transition-colors duration-150 cursor-pointer inline-flex items-center gap-1"
          >
            <RotateCcw strokeWidth={1.6} className="w-3 h-3" />
            <span className="hidden lg:inline">重置演示数据</span>
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="退出登录"
              className="text-2xs text-text-4 hover:text-danger transition-colors duration-150 cursor-pointer inline-flex items-center gap-1"
            >
              <LogOut strokeWidth={1.6} className="w-3 h-3" />
              <span className="hidden sm:inline">退出</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 报表抬头：本册名称 + 全局常用操作 ── */}
      <div className="px-4 lg:px-8 py-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="kicker">{meta.group}</div>
          <h1 className="page-title mt-1.5">{meta.title}</h1>
          <p className="meta mt-1.5">{meta.note}</p>

          {/* 在手读数：账期 / 在库 / 货值 */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-4 tracking-wide">账期</span>
              <span className="num text-sm text-text-2">{auditPeriod}</span>
            </span>
            <span className="hidden sm:block w-px h-3.5 bg-border-2" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-4 tracking-wide">在库</span>
              <span className="num text-sm text-text-2">
                {totalInStock}
                <span className="text-2xs text-text-4 ml-0.5">件</span>
              </span>
            </span>
            <span className="hidden sm:block w-px h-3.5 bg-border-2" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-4 tracking-wide">指导货值</span>
              <span className="num-ledger text-base text-text">
                ¥{totalValue.toLocaleString('zh-CN')}
              </span>
            </span>
          </div>
        </div>

        {/* 全局常用操作：一进系统就看得见、点得到 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* 审计状态：细点 + 文字，不用带框色片 */}
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-text-3 mr-1">
            <span
              aria-hidden="true"
              className={[
                'w-1.5 h-1.5 rounded-full shrink-0',
                isMonthlyMandatoryDone ? 'bg-ok' : 'bg-accent',
              ].join(' ')}
            />
            本月全盘审计
            <span className={isMonthlyMandatoryDone ? 'text-ok' : 'text-accent-strong'}>
              {isMonthlyMandatoryDone ? '已双签' : '未完成'}
            </span>
          </span>

          <button type="button" className="btn" onClick={onGoFitting}>
            <Shirt strokeWidth={1.75} className="w-4 h-4" />
            试衣间
            {fittingCount > 0 && (
              <span className="tag tag-seal ml-0.5">{fittingCount} 件在试</span>
            )}
            {pendingSaleCount > 0 && (
              <span className="tag tag-warn ml-0.5">{pendingSaleCount} 张待签</span>
            )}
          </button>

          <button type="button" className="btn" onClick={onOpenInbound}>
            <PackagePlus strokeWidth={1.75} className="w-4 h-4" />
            拿货入库
          </button>

          <button type="button" className="btn btn-seal" onClick={onOpenSale}>
            <PenLine strokeWidth={1.75} className="w-4 h-4" />
            销售出库 · 双签
          </button>

          <button type="button" className="btn" onClick={onOpenAudit}>
            <ClipboardCheck strokeWidth={1.75} className="w-4 h-4" />
            发起清点
            {(pendingBorrowCount > 0 || !isMonthlyMandatoryDone) && (
              <span className="tag tag-warn ml-0.5">
                {pendingBorrowCount > 0 ? `${pendingBorrowCount} 单待还` : '本期待强制'}
              </span>
            )}
          </button>

          {urgentFranchiseeCount > 0 && (
            <span className="tag tag-danger">
              {urgentFranchiseeCount} 家房租待续
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
