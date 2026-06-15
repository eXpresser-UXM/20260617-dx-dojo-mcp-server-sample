import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { listAvailableDate } from "./tools/list-available-date";
import { getSalesRowdata } from "./tools/get-sales-rowdata";
import { saveDailySales } from "./tools/save-daily-sales";
import { getStores } from "./tools/get-stores";
import { getItems } from "./tools/get-items";

export const getServer = () => {
  // MCP サーバー本体を初期化。
  // ここで設定する name / description / version はクライアント側の表示にも利用される。
  const server = new McpServer(
    {
      name: "売上管理システム",
      description: "各店舗の売上を管理するシステムです。",
      version: "1.0.0",
    }
  );

  // 以降で業務機能をサーバーに登録する。
  getStores(server);
  getItems(server);
  listAvailableDate(server);
  getSalesRowdata(server);
  saveDailySales(server);

  // すべて登録済みのサーバーを呼び出し元へ返す。
  return server;
  
}