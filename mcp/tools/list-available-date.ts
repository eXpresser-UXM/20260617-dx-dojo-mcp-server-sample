import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";

// 利用者入力が不要な「参照専用ツール」なので、inputSchema は持たない。
const inputSchema = undefined;
// 出力の形を先に決めておくと、クライアントが結果を読み取りやすくなる。
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
    // storage 配下にあるファイル名を見て、どの店舗にどの日付のCSVがあるかを逆算する。
    const fileList = await fs.readdir(`${projectRoot}/storage`);
    // いったん { 店舗名: [日付, 日付, ...] } の形で集約してから返す。
    const availableDates: Record<string, string[]> = {};

    for (const fileName of fileList) {
      // CSV 以外のファイルは売上データではないので対象外にする。
      if (!fileName.endsWith('.csv')) continue;
      // ファイル名形式は YYYYMMDD_店舗名.csv を前提にしている。
      const [date, storeName] = fileName.replace('.csv', '').split('_');

      // 想定外のファイル名は無理に解釈せず、そのまま飛ばす。
      if (!date || !storeName) continue;
      if (!availableDates[storeName]) {
        availableDates[storeName] = [];
      }
      // 同じ店舗のファイルを日付ごとに積み上げる。
      availableDates[storeName].push(date);
    }

    // 返却しやすいように、オブジェクトを配列に変換して最終レスポンスにする。
    const jsonResult: z.infer<typeof outputSchema> = {
      data: Object.entries(availableDates).map(([storeName, dates]) => ({
          storeName,
          availableDates: dates
        }))
      };

    // structuredContent はプログラム向け、content は人が読むテキスト向け。
    return {
      isError: false,
      structuredContent: jsonResult,
      content: [
        {type: "text", text: JSON.stringify(jsonResult) }
      ]
    }
  }
);
