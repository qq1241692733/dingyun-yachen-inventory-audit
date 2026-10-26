export type BrandType = 'Laca' | '蕾薇尔' | '悦己集' | '悦维膳' | '古澜美';

export type CategoryType = '美体内衣' | '运动套装' | '精油护肤' | '营养健康';

// 加盟商房租续费凭证（双人电子签名）
export interface FranchiseeRenewalRecord {
  id: string;
  franchiseeId: string;
  franchiseeName: string;
  renewDate: string;
  amount: number;
  previousExpireDate: string;
  newExpireDate: string;
  managerName: string; // 付蓉
  managerSignature: string;
  franchiseeSignature: string;
  notes?: string;
}

// 加盟商（4000房租，全球2700+会所共享）
export interface Franchisee {
  id: string;
  name: string;
  phone: string;
  teamName: string; // 所属团队
  rentAmount: number; // 4000
  paymentDate: string; // 缴费日期 YYYY-MM-DD
  expireDate: string; // 到期日期 YYYY-MM-DD
  status?: 'NORMAL' | 'EXPIRING_SOON' | 'EXPIRED';
  notes?: string;
  avatarColor?: string;
  managerSignature?: string;
  franchiseeSignature?: string;
  renewalHistory?: FranchiseeRenewalRecord[];
}

export interface ProductCatalog {
  id: string;
  brand: BrandType;
  category: CategoryType;
  name: string;
  color?: string;
  regularSizes: string[];
  customSizes?: string[];
  price: number;
  customFee?: number;
  unit: string; // 件 / 瓶 / 套 / 盒 / 支
}

export type InventoryStatus = 'AVAILABLE' | 'SOLD' | 'BORROWED_SOLD' | 'RETURNED';

export interface Partner {
  id: string;
  name: string;
  phone: string;
  role: '店长' | '合伙人' | string;
  joinDate: string;
  avatarColor?: string;
}

export interface InventoryItem {
  id: string; // 唯一编号如 INV-202609-001
  barcode: string; // 条码
  productId: string;
  productName: string;
  brand: BrandType;
  category: CategoryType;
  color?: string;
  size: string; // 如 76, 75B, 30mL, S
  price: number;
  ownerPartnerId: string; // 货权归属合伙人
  ownerPartnerName: string;
  entryDate: string; // 拿来入库时间 YYYY-MM-DD HH:mm
  entryOperator: string; // 入库经办人
  status: InventoryStatus;
  
  // 售出信息 (若售出)
  soldDate?: string;
  soldByPartnerId?: string; // 销售者
  soldByPartnerName?: string;
  saleOrderId?: string;
  
  // 借货借调信息 (若售出的不是本人的货)
  isBorrowedSale?: boolean;
  expectedReturnDate?: string;
  returnStatus?: 'PENDING' | 'RESOLVED';
  actualReturnDate?: string;
  returnNotes?: string;
}

export interface SaleOrder {
  id: string; // 单号 SO-202609-001
  inventoryItemId: string;
  barcode: string;
  productName: string;
  brand: BrandType;
  category: CategoryType;
  color?: string;
  size: string;
  price: number;
  dealPrice: number;
  
  // 货权与销售人
  ownerPartnerId: string;
  ownerPartnerName: string;
  sellerPartnerId: string;
  sellerPartnerName: string;
  
  saleDate: string;
  
  // 借调信息
  isCrossPartnerBorrow: boolean; // 是否借了别人的货
  expectedReturnDate?: string; // 预计还货日期
  returnStatus?: 'PENDING' | 'RESOLVED';
  actualReturnDate?: string;
  
  // 双人电子签名
  managerSignature: string; // base64 canvas image
  sellerSignature: string; // base64 canvas image
  managerName: string;
  remarks?: string;
}

export type AuditType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface AuditItemCheck {
  productId: string;
  productName: string;
  brand: BrandType;
  size: string;
  color?: string;
  systemCount: number; // 系统在库数
  physicalCount: number; // 实盘在库数
  difference: number; // 差异 = physicalCount - systemCount
  notes?: string;
}

