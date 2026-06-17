import z from "zod";
import { projectRoot, type RegisterTool } from "../lib";
import fs from "fs/promises";

// 入力不要のツールなので inputSchema は undefined。
const inputSchema = undefined;
const outputSchema = z.object({
  items: z.array(z.object({
    name: z.string().describe('メニュー名'),
    price: z.number().nonnegative().describe('単価 (円)')
  })).describe('メニュー名のリスト')
})
export const getItems: RegisterTool = (server) => server.registerTool(
  'get_items',
  {
    title: 'メニューのリストを取得',
    description: 'メニューのリストを取得します。メニューは売り上げデータの保存や取得の際に必要になります。',
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
      const items = await getAvailableItems();
      const jsonResult: z.infer<typeof outputSchema> = {
        items
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
          { type: "text", text: "メニュー名のリストの読み込みに失敗しました。 + " + error },
        ],
      }
    }
  }
);

export const getAvailableItems = async (): Promise<{ name: string; price: number }[]> => {
  const filePath = `${projectRoot}/storage/_menus.json`;
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const menuNames: { name: string; price: number }[] = JSON.parse(fileContent);
    return menuNames;
  }
  catch (error) {
    console.error(`Error reading menu names from ${filePath}:`, error);
    return [];
  }
}