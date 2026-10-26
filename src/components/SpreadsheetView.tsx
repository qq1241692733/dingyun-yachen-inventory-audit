import React, { useState, useEffect } from 'react';
import {
  InventoryItem,
  SaleOrder,
  Partner,
  Franchisee,
  BrandType,
  CategoryType,
  InventoryStatus,
} from '../types/inventory';
import {
  FileSpreadsheet,
  Save,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface SpreadsheetViewProps {
  items: InventoryItem[];
  salesOrders: SaleOrder[];
  partners: Partner[];
  franchisees: Franchisee[];
  onSyncAllData: (data: {
    items: InventoryItem[];
    salesOrders: SaleOrder[];
    partners: Partner[];
    franchisees: Franchisee[];
  }) => void;
  onShowToast: (msg: string, type?: 'success' | 'warning' | 'info') => void;
}

type SheetTab = 'ITEMS' | 'SALES' | 'PARTNERS' | 'FRANCHISEES';

/**
 * 库存明细表（ITEMS）支持的「按列筛选」维度。
 *
 * 为什么做在列头上而不是做成一个总的搜索框：这张表的使用者是习惯 Excel 的店主与长辈，
 * Excel 的筛选就是「点某一列 → 选一个值」；把下拉直接放在对应列头下面，不用教。
 * 选中的维度之间是 AND，与上方关键词搜索也是 AND。
 */
type ItemFilterKey = 'brand' | 'size' | 'color' | 'ownerPartnerId' | 'status';

const EMPTY_ITEM_FILTERS: Record<ItemFilterKey, string> = {
  brand: '',
  size: '',
  color: '',
  ownerPartnerId: '',
  status: '',
};

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  items,
  salesOrders,
  partners,
  franchisees,
  onSyncAllData,
  onShowToast,
}) => {
  const [activeSheet, setActiveSheet] = useState<SheetTab>('ITEMS');

  // Editable local copies of data in the spreadsheet
  const [sheetItems, setSheetItems] = useState<InventoryItem[]>([]);
  const [sheetSales, setSheetSales] = useState<SaleOrder[]>([]);
  const [sheetPartners, setSheetPartners] = useState<Partner[]>([]);
  const [sheetFranchisees, setSheetFranchisees] = useState<Franchisee[]>([]);

  // Selected cell / row for editing
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colKey: string;
  } | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('已是最新状态');

  /* ── 列筛选状态（仅 ITEMS 工作表） ── */
  const [itemFilters, setItemFilters] = useState<Record<ItemFilterKey, string>>(EMPTY_ITEM_FILTERS);

  /**
   * 可见行 → 真实行 的索引映射。
   *
   * ⚠️ 修掉一个真实存在的错行 bug：表格渲染的是 `filtered*`（搜索/筛选后的子集），
   * 而单元格编辑与删除写的是 `sheet*[index]`（全量数组）。原先把**可见下标**当成了
   * 全量下标 —— 只要检索框里有字，改第 1 行就会改到全量数据的第 1 行（完全不相干的记录）。
   * 现在统一用「id → 全量下标」解析出真实下标再传下去，可见下标只用于斑马纹与行号展示。
   */
  const itemIndexById = React.useMemo(
    () => new Map(sheetItems.map((it, i) => [it.id, i])),
    [sheetItems]
  );
  const saleIndexById = React.useMemo(
    () => new Map(sheetSales.map((s, i) => [s.id, i])),
    [sheetSales]
  );
  const partnerIndexById = React.useMemo(
    () => new Map(sheetPartners.map((p, i) => [p.id, i])),
    [sheetPartners]
  );
  const franchiseeIndexById = React.useMemo(
    () => new Map(sheetFranchisees.map((f, i) => [f.id, i])),
    [sheetFranchisees]
  );

  const setItemFilter = (key: ItemFilterKey, value: string) => {
    setItemFilters((prev) => ({ ...prev, [key]: value }));
    setSelectedRowIndex(null);
  };

  const activeItemFilterCount = Object.values(itemFilters).filter(Boolean).length;

  // Initialize from parent props
  useEffect(() => {
    setSheetItems(JSON.parse(JSON.stringify(items)));
    setSheetSales(JSON.parse(JSON.stringify(salesOrders)));
    setSheetPartners(JSON.parse(JSON.stringify(partners)));
    setSheetFranchisees(JSON.parse(JSON.stringify(franchisees)));
  }, [items, salesOrders, partners, franchisees]);

  // Handle cell edit for Inventory Items
  const handleItemCellChange = (
    index: number,
    field: keyof InventoryItem,
    value: any
  ) => {
    setSheetItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  // Handle cell edit for Sales
  const handleSalesCellChange = (
    index: number,
    field: keyof SaleOrder,
    value: any
  ) => {
    setSheetSales((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  // Handle cell edit for Partners
  const handlePartnerCellChange = (
    index: number,
    field: keyof Partner,
    value: any
  ) => {
    setSheetPartners((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  // Handle cell edit for Franchisees
  const handleFranchiseeCellChange = (
    index: number,
    field: keyof Franchisee,
    value: any
  ) => {
    setSheetFranchisees((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    setHasUnsavedChanges(true);
  };

  // Add new row to active sheet
  const handleAddNewRow = () => {
    const timestamp = Date.now();
    const dateStr = new Date().toISOString().slice(0, 10);

    if (activeSheet === 'ITEMS') {
      const newItem: InventoryItem = {
        id: `item-${timestamp}`,
        barcode: `SNLW${timestamp.toString().slice(-6)}`,
        productId: 'prod-custom',
        productName: '蕾薇尔 塑身衣 (新录入)',
        brand: '蕾薇尔',
        category: '美体内衣',
        size: '76',
        color: '黑色',
        price: 3880,
        ownerPartnerId: partners[0]?.id || 'p-01',
        ownerPartnerName: partners[0]?.name || '付蓉 (店长)',
        entryDate: `${dateStr} 10:00`,
        entryOperator: '付蓉 (店长)',
        status: 'AVAILABLE',
      };
      setSheetItems([newItem, ...sheetItems]);
      setSelectedRowIndex(0);
      setHasUnsavedChanges(true);
      onShowToast('已在表格第 1 行插入新行，请直接在单元格中修改。', 'info');
    } else if (activeSheet === 'SALES') {
      const newSale: SaleOrder = {
        id: `SO-${timestamp.toString().slice(-6)}`,
        inventoryItemId: `item-${timestamp}`,
        barcode: `SNLK${timestamp.toString().slice(-6)}`,
        productName: 'Laca 美体内衣 (新销售)',
        brand: 'Laca',
        category: '美体内衣',
        size: '76',
        color: '黑色',
        price: 4280,
        dealPrice: 4280,
        ownerPartnerId: partners[0]?.id || 'p-01',
        ownerPartnerName: partners[0]?.name || '付蓉 (店长)',
        sellerPartnerId: partners[0]?.id || 'p-01',
        sellerPartnerName: partners[0]?.name || '付蓉 (店长)',
        saleDate: `${dateStr} 15:00`,
        isCrossPartnerBorrow: false,
        managerSignature: '付蓉',
        sellerSignature: partners[0]?.name || '付蓉',
        managerName: '付蓉 (店长)',
        remarks: '电子表格直接录入',
      };
      setSheetSales([newSale, ...sheetSales]);
      setSelectedRowIndex(0);
      setHasUnsavedChanges(true);
      onShowToast('已插入销售记录新行。', 'info');
    } else if (activeSheet === 'PARTNERS') {
      const newPartner: Partner = {
        id: `p-${timestamp.toString().slice(-4)}`,
        name: '新合伙人姓名',
        phone: '13800000000',
        role: '合伙人',
        joinDate: dateStr,
      };
      setSheetPartners([...sheetPartners, newPartner]);
      setSelectedRowIndex(sheetPartners.length);
      setHasUnsavedChanges(true);
      onShowToast('已在表格末尾追加新合伙人记录。', 'info');
    } else if (activeSheet === 'FRANCHISEES') {
      const newFranchisee: Franchisee = {
        id: `F-${timestamp.toString().slice(-4)}`,
        name: '新加盟负责人',
        phone: '13900000000',
        teamName: '卓越会所体系',
        rentAmount: 4000,
        paymentDate: dateStr,
        expireDate: `${parseInt(dateStr.slice(0, 4)) + 1}-09-30`,
        status: 'NORMAL',
        notes: '电子表格手工录入',
      };
      setSheetFranchisees([...sheetFranchisees, newFranchisee]);
      setSelectedRowIndex(sheetFranchisees.length);
      setHasUnsavedChanges(true);
      onShowToast('已在表格末尾追加新加盟商记录。', 'info');
    }
  };

  // Delete selected row
  const handleDeleteRow = () => {
    if (selectedRowIndex === null) {
      onShowToast('请先点击选中您要删除的行。', 'warning');
      return;
    }

    if (activeSheet === 'ITEMS') {
      const itemToDelete = sheetItems[selectedRowIndex];
      if (!window.confirm(`确定删除第 ${selectedRowIndex + 1} 行【${itemToDelete?.productName || '此条记录'}】吗？`)) {
        return;
      }
      setSheetItems(sheetItems.filter((_, idx) => idx !== selectedRowIndex));
    } else if (activeSheet === 'SALES') {
      setSheetSales(sheetSales.filter((_, idx) => idx !== selectedRowIndex));
    } else if (activeSheet === 'PARTNERS') {
      setSheetPartners(sheetPartners.filter((_, idx) => idx !== selectedRowIndex));
    } else if (activeSheet === 'FRANCHISEES') {
      setSheetFranchisees(sheetFranchisees.filter((_, idx) => idx !== selectedRowIndex));
    }

    setSelectedRowIndex(null);
    setEditingCell(null);
    setHasUnsavedChanges(true);
    onShowToast('行记录已删除，请点击【保存并同步系统】使其生效。', 'info');
  };

  // Save and synchronize to parent state & localStorage
  const handleSaveAndSync = () => {
    onSyncAllData({
      items: sheetItems,
      salesOrders: sheetSales,
      partners: sheetPartners,
      franchisees: sheetFranchisees,
    });
    setHasUnsavedChanges(false);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setLastSavedTime(`已于 ${timeStr} 成功同步`);
    onShowToast('✅ 表格修改已成功保存并同步！全系统库存、合伙人货值及动态看板已实时更新。', 'success');
  };

  // Reset to initial props
  const handleReset = () => {
    if (window.confirm('确定放弃未保存的表格修改并重置吗？')) {
      setSheetItems(JSON.parse(JSON.stringify(items)));
      setSheetSales(JSON.parse(JSON.stringify(salesOrders)));
      setSheetPartners(JSON.parse(JSON.stringify(partners)));
      setSheetFranchisees(JSON.parse(JSON.stringify(franchisees)));
      setHasUnsavedChanges(false);
      setEditingCell(null);
      setSelectedRowIndex(null);
      onShowToast('已还原为系统现有数据。', 'info');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // BOM for Excel Chinese UTF-8 support

    if (activeSheet === 'ITEMS') {
      csvContent += '序号,条码,商品名称,品牌,品类,尺码,颜色,单价(元),货权归属合伙人,入库经办人,在库状态,入库时间\n';
      sheetItems.forEach((item, idx) => {
        csvContent += `"${idx + 1}","${item.barcode}","${item.productName}","${item.brand}","${item.category}","${item.size}","${item.color || ''}","${item.price}","${item.ownerPartnerName}","${item.entryOperator}","${item.status === 'AVAILABLE' ? '在库' : '已出库'}","${item.entryDate}"\n`;
      });
    } else if (activeSheet === 'SALES') {
      csvContent += '序号,单号,条码,商品名称,品牌,尺码,成交单价(元),销售合伙人,原货权人,是否借调,还货状态,店长签名,销售签名,出库时间\n';
      sheetSales.forEach((s, idx) => {
        csvContent += `"${idx + 1}","${s.id}","${s.barcode}","${s.productName}","${s.brand}","${s.size}","${s.dealPrice}","${s.sellerPartnerName}","${s.ownerPartnerName}","${s.isCrossPartnerBorrow ? '是' : '否'}","${s.returnStatus || '无需还货'}","${s.managerName}","${s.sellerPartnerName}","${s.saleDate}"\n`;
      });
    } else if (activeSheet === 'PARTNERS') {
      csvContent += '序号,合伙人姓名,联系电话,身份角色,入会时间\n';
      sheetPartners.forEach((p, idx) => {
        csvContent += `"${idx + 1}","${p.name}","${p.phone}","${p.role}","${p.joinDate}"\n`;
      });
    } else if (activeSheet === 'FRANCHISEES') {
      csvContent += '序号,加盟负责人,联系电话,所属体系/团队,年费/租金(元),缴费时间,到期时间,状态\n';
      sheetFranchisees.forEach((f, idx) => {
        csvContent += `"${idx + 1}","${f.name}","${f.phone}","${f.teamName}","${f.rentAmount}","${f.paymentDate}","${f.expireDate}","${f.status || 'NORMAL'}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `鼎运雅辰体验中心_${activeSheet === 'ITEMS' ? '库存明细' : activeSheet === 'SALES' ? '销售账单' : activeSheet === 'PARTNERS' ? '合伙人名册' : '加盟商房租'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('表格文件已下载，可直接用电脑 Excel 或 WPS 打开。', 'success');
  };

  // Filtered lists based on search + column filters
  const filteredItems = sheetItems.filter((i) => {
    if (itemFilters.brand && i.brand !== itemFilters.brand) return false;
    if (itemFilters.size && i.size !== itemFilters.size) return false;
    if (itemFilters.color && (i.color || '') !== itemFilters.color) return false;
    if (itemFilters.ownerPartnerId && i.ownerPartnerId !== itemFilters.ownerPartnerId) return false;
    if (itemFilters.status && i.status !== itemFilters.status) return false;

    if (!searchKeyword.trim()) return true;
    const q = searchKeyword.toLowerCase();
    return (
      i.productName.toLowerCase().includes(q) ||
      i.barcode.toLowerCase().includes(q) ||
      i.brand.toLowerCase().includes(q) ||
      i.ownerPartnerName.toLowerCase().includes(q) ||
      i.size.toLowerCase().includes(q)
    );
  });

  /**
   * 各筛选列的候选项从**当前数据里现算**（而不是写死枚举），
   * 这样导入新库存后下拉会自动跟上，也不会出现「选了却一条都筛不出来」的空选项。
   * 货主列优先用数据里真实出现过的 ownerPartnerId/Name 组合。
   */
  const itemFilterOptions = React.useMemo(() => {
    const uniq = (arr: string[]) => [...new Set(arr)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const ownerMap = new Map<string, string>();
    sheetItems.forEach((i) => {
      if (i.ownerPartnerId) ownerMap.set(i.ownerPartnerId, i.ownerPartnerName || i.ownerPartnerId);
    });
    return {
      brand: uniq(sheetItems.map((i) => i.brand)),
      size: uniq(sheetItems.map((i) => i.size)),
      color: uniq(sheetItems.map((i) => i.color || '')),
      owner: [...ownerMap.entries()].map(([value, label]) => ({ value, label })),
      status: [
        { value: 'AVAILABLE', label: '在库 (AVAILABLE)' },
        { value: 'SOLD', label: '已售出 (SOLD)' },
      ],
    };
  }, [sheetItems]);

  const filteredSales = sheetSales.filter((s) => {
    if (!searchKeyword.trim()) return true;
    const q = searchKeyword.toLowerCase();
    return (
      s.productName.toLowerCase().includes(q) ||
      s.barcode.toLowerCase().includes(q) ||
      s.sellerPartnerName.toLowerCase().includes(q) ||
      s.ownerPartnerName.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  const filteredPartners = sheetPartners.filter((p) => {
    if (!searchKeyword.trim()) return true;
    const q = searchKeyword.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.phone.includes(q) || p.role.includes(q);
  });

  const filteredFranchisees = sheetFranchisees.filter((f) => {
    if (!searchKeyword.trim()) return true;
    const q = searchKeyword.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.teamName.toLowerCase().includes(q) ||
      f.phone.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* 使用指引 —— 朱砂左规线，与全站「制度条」同构，不做为大卡片 */}
      <aside className="border-l-2 border-accent pl-4 py-0.5 flex flex-col sm:flex-row sm:items-start justify-between gap-x-6 gap-y-3 rise rise-1">
        <div className="min-w-0 max-w-[78ch]">
          <p className="text-sm text-text leading-normal">
            <FileSpreadsheet
              strokeWidth={1.75}
              className="w-4 h-4 inline-block mr-1.5 -mt-0.5 text-accent"
            />
            <strong className="font-medium">原始电子表格模式（Excel 多工作表）</strong>
            <span className="tag tag-seal ml-2 align-middle">专为习惯表格的长辈设计</span>
          </p>
          <p className="text-xs text-text-2 mt-1 leading-normal">
            支持<strong className="font-medium">直接点击单元格修改内容</strong>、添加或删除记录。修改后点击右侧
            <strong className="text-accent-strong">【保存并同步全系统】</strong>
            ，数据库、统计看板及出入库流水将立即全量同步更新。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveAndSync}
            disabled={!hasUnsavedChanges}
            className={`btn ${hasUnsavedChanges ? 'btn-seal' : ''} shrink-0`}
          >
            <Save strokeWidth={1.75} className="w-4 h-4" />
            {hasUnsavedChanges ? '保存并同步全系统' : '已全部同步'}
          </button>
        </div>
      </aside>

      {/* Spreadsheet Main Container */}
      <div className="panel overflow-hidden rise rise-2">
        {/* Top Excel Ribbon Toolbar */}
        <div className="px-3 py-2.5 border-b border-border-2 flex flex-wrap items-center justify-between gap-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={handleAddNewRow} className="btn btn-sm">
              <Plus strokeWidth={1.75} className="w-3.5 h-3.5 text-ok" />
              新增一行
            </button>

            <button
              type="button"
              onClick={handleDeleteRow}
              disabled={selectedRowIndex === null}
              className="btn btn-sm btn-danger"
            >
              <Trash2 strokeWidth={1.75} className="w-3.5 h-3.5" />
              删除选中行{selectedRowIndex !== null ? `（第 ${selectedRowIndex + 1} 行）` : ''}
            </button>

            <button type="button" onClick={handleExportCSV} className="btn btn-sm">
              <Download strokeWidth={1.75} className="w-3.5 h-3.5" />
              导出当前工作表
            </button>

            {hasUnsavedChanges && (
              <button type="button" onClick={handleReset} className="btn btn-sm btn-quiet">
                <RotateCcw strokeWidth={1.75} className="w-3.5 h-3.5" />
                放弃修改并重置
              </button>
            )}
          </div>

          {/* Search box & Status */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                strokeWidth={1.75}
                className="w-3.5 h-3.5 text-text-3 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="在当前表格中检索…"
                aria-label="在当前表格中检索"
                className="field pl-8 w-44 sm:w-56"
              />
            </div>

            {activeSheet === 'ITEMS' && (activeItemFilterCount > 0 || searchKeyword.trim()) && (
              <div className="text-xs flex items-center gap-1.5 whitespace-nowrap">
                <span className="tag num">
                  <Filter strokeWidth={1.75} className="w-3 h-3" />
                  筛出 {filteredItems.length} / {sheetItems.length} 行
                </span>
                {activeItemFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemFilters(EMPTY_ITEM_FILTERS);
                      setSelectedRowIndex(null);
                    }}
                    className="btn btn-sm btn-quiet"
                  >
                    <RotateCcw strokeWidth={1.75} className="w-3 h-3" />
                    清除列筛选
                  </button>
                )}
              </div>
            )}

            <div className="text-xs flex items-center gap-1.5 whitespace-nowrap">
              {hasUnsavedChanges ? (
                <span className="tag tag-seal">
                  <AlertCircle strokeWidth={1.75} className="w-3 h-3" />
                  存在未同步修改
                </span>
              ) : (
                <span className="tag tag-ok">
                  <CheckCircle2 strokeWidth={1.75} className="w-3 h-3" />
                  {lastSavedTime}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Formula / Cell Bar */}
        <div className="px-3 py-2 bg-surface-2 border-b border-border text-xs flex flex-wrap items-center gap-x-3 gap-y-1 num text-text-2">
          <span className="shrink-0 text-text px-1.5 py-0.5 bg-surface border border-border-2">
            {editingCell
              ? `单元格 [行 ${editingCell.rowIndex + 1} · ${editingCell.colKey}]`
              : selectedRowIndex !== null
              ? `已选定第 ${selectedRowIndex + 1} 行`
              : '就绪（点击单元格可直接编辑）'}
          </span>
          <span className="text-2xs text-text-3">
            双击任意单元格即可修改，修改会自动暂存
          </span>
        </div>

        {/* Table Container with classic Excel gridlines */}
        <div className="overflow-x-auto max-h-[620px] divide-y divide-border">
          {/* SHEET 1: INVENTORY ITEMS */}
          {activeSheet === 'ITEMS' && (
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-surface-2 text-text-2 border-b border-border-2">
                  <th className="p-2.5 w-12 text-center border-r border-border-2 bg-surface-3 font-num">
                    #
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">A</span>
                    专属条码
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[170px]">
                    <span className="text-text-3 font-num font-normal mr-1">B</span>
                    商品名称
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[100px]">
                    <span className="text-text-3 font-num font-normal mr-1">C</span>
                    品牌
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[70px]">
                    <span className="text-text-3 font-num font-normal mr-1">D</span>
                    尺码规格
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[80px]">
                    <span className="text-text-3 font-num font-normal mr-1">E</span>
                    颜色/规格
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[90px]">
                    <span className="text-text-3 font-num font-normal mr-1">F</span>
                    单价 (¥)
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[120px]">
                    <span className="text-text-3 font-num font-normal mr-1">G</span>
                    货权归属合伙人
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">H</span>
                    入库经办人
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[90px]">
                    <span className="text-text-3 font-num font-normal mr-1">I</span>
                    在库状态
                  </th>
                  <th className="p-2.5 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">J</span>
                    入库交割时间
                  </th>
                </tr>

                {/* ── Excel 式「按列筛选」行 ──
                    下拉直接挂在对应列头下面：想只看某位合伙人的货，就在 G 列选他。
                    未开放筛选的列留空，保持表格网格对齐。 */}
                <tr className="bg-surface-3/70 border-b border-border-2">
                  <th className="p-1 text-center border-r border-border-2 bg-surface-3">
                    {activeItemFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setItemFilters(EMPTY_ITEM_FILTERS);
                          setSelectedRowIndex(null);
                        }}
                        title="清除全部列筛选"
                        className="inline-flex items-center gap-0.5 text-2xs text-accent-strong hover:underline font-num"
                      >
                        <Filter strokeWidth={1.75} className="w-3 h-3" />
                        {activeItemFilterCount}
                      </button>
                    ) : (
                      <Filter strokeWidth={1.75} className="w-3 h-3 text-text-3 inline-block" />
                    )}
                  </th>
                  <th className="p-1 border-r border-border-2" />
                  <th className="p-1 border-r border-border-2" />
                  <th className="p-1 border-r border-border-2">
                    <select
                      value={itemFilters.brand}
                      onChange={(e) => setItemFilter('brand', e.target.value)}
                      aria-label="按品牌筛选"
                      className="w-full px-1 py-0.5 bg-surface text-2xs text-text-2 border border-border-2 rounded"
                    >
                      <option value="">全部品牌</option>
                      {itemFilterOptions.brand.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1 border-r border-border-2">
                    <select
                      value={itemFilters.size}
                      onChange={(e) => setItemFilter('size', e.target.value)}
                      aria-label="按尺码规格筛选"
                      className="w-full px-1 py-0.5 bg-surface text-2xs text-text-2 border border-border-2 rounded"
                    >
                      <option value="">全部尺码</option>
                      {itemFilterOptions.size.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1 border-r border-border-2">
                    <select
                      value={itemFilters.color}
                      onChange={(e) => setItemFilter('color', e.target.value)}
                      aria-label="按颜色筛选"
                      className="w-full px-1 py-0.5 bg-surface text-2xs text-text-2 border border-border-2 rounded"
                    >
                      <option value="">全部颜色</option>
                      {itemFilterOptions.color.map((v) => (
                        <option key={v || '__none'} value={v}>
                          {v || '（无）'}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1 border-r border-border-2" />
                  <th className="p-1 border-r border-border-2">
                    <select
                      value={itemFilters.ownerPartnerId}
                      onChange={(e) => setItemFilter('ownerPartnerId', e.target.value)}
                      aria-label="按货权归属合伙人筛选"
                      className="w-full px-1 py-0.5 bg-surface text-2xs text-text-2 border border-border-2 rounded font-medium"
                    >
                      <option value="">全部合伙人</option>
                      {itemFilterOptions.owner.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1 border-r border-border-2" />
                  <th className="p-1 border-r border-border-2">
                    <select
                      value={itemFilters.status}
                      onChange={(e) => setItemFilter('status', e.target.value)}
                      aria-label="按在库状态筛选"
                      className="w-full px-1 py-0.5 bg-surface text-2xs text-text-2 border border-border-2 rounded"
                    >
                      <option value="">全部状态</option>
                      {itemFilterOptions.status.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="p-1" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-xs text-text-3">
                      当前筛选条件下没有匹配的库存行。可点击行首的筛选图标清除全部列筛选。
                    </td>
                  </tr>
                )}
                {filteredItems.map((item, visibleIdx) => {
                  // ⚠️ rowIdx 必须是**全量数组**里的真实下标：编辑与删除都写 sheetItems[rowIdx]
                  const rowIdx = itemIndexById.get(item.id) ?? visibleIdx;
                  const isSelected = selectedRowIndex === rowIdx;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRowIndex(rowIdx)}
                      className={`transition-colors hover:bg-accent-soft/40 ${
                        isSelected ? 'bg-accent-soft/60' : visibleIdx % 2 === 0 ? 'bg-surface' : 'bg-bg/50'
                      }`}
                    >
                      {/* Row index */}
                      <td className="p-2 text-center font-num text-text-3 bg-surface-2 border-r border-border-2 font-bold">
                        {rowIdx + 1}
                      </td>

                      {/* Barcode */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={item.barcode}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'barcode', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs font-semibold text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Product Name */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'productName', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-medium text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Brand */}
                      <td className="p-1 border-r border-border">
                        <select
                          value={item.brand}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'brand', e.target.value)
                          }
                          className="w-full px-1.5 py-1 bg-transparent text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded font-semibold"
                        >
                          <option value="蕾薇尔">蕾薇尔</option>
                          <option value="Laca">Laca</option>
                          <option value="悦己集">悦己集</option>
                          <option value="悦维膳">悦维膳</option>
                        </select>
                      </td>

                      {/* Size */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={item.size}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'size', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Color */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={item.color || ''}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'color', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent text-xs text-text-2 border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Price */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleItemCellChange(
                              rowIdx,
                              'price',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 bg-transparent font-num font-bold text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Owner Partner */}
                      <td className="p-1 border-r border-border">
                        <select
                          value={item.ownerPartnerId}
                          onChange={(e) => {
                            const p = partners.find((pt) => pt.id === e.target.value);
                            handleItemCellChange(rowIdx, 'ownerPartnerId', e.target.value);
                            if (p) {
                              handleItemCellChange(rowIdx, 'ownerPartnerName', p.name);
                            }
                          }}
                          className="w-full px-1.5 py-1 bg-transparent text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        >
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.role})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Operator */}
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={item.entryOperator}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'entryOperator', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent text-xs text-text-2 border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>

                      {/* Status */}
                      <td className="p-1 border-r border-border">
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'status', e.target.value)
                          }
                          className={`w-full px-1.5 py-1 text-xs font-bold border border-transparent hover:border-border-2 focus:bg-surface rounded ${
                            item.status === 'AVAILABLE'
                              ? 'text-ok bg-ok-soft'
                              : 'text-text-3 bg-surface-2'
                          }`}
                        >
                          <option value="AVAILABLE">在库 (AVAILABLE)</option>
                          <option value="SOLD">已售出 (SOLD)</option>
                        </select>
                      </td>

                      {/* Entry Date */}
                      <td className="p-1">
                        <input
                          type="text"
                          value={item.entryDate}
                          onChange={(e) =>
                            handleItemCellChange(rowIdx, 'entryDate', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text-2 border border-transparent hover:border-border-2 focus:bg-surface focus:border-accent rounded"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* SHEET 2: SALES ORDERS */}
          {activeSheet === 'SALES' && (
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-surface-2 text-text-2 border-b border-border-2">
                  <th className="p-2.5 w-12 text-center border-r border-border-2 bg-surface-3 font-num">
                    #
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[120px]">
                    <span className="text-text-3 font-num font-normal mr-1">A</span>
                    销售单号
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">B</span>
                    货品条码
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[160px]">
                    <span className="text-text-3 font-num font-normal mr-1">C</span>
                    商品名称
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[90px]">
                    <span className="text-text-3 font-num font-normal mr-1">D</span>
                    品牌
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[70px]">
                    <span className="text-text-3 font-num font-normal mr-1">E</span>
                    尺码
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[90px]">
                    <span className="text-text-3 font-num font-normal mr-1">F</span>
                    实收成交价 (¥)
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">G</span>
                    销售合伙人
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">H</span>
                    原货权人
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[100px]">
                    <span className="text-text-3 font-num font-normal mr-1">I</span>
                    借调状态
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">J</span>
                    店长核销签名
                  </th>
                  <th className="p-2.5 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">K</span>
                    出库时间
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSales.map((sale, visibleIdx) => {
                  const rowIdx = saleIndexById.get(sale.id) ?? visibleIdx;
                  const isSelected = selectedRowIndex === rowIdx;

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedRowIndex(rowIdx)}
                      className={`transition-colors hover:bg-accent-soft/40 ${
                        isSelected ? 'bg-accent-soft/60' : visibleIdx % 2 === 0 ? 'bg-surface' : 'bg-bg/50'
                      }`}
                    >
                      <td className="p-2 text-center font-num text-text-3 bg-surface-2 border-r border-border-2 font-bold">
                        {rowIdx + 1}
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={sale.id}
                          onChange={(e) =>
                            handleSalesCellChange(rowIdx, 'id', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={sale.barcode}
                          onChange={(e) =>
                            handleSalesCellChange(rowIdx, 'barcode', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={sale.productName}
                          onChange={(e) =>
                            handleSalesCellChange(rowIdx, 'productName', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border font-semibold text-text-2">
                        {sale.brand}
                      </td>
                      <td className="p-1 border-r border-border font-num">
                        {sale.size}
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="number"
                          value={sale.dealPrice}
                          onChange={(e) =>
                            handleSalesCellChange(
                              rowIdx,
                              'dealPrice',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 bg-transparent font-num font-bold text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border font-medium">
                        {sale.sellerPartnerName}
                      </td>
                      <td className="p-1 border-r border-border font-medium">
                        {sale.ownerPartnerName}
                      </td>
                      <td className="p-1 border-r border-border">
                        {sale.isCrossPartnerBorrow ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                              sale.returnStatus === 'RESOLVED'
                                ? 'bg-ok-soft text-ok'
                                : 'bg-accent-soft text-accent-strong'
                            }`}
                          >
                            {sale.returnStatus === 'RESOLVED' ? '已还货冲销' : '借调待还货'}
                          </span>
                        ) : (
                          <span className="text-text-3 text-xs">自有售出</span>
                        )}
                      </td>
                      <td className="p-1 border-r border-border text-text-2">
                        {sale.managerName}
                      </td>
                      <td className="p-1 font-num text-text-2">
                        {sale.saleDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* SHEET 3: PARTNERS ROSTER */}
          {activeSheet === 'PARTNERS' && (
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-surface-2 text-text-2 border-b border-border-2">
                  <th className="p-2.5 w-12 text-center border-r border-border-2 bg-surface-3 font-num">
                    #
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[100px]">
                    <span className="text-text-3 font-num font-normal mr-1">A</span>
                    合伙人ID
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">B</span>
                    合伙人姓名
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">C</span>
                    联系电话
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">D</span>
                    身份角色
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[120px]">
                    <span className="text-text-3 font-num font-normal mr-1">E</span>
                    加入日期
                  </th>
                  <th className="p-2.5 min-w-[140px]">
                    <span className="text-text-3 font-num font-normal mr-1">F</span>
                    当前在库保管件数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPartners.map((p, visibleIdx) => {
                  const rowIdx = partnerIndexById.get(p.id) ?? visibleIdx;
                  const isSelected = selectedRowIndex === rowIdx;
                  const inStockCount = sheetItems.filter(
                    (i) => i.ownerPartnerId === p.id && i.status === 'AVAILABLE'
                  ).length;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedRowIndex(rowIdx)}
                      className={`transition-colors hover:bg-accent-soft/40 ${
                        isSelected ? 'bg-accent-soft/60' : visibleIdx % 2 === 0 ? 'bg-surface' : 'bg-bg/50'
                      }`}
                    >
                      <td className="p-2 text-center font-num text-text-3 bg-surface-2 border-r border-border-2 font-bold">
                        {rowIdx + 1}
                      </td>
                      <td className="p-2 border-r border-border font-num text-text-3">
                        {p.id}
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            handlePartnerCellChange(rowIdx, 'name', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-bold text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={p.phone}
                          onChange={(e) =>
                            handlePartnerCellChange(rowIdx, 'phone', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text-2 border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <select
                          value={p.role}
                          onChange={(e) =>
                            handlePartnerCellChange(rowIdx, 'role', e.target.value)
                          }
                          className="w-full px-1.5 py-1 bg-transparent text-xs font-semibold text-text-2 border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        >
                          <option value="店长">店长 (付蓉)</option>
                          <option value="合伙人">合伙人</option>
                        </select>
                      </td>
                      <td className="p-1 border-r border-border font-num text-text-2">
                        {p.joinDate}
                      </td>
                      <td className="p-2 font-num font-bold text-text">
                        {inStockCount} 件在库
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* SHEET 4: FRANCHISEES & RENT */}
          {activeSheet === 'FRANCHISEES' && (
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-surface-2 text-text-2 border-b border-border-2">
                  <th className="p-2.5 w-12 text-center border-r border-border-2 bg-surface-3 font-num">
                    #
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[100px]">
                    <span className="text-text-3 font-num font-normal mr-1">A</span>
                    加盟商编号
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">B</span>
                    负责人姓名
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[130px]">
                    <span className="text-text-3 font-num font-normal mr-1">C</span>
                    联系电话
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[150px]">
                    <span className="text-text-3 font-num font-normal mr-1">D</span>
                    所属团队/会所体系
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[110px]">
                    <span className="text-text-3 font-num font-normal mr-1">E</span>
                    会所房租/年费(¥)
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[120px]">
                    <span className="text-text-3 font-num font-normal mr-1">F</span>
                    缴费日期
                  </th>
                  <th className="p-2.5 border-r border-border-2 min-w-[120px]">
                    <span className="text-text-3 font-num font-normal mr-1">G</span>
                    到期日期
                  </th>
                  <th className="p-2.5 min-w-[100px]">
                    <span className="text-text-3 font-num font-normal mr-1">H</span>
                    缴纳状态
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFranchisees.map((f, visibleIdx) => {
                  const rowIdx = franchiseeIndexById.get(f.id) ?? visibleIdx;
                  const isSelected = selectedRowIndex === rowIdx;

                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedRowIndex(rowIdx)}
                      className={`transition-colors hover:bg-accent-soft/40 ${
                        isSelected ? 'bg-accent-soft/60' : visibleIdx % 2 === 0 ? 'bg-surface' : 'bg-bg/50'
                      }`}
                    >
                      <td className="p-2 text-center font-num text-text-3 bg-surface-2 border-r border-border-2 font-bold">
                        {rowIdx + 1}
                      </td>
                      <td className="p-2 border-r border-border font-num text-text-3">
                        {f.id}
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={f.name}
                          onChange={(e) =>
                            handleFranchiseeCellChange(rowIdx, 'name', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-bold text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={f.phone}
                          onChange={(e) =>
                            handleFranchiseeCellChange(rowIdx, 'phone', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent font-num text-xs text-text-2 border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="text"
                          value={f.teamName}
                          onChange={(e) =>
                            handleFranchiseeCellChange(rowIdx, 'teamName', e.target.value)
                          }
                          className="w-full px-2 py-1 bg-transparent text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="number"
                          value={f.rentAmount}
                          onChange={(e) =>
                            handleFranchiseeCellChange(
                              rowIdx,
                              'rentAmount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 bg-transparent font-num font-bold text-xs text-text border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-1 border-r border-border font-num text-text-2">
                        {f.paymentDate}
                      </td>
                      <td className="p-1 border-r border-border">
                        <input
                          type="date"
                          value={f.expireDate}
                          onChange={(e) =>
                            handleFranchiseeCellChange(rowIdx, 'expireDate', e.target.value)
                          }
                          className="w-full px-1.5 py-1 bg-transparent font-num text-xs font-bold text-accent-strong border border-transparent hover:border-border-2 focus:bg-surface rounded"
                        />
                      </td>
                      <td className="p-2 font-semibold">
                        <span className="tag tag-ok">
                          正常有效
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Sheet Navigation Tabs (Classic Excel Style) */}
        <div className="bg-surface-2 border-t border-border-2 px-2 py-1 flex items-center gap-1 overflow-x-auto">
          <span className="text-xs font-bold text-text-2 px-2 font-num">
            工作表:
          </span>

          <button
            onClick={() => {
              setActiveSheet('ITEMS');
              setSelectedRowIndex(null);
            }}
            className={`px-3 py-1.5 rounded-t-xs text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSheet === 'ITEMS'
                ? 'bg-surface text-text border-t-2 border-t-accent shadow-raise'
                : 'text-text-2 hover:bg-surface-3 hover:text-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-ok" />
            Sheet 1: 库存实物明细账 ({sheetItems.length}件)
          </button>

          <button
            onClick={() => {
              setActiveSheet('SALES');
              setSelectedRowIndex(null);
            }}
            className={`px-3 py-1.5 rounded-t-xs text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSheet === 'SALES'
                ? 'bg-surface text-text border-t-2 border-t-accent shadow-raise'
                : 'text-text-2 hover:bg-surface-3 hover:text-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-spine-3" />
            Sheet 2: 销售出库双签记录 ({sheetSales.length}笔)
          </button>

          <button
            onClick={() => {
              setActiveSheet('PARTNERS');
              setSelectedRowIndex(null);
            }}
            className={`px-3 py-1.5 rounded-t-xs text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSheet === 'PARTNERS'
                ? 'bg-surface text-text border-t-2 border-t-accent shadow-raise'
                : 'text-text-2 hover:bg-surface-3 hover:text-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-accent" />
            Sheet 3: 合伙人名册 ({sheetPartners.length} 人)
          </button>

          <button
            onClick={() => {
              setActiveSheet('FRANCHISEES');
              setSelectedRowIndex(null);
            }}
            className={`px-3 py-1.5 rounded-t-xs text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeSheet === 'FRANCHISEES'
                ? 'bg-surface text-text border-t-2 border-t-accent shadow-raise'
                : 'text-text-2 hover:bg-surface-3 hover:text-text'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-spine-3" />
            Sheet 4: 加盟商与房租账目 ({sheetFranchisees.length}家)
          </button>
        </div>
      </div>
    </div>
  );
};
