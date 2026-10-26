import React, { useMemo, useState } from 'react';
import { Franchisee } from '../types/inventory';
import { FranchiseeRenewalModal } from './FranchiseeRenewalModal';
import {
  Search,
  UserPlus,
  Phone,
  PenTool,
  X,
  FileCheck2,
  Users,
} from 'lucide-react';

interface FranchiseeRentManagementProps {
  franchisees: Franchisee[];
  onAddFranchisee: (newFranchisee: Omit<Franchisee, 'id'>) => void;
  onRenewFranchisee: (
    id: string,
    renewalData?: {
      renewDate: string;
      newExpireDate: string;
      managerName: string;
      managerSignature: string;
      franchiseeSignature: string;
      notes?: string;
    }
  ) => void;
  onSelectFranchiseeForFilter?: (name: string) => void;
}

/* Hallmark · macrostructure: Index-First（索引优先）· theme: Bound Ledger
 * 结构指纹：通栏「到期倒计时牌」横向滚动带 → 左栏「分册索引」（按团队 / 门店归卷）→ 右栏选中分册的完整名册账表。
 * 与其余视图的差别：概览是 Stat-Led 单焦点数字、名册是 Catalogue 单表 + 表尾合计、账单是 Workbench 票根流；
 * 本页以「左索引 + 右明细」双栏为主轴，索引本身承载信息（每册的到期紧迫度），而非纯导航。
 * 与上一版的差别：上一版是「顶部一屏卡片网格 + 下方再一张长表」，同一份数据讲两遍；
 *   本版把紧迫信息压缩进倒计时带，把全量信息收进可分册翻阅的账表，一屏只讲一次。
 * 移动端：双栏在 <1024px 折叠为「索引横向条 + 明细」，索引条横向滚动，零页面级溢出。
 */
