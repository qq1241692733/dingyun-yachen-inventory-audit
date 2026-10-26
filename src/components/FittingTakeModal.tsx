import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, Partner } from '../types/inventory';
import { Shirt, X, Search, Check, Info, ScanLine } from 'lucide-react';

export interface FittingTakePayload {
  item: InventoryItem;
  customerName: string;
  customerPhone: string;
  operator: string;
  note: string;
}

interface FittingTakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 可试衣的货：在库可用、且当前不在试衣间的 */
  availableItems: InventoryItem[];
  partners: Partner[];
  preselectedItem?: InventoryItem | null;
  /** 已登记试衣中的库存编号，用于在列表里标灰 */
  fittingItemIds?: string[];
  onSubmit: (payload: FittingTakePayload) => void;
  isPending?: boolean;
}

export const FittingTakeModal: React.FC<FittingTakeModalProps> = ({
  isOpen,
  onClose,
  availableItems,
  partners,
  preselectedItem,
  fittingItemIds = [],
  onSubmit,
  isPending = false,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [operator, setOperator] = useState('付蓉 (店长)');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const fittingSet = useMemo(() => new Set(fittingItemIds), [fittingItemIds]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(preselectedItem?.id || '');
    setQuery('');
    setCustomerName('');
    setCustomerPhone('');
    setNote('');
    setErrorMsg('');
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen, preselectedItem]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = availableItems.filter((i) => !fittingSet.has(i.id));
    if (!q) return rows.slice(0, 30);
    return rows
      .filter((i) =>
        `${i.productName} ${i.barcode} ${i.id} ${i.color || ''} ${i.size} ${i.brand} ${i.ownerPartnerName}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 30);
  }, [availableItems, query, fittingSet]);

  const selected = useMemo(() => availableItems.find((i) => i.id === selectedId) || null, [availableItems, selectedId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setErrorMsg('请先从上面选一件要给客户试的货');
      return;
    }
    if (!customerName.trim() && !customerPhone.trim()) {
      setErrorMsg('至少填一个客户标识（称呼或手机尾号），方便之后找回这条试衣记录');
      return;
    }
    setErrorMsg('');
    onSubmit({
      item: selected,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      operator: operator.trim() || '付蓉 (店长)',
      note: note.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
      <div className="modal-card relative w-full max-w-2xl">
        <div className="modal-head">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 grid place-items-center border border-accent-line bg-accent-soft shrink-0">
              <Shirt strokeWidth={1.75} className="w-4 h-4 text-accent-strong" />
            </span>
            <div>
              <h2 className="text-lg font-medium text-text">试衣借出登记</h2>
              <p className="text-xs text-text-3">客户要试穿，店长从货架取货 —— 只记一笔，不改库存</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-text-3 hover:text-text hover:bg-surface-3"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 lg:p-6 space-y-4 max-h-[68vh] overflow-y-auto">
            {/* 语义说明：这是本流程最容易被误解的地方，必须写在最上面 */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-accent-soft/70 border border-accent-line rounded-xs">
              <Info strokeWidth={1.75} className="w-4 h-4 mt-0.5 text-accent-strong shrink-0" />
              <p className="text-xs leading-5 text-text-2">
                试衣借出<strong className="text-text">不产生任何出库记录</strong>，货品的在库数量与货权归属
                <strong className="text-text">全程不变</strong>。
                <br />
                客户<strong className="text-text">不买</strong> → 在「试衣间」点「未购买 · 归还」，这条记录即消除；
                客户<strong className="text-text">要买</strong> → 点「客户要买」，生成待签销售单，回电脑端完成双人签名后才正式出库。
              </p>
            </div>

            {errorMsg && (
              <div className="px-3.5 py-2.5 bg-danger-soft border border-danger/30 rounded-xs text-xs text-danger leading-5">
                {errorMsg}
              </div>
            )}

            {/* 选货 */}
            <div>
              <label className="label block mb-1.5" htmlFor="fitting-search">
                选择货品 <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Search strokeWidth={1.75} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input
                  id="fitting-search"
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入商品名、条码、尺码或合伙人，也可用扫码枪直接扫"
                  className="field w-full pl-9"
                  autoComplete="off"
                />
              </div>

              <div className="mt-2.5 panel max-h-64 overflow-y-auto">
                {matches.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-text-3">
                    {query ? `没有匹配「${query}」的在库货品` : '没有可试衣的在库货品'}
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {matches.map((i) => {
                      const active = i.id === selectedId;
                      return (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(i.id);
                              setErrorMsg('');
                            }}
                            aria-pressed={active}
                            className={[
                              'w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors duration-150 cursor-pointer',
                              active ? 'bg-accent-soft' : 'hover:bg-accent-faint',
                            ].join(' ')}
                          >
                            <span
                              className={[
                                'w-4 h-4 shrink-0 grid place-items-center border',
                                active ? 'bg-accent border-accent text-on-accent' : 'border-border-2 text-transparent',
                              ].join(' ')}
                              aria-hidden="true"
                            >
                              <Check strokeWidth={2.5} className="w-3 h-3" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-text truncate">
                                {i.productName}
                                <span className="text-text-3 ml-1.5">
                                  {i.size}
                                  {i.color ? ` / ${i.color}` : ''}
                                </span>
                              </span>
                              <span className="block text-2xs text-text-3 mt-0.5 truncate">
                                货权 {i.ownerPartnerName} · {i.brand} · <span className="font-num">{i.barcode}</span>
                              </span>
                            </span>
                            <span className="text-xs text-text-2 font-num shrink-0">¥{i.price.toLocaleString('zh-CN')}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {matches.length >= 30 && (
                <p className="meta mt-1.5">已显示前 30 条，输入关键词可以缩小范围。</p>
              )}
            </div>

            {/* 选中摘要 */}
            {selected && (
              <div className="px-3.5 py-3 bg-surface-2 border border-border rounded-xs space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-text-3 shrink-0">货品</span>
                  <span className="text-text text-right">
                    {selected.productName} {selected.size}
                    {selected.color ? ` / ${selected.color}` : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-3 shrink-0">条码</span>
                  <span className="font-num text-text-2">{selected.barcode}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-3 shrink-0">货权归属</span>
                  <span className="text-text-2">{selected.ownerPartnerName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-text-3 shrink-0">入库时间</span>
                  <span className="text-text-2">{selected.entryDate}</span>
                </div>
              </div>
            )}

            {/* 客户与经手人 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5" htmlFor="fitting-customer">
                  客户称呼
                </label>
                <input
                  id="fitting-customer"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="例如：王女士 / 尾号 8823"
                  className="field w-full"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label block mb-1.5" htmlFor="fitting-phone">
                  客户手机（选填）
                </label>
                <input
                  id="fitting-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="138xxxxxxxx"
                  className="field w-full"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="label block mb-1.5" htmlFor="fitting-operator">
                  经手人
                </label>
                <select
                  id="fitting-operator"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="field w-full"
                >
                  <option value="付蓉 (店长)">付蓉 (店长)</option>
                  {partners
                    .filter((p) => p.name !== '付蓉 (店长)')
                    .map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="label block mb-1.5" htmlFor="fitting-note">
                  备注（选填）
                </label>
                <input
                  id="fitting-note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：客户要试两个尺码对比"
                  className="field w-full"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="px-5 lg:px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xs text-text-3 flex items-center gap-1.5">
              <ScanLine strokeWidth={1.6} className="w-3.5 h-3.5" />
              手机端可用 AI 助手一句话登记，无需打开本页面
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn btn-quiet">
                取消
              </button>
              <button type="submit" className="btn btn-seal" disabled={isPending}>
                {isPending ? '正在登记…' : '登记试衣'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
