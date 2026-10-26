import React, { useMemo, useState } from 'react';
import {
  AuditReport,
  InventoryItem,
  SaleOrder,
  Franchisee,
} from '../types/inventory';
import {
  ClipboardCheck,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  PlusCircle,
  GitBranch,
  PenLine,
} from 'lucide-react';
import { DailyAuditTreeTimeline } from './DailyAuditTreeTimeline';
import { generateDailyAuditLogs } from '../utils/auditLogs';

interface AuditReportCenterProps {
  auditReports: AuditReport[];
  onOpenNewAudit: () => void;
  isMonthlyMandatoryDue: boolean;
  items?: InventoryItem[];
  salesOrders?: SaleOrder[];
  franchisees?: Franchisee[];
}

type Mode = 'TREE' | 'REPORTS';

const TYPE_MARK: Record<string, { seal: string; label: string; full: string }> = {
  MONTHLY: { seal: '月盘', label: '月度强制全盘', full: '【月度强制全盘】库存账实审计报告' },
  WEEKLY: { seal: '周检', label: '每周重点抽查', full: '【周度重点抽检】库存审计报告' },
  DAILY: { seal: '日清', label: '每日清点日报', full: '【每日日清日结】库存审计日报' },
};

/* Hallmark · macrostructure: Dossier（卷宗）· theme: Bound Ledger
 * 结构指纹：制度条（朱砂左规线，非卡片）→ 台头分段开关 → 卷宗脊藏列表（左侧竖排印别字 + 右侧摘要行）
 *   → 展开即摊开一册「结论引文 + 明细账表 + 双签印鉴」。
 * 与其余视图的差别：概览单点焦点、名册单表、账单票据流、加盟商双栏索引、借调分卷对照账；
 *   本页是唯一以「收合 / 摊开」为交互主轴的档案柜结构。
 * 与上一版的差别：上一版每份报告都套一层大圆角卡 + 胶囊标签，7 份报告就是 7 张同形卡；
 *   本版改用卷宗脊线，收合态一行一封，摊开态才是完整文书，密度与层级同时提升。
 */
