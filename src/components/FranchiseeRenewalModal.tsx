import React, { useState } from 'react';
import { Franchisee } from '../types/inventory';
import { SignaturePad } from './SignaturePad';
import { X, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface FranchiseeRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  franchisee: Franchisee | null;
  onConfirmRenewal: (
    franchiseeId: string,
    renewalData: {
      renewDate: string;
      newExpireDate: string;
      managerName: string;
      managerSignature: string;
      franchiseeSignature: string;
      notes?: string;
    }
  ) => void;
}

export const FranchiseeRenewalModal: React.FC<FranchiseeRenewalModalProps> = ({
  isOpen,
  onClose,
  franchisee,
  onConfirmRenewal,
}) => {
  if (!isOpen || !franchisee) return null;

  const currentDate = new Date('2026-09-14');
  const todayStr = '2026-09-14';

  // Calculate new expiration date (+1 year)
  const prevExp = new Date(franchisee.expireDate);
  const baseDate = prevExp.getTime() < currentDate.getTime() ? currentDate : prevExp;
  const newExp = new Date(baseDate);
  newExp.setFullYear(newExp.getFullYear() + 1);
  const newExpireDateStr = `${newExp.getFullYear()}-${String(newExp.getMonth() + 1).padStart(2, '0')}-${String(newExp.getDate()).padStart(2, '0')}`;

  const defaultManagerSig =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="50"><text x="15" y="32" font-family="cursive" font-size="22" fill="%231c1917">付蓉</text></svg>';

  const [managerSignature, setManagerSignature] = useState(defaultManagerSig);
  const [franchiseeSignature, setFranchiseeSignature] = useState('');
  const [managerName, setManagerName] = useState('付蓉 (店长)');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!franchiseeSignature) {
      setErrorMsg('请加盟商本人完成电子手写签名确认');
      return;
    }
    if (!managerSignature) {
      setErrorMsg('请店长付蓉完成签字确认');
      return;
    }

    onConfirmRenewal(franchisee.id, {
      renewDate: todayStr,
      newExpireDate: newExpireDateStr,
      managerName,
      managerSignature,
      franchiseeSignature,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
      <div className="modal-card w-full max-w-xl ">
        {/* Header */}
        <div className="modal-head px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              加盟商房租续费双签凭证
            </h3>
            <p className="text-xs text-text-3 mt-0.5">
              店长与加盟商双方确认 · 自动顺延 1 年
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-text-3 hover:text-text-2 hover:bg-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Key Facts Summary */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-bg rounded-sm border border-border/70 text-xs">
            <div>
              <span className="text-text-3">加盟商姓名</span>
              <p className="font-bold text-text text-sm mt-0.5">{franchisee.name}</p>
              <p className="text-text-3 text-xs">{franchisee.phone} · {franchisee.teamName}</p>
            </div>
            <div>
              <span className="text-text-3">续费金额</span>
              <p className="font-num font-bold text-accent text-base mt-0.5">¥4,000</p>
              <p className="text-text-3 text-xs">全球2700+会所共享席位</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="text-text-3 block text-xs">原到期日</span>
                <span className="font-num text-text-2 font-semibold">{franchisee.expireDate}</span>
              </div>
              <div className="text-text-3 text-sm">➔</div>
              <div className="text-right">
                <span className="text-accent-strong font-semibold block text-xs">续费后新到期日</span>
                <span className="font-num font-bold text-accent text-sm">{newExpireDateStr}</span>
              </div>
            </div>
          </div>

          {/* Dual Signatures */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-2">
                双人手写电子签章确认 <span className="text-danger">*</span>
              </span>
              <span className="text-xs text-text-3">签名将生成防篡改续费凭据</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 店长签字 */}
              <div className="p-3 bg-bg/80 rounded-sm border border-border">
                <div className="text-xs font-semibold text-text-2 mb-2 flex items-center justify-between">
                  <span>店长签名</span>
                  <span className="text-text-3 text-xs font-normal">{managerName}</span>
                </div>
                <SignaturePad
                  label="店长签字"
                  signatoryRole="店长"
                  signatoryName="付蓉"
                  initialValue={managerSignature}
                  onSave={(data) => setManagerSignature(data)}
                />
              </div>

              {/* 加盟商本人签字 */}
              <div className="p-3 bg-bg/80 rounded-sm border border-border">
                <div className="text-xs font-semibold text-text-2 mb-2 flex items-center justify-between">
                  <span>加盟商手写签名</span>
                  <span className="text-text-3 text-xs font-normal">{franchisee.name}</span>
                </div>
                <SignaturePad
                  label="加盟商签名"
                  signatoryRole="加盟商本人"
                  signatoryName={franchisee.name}
                  onSave={(data) => {
                    setFranchiseeSignature(data);
                    setErrorMsg('');
                  }}
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1">
              续费备注 (选填)
            </label>
            <input
              type="text"
              placeholder="例如：微信转账 / 刷卡已入账，主店续期办理"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border-2 rounded-sm bg-surface focus:ring-1 focus:ring-accent focus:outline-hidden"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 bg-danger-soft border border-danger-soft text-danger rounded-sm text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-sm text-xs font-semibold text-text-2 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-sm text-xs font-bold text-on-spine bg-spine hover:bg-spine-3 active:bg-spine-3 transition-all shadow-raise cursor-pointer"
            >
              确认签署并完成续费
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
