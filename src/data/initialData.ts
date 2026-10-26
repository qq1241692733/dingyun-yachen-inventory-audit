import { ProductCatalog, Partner, InventoryItem, SaleOrder, AuditReport, Franchisee, CategoryType, BrandType } from '../types/inventory';
import { INVENTORY_SNAPSHOT } from './inventorySnapshot';

// 产品目录标准定义（完全对应用户上传的两张表）
export const PRODUCT_CATALOGS: ProductCatalog[] = [
  // 1. Laca 拉卡
  {
    id: 'laca-bra-gold',
    brand: 'Laca',
    category: '美体内衣',
    name: '调整型文胸',
    color: '金色',
    regularSizes: ['70B', '75B', '80B', '85B', '90B', '95B', '70C', '75C', '80C', '85C', '90C', '95C', '75D', '80D', '85D'],
    price: 1880,
    unit: '件',
  },
  {
    id: 'laca-bra-black',
    brand: 'Laca',
    category: '美体内衣',
    name: '短文胸',
    color: '黑色',
    regularSizes: ['70B', '75B', '80B', '85B', '90B', '75C', '80C', '85C'],
    price: 1980,
    unit: '件',
  },
  {
    id: 'laca-pants-gold',
    brand: 'Laca',
    category: '美体内衣',
    name: '提臀塑裤',
    color: '金色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 2250,
    customFee: 120,
    unit: '件',
  },
  {
    id: 'laca-pants-black',
    brand: 'Laca',
    category: '美体内衣',
    name: '提臀塑裤',
    color: '黑色',
    regularSizes: ['70', '76', '82', '90', '98'],
    price: 2580,
    unit: '件',
  },
  {
    id: 'laca-waist-gold',
    brand: 'Laca',
    category: '美体内衣',
    name: '腰背夹',
    color: '金色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122'],
    price: 2380,
    customFee: 120,
    unit: '件',
  },
  {
    id: 'laca-waist-black',
    brand: 'Laca',
    category: '美体内衣',
    name: '腰背夹',
    color: '黑色',
    regularSizes: ['70', '90', '98'],
    price: 2420,
    unit: '件',
  },
  {
    id: 'laca-waist-long-gold',
    brand: 'Laca',
    category: '美体内衣',
    name: '长袖腰背夹',
    color: '金色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['106', '114', '122', '130', '138'],
    price: 2580,
    customFee: 120,
    unit: '件',
  },
  {
    id: 'laca-longpants-gold',
    brand: 'Laca',
    category: '美体内衣',
    name: '长塑裤',
    color: '金色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['106', '122', '130', '138'],
    price: 2680,
    customFee: 120,
    unit: '件',
  },
  {
    id: 'laca-man-waist',
    brand: 'Laca',
    category: '美体内衣',
    name: '男士腰背夹',
    color: '金色',
    regularSizes: ['82', '90', '98', '106'],
    customSizes: ['114', '122', '138'],
    price: 2380,
    customFee: 120,
    unit: '件',
  },

  // 2. 蕾薇尔 L'IEVEILL
  {
    id: 'lieveill-bra-small',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '调整型小杯文胸',
    color: '灰色',
    regularSizes: ['70B', '75B', '80B', '70C', '75C', '80C', '70D', '75D', '80D', '85B', '90B', '95B', '85C', '90C', '95C'],
    price: 3160,
    unit: '件',
  },
  {
    id: 'lieveill-bra-big',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '调整型大杯文胸',
    color: '灰色',
    regularSizes: ['70E', '75E', '80E', '70F', '75F', '80F', '85D', '90D', '95D', '85E', '90E', '95E', '85F', '90F', '95F'],
    price: 3160,
    unit: '件',
  },
  {
    id: 'lieveill-pants',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '提臀塑裤',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 3460,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-waist',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '腰背夹',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 3360,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-belt',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '腰封',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 3160,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-longpants',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '提臀长塑裤',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 4360,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-halfwaist',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '半袖腰背夹',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98'],
    customSizes: ['64', '106', '114', '122', '130', '138'],
    price: 4160,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-multi-belt',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '多功能腰封',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98', '106'],
    customSizes: ['64', '114', '122', '130', '138'],
    price: 3360,
    customFee: 300,
    unit: '件',
  },
  {
    id: 'lieveill-women-brief',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '女士内裤',
    color: '灰色',
    regularSizes: ['70', '76', '82', '90', '98', '106'],
    price: 880,
    unit: '件',
  },
  {
    id: 'lieveill-men-brief',
    brand: '蕾薇尔',
    category: '美体内衣',
    name: '男士内裤',
    color: '灰色',
    regularSizes: ['82', '90', '98', '106', '114', '122'],
    price: 980,
    unit: '件',
  },

  // 3. 蕾薇尔跃动套装
  {
    id: 'lieveill-sport-bra-black',
    brand: '蕾薇尔',
    category: '运动套装',
    name: '运动文胸',
    color: '跃动黑',
    regularSizes: ['S', 'M', 'L', 'XL'],
    price: 1188,
    unit: '件',
  },
  {
    id: 'lieveill-sport-bra-purple',
    brand: '蕾薇尔',
    category: '运动套装',
    name: '运动文胸',
    color: '跃动紫',
    regularSizes: ['S', 'M', 'L', 'XL'],
    price: 1188,
    unit: '件',
  },
  {
    id: 'lieveill-sport-bra-yellow',
    brand: '蕾薇尔',
    category: '运动套装',
    name: '运动文胸',
    color: '跃动黄',
    regularSizes: ['S', 'M', 'L', 'XL'],
    price: 1188,
    unit: '件',
  },
  {
    id: 'lieveill-sport-pants-black',
    brand: '蕾薇尔',
    category: '运动套装',
    name: '提臀运动裤',
    color: '跃动黑',
    regularSizes: ['S', 'M', 'L', 'XL'],
    price: 1788,
    unit: '件',
  },
  {
    id: 'lieveill-sport-pants-purple',
    brand: '蕾薇尔',
    category: '运动套装',
    name: '提臀运动裤',
    color: '跃动紫',
    regularSizes: ['S', 'M', 'L', 'XL'],
    price: 1788,
    unit: '件',
  },

  // 4. 悦己集 / 古澜美 (精油与护肤)
  {
    id: 'yj-rose-oil',
    brand: '悦己集',
    category: '精油护肤',
    name: '时光凝萃玫瑰精油',
    color: '经典金装',
    regularSizes: ['30mL'],
    price: 798,
    unit: '瓶',
  },
  {
    id: 'yj-box-gift',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃焕颜礼盒装',
    regularSizes: ['6件套'],
    price: 5980,
    unit: '套',
  },
  {
    id: 'yj-aromatherapy-box',
    brand: '悦己集',
    category: '精油护肤',
    name: '悦己集套盒(香薰)',
    regularSizes: ['典藏套组'],
    price: 12500,
    unit: '套',
  },
  {
    id: 'yj-cleanser',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃净颜氨基酸洁面乳',
    regularSizes: ['80g'],
    price: 399,
    unit: '瓶',
  },
  {
    id: 'yj-toner',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃焕颜保湿精粹水',
    regularSizes: ['100mL'],
    price: 699,
    unit: '瓶',
  },
  {
    id: 'yj-lotion',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃莹润舒缓乳液',
    regularSizes: ['60mL'],
    price: 1099,
    unit: '瓶',
  },
  {
    id: 'yj-serum',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃焕采淡纹精华液',
    regularSizes: ['40mL'],
    price: 1399,
    unit: '瓶',
  },
  {
    id: 'yj-cream',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃奢宠抗皱面霜',
    regularSizes: ['50g'],
    price: 1385,
    unit: '瓶',
  },
  {
    id: 'yj-eye-cream',
    brand: '悦己集',
    category: '精油护肤',
    name: '臻萃时光紧致眼霜',
    regularSizes: ['20g'],
    price: 999,
    unit: '瓶',
  },

  // 5. 悦维膳 (营养益生菌)
  {
    id: 'yws-probiotics',
    brand: '悦维膳',
    category: '营养健康',
    name: '益生菌固体饮料',
    regularSizes: ['2g*20条'],
    price: 360,
    unit: '盒',
  },
  {
    id: 'yws-protein',
    brand: '悦维膳',
    category: '营养健康',
    name: '蛋白营养粉固体饮料',
    regularSizes: ['30g*20条'],
    price: 460,
    unit: '盒',
  },
  {
    id: 'yws-pomegranate',
    brand: '悦维膳',
    category: '营养健康',
    name: '白石榴金顶侧耳浓缩粉固体饮料',
    regularSizes: ['3g*20条'],
    price: 360,
    unit: '盒',
  },
];