export const AuditReportCenter: React.FC<AuditReportCenterProps> = ({
  auditReports,
  onOpenNewAudit,
  isMonthlyMandatoryDue,
  items = [],
  salesOrders = [],
  franchisees = [],
}) => {
  const [activeTab, setActiveTab] = useState<Mode>('TREE');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(
    auditReports[0]?.id ?? null
  );

  const filteredReports = useMemo(
    () => (selectedType === 'ALL' ? auditReports : auditReports.filter((r) => r.auditType === selectedType)),
    [auditReports, selectedType]
  );

  const auditLogs = useMemo(
    () => generateDailyAuditLogs(items, salesOrders, auditReports, franchisees),
    [items, salesOrders, auditReports, franchisees]
  );

  const discrepancyTotal = auditReports.reduce((a, r) => a + r.discrepancyCount, 0);

  const typeTabs = [
    { key: 'ALL', label: '全部卷宗', count: auditReports.length },
    { key: 'MONTHLY', label: '月度强制全盘', count: auditReports.filter((r) => r.auditType === 'MONTHLY').length },
    { key: 'WEEKLY', label: '每周重点抽查', count: auditReports.filter((r) => r.auditType === 'WEEKLY').length },
    { key: 'DAILY', label: '每日清点日报', count: auditReports.filter((r) => r.auditType === 'DAILY').length },
  ];

  return (
    <div className="space-y-6">
      {/* ══ 1 · 制度条（朱砂左规线，非卡片） ══ */}
      <aside
        className="border-l-2 border-accent pl-4 py-0.5 rise rise-1 flex flex-wrap items-start justify-between gap-x-6 gap-y-3"
      >
        <div className="min-w-0 max-w-[74ch]">
          <p className="text-sm text-text leading-normal">
            <ShieldAlert
              strokeWidth={1.75}
              className={`w-4 h-4 inline-block mr-1.5 -mt-0.5 ${isMonthlyMandatoryDue ? 'text-accent' : 'text-ok'}`}
            />
            <strong className="font-medium">门店制度：每月须强制全量清点库存一次（账实大盘点）</strong>
          </p>
          <p className="text-xs text-text-3 mt-1 leading-normal">
            逐件清点在库实物与系统电子账，由【店长付蓉】与【合伙人审计监事】双人现场手写签字确认。
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isMonthlyMandatoryDue ? (
            <span className="tag tag-seal">本月待执行</span>
          ) : (
            <span className="tag tag-ok">本月已合规</span>
          )}
          <button type="button" onClick={onOpenNewAudit} className="btn btn-sm btn-seal">
            <PlusCircle strokeWidth={1.75} className="w-3.5 h-3.5" />
            发起库存盘点清查
          </button>
        </div>
      </aside>

      {/* ══ 2 · 台头：分段开关 + 册数摘要 ══ */}
      <section className="panel rise rise-2">
        <div className="panel-body flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div
            role="tablist"
            aria-label="审计视图切换"
            className="flex flex-wrap items-center border border-border-2 rounded-xs overflow-hidden"
          >
            {(
              [
                { key: 'TREE' as Mode, label: '每日审计动态树图', count: auditLogs.length, icon: GitBranch },
                { key: 'REPORTS' as Mode, label: '全盘清查卷宗', count: auditReports.length, icon: ClipboardCheck },
              ] as const
            ).map((t, i) => {
              const active = activeTab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={[
                    'h-9 px-4 inline-flex items-center gap-2 text-xs transition-colors duration-150 cursor-pointer',
                    i > 0 ? 'border-l border-border-2' : '',
                    active ? 'bg-spine text-on-spine' : 'bg-surface text-text-2 hover:bg-surface-2',
                  ].join(' ')}
                >
                  <Icon strokeWidth={1.75} className="w-3.5 h-3.5" />
                  {t.label}
                  <span className="num text-2xs opacity-75">{t.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-3">卷宗合计</span>
              <span className="num-ledger text-base text-text">{auditReports.length}</span>
              <span className="text-2xs text-text-3">册</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-2xs text-text-3">累计账实差异</span>
              <span
                className={`num-ledger text-base ${discrepancyTotal > 0 ? 'text-danger' : 'text-ok'}`}
              >
                {discrepancyTotal}
              </span>
              <span className="text-2xs text-text-3">件</span>
            </span>
          </div>
        </div>
      </section>

      {/* ══ 3 · 每日审计动态树图 ══ */}
      {activeTab === 'TREE' && (
        <DailyAuditTreeTimeline
          logs={auditLogs}
          onOpenAuditModal={onOpenNewAudit}
          title="出入库与盘点每日动态流水"
          subtitle="按日期树状节点展现每次拿货入库、销售双签、借调平账与清点实录"
        />
      )}

      {/* ══ 4 · 卷宗档案 ══ */}
      {activeTab === 'REPORTS' && (
        <>
          <section className="panel rise rise-3">
            <div className="panel-head">
              <div className="flex flex-wrap items-center border border-border-2 rounded-xs overflow-hidden">
                {typeTabs.map((t, i) => {
                  const active = selectedType === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedType(t.key)}
                      className={[
                        'h-8 px-3 inline-flex items-center gap-1.5 text-xs transition-colors duration-150 cursor-pointer',
                        i > 0 ? 'border-l border-border-2' : '',
                        active
                          ? 'bg-surface-3 text-text'
                          : 'bg-surface text-text-3 hover:bg-surface-2',
                      ].join(' ')}
                    >
                      {t.label}
                      <span className="num text-2xs opacity-70">{t.count}</span>
                    </button>
                  );
                })}
              </div>
              <span className="panel-hint">电子库存与实物盘点数据对比表 · 点击卷脊摊开明细</span>
            </div>

            <ul className="divide-y divide-border">
              {filteredReports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                const hasDiscrepancy = report.discrepancyCount > 0;
                const mark = TYPE_MARK[report.auditType] ?? TYPE_MARK.DAILY;
                const diffTotal = report.items.reduce((a, i) => a + i.difference, 0);

                return (
                  <li key={report.id}>
                    {/* ── 卷脊（收合态一行一封） ── */}
                    <button
                      type="button"
                      onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                      aria-expanded={isExpanded}
                      className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-surface-2 transition-colors duration-150 cursor-pointer"
                    >
                      {/* 竖排印别字 */}
                      <span
                        className={[
                          'shrink-0 w-9 self-stretch flex items-center justify-center text-2xs tracking-widest',
                          'rounded-none border',
                          isExpanded
                            ? 'bg-accent text-on-accent border-accent'
                            : 'bg-surface-2 text-text-3 border-border-2',
                        ].join(' ')}
                        style={{ writingMode: 'vertical-rl' }}
                      >
                        {mark.seal}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-sm text-text font-medium">{mark.full}</span>
                          <span className="c-code text-text-4">{report.id}</span>
                          <span className="text-2xs text-text-3">{mark.label}</span>
                        </span>

                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-3 mt-1">
                          <span className="c-code inline-flex items-center gap-1">
                            <Calendar strokeWidth={1.75} className="w-3 h-3" />
                            {report.auditDate}
                          </span>
                          <span>
                            系统在库 <strong className="num font-medium text-text-2">{report.totalSystemCount}</strong> 件
                          </span>
                          <span>
                            实物清点 <strong className="num font-medium text-text-2">{report.totalPhysicalCount}</strong> 件
                          </span>
                        </span>
                      </span>

                      <span className="hidden md:flex items-center gap-4 shrink-0 text-2xs text-text-3">
                        <span className="inline-flex items-center gap-1.5">
                          <PenLine strokeWidth={1.75} className="w-3 h-3" />
                          店长 {report.managerName}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PenLine strokeWidth={1.75} className="w-3 h-3" />
                          审计 {report.inspectorName}
                        </span>
                      </span>

                      <span className="shrink-0 flex items-center gap-2">
                        {hasDiscrepancy ? (
                          <span className="tag tag-danger">
                            <AlertCircle strokeWidth={1.75} className="w-3 h-3" />
                            差异 {report.discrepancyCount} 件
                          </span>
                        ) : (
                          <span className="tag tag-ok">
                            <CheckCircle2 strokeWidth={1.75} className="w-3 h-3" />
                            账实相符
                          </span>
                        )}
                        <ChevronRight
                          strokeWidth={1.75}
                          className={`w-4 h-4 text-text-4 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </span>
                    </button>

                    {/* ── 摊开态：完整文书 ── */}
                    {isExpanded && (
                      <div className="px-4 pb-5 pt-1 bg-bg space-y-5">
                        {/* 结论引文 */}
                        <div className="border-l-2 border-border-2 pl-4">
                          <div className="kicker mb-1.5">盘点结论综述</div>
                          <p className="text-sm text-text-2 leading-normal max-w-[80ch]">
                            {report.summary}
                          </p>
                        </div>

                        {/* 明细账表 */}
                        <div>
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="section-title text-base">规格品类对照核验明细</span>
                            <span className="meta">
                              {report.items.length} 个规格 · 点击卷脊可收合
                            </span>
                          </div>

                          <div className="ledger-wrap max-h-72 overflow-y-auto">
                            <table className="ledger">
                              <thead>
                                <tr>
                                  <th>品牌</th>
                                  <th>商品品名</th>
                                  <th>尺码 / 规格</th>
                                  <th className="text-right">电子账面数</th>
                                  <th className="text-right">实物清点数</th>
                                  <th className="text-right">差异（实 − 账）</th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.items.map((item, i) => (
                                  <tr key={i}>
                                    <td className="text-text-2 whitespace-nowrap">{item.brand}</td>
                                    <td className="text-text">{item.productName}</td>
                                    <td className="c-code text-text-3 whitespace-nowrap">{item.size}</td>
                                    <td className="c-num text-text-2">{item.systemCount}</td>
                                    <td className="c-num">{item.physicalCount}</td>
                                    <td className="c-num">
                                      {item.difference === 0 ? (
                                        <span className="text-text-4">0</span>
                                      ) : item.difference > 0 ? (
                                        <span className="text-accent-strong">
                                          +{item.difference}　盘盈
                                        </span>
                                      ) : (
                                        <span className="text-danger">
                                          {item.difference}　盘亏
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={3} className="text-text-2">
                                    本册合计 · {report.items.length} 个规格
                                  </td>
                                  <td className="text-right text-text-2">{report.totalSystemCount}</td>
                                  <td className="text-right">{report.totalPhysicalCount}</td>
                                  <td className="text-right">
                                    <span
                                      className={
                                        diffTotal === 0
                                          ? 'text-ok'
                                          : diffTotal > 0
                                            ? 'text-accent-strong'
                                            : 'text-danger'
                                      }
                                    >
                                      {diffTotal > 0 ? `+${diffTotal}` : diffTotal}
                                    </span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>

                        {/* 双签印鉴 */}
                        <div>
                          <div className="kicker mb-2">双人现场审计手写电子签名印鉴</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              {
                                role: '店长核验签字',
                                who: report.managerName,
                                sig: report.managerSignature,
                              },
                              {
                                role: '合伙人审计代表签字',
                                who: report.inspectorName,
                                sig: report.inspectorSignature,
                              },
                            ].map((s) => (
                              <div
                                key={s.role}
                                className="border border-border-2 bg-surface p-4 text-center"
                              >
                                <div className="text-2xs text-text-3 tracking-wide">
                                  {s.role}
                                </div>
                                <div className="text-xs text-text-2 mt-0.5 mb-2">{s.who}</div>
                                {s.sig ? (
                                  <img
                                    src={s.sig}
                                    alt={`${s.role}签名`}
                                    className="h-12 mx-auto object-contain"
                                  />
                                ) : (
                                  <div className="h-12 flex items-center justify-center text-text-4 text-2xs">
                                    暂无电子签名
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}

              {filteredReports.length === 0 && (
                <li className="px-4 py-14 text-center text-text-3 text-xs">
                  该分类下暂无审计卷宗
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
};
