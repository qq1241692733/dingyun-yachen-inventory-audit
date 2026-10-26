import React, { useState } from 'react';
import { InventoryItem, Partner, SaleOrder } from '../types/inventory';
import { SignaturePad } from './SignaturePad';
import { AlertTriangle, CheckCircle2, DollarSign, UserCheck, X, ShieldAlert } from 'lucide-react';

interface OutboundSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableItems: InventoryItem[];
  partners: Partner[];
  preselectedItem?: InventoryItem | null;
  onSubmitSale: (saleData: {
    item: InventoryItem;
    sellerPartnerId: string;
    dealPrice: number;
    expectedReturnDate?: string;
    managerSignature: string;
    sellerSignature: string;
    managerName: string;
    remarks: string;
  }) => void;
}

export const OutboundSaleModal: React.FC<OutboundSaleModalProps> = ({
  isOpen,
  onClose,
  availableItems,
  partners,
  preselectedItem,
  onSubmitSale,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItem?.id || '');
  const [sellerPartnerId, setSellerPartnerId] = useState<string>('');
  const [dealPrice, setDealPrice] = useState<number>(preselectedItem?.price || 0);
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>('');
  const [managerSignature, setManagerSignature] = useState<string>('');
  const [sellerSignature, setSellerSignature] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('付蓉 (店长)');
  const [remarks, setRemarks] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    if (preselectedItem) {
      setSelectedItemId(preselectedItem.id);
      setDealPrice(preselectedItem.price);
    } else if (availableItems.length > 0 && !selectedItemId) {
      setSelectedItemId(availableItems[0].id);
      setDealPrice(availableItems[0].price);
    }
  }, [preselectedItem, availableItems]);

  if (!isOpen) return null;

  const currentItem = availableItems.find(i => i.id === selectedItemId);
  const selectedSeller = partners.find(p => p.id === sellerPartnerId);
  const isCrossBorrow = currentItem && sellerPartnerId && currentItem.ownerPartnerId !== sellerPartnerId;

  const handleItemChange = (id: string) => {
    setSelectedItemId(id);
    const item = availableItems.find(i => i.id === id);
    if (item) {
      setDealPrice(item.price);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentItem) {
      setErrorMsg('请选择出库销售的货品');
      return;
    }
    if (!sellerPartnerId) {
      setErrorMsg('请选择本次销售出货的合伙人');
      return;
    }
    if (dealPrice <= 0) {
      setErrorMsg('成交金额必须大于0');
      return;
    }
    if (isCrossBorrow && !expectedReturnDate) {
      setErrorMsg('售出非本人货品属于跨人借调，必须填写预计还货日期');
      return;
    }
    if (!managerSignature) {
      setErrorMsg('出库必须由店长完成手写电子签名');
      return;
    }
    if (!sellerSignature) {
      setErrorMsg('出库必须由实际销售者完成手写电子签名');
      return;
    }

    onSubmitSale({
      item: currentItem,
      sellerPartnerId,
      dealPrice,
      expectedReturnDate: isCrossBorrow ? expectedReturnDate : undefined,
      managerSignature,
      sellerSignature,
      managerName,
      remarks,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs overflow-y-auto">
      <div className="modal-card relative w-full max-w-2xl my-6">
        {/* Header */}
        <div className="modal-head">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-surface-2 border border-border-2 flex items-center justify-center">
              <DollarSign strokeWidth={1.75} className="w-5 h-5 text-text-2" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-text">合伙人销售出库凭证录入</h2>
              <p className="text-xs text-text-3">
                出库需记录货主、销售人，支持跨人借调还货追踪及双人电子签名
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-text-3 hover:text-text hover:bg-surface-3 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-sm bg-danger-soft border border-danger-soft text-danger text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. 货品选择与货主信息 */}
          <div className="p-4 rounded-sm bg-bg border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-text-2 uppercase tracking-wider">
                1. 选择出库货品（在库实物）
              </label>
              <span className="text-xs text-text-3">
                当前可选在库商品: {availableItems.length} 件
              </span>
            </div>

            <select
              value={selectedItemId}
              onChange={(e) => handleItemChange(e.target.value)}
              className="w-full text-sm font-medium border border-border-2 rounded-sm px-3 py-2.5 bg-surface focus:ring-2 focus:ring-text-3 focus:outline-hidden"
            >
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  【{item.brand}】{item.productName} ({item.color ? item.color + ' ' : ''}码号: {item.size}) - 货主: {item.ownerPartnerName} [条码: {item.barcode}]
                </option>
              ))}
            </select>

            {currentItem && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/80 text-xs">
                <div>
                  <span className="text-text-3 block">货权所有人:</span>
                  <span className="font-semibold text-text">{currentItem.ownerPartnerName}</span>
                </div>
                <div>
                  <span className="text-text-3 block">拿来入库时间:</span>
                  <span className="font-medium text-text-2">{currentItem.entryDate}</span>
                </div>
                <div>
                  <span className="text-text-3 block">指导标价:</span>
                  <span className="font-semibold text-text">¥{currentItem.price}</span>
                </div>
                <div>
                  <span className="text-text-3 block">货品条码:</span>
                  <span className="font-num text-text-2">{currentItem.barcode}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. 销售人与交易金额 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                2. 实际销售者 (谁卖的) <span className="text-danger">*</span>
              </label>
              <select
                value={sellerPartnerId}
                onChange={(e) => setSellerPartnerId(e.target.value)}
                className="w-full text-sm border border-border-2 rounded-sm px-3 py-2 bg-surface focus:ring-2 focus:ring-text-3 focus:outline-hidden"
              >
                <option value="">-- 请选择销售合伙人 --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role}) - {p.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                实际成交金额 (元) <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-text-3 font-bold">¥</span>
                <input
                  type="number"
                  min="1"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(Number(e.target.value))}
                  className="w-full text-sm pl-7 pr-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-text-3 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 3. 跨人借调检测警示区 */}
          {currentItem && sellerPartnerId && (
            <div>
              {isCrossBorrow ? (
                <div className="p-3.5 rounded-sm bg-accent-soft border border-accent-line text-accent-strong space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-accent-strong">
                    <AlertTriangle className="w-4 h-4 text-accent" />
                    <span>⚠️ 触发【跨合伙人借调销售】机制</span>
                  </div>
                  <p className="text-xs text-accent-strong leading-relaxed">
                    本件货品的所有人是 <strong className="underline decoration-brass">{currentItem.ownerPartnerName}</strong>，当前销售人是 <strong className="underline decoration-brass">{selectedSeller?.name}</strong>。
                    系统已自动建立借调待还账单，必须约定归还日期，出库后销售者负有同规格补货归还责任。
                  </p>
                  <div className="pt-2 border-t border-accent-line flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <label className="text-xs font-bold text-accent-strong shrink-0">
                      约定还货日期: <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-sm border border-accent bg-surface font-medium focus:ring-2 focus:ring-accent focus:outline-hidden"
                    />
                    <span className="text-xs text-accent">
                      (还货时原货主与店长签字冲销)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-sm bg-ok-soft border border-ok-soft text-ok flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                  <span>自有货源出库：销售者本人即为货权所有人，出库后无需借调还货冲账。</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-text-2 mb-1">
              销售备注 / 顾客提货说明 (选填)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="例如：微信转账全款已付清、下周补货进店还货..."
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm focus:ring-2 focus:ring-text-3 focus:outline-hidden"
            />
          </div>

          {/* 4. 双人电子签名区域 (店长 + 销售者) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-2 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-text-2" />
                3. 双人出库电子签名认证（合规必要项）
              </label>
              <span className="text-xs text-text-3">
                出库必须店长与销售者两人现场手写签名确认
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 店长签名 */}
              <SignaturePad
                label="店长核验签字"
                signatoryRole="店长"
                signatoryName={managerName}
                onSave={(dataUrl) => setManagerSignature(dataUrl)}
              />

              {/* 销售者签名 */}
              <SignaturePad
                label="销售经办人签字"
                signatoryRole="销售合伙人"
                signatoryName={selectedSeller?.name || '请先选择销售人'}
                onSave={(dataUrl) => setSellerSignature(dataUrl)}
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-2 hover:text-text-2 hover:bg-surface-2 rounded-sm transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-spine-3 hover:bg-spine active:bg-spine text-on-spine rounded-sm text-xs font-bold tracking-wide shadow-raise transition-all cursor-pointer"
            >
              确认出库并生成双签销售凭证
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
