import React, { useState, useMemo } from 'react';
import { InventoryItem, Partner } from '../types/inventory';
import { groupItemsForLedger, type LedgerGroup } from '../utils/ledgerGrouping';
import {
  Search,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSmall,
  Shirt,
  Layers,
} from 'lucide-react';

interface InventoryListTableProps {
  items: InventoryItem[];
  partners: Partner[];
  onSellItem: (item: InventoryItem) => void;
  selectedPartnerFilter: string;
  onSelectPartnerFilter: (id: string) => void;
  selectedBrandFilter: string;
  onSelectBrandFilter: (brand: string) => void;
  /** 正在试衣间的库存编号，用于行内标记 */
  fittingItemIds?: string[];
  /** 已登记成交意向（待双人签字）的库存编号：这些货仍在库，只是即将出库 */
  pendingItemIds?: string[];
  onTakeForFitting?: (item: InventoryItem) => void;
  onViewFitting?: () => void;
}

/** 合并后的一个「型号 × 货主」行 —— 结构与归并规则的权威定义在 `utils/ledgerGrouping.ts` */
type ItemGroup = LedgerGroup;

/* Hallmark · macrostructure: Register（台账 · 型号登记册）· theme: Bound Ledger
 * 结构指纹：一行筛选工具条（非卡片围栏）→ 型号册数摘要抬头 → 逐型号登记明细表（表尾合计在库货值）→ 分页页脚。
 * 与其余视图的差别：本页是全站唯一的「型号级」明细册；其余视图都是聚合视角。
 *
 * V3.3 变化（业主反馈）：
 *   同一货主的同一型号原先是**逐件一行**，252 件货里同款重复铺满好几屏。
 *   现改为按「货主 + 型号(+状态)」合并成一行，新增【数量】列，
 *   并去掉主行里的【入库时间】（信息量大、且对「这一款有几件」这个提问没帮助）。
 *   逐件条码仍可展开查看 —— 审计要能追到具体哪一件，所以不丢，只是收起来。
 */
