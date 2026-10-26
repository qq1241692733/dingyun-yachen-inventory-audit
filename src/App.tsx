import React, { useState, useEffect, useCallback } from 'react';
import {
 InventoryItem,
 Partner,
 SaleOrder,
 AuditReport,
 Franchisee,
 FranchiseeRenewalRecord,
 FittingEvent,
 PendingSale,
} from './types/inventory';
import {
 PRODUCT_CATALOGS,
 INITIAL_PARTNERS,
 generateInitialInventory,
 INITIAL_SALES_ORDERS,
 INITIAL_AUDIT_REPORTS,
 INITIAL_FRANCHISEES,
} from './data/initialData';
import { Header } from './components/Header';
import { SideNav, NavKey } from './components/SideNav';
import { InventoryStructureOverview } from './components/InventoryStructureOverview';
import { InventoryListTable } from './components/InventoryListTable';
import { SalesOrdersView } from './components/SalesOrdersView';
import { BorrowedReturnCenter } from './components/BorrowedReturnCenter';
import { AuditReportCenter } from './components/AuditReportCenter';
import { PartnerManagement } from './components/PartnerManagement';
import { FranchiseeRentManagement } from './components/FranchiseeRentManagement';
import { FranchiseeRenewalModal } from './components/FranchiseeRenewalModal';
import { SpreadsheetView } from './components/SpreadsheetView';
import { LoginScreen } from './components/LoginScreen';
import { PrdDocModal } from './components/PrdDocModal';
import { InboundModal } from './components/InboundModal';
import { OutboundSaleModal } from './components/OutboundSaleModal';
import { ReturnModal } from './components/ReturnModal';
import { AuditModal } from './components/AuditModal';
import { FittingTakeModal, FittingTakePayload } from './components/FittingTakeModal';
import { FittingRoomPanel } from './components/FittingRoomPanel';
import {
 paint,
 readTheme,
 readModePref,
 resolveMode,
 watchSystemMode,
 setAppearance,
} from './utils/theme';
import {
 detectServer,
 fetchState,
 watchServerChanges,
 serverApi,
 applyPatch,
 getServerStatus,
} from './utils/apiServer';
import { Layers, CheckCircle2, Info, X } from 'lucide-react';

const STORAGE_KEYS = {
 ITEMS: 'retail_partner_inventory_items_v2',
 PARTNERS: 'retail_partner_list_v2',
 SALES: 'retail_partner_sales_v2',
 AUDITS: 'retail_partner_audits_v2',
 FRANCHISEES: 'retail_partner_franchisees_v2',
 FITTING: 'retail_partner_fitting_v3',
 PENDING_SALES: 'retail_partner_pending_sales_v3',
};

/* ───────────── 登录会话（账册安全门）─────────────
   登录成功后写一条带时间戳的会话记录；刷新页面保持登录，7 天未使用则要求重新登录。 */
const AUTH_KEY = 'retail_partner_auth_v2';
const AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天免登录

/** 读取有效会话；无效或过期返回 null */
function readAuthSession(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const { user, at } = JSON.parse(raw) as { user?: unknown; at?: unknown };
    if (typeof user !== 'string' || !user) return null;
    if (typeof at !== 'number' || Date.now() - at > AUTH_TTL_MS) return null;
    return user;
  } catch {
    return null;
  }
}

// 账期基准日（业务演示基准，与 PRD 一致）
const BUSINESS_DATE = '2026-09-14';

/* V3 修复：原文件一批模板字符串丢失了 ${} 占位符，导致单号与提示文案渲染为空。
   统一补一个即时时间戳助手，供出库 / 还库 / 续约等实时业务使用。 */
