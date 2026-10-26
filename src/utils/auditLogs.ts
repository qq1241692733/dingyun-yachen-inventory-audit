import {
  InventoryItem,
  SaleOrder,
  AuditReport,
  Franchisee,
  DailyAuditLogEvent,
} from '../types/inventory';
import { deriveInboundDays } from './activityFeed';

export function generateDailyAuditLogs(
  items: InventoryItem[],
  salesOrders: SaleOrder[],
  auditReports: AuditReport[],
  franchisees: Franchisee[]
): DailyAuditLogEvent[] {
  const logs: DailyAuditLogEvent[] = [];

  // 1. Audit reports
  auditReports.forEach((ar) => {
    const time = ar.createdAt.includes(' ') ? ar.createdAt.split(' ')[1] : '18:00';
    logs.push({
      id: `LOG-AUD-${ar.id}`,
      timestamp: ar.createdAt || `${ar.auditDate} 18:00`,
      date: ar.auditDate,
      time,
      eventType: 'INVENTORY_AUDIT',
      title: ar.isMandatoryMonthly ? '月度全盘强制审计清点' : '周度库存抽检审计',
      description: ar.summary || `全盘清点实物 ${ar.totalPhysicalCount} 件，系统 ${ar.totalSystemCount} 件，差异 ${ar.discrepancyCount} 件。`,
      operator: ar.managerName || '付蓉 (店长)',
      participants: [ar.managerName || '付蓉 (店长)', ar.inspectorName],
      dualSigned: true,
      managerSignature: ar.managerSignature,
      userSignature: ar.inspectorSignature,
      status: 'COMPLETED',
      extraMeta: {
        auditType: ar.auditType,
      },
    });
  });

  // 2. Sales & Cross-borrow orders
  salesOrders.forEach((so) => {
    const [datePart, timePart] = so.saleDate.includes(' ')
      ? so.saleDate.split(' ')
      : [so.saleDate, '14:30'];

    if (so.isCrossPartnerBorrow) {
      // Cross borrow event
      logs.push({
        id: `LOG-BORROW-${so.id}`,
        timestamp: so.saleDate,
        date: datePart,
        time: timePart,
        eventType: 'CROSS_BORROW',
        title: '跨人借调售出出库',
        description: `销售者 [${so.sellerPartnerName}] 借调原货主 [${so.ownerPartnerName}] 名下货品售出，店长付蓉与销售双签，约定还货日：${so.expectedReturnDate || '待定'}`,
        operator: so.managerName || '付蓉 (店长)',
        participants: [so.managerName || '付蓉 (店长)', so.sellerPartnerName, so.ownerPartnerName],
        itemName: `${so.brand} ${so.productName} (${so.size}${so.color ? ' / ' + so.color : ''})`,
        itemBarcode: so.barcode,
        amount: so.dealPrice,
        dualSigned: Boolean(so.managerSignature && so.sellerSignature),
        managerSignature: so.managerSignature,
        userSignature: so.sellerSignature,
        status: so.returnStatus === 'RESOLVED' ? 'COMPLETED' : 'PENDING',
        extraMeta: {
          borrowOwner: so.ownerPartnerName,
          borrowSeller: so.sellerPartnerName,
          expectedReturnDate: so.expectedReturnDate,
        },
      });

      // If resolved, add a return event
      if (so.returnStatus === 'RESOLVED' && so.actualReturnDate) {
        const retDatePart = so.actualReturnDate.includes(' ')
          ? so.actualReturnDate.split(' ')[0]
          : so.actualReturnDate;
        const retTimePart = so.actualReturnDate.includes(' ')
          ? so.actualReturnDate.split(' ')[1]
          : '16:00';

        logs.push({
          id: `LOG-RET-${so.id}`,
          timestamp: so.actualReturnDate,
          date: retDatePart,
          time: retTimePart,
          eventType: 'RETURN_RESOLVED',
          title: '借调还货完成冲销',
          description: `销售者 [${so.sellerPartnerName}] 已为原货主 [${so.ownerPartnerName}] 补入新货，店长付蓉核验实物，借调关系已解除冲账。`,
          operator: so.managerName || '付蓉 (店长)',
          participants: [so.managerName || '付蓉 (店长)', so.sellerPartnerName, so.ownerPartnerName],
          itemName: `${so.brand} ${so.productName} (${so.size})`,
          dualSigned: true,
          status: 'COMPLETED',
          extraMeta: {
            borrowOwner: so.ownerPartnerName,
            borrowSeller: so.sellerPartnerName,
          },
        });
      }
    } else {
      // Normal outbound sale
      logs.push({
        id: `LOG-SALE-${so.id}`,
        timestamp: so.saleDate,
        date: datePart,
        time: timePart,
        eventType: 'OUTBOUND_SALE',
        title: '销售出库双签核销',
        description: `合伙人 [${so.sellerPartnerName}] 自有货品售出交付，店长付蓉核验出库，双人手写签字存证完成。`,
        operator: so.managerName || '付蓉 (店长)',
        participants: [so.managerName || '付蓉 (店长)', so.sellerPartnerName],
        itemName: `${so.brand} ${so.productName} (${so.size}${so.color ? ' / ' + so.color : ''})`,
        itemBarcode: so.barcode,
        amount: so.dealPrice,
        dualSigned: Boolean(so.managerSignature && so.sellerSignature),
        managerSignature: so.managerSignature,
        userSignature: so.sellerSignature,
        status: 'COMPLETED',
      });
    }
  });

  // 3. Franchisee rent renewals / payments
  franchisees.forEach((f) => {
    if (f.renewalHistory && f.renewalHistory.length > 0) {
      f.renewalHistory.forEach((rh) => {
        logs.push({
          id: `LOG-REN-${rh.id}`,
          timestamp: `${rh.renewDate} 11:30`,
          date: rh.renewDate,
          time: '11:30',
          eventType: 'FRANCHISEE_RENEWAL',
          title: '加盟商房租双签续约',
          description: `加盟商 [${rh.franchiseeName}] 缴纳年费 ¥${rh.amount}，有效期顺延至 ${rh.newExpireDate}，店长付蓉与加盟商完成双人电子签名。`,
          operator: rh.managerName || '付蓉 (店长)',
          participants: [rh.managerName || '付蓉 (店长)', rh.franchiseeName],
          amount: rh.amount,
          dualSigned: Boolean(rh.managerSignature && rh.franchiseeSignature),
          managerSignature: rh.managerSignature,
          userSignature: rh.franchiseeSignature,
          status: 'COMPLETED',
          extraMeta: {
            teamName: f.teamName,
            newExpireDate: rh.newExpireDate,
          },
        });
      });
    }
  });

  /* ── 4 · 入库流水：按日聚合 ──
     与首页动态流同源（复用 activityFeed.deriveInboundDays），避免两处逻辑漂移。
     V2 这里塞了 3 条硬编码的"入库示例事件"，与真实台账脱节。 */
  deriveInboundDays(items).forEach((d) => {
    const top = d.partnerBreakdown.slice(0, 3);
    logs.push({
      id: `LOG-INB-${d.date}`,
      timestamp: `${d.date} ${d.time}`,
      date: d.date,
      time: d.time,
      eventType: 'INBOUND',
      title: '合伙人拿货入库清点',
      description: `当日入库登记 ${d.qty} 件，涉及 ${d.partnerBreakdown.length} 位合伙人（${top
        .map((p) => `${p.name} ${p.qty} 件`)
        .join('、')}${d.partnerBreakdown.length > top.length ? ' 等' : ''}），货值合计 ¥${d.value.toLocaleString(
        'zh-CN'
      )}，由 ${d.operator} 核验防伪吊牌并贴附独立条码入库。`,
      operator: d.operator,
      participants: [d.operator, ...d.partnerBreakdown.map((p) => p.name)].filter(Boolean),
      itemName: `${d.productNames.length} 个货品（${d.productNames.slice(0, 2).join('、')}${
        d.productNames.length > 2 ? ' 等' : ''
      }）`,
      itemBarcode: `${d.qty} 个独立条码`,
      amount: d.value,
      dualSigned: false,
      status: 'COMPLETED',
    });
  });

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return logs;
}
