import React, { useMemo, useState } from 'react';
import { FittingEvent, PendingSale, Partner } from '../types/inventory';
import {
  Shirt,
  Plus,
  Undo2,
  BadgeCheck,
  Clock,
  AlertTriangle,
  FileSignature,
  Smartphone,
  Monitor,
  CheckCircle2,
} from 'lucide-react';

interface FittingRoomPanelProps {
  fittingEvents: FittingEvent[];
  pendingSales: PendingSale[];
  partners: Partner[];
  onOpenTakeModal: () => void;
  onReturn: (event: FittingEvent) => void;
  onPurchase: (event: FittingEvent) => void;
  onSignPending: (pending: PendingSale) => void;
  onReturnPending: (pending: PendingSale) => void;
  pendingActionId?: string;
}

/** 借出超过这个小时数就标为滞留 */
const OVERDUE_HOURS = 8;

function hoursSince(stamp: string): number {
  const t = new Date(String(stamp).replace(' ', 'T')).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / 36e5;
}

function humanElapsed(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟`;
  if (hours < 24) return `${Math.floor(hours)} 小时${Math.round((hours % 1) * 60) ? ` ${Math.round((hours % 1) * 60)} 分` : ''}`;
  return `${Math.floor(hours / 24)} 天 ${Math.floor(hours % 24)} 小时`;
}

export const FittingRoomPanel: React.FC<FittingRoomPanelProps> = ({
  fittingEvents,
  pendingSales,
  partners,
  onOpenTakeModal,
  onReturn,
  onPurchase,
  onSignPending,
  onReturnPending,
  pendingActionId,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  const active = useMemo(
    () =>
      fittingEvents
        .filter((f) => f.status === 'FITTING')
        .sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt))),
    [fittingEvents]
  );
  const history = useMemo(
    () =>
      fittingEvents
        .filter((f) => f.status !== 'FITTING')
        .sort((a, b) => String(b.resolvedAt || '').localeCompare(String(a.resolvedAt || ''))),
    [fittingEvents]
  );
  const openPending = useMemo(() => pendingSales.filter((p) => p.status === 'PENDING'), [pendingSales]);
  const signedPending = useMemo(() => pendingSales.filter((p) => p.status === 'SIGNED'), [pendingSales]);

  const overdueCount = active.filter((f) => hoursSince(f.takenAt) >= OVERDUE_HOURS).length;
  const fromPhone = active.filter((f) => f.source === 'MCP').length;

  const operatorName = (name?: string) => {
    const p = partners.find((x) => x.name === name);
    return p ? p.name : name || '—';
  };

  return (
    <div className="space-y-6">
      {/* 抬头 */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-3 border-b border-border-2">
        <div>
          <div className="kicker">试衣间</div>
          <h1 className="page-title mt-1.5">客户试衣 · 轻登记</h1>
          <p className="meta mt-1.5 max-w-2xl">
            试衣借出与归还<strong className="text-text-2">不产生出库记录，也不改动库存数量</strong>；
            只有客户成交并完成双人电子签名，才正式出库。手机端 AI 助手登记的记录会实时出现在这里。
          </p>
        </div>
        <button type="button" onClick={onOpenTakeModal} className="btn btn-seal shrink-0">
          <Plus strokeWidth={2} className="w-4 h-4" />
          登记试衣借出
        </button>
      </header>

      {/* 指标条 */}
      <section className="panel">
        <dl className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
          {[
            { label: '试衣中', value: active.length, unit: '件', tone: 'text-text', hint: '货仍在库，未出库' },
            {
              label: '滞留超 8 小时',
              value: overdueCount,
              unit: '件',
              tone: overdueCount > 0 ? 'text-warn' : 'text-text',
              hint: overdueCount > 0 ? '建议核对是否已归还' : '暂无滞留',
            },
            { label: '手机端登记', value: fromPhone, unit: '件', tone: 'text-text', hint: '来自 AI 助手' },
            {
              label: '待签署销售单',
              value: openPending.length,
              unit: '张',
              tone: openPending.length > 0 ? 'text-accent-strong' : 'text-text',
              hint: '需电脑端双签',
            },
          ].map((m) => (
            <div key={m.label} className="px-4 py-3.5 lg:px-5">
              <dt className="text-2xs text-text-3">{m.label}</dt>
              <dd className="mt-1.5 flex items-baseline gap-1">
                <span className={`num text-2xl leading-none ${m.tone}`}>{m.value}</span>
                <span className="text-2xs text-text-3">{m.unit}</span>
              </dd>
              <p className="text-2xs text-text-3 mt-1.5">{m.hint}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* 待签销售单 */}
      {openPending.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSignature strokeWidth={1.75} className="w-4.5 h-4.5 text-accent-strong shrink-0" />
              <div className="min-w-0">
                <h2 className="panel-title">待签署销售单 · {openPending.length} 张</h2>
                <p className="panel-hint mt-0.5">
                  手机端已登记成交，货品仍为在库状态；完成双人电子签名后才正式出库
                </p>
              </div>
            </div>
          </div>
          <div className="ledger-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>单号</th>
                  <th>货品</th>
                  <th>客户</th>
                  <th>货权 / 销售</th>
                  <th className="text-right">成交价</th>
                  <th>登记来源</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {openPending.map((p) => (
                  <tr key={p.id}>
                    <td className="c-code text-text-2">{p.id}</td>
                    <td>
                      <span className="text-text">{p.productName}</span>
                      <span className="text-text-3 ml-1.5">
                        {p.size}
                        {p.color ? ` / ${p.color}` : ''}
                      </span>
                    </td>
                    <td className="text-text-2">{p.customerName || '—'}</td>
                    <td className="text-text-2">
                      {p.ownerPartnerName}
                      <span className="text-text-3"> / </span>
                      {p.sellerPartnerName || '待定'}
                    </td>
                    <td className="c-num text-text">¥{p.dealPrice.toLocaleString('zh-CN')}</td>
                    <td>
                      <span className="tag tag-seal inline-flex items-center gap-1">
                        {p.source === 'MCP' ? (
                          <Smartphone strokeWidth={1.8} className="w-3 h-3" />
                        ) : (
                          <Monitor strokeWidth={1.8} className="w-3 h-3" />
                        )}
                        {p.source === 'MCP' ? '手机端' : '电脑端'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onReturnPending(p)}
                          disabled={pendingActionId === p.id}
                          className="btn btn-sm btn-quiet"
                        >
                          取消成交
                        </button>
                        <button
                          type="button"
                          onClick={() => onSignPending(p)}
                          disabled={pendingActionId === p.id}
                          className="btn btn-sm btn-seal"
                        >
                          <BadgeCheck strokeWidth={2} className="w-3.5 h-3.5" />
                          双签出库
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 试衣中 */}
      <section className="panel">
        <div className="panel-head">
          <div className="flex items-center gap-2.5 min-w-0">
            <Shirt strokeWidth={1.75} className="w-4.5 h-4.5 text-accent-strong shrink-0" />
            <div className="min-w-0">
              <h2 className="panel-title">试衣中 · {active.length} 件</h2>
              <p className="panel-hint mt-0.5">
                这些货仍在库存账上（未出库）。客户不买 → 归还；客户要买 → 转待签销售单
              </p>
            </div>
          </div>
          {overdueCount > 0 && (
            <span className="tag tag-warn inline-flex items-center gap-1">
              <AlertTriangle strokeWidth={1.8} className="w-3 h-3" />
              {overdueCount} 件滞留
            </span>
          )}
        </div>

        {active.length === 0 ? (
          <div className="panel-body text-center py-10">
            <Shirt strokeWidth={1.25} className="w-8 h-8 mx-auto text-text-4" />
            <p className="text-sm text-text-2 mt-3">试衣间是空的</p>
            <p className="meta mt-1">客户要试衣时，点右上角「登记试衣借出」，或用手机 AI 助手说一句就行</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((f) => {
              const hours = hoursSince(f.takenAt);
              const overdue = hours >= OVERDUE_HOURS;
              const busy = pendingActionId === f.id;
              return (
                <li key={f.id} className="px-4 lg:px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-text">
                          {f.productName}
                          <span className="text-text-3 ml-1.5">
                            {f.size}
                            {f.color ? ` / ${f.color}` : ''}
                          </span>
                        </span>
                        {overdue && (
                          <span className="tag tag-warn inline-flex items-center gap-1">
                            <AlertTriangle strokeWidth={1.8} className="w-3 h-3" />
                            滞留 {humanElapsed(hours)}
                          </span>
                        )}
                        {f.source === 'MCP' && (
                          <span className="tag tag-seal inline-flex items-center gap-1">
                            <Smartphone strokeWidth={1.8} className="w-3 h-3" />
                            手机登记
                          </span>
                        )}
                      </div>
                      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                        <div className="flex gap-1.5">
                          <dt className="text-text-3">客户</dt>
                          <dd className="text-text">
                            {f.customerName || '—'}
                            {f.customerPhone ? <span className="text-text-3 ml-1">{f.customerPhone}</span> : null}
                          </dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-text-3">货权</dt>
                          <dd className="text-text-2">{f.ownerPartnerName}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-text-3">借出</dt>
                          <dd className="text-text-2 font-num">{f.takenAt}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-text-3">经手</dt>
                          <dd className="text-text-2">{operatorName(f.takenBy)}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-text-3">单号</dt>
                          <dd className="text-text-2 font-num">{f.id}</dd>
                        </div>
                      </dl>
                      {f.note && <p className="meta mt-1.5">备注：{f.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onReturn(f)}
                        disabled={busy}
                        className="btn btn-quiet"
                      >
                        <Undo2 strokeWidth={1.9} className="w-4 h-4" />
                        未购买 · 归还
                      </button>
                      <button
                        type="button"
                        onClick={() => onPurchase(f)}
                        disabled={busy}
                        className="btn btn-seal"
                      >
                        <BadgeCheck strokeWidth={1.9} className="w-4 h-4" />
                        客户要买
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 历史 */}
      <section className="panel">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="panel-head w-full text-left cursor-pointer hover:bg-surface-2 transition-colors duration-150"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock strokeWidth={1.75} className="w-4.5 h-4.5 text-text-3 shrink-0" />
            <div className="min-w-0">
              <h2 className="panel-title">试衣历史 · {history.length} 条</h2>
              <p className="panel-hint mt-0.5">
                已归还 {history.filter((h) => h.status === 'RETURNED').length} · 已成交{' '}
                {history.filter((h) => h.status === 'PURCHASED').length} · 点此{showHistory ? '收起' : '展开'}
              </p>
            </div>
          </div>
        </button>
        {showHistory && (
          <div className="ledger-wrap">
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-text-3">还没有已处理的试衣记录</div>
            ) : (
              <table className="ledger">
                <thead>
                  <tr>
                    <th>单号</th>
                    <th>货品</th>
                    <th>客户</th>
                    <th>结果</th>
                    <th>借出 → 处理</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 60).map((f) => (
                    <tr key={f.id}>
                      <td className="c-code text-text-2">{f.id}</td>
                      <td>
                        <span className="text-text">{f.productName}</span>
                        <span className="text-text-3 ml-1.5">
                          {f.size}
                          {f.color ? ` / ${f.color}` : ''}
                        </span>
                      </td>
                      <td className="text-text-2">{f.customerName || '—'}</td>
                      <td>
                        {f.status === 'RETURNED' ? (
                          <span className="tag inline-flex items-center gap-1">
                            <CheckCircle2 strokeWidth={1.8} className="w-3 h-3" />
                            未购买已归还
                          </span>
                        ) : (
                          <span className="tag tag-seal inline-flex items-center gap-1">
                            <BadgeCheck strokeWidth={1.8} className="w-3 h-3" />
                            已成交{f.saleOrderId ? ` · ${f.saleOrderId}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="text-text-3 font-num text-xs">
                        {f.takenAt}
                        <span className="mx-1">→</span>
                        {f.resolvedAt || '—'}
                      </td>
                      <td>
                        <span className="tag inline-flex items-center gap-1">
                          {f.source === 'MCP' ? (
                            <Smartphone strokeWidth={1.8} className="w-3 h-3" />
                          ) : (
                            <Monitor strokeWidth={1.8} className="w-3 h-3" />
                          )}
                          {f.source === 'MCP' ? '手机端' : '电脑端'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {signedPending.length > 0 && (
        <p className="meta">
          已完成双签的试衣成交 {signedPending.length} 笔，已归入销售账单。
        </p>
      )}
    </div>
  );
};