const nowStamp = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function App() {
 // 1. Core State with Local Storage persistence
 const [items, setItems] = useState<InventoryItem[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
 if (saved) {
 try {
 const parsed: InventoryItem[] = JSON.parse(saved);
 return parsed
 .filter((i) => !i.brand.includes('圣诗') && !i.productName.includes('圣诗'))
 .map((i) => {
 if (i.entryOperator && (i.entryOperator.includes('店长') || i.entryOperator.includes('徐敏'))) {
 return { ...i, entryOperator: '付蓉 (店长)' };
 }
 return i;
 });
 } catch (e) {
 console.error('Failed to parse items from storage', e);
 }
 }
 return generateInitialInventory();
 });

 const [partners, setPartners] = useState<Partner[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.PARTNERS);
 if (saved) {
 try {
 const parsed: Partner[] = JSON.parse(saved);
 return parsed.map((p) => {
 if (p.role === '店长' || p.id === 'p-01' || p.name.includes('店长')) {
 return { ...p, name: '付蓉 (店长)', role: '店长' };
 }
 return p;
 });
 } catch (e) {
 console.error('Failed to parse partners', e);
 }
 }
 return INITIAL_PARTNERS;
 });

 const [salesOrders, setSalesOrders] = useState<SaleOrder[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.SALES);
 if (saved) {
 try {
 const parsed: SaleOrder[] = JSON.parse(saved);
 return parsed
 .filter((s) => !s.brand.includes('圣诗') && !s.productName.includes('圣诗'))
 .map((s) => ({
 ...s,
 managerName: '付蓉 (店长)',
 }));
 } catch (e) {
 console.error('Failed to parse sales', e);
 }
 }
 return INITIAL_SALES_ORDERS;
 });

 const [auditReports, setAuditReports] = useState<AuditReport[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.AUDITS);
 if (saved) {
 try {
 const parsed: AuditReport[] = JSON.parse(saved);
 return parsed.map((ar) => ({
 ...ar,
 managerName: '付蓉 (店长)',
 }));
 } catch (e) {
 console.error('Failed to parse audits', e);
 }
 }
 return INITIAL_AUDIT_REPORTS;
 });

 const [franchisees, setFranchisees] = useState<Franchisee[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.FRANCHISEES);
 if (saved) {
 try {
 return JSON.parse(saved);
 } catch (e) {
 console.error('Failed to parse franchisees', e);
 }
 }
 return INITIAL_FRANCHISEES;
 });

 // 登录会话：null 表示未登录，渲染登录门；登录后由 localStorage 持久化
 const [authUser, setAuthUser] = useState<string | null>(() => readAuthSession());

 const handleLogin = (username: string) => {
 localStorage.setItem(AUTH_KEY, JSON.stringify({ user: username, at: Date.now() }));
 setAuthUser(username);
 };

 const handleLogout = () => {
 localStorage.removeItem(AUTH_KEY);
 setAuthUser(null);
 };

 // Save to localStorage when state changes
 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
 }, [items]);

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(partners));
 }, [partners]);

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(salesOrders));
 }, [salesOrders]);

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.AUDITS, JSON.stringify(auditReports));
 }, [auditReports]);

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.FRANCHISEES, JSON.stringify(franchisees));
 }, [franchisees]);

 // 试衣事件 / 待签销售单：本地模式下也持久化，刷新不丢
 const [fittingEvents, setFittingEvents] = useState<FittingEvent[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.FITTING);
 if (saved) {
 try {
 return JSON.parse(saved);
 } catch (e) {
 console.error('Failed to parse fitting events', e);
 }
 }
 return [];
 });

 const [pendingSales, setPendingSales] = useState<PendingSale[]>(() => {
 const saved = localStorage.getItem(STORAGE_KEYS.PENDING_SALES);
 if (saved) {
 try {
 return JSON.parse(saved);
 } catch (e) {
 console.error('Failed to parse pending sales', e);
 }
 }
 return [];
 });

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.FITTING, JSON.stringify(fittingEvents));
 }, [fittingEvents]);

 useEffect(() => {
 localStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(pendingSales));
 }, [pendingSales]);

 /* ═══════════════ 后端连接（后端在线时它是唯一真源）═══════════════
   · 探测到后端 → 所有变更走 API，并订阅 revision，让手机端登记的记录自动出现在这里
   · 探测不到  → 完全退回上面的 localStorage 行为，页面功能一个不少
   ========================================================================= */
 const [serverOnline, setServerOnline] = useState<boolean>(false);

 const adoptSnapshot = useCallback((snap: {
 items?: InventoryItem[];
 partners?: Partner[];
 salesOrders?: SaleOrder[];
 auditReports?: AuditReport[];
 franchisees?: Franchisee[];
 fittingEvents?: FittingEvent[];
 pendingSales?: PendingSale[];
 }) => {
 if (snap.items) setItems(snap.items);
 if (snap.partners) setPartners(snap.partners);
 if (snap.salesOrders) setSalesOrders(snap.salesOrders);
 if (snap.auditReports) setAuditReports(snap.auditReports);
 if (snap.franchisees) setFranchisees(snap.franchisees);
 if (snap.fittingEvents) setFittingEvents(snap.fittingEvents);
 if (snap.pendingSales) setPendingSales(snap.pendingSales);
 }, []);

 // 启动探测 + 拉取初始状态 + 订阅变更
 useEffect(() => {
 let stopWatch: (() => void) | undefined;
 let cancelled = false;

 (async () => {
   const status = await detectServer();
   if (cancelled) return;
   setServerOnline(status === 'online');
   if (status !== 'online') return;

   const snap = await fetchState();
   if (cancelled || !snap) return;
   adoptSnapshot(snap);

   // 后端数据比本地新 → 覆盖；否则把本地数据灌给后端（首次接管）
   stopWatch = watchServerChanges(async () => {
     const fresh = await fetchState();
     if (fresh && !cancelled) adoptSnapshot(fresh);
   });
 })();

 return () => {
   cancelled = true;
   stopWatch?.();
 };
 }, [adoptSnapshot]);

 /** server 模式下变更的公共收尾：把后端返回的片段并回本地 */
 const applyServerResult = useCallback(
 (r: { ok: boolean; message?: string; patch?: Record<string, any> }) => {
   if (r.ok && r.patch) adoptSnapshot(r.patch as any);
   return r;
 },
 [adoptSnapshot]
 );

 // 外观：把已落盘的偏好同步回 <html>（首屏不播放换肤过渡，避免闪一帧）；
 // 若用户选了「跟随系统」，则跟随系统明暗变化实时重绘
 useEffect(() => {
 paint(readTheme(), resolveMode(readModePref()));
 return watchSystemMode(() => {
 if (readModePref() === 'system') setAppearance({ pref: 'system' });
 });
 }, []);

 // Navigation State —— 支持 ?view= 深链，便于逐视图验收与分享
 const [activeNav, setActiveNav] = useState<NavKey>(() => {
 const raw = new URLSearchParams(window.location.search).get('view')?.toUpperCase();
 const allowed: NavKey[] = [
 'OVERVIEW',
 'FITTING',
 'SALES',
 'BORROW',
 'AUDIT',
 'PARTNERS',
 'FRANCHISEES',
 'SPREADSHEET',
 ];
 return (allowed as string[]).includes(raw || '') ? (raw as NavKey) : 'OVERVIEW';
 });

 // 视图变化时同步回 URL（replaceState，不产生历史堆栈）
 useEffect(() => {
 const url = new URL(window.location.href);
 url.searchParams.set('view', activeNav);
 window.history.replaceState(null, '', url.toString());
 }, [activeNav]);

 // Shared Filters
 const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>('');
 const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('');

 // Modals State
 const [isInboundModalOpen, setIsInboundModalOpen] = useState<boolean>(false);
 const [isSaleModalOpen, setIsSaleModalOpen] = useState<boolean>(false);
 const [salePreselectedItem, setSalePreselectedItem] = useState<InventoryItem | null>(null);
 const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
 const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
 const [orderToReturn, setOrderToReturn] = useState<SaleOrder | null>(null);
 const [franchiseeForRenewalModal, setFranchiseeForRenewalModal] = useState<Franchisee | null>(null);
 const [isPrdModalOpen, setIsPrdModalOpen] = useState<boolean>(false);
 // 试衣：借出登记弹窗 + 当前正在处理的事件编号
 const [isFittingModalOpen, setIsFittingModalOpen] = useState<boolean>(false);
 const [fittingPreselected, setFittingPreselected] = useState<InventoryItem | null>(null);
 const [fittingBusyId, setFittingBusyId] = useState<string>('');

 // Toast / Notification
 const [toastMessage, setToastMessage] = useState<{
 text: string;
 type: 'success' | 'info';
 } | null>(null);

 const showToast = (text: string, type: 'success' | 'info' = 'success') => {
 setToastMessage({ text, type });
 setTimeout(() => setToastMessage(null), 3800);
 };

 // Calculated Metrics
 const inStockItems = items.filter((i) => i.status === 'AVAILABLE');
 const totalInStock = inStockItems.length;
 const totalInStockValue = inStockItems.reduce((acc, i) => acc + i.price, 0);
 const borrowedCount = salesOrders.filter(
 (o) => o.isCrossPartnerBorrow && o.returnStatus === 'PENDING'
 ).length;

 // 试衣相关派生
 const fittingNowCount = fittingEvents.filter((f) => f.status === 'FITTING').length;
 const fittingItemIds = fittingEvents.filter((f) => f.status === 'FITTING').map((f) => f.inventoryItemId);
 const pendingItemIds = pendingSales.filter((p) => p.status === 'PENDING').map((p) => p.inventoryItemId);
 const availableForFitting = inStockItems.filter((i) => !fittingItemIds.includes(i.id));
 const openPendingCount = pendingSales.filter((p) => p.status === 'PENDING').length;

 // Franchisee expiration check for badge
 const currentDate = new Date(BUSINESS_DATE);
 const urgentFranchiseesCount = franchisees.filter((f) => {
 const exp = new Date(f.expireDate);
 const diff = Math.ceil((exp.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
 return diff <= 30;
 }).length;

 // Monthly Mandatory Check condition: has there been a monthly audit this current month?
 const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g."2026-09"
 const hasCurrentMonthAudit = auditReports.some(
 (r) => r.auditType === 'MONTHLY' && r.auditDate.startsWith(currentYearMonth)
 );

 // 账期：由业务基准日推导（原实现在模板字符串中丢失了占位符，渲染为空的「年 月」）
 const [bizYear, bizMonth] = BUSINESS_DATE.split('-');
 const auditPeriod = `${bizYear} 年 ${Number(bizMonth)} 月`;

 // ============ Handlers ============

 // 1. 合伙人入库拿货
 const handleInboundSuccess = (
 newConsignment: {
 productId: string;
 ownerPartnerId: string;
 size: string;
 color?: string;
 quantity: number;
 entryDate: string;
 operator: string;
 }
 ) => {
 const catalog = PRODUCT_CATALOGS.find((c) => c.id === newConsignment.productId);
 const owner = partners.find((p) => p.id === newConsignment.ownerPartnerId);
 if (!catalog || !owner) return;

 // —— 后端在线：交给后端登记，条码与库存编号也由后端统一生成 ——
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(
       await serverApi.inbound({
         productName: catalog.name,
         ownerPartnerName: owner.name,
         quantity: newConsignment.quantity,
         size: newConsignment.size,
         color: newConsignment.color || catalog.color,
         entryDate: newConsignment.entryDate,
         operator: newConsignment.operator,
       })
     );
     showToast(r.ok ? (r.message || '入库完成') : `入库失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }

 const newItems: InventoryItem[] = [];
 const timestamp = Date.now();

 for (let i = 0; i < newConsignment.quantity; i++) {
 const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
 newItems.push({
 id: `INV-${newConsignment.entryDate.slice(0, 7).replace('-', '')}-${String(timestamp).slice(-4)}${i + 1}`,
 barcode: `SN${newConsignment.entryDate.slice(0, 7).replace('-', '')}${String(timestamp).slice(-4)}${i + 1}`,
 productId: catalog.id,
 productName: catalog.name,
 brand: catalog.brand,
 category: catalog.category,
 size: newConsignment.size,
 color: newConsignment.color || catalog.color,
 price: catalog.price,
 ownerPartnerId: owner.id,
 ownerPartnerName: owner.name,
 entryDate: newConsignment.entryDate,
 entryOperator: newConsignment.operator,
 status: 'AVAILABLE',
 });
 }

 setItems((prev) => [...newItems, ...prev]);
 showToast(
 `入库成功：合伙人「${owner.name}」${newConsignment.quantity} 件【${catalog.name} ${newConsignment.size}】已登记并赋独立条码。`
 );
 };

 // 2. 销售出库 (双人签字)
 const handleSubmitSale = (saleData: {
 item: InventoryItem;
 sellerPartnerId: string;
 dealPrice: number;
 expectedReturnDate?: string;
 managerSignature: string;
 sellerSignature: string;
 managerName: string;
 remarks: string;
 }) => {
 const seller = partners.find((p) => p.id === saleData.sellerPartnerId);
 if (!seller) return;

 // —— 后端在线：由后端落账，并顺带回收该件对应的试衣事件 / 待签销售单 ——
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(
       await serverApi.sale({
         inventoryItemId: saleData.item.id,
         barcode: saleData.item.barcode,
         sellerPartnerId: seller.id,
         sellerPartnerName: seller.name,
         dealPrice: saleData.dealPrice,
         expectedReturnDate: saleData.expectedReturnDate,
         managerSignature: saleData.managerSignature,
         sellerSignature: saleData.sellerSignature,
         managerName: saleData.managerName,
         remarks: saleData.remarks,
       })
     );
     showToast(r.ok ? (r.message || '出库完成') : `出库失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }

 const isCrossBorrow = saleData.item.ownerPartnerId !== seller.id;
 const now = new Date();
 const saleDate = nowStamp();

 const newOrder: SaleOrder = {
 id: `SO-${saleDate.slice(0, 7).replace('-', '')}-${String(Date.now()).slice(-4)}`,
 inventoryItemId: saleData.item.id,
 barcode: saleData.item.barcode,
 productName: saleData.item.productName,
 brand: saleData.item.brand,
 category: saleData.item.category,
 size: saleData.item.size,
 color: saleData.item.color,
 price: saleData.item.price,
 dealPrice: saleData.dealPrice,
 ownerPartnerId: saleData.item.ownerPartnerId,
 ownerPartnerName: saleData.item.ownerPartnerName,
 sellerPartnerId: seller.id,
 sellerPartnerName: seller.name,
 saleDate,
 isCrossPartnerBorrow: isCrossBorrow,
 expectedReturnDate: isCrossBorrow ? saleData.expectedReturnDate : undefined,
 returnStatus: isCrossBorrow ? 'PENDING' : undefined,
 managerSignature: saleData.managerSignature,
 sellerSignature: saleData.sellerSignature,
 managerName: saleData.managerName,
 remarks: saleData.remarks,
 };

 // Update Sales list
 setSalesOrders((prev) => [newOrder, ...prev]);

 // Update Item status
 setItems((prev) =>
 prev.map((it) => {
 if (it.id === saleData.item.id) {
 return {
 ...it,
 status: 'SOLD',
 soldDate: saleDate,
 soldByPartnerId: seller.id,
 soldByPartnerName: seller.name,
 isBorrowedSale: isCrossBorrow,
 expectedReturnDate: isCrossBorrow ? saleData.expectedReturnDate : undefined,
 saleOrderId: newOrder.id,
 };
 }
 return it;
 })
 );

 showToast(
 isCrossBorrow
 ? `销售出库完成：「${seller.name}」向「${saleData.item.ownerPartnerName}」借调待还记录已建立，双人电子印鉴已锁定。`
 : `销售出库完成：「${seller.name}」名下货品已出库，双人电子签名已生成。`
 );
 };

 // 3. 还货冲销
 const handleConfirmReturn = (
 orderId: string,
 returnData: {
 actualReturnDate: string;
 replenishBarcode?: string;
 confirmedBy: string;
 notes?: string;
 }
 ) => {
 const order = salesOrders.find((o) => o.id === orderId);
 if (!order) return;

 // —— 后端在线 ——
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(
       await serverApi.returnOrder({
         orderId,
         actualReturnDate: returnData.actualReturnDate,
         replenishBarcode: returnData.replenishBarcode,
         confirmedBy: returnData.confirmedBy,
         notes: returnData.notes,
       })
     );
     showToast(r.ok ? (r.message || '还货冲销完成') : `还货失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }

 setSalesOrders((prev) =>
 prev.map((o) => {
 if (o.id === orderId) {
 return {
 ...o,
 returnStatus: 'RESOLVED',
 actualReturnDate: returnData.actualReturnDate,
 remarks: o.remarks
 ? `${o.remarks} | 还货补齐: ${returnData.notes || ''}`
 : returnData.notes,
 };
 }
 return o;
 })
 );

 // 自动为被借原货主补入一件相同的在库现货，体现货权闭环
 const catalog = PRODUCT_CATALOGS.find((c) => c.name === order.productName) || PRODUCT_CATALOGS[0];
 const newReplenishItem: InventoryItem = {
 id: `INV-RP-${Date.now()}`,
 barcode:
 returnData.replenishBarcode && returnData.replenishBarcode.trim()
 ? returnData.replenishBarcode.trim()
 : `SNRP${String(Date.now()).slice(-6)}`,
 productId: catalog.id,
 productName: order.productName,
 brand: order.brand,
 category: catalog.category,
 size: order.size,
 color: order.color,
 price: order.price,
 ownerPartnerId: order.ownerPartnerId,
 ownerPartnerName: order.ownerPartnerName,
 entryDate: nowStamp(),
 entryOperator: returnData.confirmedBy,
 status: 'AVAILABLE',
 };

 setItems((prev) => [newReplenishItem, ...prev]);

 showToast(
 `还货冲销完成：借调关系已解除，已为原货主「${order.ownerPartnerName}」自动登记还库新商品。`
 );
 };

 // 4. 提交审计清点报告
 const handleSubmitAudit = (report: AuditReport) => {
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(await serverApi.audit(report));
     showToast(r.ok ? (r.message || '审计报告已归档') : `归档失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }
 setAuditReports((prev) => [report, ...prev]);
 showToast(`审计报告 [${report.id}] 已归档，双人电子印鉴已锁定，账实核验完成。`);
 };

 // 5. 新增合伙人
 const handleAddPartner = (newPartnerData: { name: string; phone: string; role: string }) => {
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(await serverApi.addPartner(newPartnerData));
     showToast(r.ok ? (r.message || '合伙人已建档') : `建档失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }
 const newP: Partner = {
 id: `p-${Date.now()}`,
 name: newPartnerData.name,
 phone: newPartnerData.phone,
 role: newPartnerData.role,
 joinDate: new Date().toISOString().slice(0, 10),
 };
 setPartners((prev) => [...prev, newP]);
 showToast(`合伙人「${newPartnerData.name}」档案已建立，可为其办理拿货入店。`);
 };

 // 6. 加盟商管理
 const handleAddFranchisee = (newF: Omit<Franchisee, 'id'>) => {
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(await serverApi.addFranchisee(newF as Record<string, unknown>));
     showToast(r.ok ? (r.message || '加盟商已建档') : `建档失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }
 const created: Franchisee = {
 ...newF,
 id: `FR-${Date.now()}`,
 };
 setFranchisees((prev) => [created, ...prev]);
 showToast(`加盟商「${newF.name}」档案已建立，已开通会所通行权限。`);
 };

 const handleRenewFranchisee = (
 id: string,
 renewalData?: {
 renewDate: string;
 newExpireDate: string;
 managerName: string;
 managerSignature: string;
 franchiseeSignature: string;
 notes?: string;
 }
 ) => {
 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(await serverApi.renewFranchisee(id, (renewalData || {}) as Record<string, unknown>));
     showToast(r.ok ? (r.message || '房租续约完成') : `续约失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }
 setFranchisees((prev) =>
 prev.map((f) => {
 if (f.id === id) {
 const newExpStr = renewalData
 ? renewalData.newExpireDate
 : (() => {
 const prevExp = new Date(f.expireDate);
 const baseDate = prevExp.getTime() < currentDate.getTime() ? currentDate : prevExp;
 const newExp = new Date(baseDate);
 newExp.setFullYear(newExp.getFullYear() + 1);
 return newExp.toISOString().slice(0, 10);
 })();

 const todayStr = renewalData?.renewDate || BUSINESS_DATE;

 const renewalRecord: FranchiseeRenewalRecord = {
 id: `REC-${Date.now()}`,
 franchiseeId: f.id,
 franchiseeName: f.name,
 renewDate: todayStr,
 amount: 4000,
 previousExpireDate: f.expireDate,
 newExpireDate: newExpStr,
 managerName: renewalData?.managerName || '付蓉 (店长)',
 managerSignature: renewalData?.managerSignature || '',
 franchiseeSignature: renewalData?.franchiseeSignature || '',
 notes: renewalData?.notes,
 };

 return {
 ...f,
 paymentDate: todayStr,
 expireDate: newExpStr,
 managerSignature: renewalData?.managerSignature,
 franchiseeSignature: renewalData?.franchiseeSignature,
 renewalHistory: [renewalRecord, ...(f.renewalHistory || [])],
 };
 }
 return f;
 })
 );
 showToast('房租续约完成，双人电子签名凭据已归档存证。');
 };

 // 7. 恢复初始化数据
 const handleResetDemoData = () => {
 if (window.confirm('确定恢复为标准初始数据吗？（蕾薇尔&拉卡内衣各码2件，精油20件，益生菌5件，店长付蓉）')) {
 // —— 后端在线：由后端重播种子，避免两边各留一份"初始数据" ——
 if (serverOnline) {
   void (async () => {
     const r = await serverApi.reset();
     if (r.ok) {
       const fresh = await fetchState();
       if (fresh) adoptSnapshot(fresh);
       showToast('已重置为标准初始化全量库存与档案', 'success');
     } else {
       showToast(`重置失败：${r.message || '未知错误'}`, 'info');
     }
   })();
   return;
 }
 const freshItems = generateInitialInventory();
 setItems(freshItems);
 setPartners(INITIAL_PARTNERS);
 setSalesOrders(INITIAL_SALES_ORDERS);
 setAuditReports(INITIAL_AUDIT_REPORTS);
 setFranchisees(INITIAL_FRANCHISEES);
 setFittingEvents([]);
 setPendingSales([]);
 localStorage.removeItem(STORAGE_KEYS.ITEMS);
 localStorage.removeItem(STORAGE_KEYS.PARTNERS);
 localStorage.removeItem(STORAGE_KEYS.SALES);
 localStorage.removeItem(STORAGE_KEYS.AUDITS);
 localStorage.removeItem(STORAGE_KEYS.FRANCHISEES);
 localStorage.removeItem(STORAGE_KEYS.FITTING);
 localStorage.removeItem(STORAGE_KEYS.PENDING_SALES);
 showToast('已重置为标准初始化全量库存与档案');
 }
 };

 // 8. 原始电子表格全量双向同步
 const handleSyncSpreadsheetData = (data: {
 items: InventoryItem[];
 salesOrders: SaleOrder[];
 partners: Partner[];
 franchisees: Franchisee[];
 }) => {
 setItems(data.items);
 setSalesOrders(data.salesOrders);
 setPartners(data.partners);
 setFranchisees(data.franchisees);
 localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(data.items));
 localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(data.salesOrders));
 localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(data.partners));
 localStorage.setItem(STORAGE_KEYS.FRANCHISEES, JSON.stringify(data.franchisees));
 // 后端在线时把这份全量数据回写，保证手机端看到的也是同步后的台账
 if (serverOnline) {
   void serverApi.pushState({ ...data, source: 'spreadsheet' });
 }
 };

 /* ═══════════════ 试衣：借出 / 归还 / 成交 ═══════════════
   这三类操作都不改动库存状态（试衣不是出库），因此后端也只在 fittingEvents
   里记一笔。客户要买时才生成"待签销售单"，正式出库仍需电脑端双签。
   ======================================================== */

 /** 试衣借出登记（电脑端按钮 + 手机端 AI 助手共用同一条后端链路） */
 const handleFittingTake = (payload: FittingTakePayload) => {
 const { item, customerName, customerPhone, operator, note } = payload;

 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(
       await serverApi.fittingTake({
         item: item.barcode,
         customerName,
         customerPhone,
         note,
         operator,
       })
     );
     if (r.ok) {
       showToast(r.message || '试衣登记完成', 'success');
       setIsFittingModalOpen(false);
       setFittingPreselected(null);
       setActiveNav('FITTING');
     } else {
       showToast(`试衣登记失败：${r.message || '未知错误'}`, 'info');
     }
   })();
   return;
 }

 // 本地模式：同样只记事件，不动 item.status
 const now = nowStamp();
 const mk = now.slice(0, 7).replace('-', '');
 const seq = fittingEvents.filter((f) => f.id.startsWith(`FIT-${mk}-`)).length + 1;
 const ev: FittingEvent = {
   id: `FIT-${mk}-${String(seq).padStart(4, '0')}`,
   inventoryItemId: item.id,
   barcode: item.barcode,
   productId: item.productId,
   productName: item.productName,
   brand: item.brand,
   category: item.category,
   color: item.color,
   size: item.size,
   price: item.price,
   ownerPartnerId: item.ownerPartnerId,
   ownerPartnerName: item.ownerPartnerName,
   customerName,
   customerPhone,
   takenAt: now,
   takenBy: operator,
   status: 'FITTING',
   note,
   source: 'WEB',
 };
 setFittingEvents((prev) => [ev, ...prev]);
 showToast(
   `已登记试衣：${item.productName} ${item.size}${customerName ? ` → 客户 ${customerName}` : ''}。库存状态未变动。`
 );
 setIsFittingModalOpen(false);
 setFittingPreselected(null);
 setActiveNav('FITTING');
 };

 /** 试衣归还：客户不购买，消除那条试衣事件 */
 const handleFittingReturn = (ev: FittingEvent) => {
 setFittingBusyId(ev.id);
 const finish = () => setFittingBusyId('');

 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(await serverApi.fittingReturn({ fittingId: ev.id }));
     finish();
     showToast(r.ok ? (r.message || '已登记归还') : `登记失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }

 setFittingEvents((prev) =>
   prev.map((f) =>
     f.id === ev.id
       ? { ...f, status: 'RETURNED' as const, resolvedAt: nowStamp(), resolvedBy: '付蓉 (店长)' }
       : f
   )
 );
 finish();
 showToast(`试衣归还已登记：${ev.productName} ${ev.size} 已放回货架，客户未购买，未产生出库记录。`);
 };

 /** 客户要买：生成待签销售单，回电脑端双签出库 */
 const handleFittingPurchase = (ev: FittingEvent) => {
 setFittingBusyId(ev.id);
 const finish = () => setFittingBusyId('');

 if (serverOnline) {
   void (async () => {
     const r = applyServerResult(
       await serverApi.fittingPurchase({ fittingId: ev.id, sellerPartnerName: ev.takenBy })
     );
     finish();
     showToast(r.ok ? (r.message || '已登记成交意向') : `登记失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }

 const now = nowStamp();
 const mk = now.slice(0, 7).replace('-', '');
 const seq = pendingSales.filter((p) => p.id.startsWith(`PS-${mk}-`)).length + 1;
 const pending: PendingSale = {
   id: `PS-${mk}-${String(seq).padStart(4, '0')}`,
   fittingId: ev.id,
   inventoryItemId: ev.inventoryItemId,
   barcode: ev.barcode,
   productName: ev.productName,
   brand: ev.brand,
   category: ev.category,
   color: ev.color,
   size: ev.size,
   price: ev.price,
   dealPrice: ev.price,
   ownerPartnerId: ev.ownerPartnerId,
   ownerPartnerName: ev.ownerPartnerName,
   sellerPartnerId: '',
   sellerPartnerName: ev.takenBy,
   customerName: ev.customerName,
   customerPhone: ev.customerPhone,
   createdAt: now,
   createdBy: '付蓉 (店长)',
   source: 'WEB',
   status: 'PENDING',
 };
 setPendingSales((prev) => [pending, ...prev]);
 setFittingEvents((prev) =>
   prev.map((f) =>
     f.id === ev.id ? { ...f, status: 'PURCHASED' as const, resolvedAt: now, resolvedBy: '付蓉 (店长)' } : f
   )
 );
 finish();
 showToast(`已登记成交意向：${ev.productName} ${ev.size}。待签销售单 ${pending.id} 已生成，请在电脑端完成双签。`);
 };

 /** 取消成交意向：客户临时反悔，把待签单撤掉，货仍在库 */
 const handleCancelPendingSale = (p: PendingSale) => {
 setFittingBusyId(p.id);
 if (serverOnline) {
   // 后端没有单独的取消接口：把该件对应的试衣事件按"未购买归还"处理，语义最接近
   void (async () => {
     const r = applyServerResult(await serverApi.fittingReturn({ fittingId: p.fittingId, note: '取消成交，货已放回货架' }));
     setFittingBusyId('');
     showToast(r.ok ? `已取消 ${p.id}，货品仍在库` : `取消失败：${r.message || '未知错误'}`, r.ok ? 'success' : 'info');
   })();
   return;
 }
 setPendingSales((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: 'CANCELLED' as const } : x)));
 setFittingEvents((prev) =>
   prev.map((f) =>
     f.id === p.fittingId
       ? { ...f, status: 'RETURNED' as const, resolvedAt: nowStamp(), note: '取消成交，货已放回货架' }
       : f
   )
 );
 setFittingBusyId('');
 showToast(`已取消 ${p.id}，货品仍在库，可重新登记试衣或出售。`);
 };

 /** 双签出库：跳到销售出库弹窗，货品预选为该件 */
 const handleSignPendingSale = (p: PendingSale) => {
 const item = items.find((i) => i.id === p.inventoryItemId);
 if (!item) {
   showToast('这件货品已不在台账里，请刷新后重试', 'info');
   return;
 }
 if (item.status !== 'AVAILABLE') {
   showToast(`该件当前状态为「${item.status}」，无法再出库`, 'info');
   return;
 }
 setSalePreselectedItem(item);
 setIsSaleModalOpen(true);
 };

 // 移动端横向导航（lg 以下显示）—— 试衣排在第一位：这是店长在手机上最高频的动作
 const mobileNav: { key: NavKey; label: string }[] = [
 { key: 'OVERVIEW', label: '概览' },
 { key: 'FITTING', label: `试衣${fittingNowCount > 0 ? ` ${fittingNowCount}` : ''}` },
 { key: 'SALES', label: '销售账单' },
 { key: 'BORROW', label: `借调流转${borrowedCount > 0 ? ` ${borrowedCount}` : ''}` },
 { key: 'AUDIT', label: '审计中心' },
 { key: 'PARTNERS', label: '合伙人' },
 { key: 'FRANCHISEES', label: `加盟商${urgentFranchiseesCount > 0 ? ` ${urgentFranchiseesCount}` : ''}` },
 { key: 'SPREADSHEET', label: '电子表格' },
 ];

 // ── 账册安全门：未登录时整个应用不渲染，只显示登录页 ──
 if (!authUser) {
 return <LoginScreen onLogin={handleLogin} />;
 }

 return (
 <div className="min-h-screen bg-bg text-text flex">
 {/* 书脊：全站唯一的结构性深色面 */}
 <SideNav
 activeNav={activeNav}
 onNavigate={setActiveNav}
 salesCount={salesOrders.length}
 pendingBorrowCount={borrowedCount}
 auditCount={auditReports.length}
 monthlyAuditDue={!hasCurrentMonthAudit}
 partnerCount={partners.length}
 franchiseeCount={franchisees.length}
 urgentFranchiseeCount={urgentFranchiseesCount}
 auditPeriod={auditPeriod}
 fittingCount={fittingNowCount}
 pendingSaleCount={openPendingCount}
 />

 <div className="flex-1 min-w-0 flex flex-col">
        {/* 移动端导航：V3 浅色纸面，全量换行，避免长辈遗漏末项 */}
        <div className="lg:hidden bg-nav text-on-nav no-print border-b border-border-2">
          <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
            <div aria-hidden="true" className="w-6 h-6 grid place-items-center border border-accent bg-accent-soft shrink-0">
              <span className="font-display text-xs leading-none text-accent-strong">鼎</span>
            </div>
            <span className="font-display text-sm text-text">鼎运雅辰 · 库存审计</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 px-3 py-2">
            {mobileNav.map((n) => (
              <button
                key={n.key}
                onClick={() => setActiveNav(n.key)}
                className={[
                  'px-2.5 h-8 border text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer',
                  activeNav === n.key
                    ? 'bg-accent border-accent text-on-accent'
                    : 'bg-transparent border-border-2 text-text-2 hover:bg-nav-2',
                ].join(' ')}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

 <Header
 activeNav={activeNav}
 isMonthlyMandatoryDone={hasCurrentMonthAudit}
 auditPeriod={auditPeriod}
 totalInStock={totalInStock}
 totalValue={totalInStockValue}
 operatorName="付蓉（店长 / 首席风控官）"
 pendingBorrowCount={borrowedCount}
 urgentFranchiseeCount={urgentFranchiseesCount}
 onOpenInbound={() => setIsInboundModalOpen(true)}
 onOpenSale={() => {
 setSalePreselectedItem(null);
 setIsSaleModalOpen(true);
 }}
 onOpenAudit={() => setIsAuditModalOpen(true)}
 onResetDemoData={handleResetDemoData}
 onOpenPrdDoc={() => setIsPrdModalOpen(true)}
 onLogout={handleLogout}
 onGoFitting={() => setActiveNav('FITTING')}
 onOpenFittingTake={() => {
 setFittingPreselected(null);
 setIsFittingModalOpen(true);
 }}
 fittingCount={fittingNowCount}
 pendingSaleCount={openPendingCount}
 />

 <main className="flex-1 min-w-0 px-4 lg:px-8 py-6">
 {/* View 1: Inventory Overview & Structure + Detailed List */}
 {activeNav === 'OVERVIEW' && (
 <div className="space-y-6">
 <InventoryStructureOverview
 items={items}
 partners={partners}
 salesOrders={salesOrders}
 franchisees={franchisees}
 auditReports={auditReports}
 fittingEvents={fittingEvents}
 pendingSales={pendingSales}
 selectedPartnerFilter={selectedPartnerFilter}
 onSelectPartnerFilter={(id) => setSelectedPartnerFilter(id)}
 selectedBrandFilter={selectedBrandFilter}
 onSelectBrandFilter={(b) => setSelectedBrandFilter(b)}
 onClickBorrowCard={() => setActiveNav('BORROW')}
 onNavigateToAudit={() => setActiveNav('AUDIT')}
 onNavigateToFranchisee={() => setActiveNav('FRANCHISEES')}
 onNavigateToPartners={() => setActiveNav('PARTNERS')}
 onNavigateToFitting={() => setActiveNav('FITTING')}
 onOpenFittingTake={() => {
 setFittingPreselected(null);
 setIsFittingModalOpen(true);
 }}
 onOpenInbound={() => setIsInboundModalOpen(true)}
 onOpenSale={() => {
 setSalePreselectedItem(null);
 setIsSaleModalOpen(true);
 }}
 onOpenAuditModal={() => setIsAuditModalOpen(true)}
 onConfirmReturn={(order) => {
 setOrderToReturn(order);
 setIsReturnModalOpen(true);
 }}
 onOpenFranchiseeRenewalModal={(f) => setFranchiseeForRenewalModal(f)}
 isMonthlyMandatoryDone={hasCurrentMonthAudit}
 />

 {/* Detailed Table */}
 <section className="space-y-3">
 <div className="flex items-end justify-between gap-4 pb-2.5 border-b border-border-2">
 <div>
 <div className="kicker">明细</div>
 <h2 className="section-title mt-1">门店货品全量台账</h2>
 <p className="meta mt-1">
 每件在库实物均标识「是谁的 · 何时拿来 · 出库时间 · 销售人」
 </p>
 </div>
 </div>

 <InventoryListTable
 items={items}
 partners={partners}
 selectedPartnerFilter={selectedPartnerFilter}
 onSelectPartnerFilter={(id) => setSelectedPartnerFilter(id)}
 selectedBrandFilter={selectedBrandFilter}
 onSelectBrandFilter={(b) => setSelectedBrandFilter(b)}
 onSellItem={(item) => {
 setSalePreselectedItem(item);
 setIsSaleModalOpen(true);
 }}
 fittingItemIds={fittingItemIds}
 pendingItemIds={pendingItemIds}
 onTakeForFitting={(item) => {
 setFittingPreselected(item);
 setIsFittingModalOpen(true);
 }}
 onViewFitting={() => setActiveNav('FITTING')}
 />
 </section>
 </div>
 )}

 {/* View 2: 试衣间 —— 客户试穿轻登记，不走签署 */}
 {activeNav === 'FITTING' && (
 <FittingRoomPanel
 fittingEvents={fittingEvents}
 pendingSales={pendingSales}
 partners={partners}
 onOpenTakeModal={() => {
 setFittingPreselected(null);
 setIsFittingModalOpen(true);
 }}
 onReturn={handleFittingReturn}
 onPurchase={handleFittingPurchase}
 onSignPending={handleSignPendingSale}
 onReturnPending={handleCancelPendingSale}
 pendingActionId={fittingBusyId}
 />
 )}

 {/* View 3: Franchisees & Global Club Rent Management */}
 {activeNav === 'FRANCHISEES' && (
 <FranchiseeRentManagement
 franchisees={franchisees}
 onAddFranchisee={handleAddFranchisee}
 onRenewFranchisee={handleRenewFranchisee}
 onSelectFranchiseeForFilter={(name) => {
 const matched = partners.find((p) => p.name === name);
 if (matched) {
 setSelectedPartnerFilter(matched.id);
 }
 setActiveNav('OVERVIEW');
 }}
 />
 )}

 {/* View 3: Sales Orders & Outbound dual signatures */}
 {activeNav === 'SALES' && (
 <SalesOrdersView
 salesOrders={salesOrders}
 onOpenReturnModal={(order) => {
 setOrderToReturn(order);
 setIsReturnModalOpen(true);
 }}
 />
 )}

 {/* View 4: Borrow & Return Debt Center (Interactive Flow) */}
 {activeNav === 'BORROW' && (
 <BorrowedReturnCenter
 salesOrders={salesOrders}
 onOpenReturnModal={(order) => {
 setOrderToReturn(order);
 setIsReturnModalOpen(true);
 }}
 />
 )}

 {/* View 5: Audit Reports (Daily / Weekly / Monthly Mandatory) */}
 {activeNav === 'AUDIT' && (
 <AuditReportCenter
 auditReports={auditReports}
 items={items}
 salesOrders={salesOrders}
 franchisees={franchisees}
 onOpenNewAudit={() => setIsAuditModalOpen(true)}
 isMonthlyMandatoryDue={!hasCurrentMonthAudit}
 />
 )}

 {/* View 6: Partners Management */}
 {activeNav === 'PARTNERS' && (
 <PartnerManagement
 partners={partners}
 items={items}
 salesOrders={salesOrders}
 onAddPartner={handleAddPartner}
 onSelectPartnerForFilter={(pId) => {
 setSelectedPartnerFilter(pId);
 setActiveNav('OVERVIEW');
 }}
 onOpenInboundForPartner={() => {
 setIsInboundModalOpen(true);
 }}
 />
 )}

 {/* View 7: Spreadsheet Mode */}
 {activeNav === 'SPREADSHEET' && (
 <SpreadsheetView
 items={items}
 salesOrders={salesOrders}
 partners={partners}
 franchisees={franchisees}
 onSyncAllData={handleSyncSpreadsheetData}
 onShowToast={showToast}
 />
 )}
 </main>

 {/* 页脚：账册版权行 */}
 <footer className="border-t border-border px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 no-print">
 <div className="flex items-center gap-2 text-2xs text-text-3">
 <Layers strokeWidth={1.6} className="w-3.5 h-3.5" />
 鼎运雅辰品质体验中心 · 运营与合伙人库存审计系统
 </div>
 <div className="flex items-center gap-3 text-2xs text-text-3">
 <span>台账数据本地持久化</span>
 <span className="w-px h-3 bg-border-2" aria-hidden="true" />
 <span>重要业务双签存证 · 不可单方篡改</span>
 </div>
 </footer>
 </div>

 {/* 通知：静默成功优先，不用庆祝式提示 */}
 {toastMessage && (
 <div
 role="status"
 className="rise fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] max-w-[min(720px,92vw)] flex items-start gap-2.5 px-3.5 py-2.5 bg-surface border border-border-2 rounded-sm shadow-pop no-print"
 >
 {toastMessage.type === 'success' ? (
 <CheckCircle2 strokeWidth={1.75} className="w-4 h-4 mt-0.5 text-ok shrink-0"/>
 ) : (
 <Info strokeWidth={1.75} className="w-4 h-4 mt-0.5 text-accent shrink-0"/>
 )}
 <span className="text-sm leading-5 text-text">{toastMessage.text}</span>
 <button
 onClick={() => setToastMessage(null)}
 className="ml-1 p-0.5 rounded-xs text-text-3 hover:text-text shrink-0"
 aria-label="关闭通知"
 >
 <X className="w-3.5 h-3.5"/>
 </button>
 </div>
 )}

 {/* Modals */}
 <FittingTakeModal
 isOpen={isFittingModalOpen}
 onClose={() => {
 setIsFittingModalOpen(false);
 setFittingPreselected(null);
 }}
 availableItems={inStockItems}
 partners={partners}
 preselectedItem={fittingPreselected}
 fittingItemIds={fittingItemIds}
 onSubmit={handleFittingTake}
 />

 <InboundModal
 isOpen={isInboundModalOpen}
 onClose={() => setIsInboundModalOpen(false)}
 catalogs={PRODUCT_CATALOGS}
 partners={partners}
 onInboundSuccess={handleInboundSuccess}
 />

 <OutboundSaleModal
 isOpen={isSaleModalOpen}
 onClose={() => {
 setIsSaleModalOpen(false);
 setSalePreselectedItem(null);
 }}
 availableItems={inStockItems}
 partners={partners}
 preselectedItem={salePreselectedItem}
 onSubmitSale={handleSubmitSale}
 />

 <ReturnModal
 isOpen={isReturnModalOpen}
 onClose={() => {
 setIsReturnModalOpen(false);
 setOrderToReturn(null);
 }}
 order={orderToReturn}
 onConfirmReturn={handleConfirmReturn}
 />

 <AuditModal
 isOpen={isAuditModalOpen}
 onClose={() => setIsAuditModalOpen(false)}
 availableItems={inStockItems}
 onSubmitAudit={handleSubmitAudit}
 isMonthlyMandatoryDue={!hasCurrentMonthAudit}
 />

 {franchiseeForRenewalModal && (
 <FranchiseeRenewalModal
 isOpen={Boolean(franchiseeForRenewalModal)}
 onClose={() => setFranchiseeForRenewalModal(null)}
 franchisee={franchiseeForRenewalModal}
 onConfirmRenewal={(franchiseeId, data) => {
 handleRenewFranchisee(franchiseeId, data);
 setFranchiseeForRenewalModal(null);
 }}
 />
 )}

 <PrdDocModal
 isOpen={isPrdModalOpen}
 onClose={() => setIsPrdModalOpen(false)}
 onShowToast={showToast}
 />
 </div>
 );
}
