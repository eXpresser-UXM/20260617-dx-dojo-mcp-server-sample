import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";
import * as csv from "csv";

// 保存時に必要な入力情報を定義。
const inputSchema = z.object({
  storeName: z.string().min(1).describe('店舗名'),
  date: z.string().regex(/^\d{8}$/).describe('保存対象の日付 (YYYYMMDD形式)'),
  sales: z.array(
    z.object({
      itemName: z.string().min(1).describe('メニュー名'),
      unitPrice: z.number().nonnegative().describe('単価'),
      quantity: z.number().int().nonnegative().describe('販売数量'),
    })
  ).min(1).describe('確定済みの売上明細'),
});

// 保存後に返す明細（amount は再計算値）を定義。
const outputSchema = z.object({
  storeName: z.string().describe('店舗名'),
  date: z.string().describe('保存対象の日付 (YYYYMMDD形式)'),
  sales: z.array(
    z.object({
      itemName: z.string().min(1).describe('メニュー名'),
      unitPrice: z.number().nonnegative().describe('単価'),
      quantity: z.number().int().nonnegative().describe('販売数量'),
      amount: z.number().nonnegative().describe('売上金額')
    })
  ).describe('保存した売上明細'),
});

export const saveDailySales: RegisterTool = (server) => server.registerTool(
  'save_daily_sales',
  {
    // 事前ヒアリング済みの明細を受け取り、CSV へ確定保存する用途。
    title: '店舗内の売り上げデータを保存',
    description: '店舗の1日分の売り上げデータを保存します。"register_sales_assistant" で聞き取りを行い確定した明細を受け取り、保存します。',
    inputSchema,
    outputSchema,
  },
  async ({ storeName, date, sales }) => {
    // 空配列は業務的に無効データとして扱う。
    if (sales.length === 0) {
      return {
        isError: true,
        content: [
          { type: "text", text: "保存する売り上げ明細がありません。" },
        ],
      };
    }

    // 保存先は 1日1店舗1ファイル（YYYYMMDD_店舗名.csv）。
    const filePath = `${projectRoot}/storage/${date}_${storeName}.csv`;

    // 入力明細を CSV 列仕様へ正規化し、金額は単価×数量で再計算する。
    const normalizedRows = sales.map((sale) => ({
      "メニュー名": sale.itemName,
      "単価 (円)": sale.unitPrice,
      "売上数量 (個)": sale.quantity,
      "売上金額 (円)": sale.unitPrice * sale.quantity,
    }));

    // ヘッダ付き・BOM付きで CSV 文字列を作る（Excel でも開きやすい）。
    const csvText = csv.stringify(normalizedRows, {
      header: true,
      columns: ["メニュー名", "単価 (円)", "売上数量 (個)", "売上金額 (円)"],
      bom: true,
    });

    // ファイルへ上書き保存。
    await fs.writeFile(filePath, csvText, "utf-8");

    // 保存結果を API 返却フォーマットへ整形。
    const jsonResult: z.infer<typeof outputSchema> = {
      storeName,
      date,
      sales: sales.map((sale) => ({
        ...sale,
        amount: sale.unitPrice * sale.quantity,
      })),
    };

    // 保存成功レスポンス。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [{ type: "text", text: JSON.stringify(jsonResult) }],
    };
  }
);