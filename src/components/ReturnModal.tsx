import React, { useState } from 'react';
import { SaleOrder } from '../types/inventory';
import { RefreshCw, X, CheckCircle, ShieldCheck } from 'lucide-react';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SaleOrder | null;
  onConfirmReturn: (orderId: string, returnData: {
    actualReturnDate: string;
    replenishBarcode?: string;
    confirmedBy: string;
    notes?: string;
  }) => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  order,
  onConfirmReturn,
}) => {
  const [actualReturnDate, setActualReturnDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [replenishBarcode, setReplenishBarcode] = useState<string>('');
  const [confirmedBy, setConfirmedBy] = useState<string>('付蓉 (店长)');
  const [notes, setNotes] = useState<string>('新货已补放入库，原货主已核对确认');

  if (!isOpen || !order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmReturn(order.id, {
      actualReturnDate,
      replenishBarcode,
      confirmedBy,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
      <div className="modal-card relative w-full max-w-md">
        <div className="modal-head">
          <div className="flex items-center gap-2">
            <RefreshCw strokeWidth={1.75} className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-lg font-medium text-text">借调还货冲销确认</h2>
              <p className="text-xs text-text-3">消除跨人借调账目，闭环货权流转</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-text-3 hover:text-text hover:bg-surface-3"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-accent-soft/80 border border-accent-line rounded-sm space-y-2 text-text-2">
            <div className="flex justify-between">
              <span className="text-text-3">原销售单号:</span>
              <span className="font-num font-bold text-text">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">借用货品:</span>
              <span className="font-semibold text-text">
                {order.productName} ({order.color} {order.size})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">被借货主 (债权人):</span>
              <span className="font-bold text-text-2">{order.ownerPartnerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">借货销售人 (还款人):</span>
              <span className="font-bold text-accent-strong">{order.sellerPartnerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">约定还货日期:</span>
              <span className="text-danger font-medium">{order.expectedReturnDate || '未约定'}</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-text-2 mb-1">
              实际还货到店日期 <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              required
              value={actualReturnDate}
              onChange={(e) => setActualReturnDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-accent focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-text-2 mb-1">
              归还补库新条码 (选填)
            </label>
            <input
              type="text"
              placeholder="例如：SN69029988 或留空由系统自动生成"
              value={replenishBarcode}
              onChange={(e) => setReplenishBarcode(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-accent focus:outline-hidden font-num"
            />
          </div>

          <div>
            <label className="block font-bold text-text-2 mb-1">
              验收冲销责任人
            </label>
            <input
              type="text"
              value={confirmedBy}
              onChange={(e) => setConfirmedBy(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-accent focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-text-2 mb-1">
              还货说明与冲销备注
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-accent focus:outline-hidden"
            />
          </div>

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
              className="px-5 py-2.5 bg-accent-strong hover:brightness-[0.92] text-on-accent rounded-sm text-xs font-bold shadow-raise shadow-accent-strong/20"
            >
              确认还货已冲销清账
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
