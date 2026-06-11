import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { listAvailableDate } from "./tools/list-available-date";
import { getSalesRowdata } from "./tools/get-sales-rowdata";
import { getSalesStatisticsPerDate } from "./tools/get-sales-statistics-perdate";
import { getSalesStatisticsPerItem } from "./tools/get-sales-statistics-peritem";
import { saveDailySales } from "./tools/save-daily-sales";
import { registerSalesAssistant } from "./tools/register-sales-assistant";

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
  // 登録順は必須ではないが、機能を把握しやすいように一覧系→集計系→保存系→対話系の順に並べている。
  listAvailableDate(server);
  getSalesRowdata(server);
  getSalesStatisticsPerDate(server);
  getSalesStatisticsPerItem(server);
  saveDailySales(server);
  registerSalesAssistant(server);

  // すべて登録済みのサーバーを呼び出し元へ返す。
  return server;
  
}