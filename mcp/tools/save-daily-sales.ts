import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";
import * as csv from "csv";
import { getAvailableStores } from "./get-stores";
import { getAvailableItems } from "./get-items";
import { add, format, parse } from "date-fns";

// 保存ツールは、入力された売上明細の形が正しいかを先に厳密に確認する。
// 後からCSVに書き出すため、ここで不正なデータを止めておくと分かりやすい。
const inputSchema = z.object({
  storeName: z.string().min(1).describe('店舗名 (有効な店名である必要があります)'),
  date: z.string().regex(/^\d{8}$/).describe('売り上げデータの日付 (YYYYMMDD形式)'),
  sales: z.array(
    z.object({
      itemName: z.string().describe('メニュー名'),
      unitPrice: z.number().nonnegative().describe('単価 (円)'),
      quantity: z.number().int().nonnegative().describe('販売数量'),
    })
  ).describe('売上明細 (すべてのメニューを含む必要があります)'),
}).describe('売り上げデータの保存に必要な情報');

const outputSchema = z.object({
  storeName: z.string().describe('店舗名'),
  date: z.string().describe('売り上げデータの日付 (YYYYMMDD形式)'),
  sales: z.array(
    z.object({
      itemName: z.string().describe('メニュー名'),
      unitPrice: z.number().nonnegative().describe('単価 (円)'),
      quantity: z.number().int().nonnegative().describe('販売数量'),
      amount: z.number().nonnegative().describe('売上金額')
    })
  ).describe('保存した売上明細'),
});

export const saveDailySales: RegisterTool = (server) => server.registerTool(
  'save_daily_sales',
  {
    title: '店舗内の売り上げデータを保存',
    description: '店舗の1日分の売り上げデータを保存します。保存対象の日付と店舗名を指定し、売り上げ明細を提供してください。明細にはすべてのメニューを含める必要があります。',
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: false, // このツールはデータ保存を伴うため、readOnlyHint は false に設定。
      destructiveHint: true, // データを変更する可能性があるため、destructiveHint は true に設定。
      idempotentHint: false, // 同じ入力でも複数回呼び出すと売り上げデータが重複保存される可能性があるため、idempotentHint は false に設定。
      openWorldHint: false, // 入力スキーマで受け取る情報が保存処理に必要なため、openWorldHint は false に設定。
    }
  },
  async ({ storeName, date, sales }) => {
    // 保存前に、対象店舗とメニューの一覧を読み込んでおく。
    // これにより「存在しない店舗」や「メニュー抜け」を事前に検出できる。
    const availableStoreNames = await getAvailableStores();
    const availableMenus = await getAvailableItems();

    // 店舗名が登録済みでなければ、保存をやめる。
    if (!availableStoreNames.includes(storeName)) {
      return {
        isError: true,
        content: [
          { type: "text", text: `指定された店舗名 "${storeName}" は存在しません。店名のリストを取得してから再度指定してください。` },
        ],
      };
    }

    // 入力された明細に、必要なメニューが全部入っているかを確認する。
    // 売上保存は「1 日分を丸ごと置く」前提なので、抜けや余計なメニューを検知する。
    const setMenus = new Set(sales.map(s => s.itemName));
    const missingMenus = availableMenus.filter(menu => !setMenus.has(menu.name));
    const extraMenus = sales.map(s => s.itemName).filter(itemName => !availableMenus.some(menu => menu.name === itemName));
    if (missingMenus.length > 0 || extraMenus.length > 0) {
      // 何が足りないか、何が余計かを一つずつ示して、修正しやすくする。
      const messages = [];
      if (missingMenus.length > 0) {
        messages.push(`以下のメニューが売り上げ明細に含まれていません: ${missingMenus.map(menu => menu.name).join(", ")}`);
      }
      if (extraMenus.length > 0) {
        messages.push(`以下のメニューは存在しないため売り上げ明細に含めることができません: ${extraMenus.join(", ")}`);
      }
      return {
        isError: true,
        content: [
          { type: "text", text: `売り上げ明細に不備があります。 ${messages.join(" | ")}` },
        ],
      };
    }
      // 保存先は「1日1店舗1ファイル」のルールにそろえる。
      // こうしておくと、あとで読み返す側がファイル名だけで内容を判断しやすい。
    // 保存先は 1日1店舗1ファイル（YYYYMMDD_店舗名.csv）。
    const filePath = `${projectRoot}/storage/csv/${date}_${storeName}.csv`;
      // 入力された金額はそのまま使わず、単価 × 数量 で再計算する。
      // 手入力や呼び出し側の誤りがあっても、保存データの整合性を保つため。
    // 入力明細を CSV 列仕様へ正規化し、金額は単価×数量で再計算する。
    const rows = sales.map((sale) => {
      const unitPrice = availableMenus.find(menu => menu.name === sale.itemName)?.price ?? 0;
      return {
        itemName: sale.itemName,
        unitPrice: unitPrice,
        quantity: sale.quantity,
        amount: unitPrice * sale.quantity,
      };
    });

    // Excel で開いたときに文字化けしにくいよう、BOM 付きで CSV を書き出す。
    const csvText = csv.stringify(
      rows.map(row => ([
        row.itemName,
        row.unitPrice,
        row.quantity,
        row.amount,
      ])),
      {
        header: true,
        columns: ["メニュー名", "単価 (円)", "売上数量 (個)", "売上金額 (円)"],
        bom: true,
      }
    );

    // 実際にファイルへ保存する。
    await fs.writeFile(filePath, csvText, "utf-8");

    // 保存した内容を、呼び出し元が確認しやすい形で返す。
    const jsonResult: z.infer<typeof outputSchema> = {
      storeName,
      date,
      sales: rows,
    };

    // 保存成功レスポンス。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [{ type: "text", text: JSON.stringify(jsonResult) }],
    };
  }
);

const getPreviousUnitPrices = async (storeName: string, date: string, availableMenus: string[]): Promise<{itemName: string, unitPrice: number}[]> => {
  // ある日付の単価一覧を作るために、指定日より前の日付を順に探す。
  // 直近の過去データを見つけて、同じメニューの価格を補うための補助関数。
  const unitPrices: {itemName: string, unitPrice: number}[] = [];
  let tDate = parse(date, 'yyyyMMdd', new Date());
  while (unitPrices.length < availableMenus.length) {
    if (tDate < new Date(2000, 0, 1)) {
      // これ以上さかのぼると探索が長すぎるので、無限に近いループを防ぐ。
      throw new Error(`有効な単価データが見つかりませんでした。店舗: ${storeName}, 日付: ${date} より前のデータを遡りましたが、2000年1月1日を超えました。`);
    }

    const fotmattedDate = format(tDate, 'yyyyMMdd');
    const filePath = `${projectRoot}/storage/csv/${fotmattedDate}_${storeName}.csv`;
    try {
      // 見つかった CSV から、メニュー名と単価を抜き出していく。
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

      rows.forEach(row => {
        const itemName = row["メニュー名"] ?? "";
        const unitPrice = Number(row["単価 (円)"] ?? 0);
        if (itemName && unitPrice) {
          unitPrices.push({ itemName, unitPrice });
        }
      });
    } catch (error) {
      // その日の CSV が無ければ、前日に戻って再探索する。
      tDate = add(tDate, { days: -1 });
    }
  }
  return unitPrices;
}
