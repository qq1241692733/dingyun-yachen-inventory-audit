import React, { useState, useMemo } from 'react';
import { DailyAuditLogEvent, AuditLogEventType } from '../types/inventory';
import {
  GitCommit,
  GitBranch,
  ShieldCheck,
  ShoppingBag,
  ArrowRightLeft,
  PackagePlus,
  RotateCcw,
  KeyRound,
  FileCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Search,
  Filter,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DailyAuditTreeTimelineProps {
  logs: DailyAuditLogEvent[];
  onOpenAuditModal?: () => void;
  onSelectEventItem?: (barcode: string) => void;
  maxDaysToShow?: number;
  title?: string;
  subtitle?: string;
  isCompact?: boolean;
}

const EVENT_CONFIG: Record<
  AuditLogEventType,
  {
    label: string;
    badgeBg: string;
    textColor: string;
    icon: React.ComponentType<{ className?: string }>;
    borderColor: string;
    dotColor: string;
  }
> = {
  INBOUND: {
    label: '拿货入库',
    badgeBg: 'bg-ok-soft text-ok border-ok-soft',
    textColor: 'text-ok',
    icon: PackagePlus,
    borderColor: 'border-ok-soft',
    dotColor: 'bg-ok ring-ok-soft',
  },
  OUTBOUND_SALE: {
    label: '销售出库',
    badgeBg: 'bg-surface-2 text-text border-border-2',
    textColor: 'text-text',
    icon: ShoppingBag,
    borderColor: 'border-border-2',
    dotColor: 'bg-spine-3 ring-border',
  },
  CROSS_BORROW: {
    label: '跨人借调',
    badgeBg: 'bg-accent-soft text-accent-strong border-accent-line',
    textColor: 'text-accent-strong',
    icon: ArrowRightLeft,
    borderColor: 'border-accent',
    dotColor: 'bg-accent ring-accent-soft',
  },
  RETURN_RESOLVED: {
    label: '还货冲销',
    badgeBg: 'bg-bg text-text border-border',
    textColor: 'text-text-2',
    icon: RotateCcw,
    borderColor: 'border-border-2',
    dotColor: 'bg-spine-3 ring-border',
  },
  INVENTORY_AUDIT: {
    label: '全盘审计',
    badgeBg: 'bg-ok-soft text-ok border-ok-soft',
    textColor: 'text-ok',
    icon: ShieldCheck,
    borderColor: 'border-ok-soft',
    dotColor: 'bg-ok ring-ok-soft',
  },
  FRANCHISEE_RENEWAL: {
    label: '房租续约',
    badgeBg: 'bg-accent-soft/70 text-accent-strong border-accent',
    textColor: 'text-accent-strong',
    icon: KeyRound,
    borderColor: 'border-accent',
    dotColor: 'bg-accent ring-accent-soft',
  },
};

export const DailyAuditTreeTimeline: React.FC<DailyAuditTreeTimelineProps> = ({
  logs,
  onOpenAuditModal,
  onSelectEventItem,
  maxDaysToShow,
  title = '每日审计动态日志树图',
  subtitle = '实时追踪入库交割、销售出库双签、跨人借调及账实清点明细',
  isCompact = false,
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedLogForSignature, setSelectedLogForSignature] =
    useState<DailyAuditLogEvent | null>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedType !== 'ALL' && log.eventType !== selectedType) {
        return false;
      }
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchDesc = log.description.toLowerCase().includes(q);
        const matchItem = (log.itemName || '').toLowerCase().includes(q);
        const matchBarcode = (log.itemBarcode || '').toLowerCase().includes(q);
        const matchPeople = log.participants.some((p) => p.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchItem && !matchBarcode && !matchPeople) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedType, searchKeyword]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; displayDate: string; items: DailyAuditLogEvent[] }[] = [];
    const map = new Map<string, DailyAuditLogEvent[]>();

    filteredLogs.forEach((log) => {
      const cur = map.get(log.date) || [];
      cur.push(log);
      map.set(log.date, cur);
    });

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const finalDates = maxDaysToShow ? sortedDates.slice(0, maxDaysToShow) : sortedDates;

    finalDates.forEach((d) => {
      let displayDate = d;
      if (d === '2026-09-14') displayDate = `${d} · 今天`;
      else if (d === '2026-09-13') displayDate = `${d} · 昨天`;
      else if (d === '2026-09-12') displayDate = `${d} · 前天`;

      groups.push({
        date: d,
        displayDate,
        items: map.get(d) || [],
      });
    });

    return groups;
  }, [filteredLogs, maxDaysToShow]);

  return (
    <div className="bg-surface rounded-md border border-border/90 shadow-raise p-5 space-y-4">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-spine text-on-spine-accent flex items-center justify-center shrink-0 shadow-raise">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text tracking-tight flex items-center gap-2">
                {title}
                <span className="tag num">
                  共 {filteredLogs.length} 条流水
                </span>
              </h3>
              <p className="text-xs text-text-3 mt-0.5">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-3 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="搜索事件、商品、合伙人..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="text-xs pl-8 pr-2.5 py-1.5 rounded-sm border border-border bg-bg focus:bg-surface focus:outline-hidden focus:border-border w-44 sm:w-52"
            />
          </div>

          {onOpenAuditModal && (
            <button
              onClick={onOpenAuditModal}
              className="px-3 py-1.5 text-xs font-bold bg-accent hover:bg-accent-strong text-on-accent rounded-sm transition-all cursor-pointer shrink-0 shadow-raise active:scale-[0.98]"
            >
              + 记录全盘清点
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedType('ALL')}
          className={`px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
            selectedType === 'ALL'
              ? 'bg-spine text-on-spine font-bold shadow-raise'
              : 'bg-surface-2 text-text-2 hover:bg-border'
          }`}
        >
          全部日志 ({logs.length})
        </button>

        {(
          [
            ['OUTBOUND_SALE', '销售出库'],
            ['CROSS_BORROW', '跨人借调'],
            ['RETURN_RESOLVED', '还货冲销'],
            ['INBOUND', '拿货入库'],
            ['INVENTORY_AUDIT', '全盘审计'],
            ['FRANCHISEE_RENEWAL', '房租续约'],
          ] as [AuditLogEventType, string][]
        ).map(([typeKey, label]) => {
          const count = logs.filter((l) => l.eventType === typeKey).length;
          const isSelected = selectedType === typeKey;
          return (
            <button
              key={typeKey}
              onClick={() => setSelectedType(isSelected ? 'ALL' : typeKey)}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-spine text-on-spine font-bold shadow-raise'
                  : 'bg-bg text-text-2 hover:bg-surface-2 border border-border/80'
              }`}
            >
              <span>{label}</span>
              <span
                className={`text-xs font-num px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-accent text-on-accent' : 'bg-border/80 text-text-2'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tree Timeline Container */}
      {groupedByDate.length === 0 ? (
        <div className="py-12 text-center text-text-3 text-xs">
          暂无匹配的审计动态记录
        </div>
      ) : (
        <div className="relative pl-3 sm:pl-6 space-y-6 pt-2">
          {/* Continuous vertical trunk stem */}
          <div className="absolute left-[13px] sm:left-[25px] top-4 bottom-4 w-0.5 bg-border-2" />

          {groupedByDate.map((group) => (
            <div key={group.date} className="relative space-y-3">
              {/* Day Node Header */}
              <div className="flex items-center gap-3">
                <div className="relative z-10 w-7 h-7 rounded-full bg-spine text-on-spine-accent flex items-center justify-center font-num text-xs border-2 border-surface shadow-raise">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-num text-text bg-surface-2/90 border border-border px-2.5 py-0.5 rounded-sm">
                    {group.displayDate}
                  </span>
                  <span className="text-xs text-text-3">
                    {group.items.length} 个操作节点
                  </span>
                </div>
              </div>

              {/* Branch Leaf Events */}
              <div className="space-y-2.5 ml-4 sm:ml-7 border-l-2 border-border/80 pl-4 sm:pl-6">
                {group.items.map((item) => {
                  const cfg = EVENT_CONFIG[item.eventType] || EVENT_CONFIG.INBOUND;
                  const Icon = cfg.icon;

                  return (
                    <div
                      key={item.id}
                      className="group relative bg-bg/70 hover:bg-bg border border-border/80 hover:border-border-2 rounded-sm p-3.5 transition-all shadow-raise flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Left branch node indicator */}
                      <div className="absolute -left-[23px] sm:-left-[31px] top-4.5 w-3 h-3 rounded-full bg-surface border-2 border-border group-hover:border-border-2 transition-colors" />

                      {/* Main narrative & details */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${cfg.badgeBg}`}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>

                          <span className="text-xs font-num font-bold text-text-2 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-text-3" />
                            {item.time}
                          </span>

                          <span className="text-xs font-bold text-text">
                            {item.title}
                          </span>

                          {item.amount && item.amount > 0 && (
                            <span className="text-xs font-num font-bold text-accent-strong bg-accent-soft border border-accent-line px-1.5 py-0.5 rounded">
                              ¥{item.amount.toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Description narrative */}
                        <p className="text-xs text-text-2 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Item barcode tag if available */}
                        {item.itemName && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-3">
                            <span className="font-medium text-text-2">
                              品名: {item.itemName}
                            </span>
                            {item.itemBarcode && (
                              <span className="font-num bg-border/70 px-1.5 py-0.5 rounded text-xs text-text-2">
                                {item.itemBarcode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Signature & Participant badges */}
                      <div className="flex flex-wrap md:flex-col md:items-end gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-text-3">经办/店长:</span>
                          <span className="text-xs font-semibold text-text-2 bg-surface border border-border px-1.5 py-0.5 rounded">
                            {item.operator}
                          </span>
                        </div>

                        {item.dualSigned ? (
                          <div className="tag tag-ok">
                            <CheckCircle2 className="w-3 h-3 text-ok" />
                            双人电子签名生效
                            {(item.managerSignature || item.userSignature) && (
                              <button
                                onClick={() => setSelectedLogForSignature(item)}
                                className="underline hover:text-ok ml-1 cursor-pointer font-normal"
                              >
                                查看凭证
                              </button>
                            )}
                          </div>
                        ) : item.status === 'PENDING' ? (
                          <div className="tag tag-seal">
                            <RotateCcw className="w-3 h-3 text-accent animate-spin" />
                            待还货履约冲销
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signature Preview Modal */}
      {selectedLogForSignature && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
          <div className="modal-card w-full max-w-md p-5 space-y-4 ">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-text">
                  {selectedLogForSignature.title} · 电子签名存证
                </h4>
                <p className="text-xs text-text-3 font-num mt-0.5">
                  流水单号: {selectedLogForSignature.id} ({selectedLogForSignature.timestamp})
                </p>
              </div>
              <button
                onClick={() => setSelectedLogForSignature(null)}
                className="w-7 h-7 rounded-sm bg-surface-2 hover:bg-border text-text-2 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-bg p-3 rounded-sm border border-border text-xs space-y-1.5">
              <p className="text-text-2">
                <strong>事件描述:</strong> {selectedLogForSignature.description}
              </p>
              {selectedLogForSignature.itemName && (
                <p className="text-text-2">
                  <strong>涉及货品:</strong> {selectedLogForSignature.itemName}
                </p>
              )}
            </div>

            {/* Signature view slots */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-bg rounded-sm border border-border text-center">
                <span className="text-xs font-semibold text-text-3 block mb-1">
                  店长签名 (付蓉)
                </span>
                {selectedLogForSignature.managerSignature ? (
                  <img
                    src={selectedLogForSignature.managerSignature}
                    alt="店长付蓉签名"
                    className="h-12 mx-auto object-contain border border-border rounded bg-surface p-1"
                  />
                ) : (
                  <span className="text-xs text-text-3 font-num py-3 block">
                    付蓉 (店长已核验)
                  </span>
                )}
              </div>

              <div className="p-3 bg-bg rounded-sm border border-border text-center">
                <span className="text-xs font-semibold text-text-3 block mb-1">
                  经办/销售人签名
                </span>
                {selectedLogForSignature.userSignature ? (
                  <img
                    src={selectedLogForSignature.userSignature}
                    alt="经办人签名"
                    className="h-12 mx-auto object-contain border border-border rounded bg-surface p-1"
                  />
                ) : (
                  <span className="text-xs text-text-3 font-num py-3 block">
                    已核验电子留存
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedLogForSignature(null)}
              className="w-full py-2 bg-spine hover:bg-spine-3 text-on-spine rounded-sm text-xs font-bold transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
