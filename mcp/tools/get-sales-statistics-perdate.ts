import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";
import * as csv from "csv";
import {addDays, format, parse} from "date-fns";

// 集計対象を指定する入力。
const inputSchema = z.object({
  storeName: z.string().min(1).describe('店舗名'),
  from: z.string().regex(/^\d{8}$/).describe('取得期間の開始日 (YYYYMMDD形式、その日を含む)'),
  to: z.string().regex(/^\d{8}$/).describe('取得期間の終了日 (YYYYMMDD形式、その日を含む)'),
});
// 日別集計の返却形式。
const outputSchema = z.object({
  storeName: z.string().describe('店舗名'),
  statistics: z.array(
    z.object({
      date: z.string().describe('日付 (YYYYMMDD形式)'),
      totalAmount: z.number().describe('売上金額の合計'),
      totalQuantity: z.number().describe('販売数量の合計'),
      averageUnitPrice: z.number().describe('平均単価')
    })
  ).describe('指定期間内の日ごとの売上統計情報')
});

export const getSalesStatisticsPerDate: RegisterTool = (server) => server.registerTool(
  'get_sales_statistics_perdate',
  {
    // このツールが日別集計であることを明示。
    title: '店舗内の日ごとの売り上げ統計情報を取得',
    description: '店舗内の日ごとの売り上げ統計情報を取得します。',
    inputSchema: inputSchema,
    outputSchema: outputSchema,
  },
  async ({storeName, from, to}) => {
    // 期間文字列を Date に変換。
    const dateFrom = parse(from, 'yyyyMMdd', new Date());
    const dateTo = parse(to, 'yyyyMMdd', new Date());

    // 期間指定が不正なら明示的にエラーを返す。
    if (dateFrom > dateTo) {
      return {
        isError: true,
        content: [
          { type: "text", text: "取得期間の開始日が終了日よりも後になっています。正しい期間を指定してください。" }
        ]
      };
    }

    // from-to を1日刻みで展開して処理対象日を作る。
    const dateList: string[] = [];
    for (let d = dateFrom; d <= dateTo; d = addDays(d, 1)) {
      dateList.push(format(d, 'yyyyMMdd'));
    }

    // 各日ファイルを並列で読み込み、日別統計へ変換する。
    const statistics = (
      await Promise.all(
        dateList.map(async (date) => {
          const filePath = `${projectRoot}/storage/${date}_${storeName}.csv`;

          try {
            // CSV をパースして行データ配列にする。
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

            // 表記ゆれに対応しながら売上金額と数量を合計。
            const totalAmount = rows.reduce((sum, row) => sum + Number(row["売上金額 (円)"] ?? row["売上金額"] ?? 0), 0);
            const totalQuantity = rows.reduce((sum, row) => sum + Number(row["売上数量 (個)"] ?? row["売上数量"] ?? 0), 0);

            return {
              date,
              totalAmount,
              totalQuantity,
              // 平均単価 = 合計金額 / 合計数量（数量ゼロはゼロ割回避）。
              averageUnitPrice: totalQuantity === 0 ? 0 : totalAmount / totalQuantity,
            };
          } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code;
            // ファイル不存在は欠損日として無視可能なため null を返す。
            if (errorCode === "ENOENT") {
              return null;
            }
            throw error;
          }
        })
      )
    ).filter(
      // 欠損日 null を除外し、型を絞り込む。
      (row): row is { date: string; totalAmount: number; totalQuantity: number; averageUnitPrice: number } => row !== null
    );

    // 最終レスポンスを構築。
    const jsonResult: z.infer<typeof outputSchema> = {
      storeName,
      statistics,
    };

    // structuredContent と content の両方を返して互換性を高める。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [{ type: "text", text: JSON.stringify(jsonResult) }],
    };
  }
); 