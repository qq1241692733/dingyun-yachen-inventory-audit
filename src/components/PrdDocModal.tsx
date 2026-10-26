import React, { useState } from 'react';
import { FileText, Download, Copy, Check, Printer, X } from 'lucide-react';

interface PrdDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'info') => void;
}

export const PRD_RAW_CONTENT = `# 《鼎运雅辰品质体验中心 · 运营与库存审计系统》产品需求文档 (PRD)

| 文档版本 | V2.0 |
| :--- | :--- |
| **系统全称** | 鼎运雅辰品质体验中心 · 日常运营与合伙人库存审计管理系统 |
| **店长兼风控官** | 付蓉 |
| **适用网络** | 鼎运雅辰体验中心总部及全球 2,700+ 会所加盟节点 |
| **撰写日期** | 2026年9月14日 |
| **文档状态** | 正式生效归档 |

---

## 一、 产品概述与业务背景

### 1.1 业务背景
鼎运雅辰品质体验中心作为高端体验会所及全球 2,700+ 会所联盟的核心示范店，日常具备以下核心运营特性：
1. **多合伙人独立货权**：店内常备实物库存分别归属于 17 位独立合伙人，由店长（付蓉）受托统一保管并在库清点，各合伙人名下货值独立核算。
2. **跨人借调高频流转**：合伙人间存在“销售时如自有名下无现货，可借调他人名下库存交付客户，后续采购补入同款新货冲销归还”的机制。
3. **老少合伙人共存**：部分长辈合伙人不习惯多层级复杂的软件操作，只习惯直观的电子表格（Excel），但数据又必须与系统实时互通。
4. **强风控双签存证**：严防货权混淆与账实不符，所有销售出库、跨人借调、归还冲销、月度大检及房租续约均必须经过店长付蓉与经办人双人手写签字确认。

### 1.2 产品定位
打造集**实物出入库核验、合伙人货权分账、跨人借调冲销闭环、月度强制全盘双签、加盟商房租档案以及多工作表 Excel 模式**于一体的轻量化、高可靠、极简易用的综合中台。

---

## 二、 用户角色与权限矩阵

| 角色 | 代表人员 | 权限与职责 |
| :--- | :--- | :--- |
| **店长 / 首席风控官** | **付蓉** | 全局管理与审计见证。所有出入库、跨人借调、还货冲销、月度全盘审计及加盟商续费均须其双人签署确认。合伙人看板中恒定置顶。 |
| **会所合伙人** | 陆思齐、李雅琴、周丽华、王雪梅、张美玲、陈晓曼等 17 人 | 自有货品入库、名下货品销售出库、发起借调他人物品、补货归还冲销、实时查阅名下实物资产与借贷明细。 |
| **加盟商负责人** | 卓越团队、优雅荟、国际形体等全球 2,700+ 共享节点 | 每年缴纳 4,000 元会所共享运营金/房租，享有通店权限；与店长付蓉完成年度续费双签。 |
| **传统操作员 / 长辈合伙人** | 部分老年合伙人及传统店员 | 习惯电子表格视图。直接在“原始电子表格”模式中查阅与修改单元格，点击一键全系统双向同步。 |

---

## 三、 系统功能架构设计

- 1. 门店综合概览 (主页 OVERVIEW): 4大核心指标卡、极简5条最新动态(点击看双签)、品牌结构分布、合伙人货权归属看板。
- 2. 原始电子表格模式 (SPREADSHEET): Sheet 1 实物明细账、Sheet 2 销售出库双签、Sheet 3 17位合伙人名册、Sheet 4 加盟商房租表，支持就地编辑与全量双向同步。
- 3. 跨人借调流转中心 (BORROW): 借调待还追踪台账、补货还库核验冲销闭环。
- 4. 销售账单管理 (SALES): 销售出库历史、双签印鉴存证票据。
- 5. 审计中心 (AUDIT): 月度全盘强制大检报告与双签记录、每日审计动态流水树图。
- 6. 加盟商与房租管理 (FRANCHISEES): 全球 2,700+ 体系加盟商台账(4,000元/年)、到期预警与双签续费。
- 7. 17 位合伙人名册 (PARTNERS): 资产明细与货权关联。

---

## 四、 核心业务规范与功能需求

### 4.1 首页概览：4 大高亮指标卡与极简最新动态
- 4大核心指标卡：在库实物总量 (77件/¥1,085,820)、出入审计、合伙人与加盟商、借调待还。
- 最新动态（极简展示规范）：克制显示，仅在首页展示最近 5 条高频核心动态：
  1. 李雅琴 入库 蕾薇尔82码 2件 · 今天 14:32 · [入库上架]
  2. 王雪梅 销售出库 Laca76码 1件 · 双签完成 · 今天 11:15 · [双签完成]
  3. 周丽华 售出 张美玲 蕾薇尔76码 1件 · 待还货 · 昨天 16:48 · [借调待还]
  4. 月度审计清点完成 · 账实相符 · 付蓉+王雪梅双签 · 9月7日 · [账实相符]
  5. 陈晓曼 入库 悦己集玫瑰精油 5瓶 · 9月5日 · [入库上架]
- 交互详情弹窗：点击动态列表中任意一条，即弹出详情抽屉，展示交割明细及双人手写签字笔迹。

### 4.2 原始电子表格模式（Excel 多工作表与双向同步）
- 专为长辈及表格使用者设计，具有 4 个独立工作表：
  * Sheet 1: 库存实物明细账 (77+ 件实物条码、品名、尺码、货主、状态)
  * Sheet 2: 销售出库双签记录 (单号、成交价、销售人、原货主、还货状态)
  * Sheet 3: 17 位合伙人名册 (联系电话、角色、名下在库资产)
  * Sheet 4: 加盟商与房租账目表 (4,000 房租、缴费日、到期日)
- 工具功能：直接双击编辑单元格、新增行、删除选中行、导出 CSV、一键保存并同步全系统。

### 4.3 跨人借调与还货冲销风控规范
- 借调出库：记录原货权人与销售人两个主体，标记借调待还，必须由销售人与店长付蓉双签。
- 还货冲销：补入同款新货时输入条码核验，状态变更为已冲销，自动登记为原货主名下资产。

### 4.4 品牌与商品品类规范
- 彻底移除圣诗曼组件，保留四大品牌：
  1. 蕾薇尔：高端美体内衣系列 (76/82 等)
  2. Laca：经典提臀塑身系列 (76/82 等)
  3. 悦己集：玫瑰精油系列 (30mL/瓶)
  4. 悦维膳：益生菌固体饮料等营养品

### 4.5 房租与加盟商管理规范
- 全球 2,700+ 会所加盟商，每家 4,000 元/年。
- 房租提醒仅在房租专区集中管理，不再侵入全站各目录。
- 付蓉店长与加盟商双签手写确认续费。
`;

