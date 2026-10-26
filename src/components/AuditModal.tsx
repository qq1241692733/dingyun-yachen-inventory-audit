import React, { useState } from 'react';
import { InventoryItem, AuditType, AuditReport, AuditItemCheck } from '../types/inventory';
import { SignaturePad } from './SignaturePad';
import { ClipboardCheck, X, AlertCircle, CheckCircle2, Calendar, FileText } from 'lucide-react';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableItems: InventoryItem[];
  onSubmitAudit: (report: AuditReport) => void;
  isMonthlyMandatoryDue: boolean;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  availableItems,
  onSubmitAudit,
  isMonthlyMandatoryDue,
}) => {
  const [auditDate, setAuditDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [auditType, setAuditType] = useState<AuditType>('MONTHLY');
  const [managerName, setManagerName] = useState<string>('付蓉 (店长)');
  const [inspectorName, setInspectorName] = useState<string>('李雅琴 (合伙人审计代表)');
  const [managerSignature, setManagerSignature] = useState<string>('');
  const [inspectorSignature, setInspectorSignature] = useState<string>('');
  const [summaryNotes, setSummaryNotes] = useState<string>('实地核对无误，在库标签均完好，账实核验相符。');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 聚合当前在库的商品分类和尺码
  const [auditItems, setAuditItems] = useState<AuditItemCheck[]>([]);

  React.useEffect(() => {
    // 汇总当前在库商品生成明细行
    const map = new Map<string, AuditItemCheck>();
    availableItems.forEach((item) => {
      const key = `${item.productId}_${item.size}_${item.color || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          productId: item.productId,
          productName: item.productName,
          brand: item.brand,
          size: item.size,
          color: item.color,
          systemCount: 1,
          physicalCount: 1,
          difference: 0,
        });
      } else {
        const row = map.get(key)!;
        row.systemCount += 1;
        row.physicalCount += 1;
      }
    });
    setAuditItems(Array.from(map.values()));
  }, [availableItems, isOpen]);

  if (!isOpen) return null;

  const handlePhysicalChange = (index: number, val: number) => {
    const updated = [...auditItems];
    const row = { ...updated[index] };
    row.physicalCount = Math.max(0, val);
    row.difference = row.physicalCount - row.systemCount;
    updated[index] = row;
    setAuditItems(updated);
  };

  const setAllMatch = () => {
    const updated = auditItems.map((item) => ({
      ...item,
      physicalCount: item.systemCount,
      difference: 0,
    }));
    setAuditItems(updated);
  };

  const totalSystem = auditItems.reduce((acc, curr) => acc + curr.systemCount, 0);
  const totalPhysical = auditItems.reduce((acc, curr) => acc + curr.physicalCount, 0);
  const discrepancyRows = auditItems.filter((i) => i.difference !== 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!auditDate) {
      setErrorMsg('请选择清点盘点日期');
      return;
    }
    if (!managerSignature) {
      setErrorMsg('审计清点报告必须由店长签字确认');
      return;
    }
    if (!inspectorSignature) {
      setErrorMsg('审计清点报告必须由合伙人审计代表签字确认');
      return;
    }

    const newReport: AuditReport = {
      id: `AUD-${auditDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      auditDate,
      auditType,
      isMandatoryMonthly: auditType === 'MONTHLY',
      totalSystemCount: totalSystem,
      totalPhysicalCount: totalPhysical,
      discrepancyCount: Math.abs(totalPhysical - totalSystem),
      status: 'COMPLETED',
      inspectorName,
      managerName,
      inspectorSignature,
      managerSignature,
      summary: summaryNotes,
      items: auditItems,
      createdAt: `${auditDate} 18:00`,
    };

    onSubmitAudit(newReport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs overflow-y-auto">
      <div className="modal-card relative w-full max-w-4xl my-6">
        <div className="modal-head">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-surface-2 border border-border-2 flex items-center justify-center">
              <ClipboardCheck strokeWidth={1.75} className="w-5 h-5 text-text-2" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-text">新零售门店库存实盘审计表</h2>
                {auditType === 'MONTHLY' && (
                  <span className="tag tag-seal">
                    每月法定强制全盘
                  </span>
                )}
              </div>
              <p className="text-xs text-text-3">
                支持自由选择日期比对电子库存与实物在库，双人电子签字存档防抵赖
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-text-3 hover:text-text hover:bg-surface-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3 rounded-sm bg-danger-soft border border-danger-soft text-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 盘点基础配置 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-bg border border-border rounded-sm">
            <div>
              <label className="block font-bold text-text-2 mb-1">
                盘点审计日期 <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                required
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm bg-surface focus:ring-2 focus:ring-text-3 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-text-2 mb-1">
                审计频次/类型 <span className="text-danger">*</span>
              </label>
              <select
                value={auditType}
                onChange={(e) => setAuditType(e.target.value as AuditType)}
                className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm bg-surface focus:ring-2 focus:ring-text-3 focus:outline-hidden font-semibold"
              >
                <option value="DAILY">每日审计盘点 (日清日结)</option>
                <option value="WEEKLY">每周重点抽检 (周度审计)</option>
                <option value="MONTHLY">每月强制全店大盘点 (全量审计)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-text-2 mb-1">
                强制合规提示
              </label>
              <div className="text-xs p-2 rounded-sm bg-surface-2/60 border border-border text-text font-medium leading-tight">
                门店规定：每月必须强制全量清点一次，双人签字存档备查。
              </div>
            </div>
          </div>

          {/* 盘点比对总揽 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-sm bg-surface-2 border border-border text-center">
              <span className="text-text-3 block text-xs">系统电子库存</span>
              <span className="text-lg font-black text-text-2">{totalSystem} <span className="text-xs font-normal">件</span></span>
            </div>
            <div className="p-3 rounded-sm bg-bg border border-border text-center">
              <span className="text-text-2 block text-xs">实物清点数量</span>
              <span className="text-lg font-black text-text">{totalPhysical} <span className="text-xs font-normal">件</span></span>
            </div>
            <div className={`p-3 rounded-sm border text-center ${
              totalPhysical === totalSystem ? 'bg-ok-soft border-ok-soft text-ok' : 'bg-danger-soft border-danger-soft text-danger'
            }`}>
              <span className="block text-xs">账实差异 (盘盈/盘亏)</span>
              <span className="text-lg font-black">
                {totalPhysical - totalSystem > 0 ? `+${totalPhysical - totalSystem}` : totalPhysical - totalSystem} <span className="text-xs font-normal">件</span>
              </span>
            </div>
          </div>

          {/* 清点明细表格 */}
          <div className="border border-border rounded-sm overflow-hidden shadow-raise">
            <div className="px-4 py-2.5 bg-surface-2 border-b border-border flex items-center justify-between">
              <span className="font-bold text-text-2">各规格实物清点核验列表 ({auditItems.length} 个品类规)</span>
              <button
                type="button"
                onClick={setAllMatch}
                className="px-2.5 py-1 text-xs font-semibold bg-surface hover:bg-bg border border-border-2 rounded-md text-text-2 shadow-raise cursor-pointer"
              >
                一键快速设为实盘全相符
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-bg text-text-3 text-xs sticky top-0 border-b border-border">
                  <tr>
                    <th className="py-2 px-3 font-semibold">品牌</th>
                    <th className="py-2 px-3 font-semibold">品名及颜色</th>
                    <th className="py-2 px-3 font-semibold">尺码/规格</th>
                    <th className="py-2 px-3 font-semibold text-center">系统电子数</th>
                    <th className="py-2 px-3 font-semibold text-center">实物清点数</th>
                    <th className="py-2 px-3 font-semibold text-center">差异</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text-2 text-xs">
                  {auditItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/80">
                      <td className="py-2 px-3 font-semibold text-text">{item.brand}</td>
                      <td className="py-2 px-3">
                        {item.productName} {item.color ? `(${item.color})` : ''}
                      </td>
                      <td className="py-2 px-3 font-num font-medium text-text-2">{item.size}</td>
                      <td className="py-2 px-3 text-center font-num font-bold text-text-2">
                        {item.systemCount}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.physicalCount}
                          onChange={(e) => handlePhysicalChange(idx, Number(e.target.value))}
                          className={`w-16 text-center font-num font-bold py-1 border rounded ${
                            item.difference !== 0
                              ? 'border-danger bg-danger-soft text-danger'
                              : 'border-border-2 bg-surface text-text-2'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3 text-center font-bold">
                        {item.difference === 0 ? (
                          <span className="text-ok font-num">0</span>
                        ) : item.difference > 0 ? (
                          <span className="text-text-2 font-num">+{item.difference} (盘盈)</span>
                        ) : (
                          <span className="text-danger font-num">{item.difference} (盘亏)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="block font-bold text-text-2 mb-1">
              盘点结论与异常说明
            </label>
            <textarea
              rows={2}
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              className="w-full text-xs p-2.5 border border-border-2 rounded-sm focus:ring-2 focus:ring-text-3 focus:outline-hidden"
            />
          </div>

          {/* 审计双人电子签字 */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-2 uppercase tracking-wider">
                清点核实双人签名存档（店长 + 审计代表）
              </label>
              <span className="text-xs text-text-3">
                双人签名确权后形成不可篡改的审计日报/月报
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SignaturePad
                label="店长核验签字"
                signatoryRole="店长"
                signatoryName={managerName}
                onSave={(dataUrl) => setManagerSignature(dataUrl)}
              />

              <SignaturePad
                label="合伙人审计代表签字"
                signatoryRole="合伙人监事"
                signatoryName={inspectorName}
                onSave={(dataUrl) => setInspectorSignature(dataUrl)}
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-2 hover:text-text-2 hover:bg-surface-2 rounded-sm"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-spine-3 hover:bg-spine text-on-spine rounded-sm text-xs font-bold shadow-raise"
            >
              完成双签并生成官方审计报告
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