export const InventoryListTable: React.FC<InventoryListTableProps> = ({
  items,
  partners,
  onSellItem,
  selectedPartnerFilter,
  onSelectPartnerFilter,
  selectedBrandFilter,
  onSelectBrandFilter,
  fittingItemIds = [],
  pendingItemIds = [],
  onTakeForFitting,
  onViewFitting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('AVAILABLE');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  /** 一页展示多少个「型号」，而不是多少件 */
  const pageSize = 20;

  /** 试衣中的库存编号集合：这些货仍在库（status 未变），只是人不在货架上 */
  const fittingSet = useMemo(() => new Set(fittingItemIds), [fittingItemIds]);
  /** 已登记成交意向（待双签）的库存编号集合：货仍在库，只是即将出库 */
  const pendingSet = useMemo(() => new Set(pendingItemIds), [pendingItemIds]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.barcode.toLowerCase().includes(q) ||
          item.productName.toLowerCase().includes(q) ||
          item.size.toLowerCase().includes(q) ||
          item.ownerPartnerName.toLowerCase().includes(q) ||
          (item.soldByPartnerName && item.soldByPartnerName.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (selectedPartnerFilter && item.ownerPartnerId !== selectedPartnerFilter) return false;
      if (selectedBrandFilter && item.brand !== selectedBrandFilter) return false;
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedStatus && selectedStatus !== 'ALL') {
        if (selectedStatus === 'AVAILABLE' && item.status !== 'AVAILABLE') return false;
        if (selectedStatus === 'SOLD' && item.status === 'AVAILABLE') return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedPartnerFilter, selectedBrandFilter, selectedCategory, selectedStatus]);

  /**
   * 合并成「货主 + 型号」行。
   * ⭐ 归并键的权威定义在 `utils/ledgerGrouping.ts` —— 任何需要
   * 「同货主同型号算一个」的地方都必须复用它，不得在此处另拼一套键。
   */
  const groups = useMemo<ItemGroup[]>(
    () => groupItemsForLedger(filteredItems, fittingSet),
    [filteredItems, fittingSet],
  );

  const totalPages = Math.ceil(groups.length / pageSize) || 1;
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groups.slice(start, start + pageSize);
  }, [groups, currentPage]);

  const pageValue = paginatedGroups.reduce((a, g) => a + g.value, 0);
  const pageCount = paginatedGroups.reduce((a, g) => a + g.count, 0);
  const availableCount = filteredItems.filter((i) => i.status === 'AVAILABLE').length;
  const availableValue = filteredItems
    .filter((i) => i.status === 'AVAILABLE')
    .reduce((a, i) => a + i.price, 0);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExportCSV = () => {
    // 导出仍按**逐件**一行 —— 导出物是给财务/审计对条码用的，合并会丢可追溯性
    const headers = ['货品条码', '品牌', '品类', '商品名称', '规格/尺码', '颜色', '单价', '数量', '货权归属合伙人', '拿来入库时间', '在库状态', '销售人', '售出时间', '是否借调', '预计还货时间'];
    const rows = filteredItems.map((i) => [
      i.barcode,
      i.brand,
      i.category,
      i.productName,
      i.size,
      i.color || '-',
      i.price,
      1,
      i.ownerPartnerName,
      i.entryDate,
      i.status === 'AVAILABLE' ? '在库' : '已售出',
      i.soldByPartnerName || '-',
      i.soldDate || '-',
      i.isBorrowedSale ? '是(跨人借调)' : '否',
      i.expectedReturnDate || '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `门店库存审计表_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetPage = () => setCurrentPage(1);

  return (
    <section className="panel rise rise-1">
      {/* ══ 1 · 台账抬头：筛选工具条 + 册数摘要 ══ */}
      <div className="panel-head flex-col !items-stretch gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 w-full">
          <div className="relative flex-1 min-w-0">
            <Search
              strokeWidth={1.75}
              className="w-4 h-4 text-text-3 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              placeholder="搜索条码、商品品名、尺码（如 76 / 75B / 30mL）或合伙人姓名"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="field pl-9"
              aria-label="搜索库存"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                resetPage();
              }}
              className="field !w-auto num"
              aria-label="状态筛选"
            >
              <option value="AVAILABLE">状态：仅看在库实物</option>
              <option value="SOLD">状态：仅看已售出出库</option>
              <option value="ALL">状态：全部库存记录</option>
            </select>

            <select
              value={selectedPartnerFilter}
              onChange={(e) => {
                onSelectPartnerFilter(e.target.value);
                resetPage();
              }}
              className="field !w-auto max-w-[168px]"
              aria-label="合伙人筛选"
            >
              <option value="">全部合伙人货权</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={selectedBrandFilter}
              onChange={(e) => {
                onSelectBrandFilter(e.target.value);
                resetPage();
              }}
              className="field !w-auto"
              aria-label="品牌筛选"
            >
              <option value="">全部品牌</option>
              <option value="蕾薇尔">蕾薇尔</option>
              <option value="Laca">Laca（拉卡）</option>
              <option value="悦己集">悦己集</option>
              <option value="悦维膳">悦维膳</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                resetPage();
              }}
              className="field !w-auto"
              aria-label="品类筛选"
            >
              <option value="">全部品类</option>
              <option value="美体内衣">美体内衣</option>
              <option value="运动套装">运动套装</option>
              <option value="精油护肤">精油护肤</option>
              <option value="营养健康">营养健康</option>
            </select>

            <button type="button" onClick={handleExportCSV} className="btn shrink-0">
              <Download strokeWidth={1.75} className="w-3.5 h-3.5" />
              导出表格
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 w-full pt-1 border-t border-border">
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xs text-text-3">符合条件</span>
            <span className="num-ledger text-base text-text">{filteredItems.length}</span>
            <span className="text-2xs text-text-3">件</span>
            <span className="text-2xs text-text-3">
              · 合并为 <span className="num text-text-2">{groups.length}</span> 个型号
            </span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xs text-text-3">其中在库</span>
            <span className="num-ledger text-base text-ok">{availableCount}</span>
            <span className="text-2xs text-text-3">件</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xs text-text-3">在库指导货值</span>
            <span className="num-ledger text-base text-accent-strong">
              ¥{availableValue.toLocaleString('zh-CN')}
            </span>
          </span>
          {selectedPartnerFilter && (
            <span className="tag tag-seal ml-auto">已锁定特定合伙人货权</span>
          )}
          <span className="text-2xs text-text-3 ml-auto num">
            第 {currentPage} / {totalPages} 页
          </span>
        </div>
      </div>

      {/* ══ 2 · 型号级登记明细 ══ */}
      <div className="ledger-wrap border-0 rounded-none">
        <table className="ledger">
          <thead>
            <tr>
              <th>货品条码</th>
              <th>商品全称 / 品牌</th>
              <th>尺码 / 规格</th>
              <th>颜色</th>
              <th className="text-right">零售指导价</th>
              <th className="text-right">数量</th>
              <th>货权归属</th>
              <th className="text-center">状态</th>
              <th className="text-right">出入库审计流转</th>
            </tr>
          </thead>

          <tbody>
            {paginatedGroups.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-text-3 py-14">
                  未匹配到相关库存条目，请调整搜索关键词或重置筛选条件
                </td>
              </tr>
            ) : (
              paginatedGroups.map((group) => {
                const item = group.sample;
                const isAvailable = item.status === 'AVAILABLE';
                const isFitting = group.fittingCount > 0;
                const isOpen = expandedKeys.has(group.key);
                const multi = group.count > 1;
                // 动作作用于组内第一件可操作的货品（同货主同型号的件彼此等价）
                const firstSellable = group.pieces.find((p) => p.status === 'AVAILABLE');
                const firstTakable =
                  group.pieces.find((p) => p.status === 'AVAILABLE' && !fittingSet.has(p.id)) ||
                  firstSellable;

                return (
                  <React.Fragment key={group.key}>
                    <tr>
                      <td className="c-code text-text-3 whitespace-nowrap">
                        {multi && isAvailable ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(group.key)}
                            title={`展开查看 ${group.count} 个条码`}
                            className="inline-flex items-center gap-1 text-accent-strong hover:underline"
                          >
                            {isOpen ? (
                              <ChevronDown strokeWidth={1.75} className="w-3 h-3 shrink-0" />
                            ) : (
                              <ChevronRightSmall strokeWidth={1.75} className="w-3 h-3 shrink-0" />
                            )}
                            <span className="text-text-3">{item.barcode}</span>
                            <span className="text-2xs">等 {group.count} 个</span>
                          </button>
                        ) : (
                          <span className="block">{item.barcode}</span>
                        )}
                      </td>

                      <td className="min-w-[190px]">
                        <span className="block text-text">{item.productName}</span>
                        <span className="flex items-center gap-1.5 mt-0.5">
                          <span className={`tag ${item.brand === '蕾薇尔' ? '' : 'tag-seal'}`}>
                            {item.brand}
                          </span>
                          <span className="text-2xs text-text-3">{item.category}</span>
                        </span>
                      </td>

                      <td className="c-code text-text-2 whitespace-nowrap">{item.size}</td>
                      <td className="text-text-2 whitespace-nowrap">{item.color || '—'}</td>
                      <td className="c-num">¥{item.price.toLocaleString('zh-CN')}</td>

                      <td className="c-num text-right whitespace-nowrap">
                        <span className="inline-flex items-baseline gap-1">
                          <span className="num-ledger text-base text-text">{group.count}</span>
                          <span className="text-2xs text-text-3">件</span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-surface-2 text-text-2 flex items-center justify-center text-2xs shrink-0">
                            {item.ownerPartnerName.slice(0, 1)}
                          </span>
                          <span className="text-text">{item.ownerPartnerName}</span>
                        </span>
                      </td>

                      <td className="text-center whitespace-nowrap">
                        {isAvailable && isFitting ? (
                          <button
                            type="button"
                            onClick={onViewFitting}
                            title="该型号有货正在试衣间，点击查看"
                            className="tag tag-seal cursor-pointer hover:brightness-[0.95]"
                          >
                            <Shirt strokeWidth={1.75} className="w-3 h-3" />
                            在库 · {group.fittingCount} 件试衣中
                          </button>
                        ) : isAvailable ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <span className="tag tag-ok">
                              <CheckCircle2 strokeWidth={1.75} className="w-3 h-3" />
                              在库实存
                            </span>
                            {pendingSet.has(item.id) && (
                              <span
                                className="tag"
                                title="客户已登记成交意向，等待电脑端双人电子签字出库；签字之前货品仍在库"
                              >
                                待签
                              </span>
                            )}
                          </span>
                        ) : item.isBorrowedSale ? (
                          <span className="tag tag-seal">
                            <Clock strokeWidth={1.75} className="w-3 h-3" />
                            借调售出待还
                          </span>
                        ) : (
                          <span className="tag">自有售出出库</span>
                        )}
                      </td>

                      <td className="text-right whitespace-nowrap">
                        {isAvailable ? (
                          <div className="inline-flex items-center gap-2">
                            {isFitting ? (
                              <button type="button" onClick={onViewFitting} className="btn btn-sm">
                                <Shirt strokeWidth={1.75} className="w-3.5 h-3.5" />
                                去试衣间处理
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onTakeForFitting?.(firstTakable || item)}
                                title={`作用于条码 ${(firstTakable || item).barcode}`}
                                className="btn btn-sm"
                              >
                                <Shirt strokeWidth={1.75} className="w-3.5 h-3.5" />
                                取去试衣
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSellItem(firstSellable || item)}
                              title={`作用于条码 ${(firstSellable || item).barcode}`}
                              className="btn btn-sm"
                            >
                              <ShoppingBag strokeWidth={1.75} className="w-3.5 h-3.5" />
                              发起出库销售
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right">
                            <span className="c-code text-text-3 block">售于 {item.soldDate}</span>
                            <span className="text-2xs text-text-2">
                              销售人 {item.soldByPartnerName}
                            </span>
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* 展开后的逐件条码：审计要能追到具体哪一件 */}
                    {isOpen && multi && (
                      <tr className="bg-surface-2/60">
                        <td colSpan={9} className="!py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Layers strokeWidth={1.75} className="w-3.5 h-3.5 text-text-3 shrink-0" />
                            <span className="text-2xs text-text-3 mr-1">
                              该型号 {group.count} 件条码：
                            </span>
                            {group.pieces.map((p) => {
                              const pFitting = fittingSet.has(p.id);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  disabled={pFitting || p.status !== 'AVAILABLE'}
                                  onClick={() => onTakeForFitting?.(p)}
                                  title={
                                    pFitting
                                      ? '该件正在试衣间'
                                      : p.status !== 'AVAILABLE'
                                      ? '该件已售出'
                                      : '点此把这一件取去试衣'
                                  }
                                  className={`c-code text-2xs px-1.5 py-0.5 border rounded ${
                                    pFitting
                                      ? 'border-accent text-accent-strong bg-accent-soft/40'
                                      : 'border-border-2 text-text-2 hover:border-accent hover:text-accent-strong'
                                  } disabled:cursor-default`}
                                >
                                  {p.barcode}
                                  {pFitting && ' ·試衣中'}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {paginatedGroups.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} className="text-text-2">
                  本页合计 · {paginatedGroups.length} 个型号
                </td>
                <td className="c-num text-right whitespace-nowrap">
                  <span className="num-ledger text-base text-text">{pageCount}</span>
                  <span className="text-2xs text-text-3"> 件</span>
                </td>
                <td colSpan={3} className="text-right c-num text-accent-strong">
                  本页货值 ¥{pageValue.toLocaleString('zh-CN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ══ 3 · 分页页脚 ══ */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <span className="text-2xs text-text-3 num">
            显示第 {(currentPage - 1) * pageSize + 1} –{' '}
            {Math.min(currentPage * pageSize, groups.length)} 个型号，共 {groups.length} 个型号（
            {filteredItems.length} 件）
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="btn btn-sm"
            >
              <ChevronLeft strokeWidth={1.75} className="w-3.5 h-3.5" />
              上一页
            </button>
            <span className="num text-2xs text-text-2 px-1">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-sm"
            >
              下一页
              <ChevronRight strokeWidth={1.75} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