export const FranchiseeRentManagement: React.FC<FranchiseeRentManagementProps> = ({
  franchisees,
  onAddFranchisee,
  onRenewFranchisee,
  onSelectFranchiseeForFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTeam, setActiveTeam] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [renewalTarget, setRenewalTarget] = useState<Franchisee | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Franchisee | null>(null);

  /* 登记表单 */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [teamName, setTeamName] = useState('雅辰战队');
  const [paymentDate, setPaymentDate] = useState('2026-09-14');
  const [notes, setNotes] = useState('');

  const currentDate = useMemo(() => new Date('2026-09-14'), []);

  /* ── 一次算清：剩余天数 + 紧迫等级 ── */
  const processedList = useMemo(() => {
    const list = franchisees.map((f) => {
      const expDate = new Date(f.expireDate);
      const diffDays = Math.ceil(
        (expDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      let calcStatus: 'EXPIRED' | 'EXPIRING_URGENT' | 'EXPIRING_SOON' | 'ACTIVE' = 'ACTIVE';
      if (diffDays < 0) calcStatus = 'EXPIRED';
      else if (diffDays <= 7) calcStatus = 'EXPIRING_URGENT';
      else if (diffDays <= 30) calcStatus = 'EXPIRING_SOON';
      return { ...f, diffDays, calcStatus };
    });
    return list.sort((a, b) => a.diffDays - b.diffDays);
  }, [franchisees, currentDate]);

  /* ── 搜索：同时约束索引与明细，两栏永远同源 ── */
  const q = searchTerm.trim().toLowerCase();
  const visible = useMemo(
    () =>
      !q
        ? processedList
        : processedList.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.phone.includes(q) ||
              f.teamName.toLowerCase().includes(q)
          ),
    [processedList, q]
  );

  /* ── 分册索引：按团队归卷，每册自带紧迫度 ── */
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    visible.forEach((f) => {
      const arr = map.get(f.teamName) ?? [];
      arr.push(f);
      map.set(f.teamName, arr);
    });
    return Array.from(map.entries())
      .map(([team, members]) => ({
        team,
        members,
        count: members.length,
        totalRent: members.reduce((a, m) => a + m.rentAmount, 0),
        minDays: Math.min(...members.map((m) => m.diffDays)),
        alertCount: members.filter((m) => m.calcStatus !== 'ACTIVE').length,
      }))
      .sort((a, b) => a.minDays - b.minDays);
  }, [visible]);

  const activeGroup = groups.find((g) => g.team === activeTeam) ?? groups[0] ?? null;

  /* ── 倒计时带：全册最紧迫的几个人，横向排开 ── */
  const urgent = processedList.filter((f) => f.calcStatus !== 'ACTIVE').slice(0, 6);

  const totalRent = processedList.reduce((a, f) => a + f.rentAmount, 0);
  const alertTotal = processedList.filter((f) => f.calcStatus !== 'ACTIVE').length;

  const handleCreateFranchisee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const pDate = new Date(paymentDate);
    pDate.setFullYear(pDate.getFullYear() + 1);
    const expireDateStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;

    onAddFranchisee({
      name: name.trim(),
      phone: phone.trim(),
      teamName: teamName.trim(),
      rentAmount: 4000,
      paymentDate,
      expireDate: expireDateStr,
      notes: notes.trim() || undefined,
    });

    setName('');
    setPhone('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const handleModalRenewalConfirm = (
    franchiseeId: string,
    renewalData: {
      renewDate: string;
      newExpireDate: string;
      managerName: string;
      managerSignature: string;
      franchiseeSignature: string;
      notes?: string;
    }
  ) => {
    onRenewFranchisee(franchiseeId, renewalData);
    setRenewalTarget(null);
  };

  const dash = <span className="text-text-4">—</span>;

  return (
    <div className="space-y-6">
      {/* ══ 1 · 到期倒计时带（通栏 · 全册最紧迫者横向排开） ══ */}
      {urgent.length > 0 && (
        <section className="panel overflow-hidden rise rise-1">
          <div className="panel-head">
            <h2 className="panel-title">
              到期倒计时
              <span className="text-2xs text-text-3 font-sans tracking-normal ml-1">
                按剩余天数排序 · 共 {alertTotal} 位需续签
              </span>
            </h2>
            <span className="panel-hint">
              4000 / 年 · 到期须店长与加盟商双方签字方可续期
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-min divide-x divide-border">
              {urgent.map((item) => {
                const expired = item.calcStatus === 'EXPIRED';
                const days = Math.abs(item.diffDays);
                return (
                  <div
                    key={item.id}
                    className="w-[196px] shrink-0 px-4 py-4 flex flex-col gap-2.5"
                    style={{
                      background: expired ? 'var(--color-danger-soft)' : 'var(--color-accent-faint)',
                    }}
                  >
                    <span className={`tag ${expired ? 'tag-danger' : 'tag-warn'} self-start`}>
                      {expired ? '已逾期' : '临近到期'}
                    </span>

                    <span className="flex items-baseline gap-1">
                      <span
                        className={`num-ledger text-2xl leading-tight ${expired ? 'text-danger' : 'text-accent-strong'}`}
                      >
                        {days}
                      </span>
                      <span className="text-2xs text-text-3">{expired ? '天前' : '天后'}</span>
                    </span>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text truncate">{item.name}</div>
                      <div className="text-2xs text-text-3 truncate">
                        {item.teamName} · {item.expireDate}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setRenewalTarget(item)}
                        className="btn btn-sm btn-seal flex-1"
                      >
                        <PenTool strokeWidth={1.75} className="w-3.5 h-3.5" />
                        双签续费
                      </button>
                      {onSelectFranchiseeForFilter && (
                        <button
                          type="button"
                          onClick={() => onSelectFranchiseeForFilter(item.name)}
                          className="btn btn-sm btn-quiet"
                          title="查看该加盟商在库货品"
                        >
                          查在库
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══ 2 · 主轴：左索引（分册）+ 右明细（账表） ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[264px_minmax(0,1fr)] gap-6">
        {/* ── 左：分册索引 ── */}
        <aside className="panel self-start rise rise-2">
          <div className="panel-head">
            <h2 className="panel-title">分册索引</h2>
            <span className="panel-hint num">{groups.length}</span>
          </div>

          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search
                className="w-4 h-4 text-text-3 absolute left-3 top-1/2 -translate-y-1/2"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="姓名 / 手机号 / 团队"
                className="field pl-9"
                aria-label="搜索加盟商"
              />
            </div>
          </div>

          {/* 移动端：横向索引条；桌面：纵向目录 */}
          <div className="lg:block max-lg:overflow-x-auto">
            <ul className="max-lg:flex max-lg:min-w-min max-lg:divide-x max-lg:divide-border lg:divide-y lg:divide-border">
              {groups.map((g) => {
                const active = activeGroup?.team === g.team;
                const expired = g.minDays < 0;
                return (
                  <li key={g.team} className="max-lg:shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTeam(g.team)}
                      aria-current={active}
                      className={[
                        'w-full text-left px-4 py-3 transition-colors duration-150 cursor-pointer',
                        'flex items-center justify-between gap-3',
                        'max-lg:w-[168px]',
                        active
                          ? 'bg-surface-2 shadow-[inset_3px_0_0_var(--color-accent)]'
                          : 'bg-surface hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block text-sm truncate ${active ? 'text-text font-medium' : 'text-text-2'}`}
                        >
                          {g.team}
                        </span>
                        <span className="block text-2xs text-text-3 mt-0.5">
                          {g.count} 人 · ¥{g.totalRent.toLocaleString('zh-CN')}
                        </span>
                      </span>

                      {expired ? (
                        <span className="tag tag-danger shrink-0">逾期</span>
                      ) : g.minDays <= 30 ? (
                        <span className="tag tag-warn shrink-0 num">{g.minDays}天</span>
                      ) : (
                        <span className="tag shrink-0">正常</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {groups.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-text-3">
                  没有匹配的加盟商
                </li>
              )}
            </ul>
          </div>

          <div className="px-4 py-3 border-t border-border flex items-baseline justify-between">
            <span className="text-2xs text-text-3">全册合计房租</span>
            <span className="num-ledger text-base text-accent-strong">
              ¥{totalRent.toLocaleString('zh-CN')}
            </span>
          </div>
        </aside>

        {/* ── 右：选中分册的完整名册 ── */}
        <section className="panel min-w-0 rise rise-3">
          <div className="panel-head">
            <h2 className="panel-title">
              {activeGroup ? activeGroup.team : '加盟商名册'}
              {activeGroup && (
                <span className="text-2xs text-text-3 font-sans tracking-normal ml-1">
                  {activeGroup.count} 位 · 房租合计 ¥
                  {activeGroup.totalRent.toLocaleString('zh-CN')}
                  {activeGroup.alertCount > 0 && ` · ${activeGroup.alertCount} 位待续签`}
                </span>
              )}
            </h2>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-seal btn-sm"
            >
              <UserPlus strokeWidth={1.75} className="w-3.5 h-3.5" />
              登记加盟商
            </button>
          </div>

          <div className="ledger-wrap border-0 rounded-none">
            <table className="ledger">
              <thead>
                <tr>
                  <th>加盟商</th>
                  <th>联系方式</th>
                  <th>所属团队</th>
                  <th className="text-right">房租</th>
                  <th>缴费日</th>
                  <th>到期日</th>
                  <th>倒计时</th>
                  <th>签署凭证</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {activeGroup?.members.map((f) => {
                  const expired = f.calcStatus === 'EXPIRED';
                  const soon = f.calcStatus === 'EXPIRING_URGENT';
                  const nearing = f.calcStatus === 'EXPIRING_SOON';
                  const hasReceipt = Boolean(f.managerSignature || f.franchiseeSignature);

                  return (
                    <tr key={f.id}>
                      <td className="font-medium whitespace-nowrap">{f.name}</td>
                      <td className="c-code text-text-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone strokeWidth={1.75} className="w-3.5 h-3.5 text-text-4" />
                          {f.phone}
                        </span>
                      </td>
                      <td className="text-text-2 whitespace-nowrap">{f.teamName}</td>
                      <td className="c-num">¥{f.rentAmount.toLocaleString('zh-CN')}</td>
                      <td className="c-code text-text-3 whitespace-nowrap">{f.paymentDate}</td>
                      <td
                        className={[
                          'c-code whitespace-nowrap',
                          expired ? 'text-danger' : nearing || soon ? 'text-accent-strong' : 'text-text-2',
                        ].join(' ')}
                      >
                        {f.expireDate}
                      </td>
                      <td className="whitespace-nowrap">
                        {expired ? (
                          <span className="tag tag-danger num">
                            逾期 {Math.abs(f.diffDays)} 天
                          </span>
                        ) : soon ? (
                          <span className="tag tag-seal num">剩 {f.diffDays} 天</span>
                        ) : nearing ? (
                          <span className="tag tag-warn num">剩 {f.diffDays} 天</span>
                        ) : (
                          <span className="tag tag-ok num">剩 {f.diffDays} 天</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => setViewingReceipt(f)}
                            className="inline-flex items-center gap-1.5 text-xs text-accent-strong hover:text-accent font-medium cursor-pointer"
                          >
                            <FileCheck2 strokeWidth={1.75} className="w-3.5 h-3.5" />
                            查看双签
                          </button>
                        ) : (
                          <span className="text-xs text-text-4">初始录入</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setRenewalTarget(f)}
                          className="btn btn-sm"
                        >
                          <PenTool strokeWidth={1.75} className="w-3.5 h-3.5" />
                          双签续费
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {(!activeGroup || activeGroup.members.length === 0) && (
                  <tr>
                    <td colSpan={9} className="text-center text-text-3 py-10">
                      该分册暂无在册加盟商
                    </td>
                  </tr>
                )}
              </tbody>

              {activeGroup && activeGroup.members.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-text-2">
                      本册合计 · {activeGroup.count} 位
                    </td>
                    <td className="c-num text-accent-strong">
                      ¥{activeGroup.totalRent.toLocaleString('zh-CN')}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>

      {/* ══ 3 · 双签续费（复用既有签署链路，视觉归一到令牌层） ══ */}
      <FranchiseeRenewalModal
        isOpen={Boolean(renewalTarget)}
        onClose={() => setRenewalTarget(null)}
        franchisee={renewalTarget}
        onConfirmRenewal={handleModalRenewalConfirm}
      />

      {/* ══ 4 · 续约存证查阅 ══ */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim">
          <div className="modal-card w-full max-w-md">
            <div className="modal-head">
              <h3 className="panel-title">
                <FileCheck2 strokeWidth={1.75} className="w-4 h-4 text-ok self-center" />
                房租续约双签存证
              </h3>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="btn btn-quiet btn-sm"
                aria-label="关闭"
              >
                <X strokeWidth={1.75} className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <dl className="text-sm divide-y divide-border">
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-text-3 text-xs">加盟商姓名</dt>
                  <dd className="text-text font-medium">{viewingReceipt.name}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-text-3 text-xs">所属团队</dt>
                  <dd className="text-text-2">{viewingReceipt.teamName}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-text-3 text-xs">房租金额</dt>
                  <dd className="num-ledger text-accent-strong">
                    ¥{viewingReceipt.rentAmount.toLocaleString('zh-CN')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-text-3 text-xs">最新到期日</dt>
                  <dd className="num text-text">{viewingReceipt.expireDate}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border p-3 text-center bg-bg">
                  <span className="text-2xs text-text-3 block mb-1.5 tracking-wide">
                    店长签字 · 付蓉
                  </span>
                  {viewingReceipt.managerSignature ? (
                    <img
                      src={viewingReceipt.managerSignature}
                      alt="店长付蓉签名"
                      className="h-10 mx-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-text-4">已授权</span>
                  )}
                </div>

                <div className="border border-border p-3 text-center bg-bg">
                  <span className="text-2xs text-text-3 block mb-1.5 tracking-wide">
                    加盟商手写签名
                  </span>
                  {viewingReceipt.franchiseeSignature ? (
                    <img
                      src={viewingReceipt.franchiseeSignature}
                      alt="加盟商签名"
                      className="h-10 mx-auto object-contain"
                    />
                  ) : (
                    <span className="text-xs text-text-4">已签署</span>
                  )}
                </div>
              </div>

              {viewingReceipt.notes && (
                <p className="text-xs text-text-3 border-l-2 border-border-2 pl-3 leading-normal">
                  {viewingReceipt.notes}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="btn"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 5 · 登记加盟商 ══ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim">
          <div className="modal-card w-full max-w-md">
            <div className="modal-head">
              <h3 className="panel-title">登记加盟商</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-quiet btn-sm"
                aria-label="关闭"
              >
                <X strokeWidth={1.75} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFranchisee} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="label" htmlFor="fr-name">
                  姓名 <span className="text-danger">*</span>
                </label>
                <input
                  id="fr-name"
                  type="text"
                  required
                  placeholder="请输入姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="fr-phone">
                  联系电话 <span className="text-danger">*</span>
                </label>
                <input
                  id="fr-phone"
                  type="tel"
                  required
                  placeholder="请输入 11 位手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field num"
                />
              </div>

              <div>
                <label className="label" htmlFor="fr-team">
                  所属团队
                </label>
                <input
                  id="fr-team"
                  type="text"
                  placeholder="如：雅辰战队 / 璀璨名媛组"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="fr-rent">
                    房租金额
                  </label>
                  <input
                    id="fr-rent"
                    type="text"
                    disabled
                    value="¥4,000 / 年"
                    className="field num bg-surface-2 text-text-3"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="fr-pay">
                    缴费日期
                  </label>
                  <input
                    id="fr-pay"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="field num"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="fr-notes">
                  备注说明
                </label>
                <input
                  id="fr-notes"
                  type="text"
                  placeholder="例如：常驻借调业务 / 沙龙活动组织"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="field"
                />
              </div>

              <p className="text-2xs text-text-3 leading-normal border-t border-border pt-3">
                到期日由缴费日期自动顺延一年生成，登记后可在名册中随时补签双签存证。
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-quiet"
                >
                  取消
                </button>
                <button type="submit" className="btn btn-seal">
                  保存加盟商
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
