import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";

// 入力不要のツールなので inputSchema は undefined。
const inputSchema = undefined;
// ツールの返却 JSON 形式を厳密に定義。
// クライアント側が型安全に結果を扱えるようにする。
const outputSchema = z.object({
  data: z.array(
    z.object({
      storeName: z.string().describe('店舗名'),
      availableDates: z.array(z.string()).describe('データが取得可能な日付のリスト (YYYYMMDD形式)')
    })
  ).describe('取得可能な店舗と日付のリスト')
});


export const listAvailableDate: RegisterTool = (server) => server.registerTool(
  'list_available_date',
  {
    // 人間向けメタ情報。ツール選択時の表示名・説明に利用される。
    title: '取得可能店舗・日付のリスト取得',
    description: '売り上げデータが取得可能な店舗・日付のリストを取得します。',
    outputSchema: outputSchema,
    inputSchema: inputSchema,
    annotations: {
      readOnlyHint: true, // データの取得のみを行うため、readOnlyHint は true に設定。
      destructiveHint: false, // データを変更しないため、destructiveHint は false に設定。
      idempotentHint: true, // 同じ入力であれば何度呼び出しても同じ結果になるため、idempotentHint は true に設定。
      openWorldHint: false, // 入力スキーマで受け取る情報がないため、openWorldHint は false に設定。
    }
  },
  async () => {
    // storage 配下のファイル名を取得して、CSV 名から店舗と日付を逆引きする。
    const fileList = await fs.readdir(`${projectRoot}/storage`);
    // { 店舗名: [日付, 日付, ...] } という一時集約用オブジェクト。
    const availableDates: Record<string, string[]> = {};

    for (const fileName of fileList) {
      // CSV 以外のファイル（メモや隠しファイルなど）は対象外。
      if (!fileName.endsWith('.csv')) continue;
      // ファイル名形式: YYYYMMDD_店舗名.csv
      const [date, storeName] = fileName.replace('.csv', '').split('_');

      // 想定外の命名は無視して処理継続。
      if (!date || !storeName) continue;
      if (!availableDates[storeName]) {
        availableDates[storeName] = [];
      }
      // 店舗ごとに利用可能日付を追加。
      availableDates[storeName].push(date);
    }

    // スキーマ準拠の最終レスポンスを構築。
    const jsonResult: z.infer<typeof outputSchema> = {
      data: Object.entries(availableDates).map(([storeName, dates]) => ({
          storeName,
          availableDates: dates
        }))
      };

    // structuredContent は機械向け、content はテキスト表示向け。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [
        {type: "text", text: JSON.stringify(jsonResult) }
      ]
    }
  }
);
