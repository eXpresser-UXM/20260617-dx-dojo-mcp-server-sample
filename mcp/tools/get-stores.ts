import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";

// このツールは「店舗名の一覧を返すだけ」なので、利用者からの入力は不要。
const inputSchema = undefined;
const outputSchema = z.object({
  storeNames: z.array(z.string()).describe('店舗名のリスト')
})
export const getStores: RegisterTool = (server) => server.registerTool(
  'get_stores',
  {
    title: '店舗名のリストを取得',
    description: '店舗名のリストを取得します。店舗名は売り上げデータの保存や取得の際に必要になります。',
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: true, // データの取得のみを行うため、readOnlyHint は true に設定。
      destructiveHint: false, // データを変更しないため、destructiveHint は false に設定。
      idempotentHint: true, // 同じ入力であれば何度呼び出しても同じ結果になるため、idempotentHint は true に設定。
      openWorldHint: false, // 入力スキーマで受け取る情報が集計処理に必要なため、openWorldHint は false に設定。
    }
  },
  async () => {
    try {
      // JSON ファイルに保存された店舗一覧を読み込んで返す。
      // 売上データの保存や検索では、まず対象店舗を知る必要があるため、このツールを独立させている。
      const storeNames = await getAvailableStores();
      const jsonResult: z.infer<typeof outputSchema> = {
        storeNames
      }
      return { 
        isError: false,
        structuredContent: jsonResult,
        content: [
          { type: "text", text: JSON.stringify(jsonResult) },
        ]
      };
    }
    catch (error) {
      return {
        isError: true,
        content: [
          { type: "text", text: "店舗名のリストの読み込みに失敗しました。 + " + error },
        ],
      }
    }
  }
);

// storage/_stores.json だけを読んで、店舗名の配列にして返す。
// ファイルの場所をここにまとめておくと、他のツールからも再利用しやすい。
export const getAvailableStores = async (): Promise<string[]> => {
  const filePath = `${projectRoot}/storage/_stores.json`;
  try {
    // JSON の中身は単純な文字列配列を想定している。
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const storeNames: string[] = JSON.parse(fileContent);
    return storeNames;
  }
  catch (error) {
    console.error(`Error reading store names from ${filePath}:`, error);
    return [];
  }
}