export interface AuditReport {
  id: string; // AUD-202609-001
  auditDate: string; // 盘点日期
  auditType: AuditType;
  isMandatoryMonthly: boolean; // 是否本月强制大盘
  totalSystemCount: number;
  totalPhysicalCount: number;
  discrepancyCount: number; // 差异件数
  status: 'COMPLETED' | 'DRAFT';
  inspectorName: string;
  managerName: string;
  inspectorSignature: string;
  managerSignature: string;
  summary: string;
  items: AuditItemCheck[];
  createdAt: string;
}

// 每日审计动态日志（树图与时间轴展示）
// 注意：试衣借出 / 归还 / 成交不属于审计事件（它们不改变账实差异），
// 所以走 activityFeed 的 ActivityKind，而不是塞进这里。
export type AuditLogEventType =
  | 'INBOUND' // 合伙人拿货入库
  | 'OUTBOUND_SALE' // 销售出库（双签）
  | 'CROSS_BORROW' // 跨人借调流转
  | 'RETURN_RESOLVED' // 借调还货冲销
  | 'INVENTORY_AUDIT' // 全盘/抽检审计清点（双签）
  | 'FRANCHISEE_RENEWAL'; // 加盟商房租续约（双签）

/* ────────────────────── 试衣（智能体接入的核心场景）────────────────────── */

export type FittingStatus = 'FITTING' | 'RETURNED' | 'PURCHASED';

/**
 * 试衣事件。
 *
 * ⚠️ 最关键的约定：试衣借出与归还 **绝不修改 InventoryItem.status**。
 * 客户试衣只是把货从货架拿到试衣间，既不是出库也不是销售；
 * 所以系统只记一条事件（谁、何时、拿了哪件、给哪位客户试），
 * 盘点时这件货依然算在该合伙人名下的在库货里，不会凭空消失。
 *
 * 只有「客户成交 + 双人电子签名」才会走正式出库把 status 置为 SOLD。
 */
export interface FittingEvent {
  id: string; // FIT-202609-0001
  inventoryItemId: string;
  barcode: string;
  productId: string;
  productName: string;
  brand: BrandType;
  category: CategoryType;
  color?: string;
  size: string;
  price: number;
  ownerPartnerId: string;
  ownerPartnerName: string;
  customerName?: string; // 客户称呼（如「王女士」「尾号 8823」）
  customerPhone?: string;
  takenAt: string; // 借出时间 YYYY-MM-DD HH:mm
  takenBy: string; // 经手人
  status: FittingStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  note?: string;
  saleOrderId?: string; // 成交后关联的销售单号
  source: 'WEB' | 'MCP'; // 从电脑端登记还是手机 AI 助手登记
}

/** 手机端登记成交后生成的待签销售单：正式出库仍需电脑端双人电子签名 */
export interface PendingSale {
  id: string; // PS-202609-0001
  fittingId: string;
  inventoryItemId: string;
  barcode: string;
  productName: string;
  brand: BrandType;
  category: CategoryType;
  color?: string;
  size: string;
  price: number;
  dealPrice: number;
  ownerPartnerId: string;
  ownerPartnerName: string;
  sellerPartnerId: string;
  sellerPartnerName: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  createdBy: string;
  note?: string;
  source: 'WEB' | 'MCP';
  status: 'PENDING' | 'SIGNED' | 'CANCELLED';
  signedAt?: string;
  saleOrderId?: string;
}

/** 服务端返回的完整数据仓快照 */
export interface ServerSnapshot {
  revision: number;
  updatedAt: string;
  source: string;
  items: InventoryItem[];
  partners: Partner[];
  salesOrders: SaleOrder[];
  auditReports: AuditReport[];
  franchisees: Franchisee[];
  fittingEvents: FittingEvent[];
  pendingSales: PendingSale[];
}


export interface DailyAuditLogEvent {
  id: string;
  timestamp: string; // YYYY-MM-DD HH:mm
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  eventType: AuditLogEventType;
  title: string;
  description: string;
  operator: string; // 经办人 / 店长付蓉
  participants: string[]; // 相关人员
  itemName?: string;
  itemBarcode?: string;
  amount?: number;
  dualSigned: boolean;
  managerSignature?: string;
  userSignature?: string;
  status: 'COMPLETED' | 'PENDING';
  extraMeta?: {
    borrowOwner?: string;
    borrowSeller?: string;
    expectedReturnDate?: string;
    auditType?: string;
    teamName?: string;
    newExpireDate?: string;
  };
}
