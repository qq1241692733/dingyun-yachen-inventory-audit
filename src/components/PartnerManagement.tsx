import React, { useMemo, useState } from 'react';
import { Partner, InventoryItem, SaleOrder } from '../types/inventory';
import { UserPlus, Search, X, CornerDownRight, ArrowUpRight, PackagePlus } from 'lucide-react';

interface PartnerManagementProps {
  partners: Partner[];
  items: InventoryItem[];
  salesOrders: SaleOrder[];
  onAddPartner: (newPartner: { name: string; phone: string; role: string }) => void;
  onSelectPartnerForFilter: (partnerId: string) => void;
  onOpenInboundForPartner: (partnerId: string) => void;
}

/* Hallmark · macrostructure: Catalogue（目录式名册）· theme: Bound Ledger
 * 结构指纹：店长独占一条横向身份条 → 其余合伙人以「名册表格」逐行列出（非卡片网格）→ 表尾合计行。
 * 与上一版的差别：17 张逐字节相同的卡片 → 一张可按值排序的真实账表；零值一律渲染为「—」，不再重复占位。
 * 移动端：表格外层横向滚动，容器内不产生页面级溢出。
 */
export const PartnerManagement: React.FC<PartnerManagementProps> = ({
  partners,
  items,
  salesOrders,
  onAddPartner,
  onSelectPartnerForFilter,
  onOpenInboundForPartner,
}) => {
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('高级合伙人');

  /* ── 一次算清全部指标，避免每行重复过滤 ── */
  const rows = useMemo(() => {
    return partners.map((p) => {
      const isManager = p.role === '店长' || p.id === 'p-01' || p.name.includes('店长');
      const own = items.filter((i) => i.ownerPartnerId === p.id && i.status === 'AVAILABLE');
      const borrowPending = salesOrders.filter(
        (s) => s.sellerPartnerId === p.id && s.isCrossPartnerBorrow && s.returnStatus === 'PENDING'
      ).length;
      const lentPending = salesOrders.filter(
        (s) => s.ownerPartnerId === p.id && s.isCrossPartnerBorrow && s.returnStatus === 'PENDING'
      ).length;
      const mySales = salesOrders.filter((s) => s.sellerPartnerId === p.id);
      return {
        partner: p,
        isManager,
        name: isManager ? '付蓉' : p.name,
        role: isManager ? '店长 / 首席风控官' : p.role,
        inStockCount: own.length,
        inStockValue: own.reduce((a, i) => a + i.price, 0),
        borrowPending,
        lentPending,
        salesCount: mySales.length,
        salesRevenue: mySales.reduce((a, s) => a + s.dealPrice, 0),
      };
    });
  }, [partners, items, salesOrders]);

  const manager = rows.find((r) => r.isManager);
  const members = useMemo(
    () =>
      rows
        .filter((r) => !r.isManager)
        .sort((a, b) => b.inStockValue - a.inStockValue)
        .filter((r) =>
          !search.trim()
            ? true
            : r.name.includes(search) || r.partner.phone.includes(search) || r.role.includes(search)
        ),
    [rows, search]
  );

  const totalCount = rows.reduce((a, r) => a + r.inStockCount, 0);
  const totalValue = rows.reduce((a, r) => a + r.inStockValue, 0);
  const totalBorrow = rows.reduce((a, r) => a + r.borrowPending, 0);

  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    onAddPartner({ name: newName.trim(), phone: newPhone.trim(), role: newRole });
    setNewName('');
    setNewPhone('');
    setIsAddModalOpen(false);
  };

  /* 空值一律以「—」呈现：账本里不写无意义的 0 */
  const dash = <span className="text-text-4">—</span>;

  return (
    <div className="space-y-6">
      {/* ══ 1 · 册首统计带（一行账目摘要） ══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-border rounded-sm bg-surface divide-x divide-border">
        {[
          { label: '在册合伙人', value: String(partners.length), unit: '位', accent: false },
          { label: '合计在库', value: String(totalCount), unit: '件', accent: false },
          { label: '合计在库货值', value: `¥${totalValue.toLocaleString('zh-CN')}`, unit: '', accent: true },
          { label: '借入待还', value: String(totalBorrow), unit: '笔', accent: totalBorrow > 0 },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3.5 min-w-0">
            <div className="text-2xs text-text-3 tracking-wide">{s.label}</div>
            <div
              className={[
                'mt-1.5 wrap-anywhere',
                s.accent ? 'num-ledger text-lg text-accent-strong' : 'num-ledger text-lg text-text',
              ].join(' ')}
            >
              {s.value}
              {s.unit && <span className="text-2xs text-text-3 ml-1 font-sans">{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ══ 2 · 店长身份条（置顶 · 唯一带朱砂印记） ══ */}
      {manager && (
        <section className="panel">
          <div className="p-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                className="w-12 h-12 grid place-items-center border-2 border-accent bg-accent-soft shrink-0"
              >
                <span className="font-display text-xl leading-none text-accent-strong">
                  付
                </span>
              </span>
              <span>
                <span className="block font-display text-lg text-text">付蓉</span>
                <span className="block mt-0.5 text-xs text-accent-strong">店长 / 首席风控官</span>
                <span className="num block mt-1 text-xs text-text-3">{manager.partner.phone}</span>
              </span>
            </div>

            <span className="flex-1 min-w-[24px]" />

            <span className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xs text-text-3">在库</span>
                <span className="num-ledger text-lg text-text">{manager.inStockCount}</span>
                <span className="text-2xs text-text-3">件</span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xs text-text-3">在库货值</span>
                <span className="num-ledger text-lg text-text">
                  ¥{manager.inStockValue.toLocaleString('zh-CN')}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-2xs text-text-3">累计出货</span>
                <span className="num-ledger text-lg text-text">
                  {manager.salesCount} <span className="text-2xs text-text-3">笔</span>
                </span>
              </span>
            </span>

            <span className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onSelectPartnerForFilter(manager.partner.id)}
              >
                查看在库明细
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenInboundForPartner(manager.partner.id)}
              >
                <PackagePlus strokeWidth={1.75} className="w-3.5 h-3.5" />
                拿货入店
              </button>
            </span>
          </div>
        </section>
      )}

      {/* ══ 3 · 名册主表 ══ */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">合伙人名册</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                strokeWidth={1.6}
                className="w-3.5 h-3.5 text-text-3 absolute left-2.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索姓名 / 手机 / 级别"
                aria-label="搜索合伙人"
                className="field !min-h-9 !w-56 pl-8"
              />
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus strokeWidth={1.75} className="w-3.5 h-3.5" />
              登记新档案
            </button>
          </div>
        </div>

        <div className="ledger-wrap !border-0 !rounded-none max-h-[640px]">
          <table className="ledger">
            <thead>
              <tr>
                <th className="w-12 text-right">序号</th>
                <th className="min-w-[168px]">合伙人</th>
                <th className="min-w-[120px]">联系方式</th>
                <th className="text-right">在库件数</th>
                <th className="text-right">在库货值</th>
                <th className="min-w-[150px]">借调往来</th>
                <th className="text-right">累计出货</th>
                <th className="text-right">出货总额</th>
                <th className="w-[168px] text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((r, idx) => (
                <tr key={r.partner.id} className="group">
                  <td className="c-num c-code text-text-3">{String(idx + 1).padStart(2, '0')}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="w-6 h-6 grid place-items-center border border-border-2 bg-surface-2 shrink-0"
                      >
                        <span className="font-display text-xs leading-none text-text-2">
                          {r.name.charAt(0)}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm text-text truncate">{r.name}</span>
                        <span className="block text-2xs text-text-3 truncate">{r.role}</span>
                      </span>
                    </span>
                  </td>
                  <td className="c-code text-text-3">{r.partner.phone}</td>
                  <td className="c-num">
                    {r.inStockCount > 0 ? (
                      <>
                        <span className="num text-sm text-text">{r.inStockCount}</span>
                        <span className="text-2xs text-text-3 ml-0.5">件</span>
                      </>
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="c-num">
                    {r.inStockValue > 0 ? (
                      <span className="num-ledger text-text">
                        ¥{r.inStockValue.toLocaleString('zh-CN')}
                      </span>
                    ) : (
                      dash
                    )}
                  </td>
                  <td>
                    {r.borrowPending === 0 && r.lentPending === 0 ? (
                      dash
                    ) : (
                      <span className="flex flex-wrap items-center gap-1">
                        {r.borrowPending > 0 && (
                          <span className="tag tag-warn">
                            <CornerDownRight strokeWidth={1.75} className="w-3 h-3" />
                            借入待还 <span className="num">{r.borrowPending}</span>
                          </span>
                        )}
                        {r.lentPending > 0 && (
                          <span className="tag">
                            <ArrowUpRight strokeWidth={1.75} className="w-3 h-3" />
                            被借待还 <span className="num">{r.lentPending}</span>
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="c-num">
                    {r.salesCount > 0 ? (
                      <>
                        <span className="num text-sm text-text">{r.salesCount}</span>
                        <span className="text-2xs text-text-3 ml-0.5">笔</span>
                      </>
                    ) : (
                      dash
                    )}
                  </td>
                  <td className="c-num">
                    {r.salesRevenue > 0 ? (
                      <span className="num-ledger text-ok">
                        ¥{r.salesRevenue.toLocaleString('zh-CN')}
                      </span>
                    ) : (
                      dash
                    )}
                  </td>
                  <td>
                    <span className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onSelectPartnerForFilter(r.partner.id)}
                      >
                        在库明细
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenInboundForPartner(r.partner.id)}
                      >
                        拿货
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm text-text-3">
                    未匹配到合伙人，请调整搜索条件
                  </td>
                </tr>
              )}
            </tbody>
            {/* 账表必有合计行 */}
            <tfoot>
              <tr>
                <td />
                <td className="text-text-2">合计</td>
                <td />
                <td className="c-num text-text">
                  {totalCount} <span className="text-2xs text-text-3 font-normal">件</span>
                </td>
                <td className="c-num num-ledger text-text">
                  ¥{totalValue.toLocaleString('zh-CN')}
                </td>
                <td /> 
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ══ 4 · 登记新档案（八态齐全的表单弹窗） ══ */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="登记新合伙人档案"
        >
          <div className="modal-card w-full max-w-sm">
            <div className="modal-head">
              <h3 className="font-display text-lg text-text">登记新合伙人档案</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-quiet btn-sm"
                aria-label="关闭"
              >
                <X strokeWidth={1.75} className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="p-5 space-y-4">
              <div>
                <label className="label" htmlFor="np-name">
                  合伙人姓名
                </label>
                <input
                  id="np-name"
                  type="text"
                  required
                  placeholder="如：赵雅茹"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="np-phone">
                  手机号码
                </label>
                <input
                  id="np-phone"
                  type="tel"
                  required
                  placeholder="13800000000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="field num"
                />
              </div>

              <div>
                <label className="label" htmlFor="np-role">
                  合伙人等级 / 头衔
                </label>
                <select
                  id="np-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="field"
                >
                  <option value="核心合伙人">核心合伙人</option>
                  <option value="高级合伙人">高级合伙人</option>
                  <option value="荣誉合伙人">荣誉合伙人</option>
                  <option value="资深合伙人">资深合伙人</option>
                  <option value="城市合伙人">城市合伙人</option>
                </select>
              </div>

              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-seal">
                  确认登记
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
