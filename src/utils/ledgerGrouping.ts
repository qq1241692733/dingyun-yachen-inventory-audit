/**
 * 在库台账「货主 × 型号」归并 —— ⭐ 权威定义（唯一真源）
 *
 * 为什么把它从 `InventoryListTable` 里抽出来：
 *   归并键一旦散落在多个消费方（台账、动态流、MCP 汇总、将来的报表），
 *   每处各写一遍迟早漂移 —— 表现就是「两个页面对同批货给出的型号数/件数对不上」。
 *   任何需要「同货主同型号算一个」的地方，都必须 import 本文件，不得自己再拼键。
 *
 * 归并键（每个字段的去留都有理由）：
 *   - 货主 ownerPartnerId —— 需求本意就是「同一个人的同型号合并」；不同货主的同款货
 *     货权不同，绝不能并成一行。
 *   - 品牌 / 品类 / 品名 / 颜色 / 尺码 —— 「型号」的业务定义。
 *   - 单价 price —— 同款改过价的两批货不该混算成一个货值（价不同的批次合并会让
 *     「数量 × 单价」算不平）。
 *   - 状态 status（及售出件的售出日期/销售人）—— 让一行内**语义同质**：
 *     「在库」与「已售出」若并成一行，状态列与流转列就没有唯一答案。
 *
 *   有意**不含** entryDate：台账回答的是「这一款有几件」，入库时间对这个问题没帮助；
 *   且逐件的入库时间仍在逐件明细（展开行）与导出 CSV 里，没有丢失。
 */
import type { InventoryItem } from '../types/inventory';

/** 归并后的一个「货主 × 型号」行 */
export interface LedgerGroup {
  /** 归并键（调试 / React key 用） */
  key: string;
  /** 组内逐件货品（展开行、导出 CSV 用） */
  pieces: InventoryItem[];
  /** 组内第一件（代表行渲染用） */
  sample: InventoryItem;
  /** 件数 */
  count: number;
  /** 其中处于试衣中的件数 */
  fittingCount: number;
  /** 货值合计（单价求和） */
  value: number;
  /** 是否为已结算（售出/借调售出）行 */
  isSettled: boolean;
}

/** 键分隔符选用业务字段中不可能出现的字符，避免字段内容拼接后互相吞并 */
const SEP = '§';

/** 单件货品的归并键。需要判断「两件是否同款同主」时也应使用本函数，保持一致 */
export function ledgerGroupKeyOf(item: InventoryItem): string {
  const settled = item.status !== 'AVAILABLE';
  return [
    item.ownerPartnerId,
    item.brand,
    item.category,
    item.productName,
    item.color || '',
    item.size,
    item.price,
    item.status,
    settled ? `${item.soldDate || ''}|${item.soldByPartnerName || ''}` : '',
  ].join(SEP);
}

/** 把逐件货品归并成「货主 × 型号」行；保持首次出现的相对顺序，保证渲染稳定 */
export function groupItemsForLedger(
  items: readonly InventoryItem[],
  fittingItemIds?: ReadonlySet<string>,
): LedgerGroup[] {
  const map = new Map<string, LedgerGroup>();
  for (const item of items) {
    const key = ledgerGroupKeyOf(item);
    const existing = map.get(key);
    if (existing) {
      existing.pieces.push(item);
      existing.count += 1;
      existing.value += item.price;
      if (fittingItemIds?.has(item.id)) existing.fittingCount += 1;
    } else {
      map.set(key, {
        key,
        pieces: [item],
        sample: item,
        count: 1,
        fittingCount: fittingItemIds?.has(item.id) ? 1 : 0,
        value: item.price,
        isSettled: item.status !== 'AVAILABLE',
      });
    }
  }
  return [...map.values()];
}
