import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { listAvailableDate } from "./tools/list-available-date";
import { getSalesRowdata } from "./tools/get-sales-rowdata";
import { saveDailySales } from "./tools/save-daily-sales";
import { getStores } from "./tools/get-stores";
import { getItems } from "./tools/get-items";

export const getServer = () => {
  // まず、MCP クライアントに見せる「サーバーの顔」を作る。
  // name / description / version は、Inspector や Claude Desktop の一覧表示にそのまま出る。
  const server = new McpServer(
    {
      name: "売上管理システム",
      description: "各店舗の売上を管理するシステムです。",
      version: "1.0.0",
    }
  );

  // ここで「このサーバーが何をできるか」を1つずつ登録する。
  // ツールはあとから並び順ごと見つけやすいよう、役割の近いものをまとめている。
  getStores(server);
  getItems(server);
  listAvailableDate(server);
  getSalesRowdata(server);
  saveDailySales(server);

  // 登録が完了したサーバーを返す。呼び出し元はこの server を起動するだけでよい。
  return server;
  
}