import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";
import * as csv from "csv";
import {addDays, format, parse} from "date-fns";

// 集計対象の店舗・期間を受け取る入力スキーマ。
const inputSchema = z.object({
  storeName: z.string().min(1).describe('店舗名'),
  from: z.string().regex(/^\d{8}$/).describe('取得期間の開始日 (YYYYMMDD形式、その日を含む)'),
  to: z.string().regex(/^\d{8}$/).describe('取得期間の終了日 (YYYYMMDD形式、その日を含む)'),
});
// 商品別の合計値を返す出力スキーマ。
const outputSchema = z.object({
  storeName: z.string().describe('店舗名'),
  statistics: z.array(
    z.object({
      itemName: z.string().describe('メニュー名'),
      totalAmount: z.number().describe('売上金額の合計'),
      totalQuantity: z.number().describe('販売数量の合計'),
      averageUnitPrice: z.number().describe('平均単価')
    })
  ).describe('指定期間内のメニューごとの売上統計情報')
});

export const getSalesStatisticsPerItem: RegisterTool = (server) => server.registerTool(
  'get_sales_statistics_peritem',
  {
    // このツールの用途（商品別集計）を明示。
    title: '店舗内のメニューごとの売り上げ統計情報を取得',
    description: '店舗内のメニューごとの売り上げ統計情報を取得します。',
    inputSchema: inputSchema,
    outputSchema: outputSchema,
  },
  async ({storeName, from, to}) => {
    // 文字列日付を Date に変換して期間チェックに使う。
    const dateFrom = parse(from, 'yyyyMMdd', new Date());
    const dateTo = parse(to, 'yyyyMMdd', new Date());
    if (dateFrom > dateTo) {
      return {
        isError: true,
        content: [
          { type: "text", text: "取得期間の開始日が終了日よりも後になっています。正しい期間を指定してください。" }
        ]
      };
    }

    // 期間内の日付をすべて列挙。
    const dateList: string[] = [];
    for (let d = dateFrom; d <= dateTo; d = addDays(d, 1)) {
      dateList.push(format(d, 'yyyyMMdd'));
    }

    // 商品名ごとに金額・数量を積み上げるマップ。
    const summaryByItem = new Map<string, { totalAmount: number; totalQuantity: number }>();

    // 各日データを順番に読み込み、商品単位で合算する。
    for (const date of dateList) {
      const filePath = `${projectRoot}/storage/${date}_${storeName}.csv`;

      try {
        // CSV をレコード配列に変換。
        const csvContent = await fs.readFile(filePath, "utf-8");
        const rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
          csv.parse(csvContent, { columns: true, trim: true, bom: true }, (err, records) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(records as Record<string, string>[]);
          });
        });

        for (const row of rows) {
          // メニュー名/商品名どちらの列名でも読めるように吸収。
          const itemName = row["メニュー名"] ?? row["商品名"] ?? "";
          if (!itemName) continue;

          // 数値列を安全に数値化。
          const amount = Number(row["売上金額 (円)"] ?? row["売上金額"] ?? 0);
          const quantity = Number(row["売上数量 (個)"] ?? row["売上数量"] ?? 0);

          // 既存集計値を取り出して加算し、マップへ書き戻す。
          const current = summaryByItem.get(itemName) ?? { totalAmount: 0, totalQuantity: 0 };
          current.totalAmount += amount;
          current.totalQuantity += quantity;
          summaryByItem.set(itemName, current);
        }
      } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        // 欠損日（ファイルなし）は無視、その他は異常として再送出。
        if (errorCode !== "ENOENT") {
          throw error;
        }
      }
    }

    // Map を配列に変換し、平均単価を計算して表示順を安定化。
    const statistics = Array.from(summaryByItem.entries())
      .map(([itemName, summary]) => ({
        itemName,
        totalAmount: summary.totalAmount,
        totalQuantity: summary.totalQuantity,
        averageUnitPrice: summary.totalQuantity === 0 ? 0 : summary.totalAmount / summary.totalQuantity,
      }))
      .sort((a, b) => a.itemName.localeCompare(b.itemName, 'ja'));

    // スキーマ準拠レスポンスを組み立てる。
    const jsonResult: z.infer<typeof outputSchema> = {
      storeName,
      statistics,
    };

    // structuredContent と text の双方を返す。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [{ type: "text", text: JSON.stringify(jsonResult) }],
    };
  }
); 