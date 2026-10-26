import React, { useState } from 'react';
import { ProductCatalog, Partner } from '../types/inventory';
import { PackagePlus, X, Check, Info } from 'lucide-react';

interface InboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogs: ProductCatalog[];
  partners: Partner[];
  onInboundSuccess: (newItems: {
    productId: string;
    ownerPartnerId: string;
    size: string;
    color?: string;
    quantity: number;
    entryDate: string;
    operator: string;
  }) => void;
}

export const InboundModal: React.FC<InboundModalProps> = ({
  isOpen,
  onClose,
  catalogs,
  partners,
  onInboundSuccess,
}) => {
  const [ownerPartnerId, setOwnerPartnerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>(catalogs[0]?.id || '');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(2); // 默认合伙人常拿2件
  const [operator, setOperator] = useState<string>('付蓉 (店长)');
  const [entryDate, setEntryDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  const currentProduct = catalogs.find((c) => c.id === selectedProductId);

  React.useEffect(() => {
    if (currentProduct && currentProduct.regularSizes.length > 0) {
      setSelectedSize(currentProduct.regularSizes[0]);
    }
  }, [selectedProductId, currentProduct]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPartnerId) {
      setErrorMsg('请选择送货拿来的合伙人（明确货权归属）');
      return;
    }
    if (!selectedProductId) {
      setErrorMsg('请选择入库商品型号');
      return;
    }
    if (!selectedSize) {
      setErrorMsg('请选择商品尺码/规格');
      return;
    }
    if (quantity <= 0) {
      setErrorMsg('入库件数必须至少为1件');
      return;
    }

    onInboundSuccess({
      productId: selectedProductId,
      ownerPartnerId,
      size: selectedSize,
      color: currentProduct?.color,
      quantity,
      entryDate,
      operator,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
      <div className="modal-card relative w-full max-w-lg">
        <div className="modal-head">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-ok/20 border border-ok/30 flex items-center justify-center">
              <PackagePlus strokeWidth={1.75} className="w-5 h-5 text-ok" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-text">合伙人拿货入店登记</h2>
              <p className="text-xs text-text-3">
                一人拿自己的两件或数件货放到店里，建立门店电子货权
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {errorMsg && (
            <div className="p-3 rounded-sm bg-danger-soft border border-danger-soft text-danger text-xs">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-text-2 mb-1">
              拿来货品的合伙人 (货权归属) <span className="text-danger">*</span>
            </label>
            <select
              value={ownerPartnerId}
              onChange={(e) => setOwnerPartnerId(e.target.value)}
              className="w-full text-sm border border-border-2 rounded-sm px-3 py-2 bg-surface focus:ring-2 focus:ring-ok focus:outline-hidden"
            >
              <option value="">-- 请选择送货合伙人 --</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role}) - {p.phone}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-2 mb-1">
              商品系列及品名 <span className="text-danger">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full text-sm border border-border-2 rounded-sm px-3 py-2 bg-surface focus:ring-2 focus:ring-ok focus:outline-hidden"
            >
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>
                  【{c.brand}】{c.name} {c.color ? `(${c.color})` : ''} - 指导价 ¥{c.price}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                规格/尺码 <span className="text-danger">*</span>
              </label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="w-full text-sm border border-border-2 rounded-sm px-3 py-2 bg-surface focus:ring-2 focus:ring-ok focus:outline-hidden"
              >
                {currentProduct?.regularSizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                拿来件数 <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full text-sm border border-border-2 rounded-sm px-3 py-2 focus:ring-2 focus:ring-ok focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                拿来入库时间
              </label>
              <input
                type="text"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full text-xs font-num border border-border-2 rounded-sm px-3 py-2 focus:ring-2 focus:ring-ok focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-2 mb-1">
                入库验收经办人
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full text-xs border border-border-2 rounded-sm px-3 py-2 focus:ring-2 focus:ring-ok focus:outline-hidden"
              />
            </div>
          </div>

          <div className="p-3 bg-bg border border-border rounded-sm text-xs text-text-2 flex items-start gap-2">
            <Info className="w-4 h-4 text-text-3 shrink-0 mt-0.5" />
            <span>
              登记后系统将为每件货品自动派发全局独立唯一识别条码（如 SN...），牢固绑定送货合伙人身份及进店时间。
            </span>
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
              className="px-5 py-2.5 bg-ok hover:brightness-[0.94] text-on-ok rounded-sm text-xs font-bold shadow-raise shadow-ok/20"
            >
              完成登记并入库生成条码
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
