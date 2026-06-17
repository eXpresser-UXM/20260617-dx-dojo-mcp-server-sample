import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";
import * as csv from "csv";
import {addDays, format, parse} from "date-fns";
import { getAvailableStores } from "./get-stores";

// 店舗名と取得期間を受け取る入力スキーマ。
const inputSchema = z.object({
  storeName: z.string().min(1).describe('店舗名'),
  from: z.string().regex(/^\d{8}$/).describe('取得期間の開始日 (YYYYMMDD形式、その日を含む)'),
  to: z.string().regex(/^\d{8}$/).describe('取得期間の終了日 (YYYYMMDD形式、その日を含む)'),
});
// 明細データを日付ごとに返す出力スキーマ。
const outputSchema = z.object({
  storeName: z.string().describe('店舗名'),
  sales: z.array(
    z.object({
      date: z.string().describe('売上データの日付 (YYYYMMDD形式)'),
      details: z.array(
        z.object({
          itemName: z.string().describe('メニュー名'),
          unitPrice: z.number().describe('単価'),
          quantity: z.number().describe('販売数量'),
          amount: z.number().describe('売上金額')
        })
      ).describe('売上データの詳細'),
    })
  ).describe('売り上げデータの内容。対象店舗や期間がない場合は、空の配列になります。')
});

export const getSalesRowdata: RegisterTool = (server) => server.registerTool(
  'get_sales_rowdata',
  {
    // クライアントが選びやすいよう用途を分かりやすく記述。
    title: '店舗内の売り上げデータを取得',
    description: '店舗内の売り上げデータを取得します。日付・メニューごとにその店舗の売上高を計算します。取得期間が大きいと返却データが大きくなる可能性があります。',
    inputSchema: inputSchema,
    outputSchema: outputSchema,
    annotations: {
      readOnlyHint: true, // データの取得のみを行うため、readOnlyHint は true に設定。
      destructiveHint: false, // データを変更しないため、destructiveHint は false に設定。
      idempotentHint: true, // 同じ入力であれば何度呼び出しても同じ結果になるため、idempotentHint は true に設定。
      openWorldHint: false, // 入力スキーマで受け取る情報が集計処理に必要なため、openWorldHint は false に設定。
    }
  },
  async ({storeName, from, to}) => {
    if (!(await getAvailableStores()).includes(storeName)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `指定された店舗名 "${storeName}" は存在しません。店名のリストを取得してから再度指定してください。`
          }
        ]
      };
    }

    // 文字列日付を Date に変換して比較可能にする。
    const dateFrom = parse(from, 'yyyyMMdd', new Date())
    const dateTo = parse(to, 'yyyyMMdd', new Date())

    // 入力ミス（開始日 > 終了日）は早期にエラー返却。
    if (dateFrom > dateTo) {
      return {
        isError: true,
        content: [
          {
            type: "text", 
            text: "取得期間の開始日が終了日よりも後になっています。正しい期間を指定してください。"
          }
        ]
      }
    }

    // 取得期間を1日ごとにyyyyMMdd形式の文字列に変換してリスト化
    const dateList: string[] = [];
    for (let d = dateFrom; d <= dateTo; d = addDays(d, 1)) {
      dateList.push(format(d, 'yyyyMMdd'));
    }

    // 日ごとの CSV 読み込みを並列実行し、全日分をまとめて取得する。
    const sales = await Promise.all(
      dateList.map(async (date) => {
        const filePath = `${projectRoot}/storage/csv/${date}_${storeName}.csv`;

        try {
          // CSV をテキストで読み込み、ヘッダ付きレコードへパース。
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

          // CSV の列名を API 返却用のフィールドへ正規化する。
          const details = rows.map((row) => ({
            itemName: row["メニュー名"] ?? "",
            unitPrice: Number(row["単価 (円)"] ?? 0),
            quantity: Number(row["売上数量 (個)"] ?? 0),
            amount: Number(row["売上金額 (円)"] ?? 0),
          }));

          return {
            date,
            details,
          };
        } catch (error) {
          const errorCode = (error as NodeJS.ErrnoException).code;
          // 該当日のファイルが無い場合は「データなし」として null を返し、後段で除去する。
          if (errorCode === "ENOENT") {
            return null;
          }
          // 想定外エラーは握りつぶさずに上位へ伝播。
          throw error;
        }
      })
    );

    // null（欠損日）を取り除いたうえで最終レスポンスを構築。
    const jsonResult: z.infer<typeof outputSchema> = {
      storeName,
      sales: sales.filter((sale): sale is { date: string; details: { itemName: string; unitPrice: number; quantity: number; amount: number }[] } => sale !== null),
    };

    // structuredContent は機械向け、content は汎用テキスト表示向け。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [{ type: "text", text: JSON.stringify(jsonResult) }],
    };
  }
);