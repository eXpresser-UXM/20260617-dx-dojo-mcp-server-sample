import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getServer } from "./mcp-server";

// MCP サーバーを STDIO 経由で起動する。
// ローカル開発時にクライアント（Inspector など）と接続しやすいエントリポイント。
const runStdio = async () => {
  // ツール・プロンプト登録済みのサーバーインスタンスを作成。
  const server = getServer();
  // 入出力を標準入出力に紐づけるトランスポートを用意。
  const transport = new StdioServerTransport();

  // サーバーを接続開始し、受信待ち状態にする。
  await server.connect(transport);
}

// 起動失敗時は理由を表示し、異常終了であることが分かるように終了コード 1 を返す。
runStdio().catch((err) => {
  console.error("Error starting MCP STDIO Server:", err);
  process.exit(1);
});