// 合伙人团队列表
//
// ⚠️ 2026-09-17 变更：货权人已按《库存盘点9.17》实盘表整体替换为**真实货主**。
//    · p-01 付蓉（店长）保留 —— 她是双人电子签的风控签署人，必须常驻；
//    · 其余 19 位来自实盘表的人名列（原表只给了姓名，**没有**手机号与入伙日期，
//      故留空待补录，不臆造数据）；
//    · 原来的 16 位占位姓名（李雅琴/陈晓曼/张美玲…）已随假库存一并移除。
//      副作用：加盟商页「按该加盟商筛选货权」对孙晓雅/李雅琴/周丽华/陈晓曼/郑雅琪
//      这 5 位将匹配不到合伙人（她们是加盟商而非货主）——如需该联动请另行补人。
export const INITIAL_PARTNERS: Partner[] = [
  { id: 'p-01', name: '付蓉 (店长)', phone: '13800138001', role: '店长', joinDate: '2024-01-10' },
  ...INVENTORY_SNAPSHOT.owners.map((name, i) => ({
    id: `p-${String(i + 2).padStart(2, '0')}`,
    name,
    phone: '',
    role: '合伙人',
    joinDate: '',
  })),
];

// 加盟商房租管理（交4000房租选择全球2700+任意一家会所，即可使用全球会所）
// 预置数据按到期日期最近排序
export const INITIAL_FRANCHISEES: Franchisee[] = [
  {
    id: 'FC-001',
    name: '方慧敏',
    phone: '15255668899',
    teamName: '宏图精英队',
    rentAmount: 4000,
    paymentDate: '2025-09-01',
    expireDate: '2026-09-01',
    notes: '选择主会所：鼎运雅辰，常驻借调业务活跃，房租已超期需紧急续费。',
  },
  {
    id: 'FC-002',
    name: '彭丽敏',
    phone: '13900123456',
    teamName: '雅辰战队',
    rentAmount: 4000,
    paymentDate: '2025-09-18',
    expireDate: '2026-09-18',
    notes: '将于4天后到期，常在华东及华南2700+网络会所接待客户。',
  },
  {
    id: 'FC-003',
    name: '赵雅芝',
    phone: '13811223399',
    teamName: '璀璨名媛组',
    rentAmount: 4000,
    paymentDate: '2025-09-25',
    expireDate: '2026-09-25',
    notes: '将于11天后到期，已电话预通知续费。',
  },
  {
    id: 'FC-004',
    name: '孙晓雅',
    phone: '13233445544',
    teamName: '宏图精英队',
    rentAmount: 4000,
    paymentDate: '2025-10-05',
    expireDate: '2026-10-05',
    notes: '21天后到期，在库货量充足。',
  },
  {
    id: 'FC-005',
    name: '李雅琴',
    phone: '13911223344',
    teamName: '雅辰战队',
    rentAmount: 4000,
    paymentDate: '2025-10-28',
    expireDate: '2026-10-28',
    notes: '核心加盟商，全球会所VIP权益正常使用中。',
  },
  {
    id: 'FC-006',
    name: '周丽华',
    phone: '13566778811',
    teamName: '卓越盛世体系',
    rentAmount: 4000,
    paymentDate: '2025-11-15',
    expireDate: '2026-11-15',
    notes: '正常使用中，跨会所沙龙组织者。',
  },
  {
    id: 'FC-007',
    name: '陈晓曼',
    phone: '13788996655',
    teamName: '璀璨名媛组',
    rentAmount: 4000,
    paymentDate: '2025-12-01',
    expireDate: '2026-12-01',
    notes: '正常使用中，已缴纳本年度全球共享席位房租。',
  },
  {
    id: 'FC-008',
    name: '郑雅琪',
    phone: '15811224455',
    teamName: '雅辰战队',
    rentAmount: 4000,
    paymentDate: '2026-01-10',
    expireDate: '2027-01-10',
    notes: '远期有效，年初已全额缴纳4000元会所年费。',
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   初始库存 —— 由《库存盘点9.17》实盘快照逐件展开
   ═══════════════════════════════════════════════════════════════════════

   2026-09-17 变更：原先这份库存是按「内衣每码 2 件 / 精油 20 瓶 / 其他 5 件」
   程序生成的**演示数据**，货主也是占位姓名；现整体替换为门店真实实盘数据。

   展开规则：快照里每个「(品牌,颜色,品名,尺码) × 货主 = N 件」拆成 N 条独立货品，
   条码与库存编号全局唯一（INV-202609-0001 … / SN2026090001 …）。
   入库经办人统一记「付蓉 (店长)」，入库日取业务基准日 2026-09-14 09:00
   （⚠️ 不能用盘点表上的 9.17 —— 前端 BUSINESS_DATE 硬编码为 2026-09-14，
     晚于它的日期会被渲染成「未来」，所以这里必须落在基准日当天）。
*/

/** 实盘品名 → 产品目录 id。目录里没有的品目给 `IMP-` 前缀的稳定 id，
 *  不去改写产品目录（产品目录沿用前端原有的一份，差异另见导入报告）。 */
function snapshotProductId(brand: string, name: string, color: string): string {
  const candidates = PRODUCT_CATALOGS.filter((c) => c.brand === brand && c.name === name);
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length > 1) {
    // 同品名多色（如运动文胸 跃动黑/跃动黄/跃动紫）再按颜色选一次
    const byColor = candidates.find((c) => {
      const catColor = (c.color || '').replace(/^跃动/, '');
      return !!catColor && (color === catColor || color.includes(catColor) || catColor.includes(color));
    });
    if (byColor) return byColor.id;
  }
  return `IMP-${brand}-${name}`;
}

/** 实盘品牌/品名 → 品类（口径与 PRODUCT_CATALOGS 一致） */
function snapshotCategory(brand: string, name: string): CategoryType {
  if (brand === '悦维膳') return '营养健康';
  if (brand === '悦己集' || brand === '古澜美' || brand === '圣诗蔓') return '精油护肤';
  if (name.includes('运动')) return '运动套装';
  return '美体内衣';
}

export function generateInitialInventory(): InventoryItem[] {
  const items: InventoryItem[] = [];
  const entryDate = `${INVENTORY_SNAPSHOT.businessDate} 09:00`;
  const mk = INVENTORY_SNAPSHOT.businessDate.slice(0, 7).replace('-', ''); // 202609
  let seq = 0;

  for (const row of INVENTORY_SNAPSHOT.rows) {
    const productId = snapshotProductId(row.brand, row.name, row.color);
    const category = snapshotCategory(row.brand, row.name);
    for (const [ownerName, count] of Object.entries(row.qty)) {
      const owner = INITIAL_PARTNERS.find((p) => p.name === ownerName);
      if (!owner) continue; // 出现未登记的货主时跳过，不造无主货品
      for (let i = 0; i < count; i += 1) {
        seq += 1;
        const tail = String(seq).padStart(4, '0');
        items.push({
          id: `INV-${mk}-${tail}`,
          barcode: `SN${mk}${tail}`,
          productId,
          productName: row.name,
          brand: row.brand as BrandType,
          category,
          color: row.color,
          size: row.size,
          price: row.price,
          ownerPartnerId: owner.id,
          ownerPartnerName: owner.name,
          entryDate,
          entryOperator: '付蓉 (店长)',
          status: 'AVAILABLE',
        });
      }
    }
  }

  return items;
}

// ⚠️ 2026-09-17 清空：原有两张样本销售单引用的 INV-1005 / INV-1020 及
// 陈晓曼/张美玲/李雅琴等货主已随假库存一并移除，留着即悬空脏数据。
// 新库存下的销售单请通过「销售出库 · 双签」真实产生。
export const INITIAL_SALES_ORDERS: SaleOrder[] = [];

// ⚠️ 2026-09-17 清空：原两份卷宗的被审货主与 382 件基线同属旧假数据。
export const INITIAL_AUDIT_REPORTS: AuditReport[] = [];


