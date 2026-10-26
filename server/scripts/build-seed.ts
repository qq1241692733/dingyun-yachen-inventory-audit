/**
 * 把前端的主数据（商品目录 / 合伙人 / 加盟商 / 销售单 / 审计单 / 初始库存）
 * 抽成后端可直接读取的 JSON，保证后端与前端用的是同一份主数据，永不漂移。
 *
 * 运行：  node ./node_modules/tsx/dist/cli.mjs server/scripts/build-seed.ts
 * 或：    npm run seed
 *
 * 为什么不在后端运行时直接 import TS：后端是长驻服务，走纯 JS 更稳（且本机
 * 局域网服务要求用系统 Node）；把 TS 抽取收敛成一次性的构建步骤，两全。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRODUCT_CATALOGS,
  INITIAL_PARTNERS,
  INITIAL_FRANCHISEES,
  INITIAL_SALES_ORDERS,
  INITIAL_AUDIT_REPORTS,
  generateInitialInventory,
} from '../../src/data/initialData';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(HERE, '..', 'data');
const TARGET = path.join(DATA_DIR, 'seed.json');

const seed = {
  generatedAt: new Date().toISOString(),
  businessDate: '2026-09-14',
  catalogs: PRODUCT_CATALOGS,
  partners: INITIAL_PARTNERS,
  franchisees: INITIAL_FRANCHISEES,
  salesOrders: INITIAL_SALES_ORDERS,
  auditReports: INITIAL_AUDIT_REPORTS,
  items: generateInitialInventory(),
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(seed, null, 2), 'utf8');

const n = (a: unknown[]) => (Array.isArray(a) ? a.length : 0);
console.log(
  `[seed] ${path.relative(process.cwd(), TARGET)}  catalog=${n(seed.catalogs)} partner=${n(seed.partners)} ` +
    `franchisee=${n(seed.franchisees)} sale=${n(seed.salesOrders)} audit=${n(seed.auditReports)} item=${n(seed.items)}`
);