export const PrdDocModal: React.FC<PrdDocModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // One-click download as Markdown (.md)
  const handleDownloadMarkdown = () => {
    const blob = new Blob([PRD_RAW_CONTENT], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `鼎运雅辰体验中心_产品需求文档_PRD_V2.0_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (onShowToast) {
      onShowToast('PRD 需求文档已成功下载 (.md格式)！', 'success');
    }
  };

  // One-click copy text
  const handleCopy = () => {
    navigator.clipboard.writeText(PRD_RAW_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onShowToast) {
      onShowToast('需求文档全文已复制到剪贴板！', 'success');
    }
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-scrim backdrop-blur-xs">
      <div className="modal-card w-full max-w-4xl">
        {/* Header */}
        <div className="px-6 py-4 bg-spine text-on-spine flex items-center justify-between border-b border-border-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-accent/20 text-accent border border-accent/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-on-spine flex items-center gap-2">
                产品需求文档 (PRD V2.0)
                <span className="text-xs px-2 py-0.5 rounded-md bg-accent/20 text-accent font-normal">
                  正式生效归档
                </span>
              </h2>
              <p className="text-xs text-text-3 mt-0.5">
                鼎运雅辰品质体验中心 · 日常运营与合伙人库存审计管理系统
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-accent hover:bg-accent-strong text-on-accent text-xs font-bold transition-all shadow-raise cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              下载 .md 文件
            </button>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-spine-3 hover:bg-spine text-text-3 text-xs font-semibold transition-all border border-border-2 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制全文'}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm bg-spine-3 hover:bg-spine text-text-3 text-xs font-semibold transition-all border border-border-2 cursor-pointer"
              title="打印 / 导出为 PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-sm text-text-3 hover:text-on-spine hover:bg-spine-3 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 font-sans text-text-2 text-xs sm:text-sm leading-relaxed space-y-6 bg-bg">
          <div className="bg-surface p-6 rounded-sm border border-border shadow-raise space-y-5">
            <div className="border-b border-border pb-4">
              <h1 className="text-xl font-bold text-text font-display">
                《鼎运雅辰品质体验中心 · 运营与库存审计系统》产品需求文档 (PRD)
              </h1>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-text-2 bg-surface-2 p-3 rounded-sm font-num">
                <div>版本: <strong>V2.0 (正式生效)</strong></div>
                <div>店长: <strong>付蓉 (兼风控官)</strong></div>
                <div>适用: <strong>全球 2,700+ 会所</strong></div>
                <div>日期: <strong>2026-09-14</strong></div>
              </div>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-text border-l-4 border-accent pl-2">
                一、 产品概述与背景
              </h2>
              <p className="text-text-2">
                鼎运雅辰品质体验中心作为高端体验会所及全球 2,700+ 会所联盟的核心示范店，日常具备四大特征：
              </p>
              <ul className="list-disc pl-5 space-y-1 text-text-2">
                <li><strong>多合伙人独立货权</strong>：店内常备库存归属于 17 位合伙人名下，店长付蓉统一保管并在库清点，名下货值独立核算。</li>
                <li><strong>跨人借调高频流转</strong>：合伙人间存在借调他人名下库存交付客户、后续补入同款新货冲销归还的闭环机制。</li>
                <li><strong>老少合伙人共存</strong>：部分长辈合伙人不习惯复杂系统操作，只看电子表格（Excel），数据必须与系统实时互通。</li>
                <li><strong>强风控双签存证</strong>：出入库、跨人借调、归还冲销、月度大检及房租续约均须付蓉店长与经办人双人手写签名确认。</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-text border-l-4 border-accent pl-2">
                二、 用户角色与权限矩阵
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-border text-xs">
                  <thead>
                    <tr className="bg-surface-2 font-bold text-text-2">
                      <th className="p-2 border border-border">角色</th>
                      <th className="p-2 border border-border">代表人员</th>
                      <th className="p-2 border border-border">核心职责与权限</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border border-border font-bold">店长 / 首席风控官</td>
                      <td className="p-2 border border-border text-accent-strong font-bold">付蓉</td>
                      <td className="p-2 border border-border">全盘实物保管见证、双人手写签字核销、月度全盘大检、看板恒定置顶。</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-border font-bold">会所合伙人</td>
                      <td className="p-2 border border-border">17位合伙人</td>
                      <td className="p-2 border border-border">自有货品拿货入库、自有名下销售出库、借调他人货品、补货还库冲销。</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-border font-bold">加盟商负责人</td>
                      <td className="p-2 border border-border">全球 2,700+ 会所体系</td>
                      <td className="p-2 border border-border">每年缴纳 4,000 元房租/共享年费，与店长付蓉双签完成续费登记。</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-border font-bold">长辈合伙人 / 传统操作员</td>
                      <td className="p-2 border border-border">习惯看表格的老人</td>
                      <td className="p-2 border border-border">在“原始电子表格”中直接看多Sheet、就地改单元格，点击一键同步全系统。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-text border-l-4 border-accent pl-2">
                三、 核心功能与规范落实
              </h2>
              <div className="space-y-3">
                <div className="bg-bg p-3 rounded-sm border border-border">
                  <h3 className="font-bold text-text mb-1">1. 首页极简最新动态（用户严格指定规范）</h3>
                  <p className="text-text-2 text-xs mb-2">
                    主页仅保留最近 5 条高频核心动态，点击任意一条可弹出查看完整交割详情与双人手写签名凭据：
                  </p>
                  <div className="font-num text-xs text-text-2 space-y-1 bg-surface p-2.5 rounded border border-border">
                    <div>1. 李雅琴 入库 蕾薇尔82码 2件 · 今天 14:32 · [入库上架]</div>
                    <div>2. 王雪梅 销售出库 Laca76码 1件 · 双签完成 · 今天 11:15 · [双签完成]</div>
                    <div>3. 周丽华 售出 张美玲 蕾薇尔76码 1件 · 待还货 · 昨天 16:48 · [借调待还]</div>
                    <div>4. 月度审计清点完成 · 账实相符 · 付蓉+王雪梅双签 · 9月7日 · [账实相符]</div>
                    <div>5. 陈晓曼 入库 悦己集玫瑰精油 5瓶 · 9月5日 · [入库上架]</div>
                  </div>
                </div>

                <div className="bg-bg p-3 rounded-sm border border-border">
                  <h3 className="font-bold text-text mb-1">2. 原始电子表格模式 (Excel 多工作表与双向同步)</h3>
                  <p className="text-text-2 text-xs leading-relaxed">
                    专为长辈设计：Sheet 1 实物明细账、Sheet 2 销售出库双签、Sheet 3 17位合伙人名册、Sheet 4 加盟商房租表。支持双击就地修改、新增行、删除行、一键导出 CSV。点击【保存并同步全系统】后，全系统看板、在库件数与流水联动更新。
                  </p>
                </div>

                <div className="bg-bg p-3 rounded-sm border border-border">
                  <h3 className="font-bold text-text mb-1">3. 跨人借调流转与还货冲销闭环</h3>
                  <p className="text-text-2 text-xs leading-relaxed">
                    借调必须由销售人与店长付蓉双签；补货归还时核验同款新货条码，一键冲销解除借调关系，自动转为原货主名下资产。
                  </p>
                </div>

                <div className="bg-bg p-3 rounded-sm border border-border">
                  <h3 className="font-bold text-text mb-1">4. 品牌规范</h3>
                  <p className="text-text-2 text-xs leading-relaxed">
                    圣诗曼已彻底移除；系统涵盖四大核心品牌：蕾薇尔（塑身内衣）、Laca（提臀塑身）、悦己集（玫瑰精油）、悦维膳（益生菌）。
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-2 border-t border-border flex items-center justify-between text-xs text-text-3">
          <span>文件已保存在项目根目录：<code className="font-num bg-surface px-1 py-0.5 rounded border border-border-2">/PRODUCT_REQUIREMENTS_DOCUMENT.md</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-sm bg-spine text-on-spine hover:bg-spine-3 font-semibold cursor-pointer"
          >
            关闭阅读
          </button>
        </div>
      </div>
    </div>
  );
};
