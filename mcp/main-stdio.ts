import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getServer } from "./mcp-server";

// このファイルは、MCP サーバーを標準入出力で起動するための入口。
// Claude Desktop や Inspector は、この STDIO 方式でサーバーと会話する。
const runStdio = async () => {
  // まず、ツール登録が済んだサーバー本体を作る。
  const server = getServer();
  // 標準入出力を使ってやり取りするための通路を用意する。
  const transport = new StdioServerTransport();

  // 実際に接続して、クライアントからのリクエストを待ち受ける。
  await server.connect(transport);
}

// 起動に失敗したら原因を表示して、プロセスを異常終了させる。
// こうしておくと、設定ミスや依存関係の問題がすぐ分かる。
runStdio().catch((err) => {
  console.error("Error starting MCP STDIO Server:", err);
  process.exit(1);
});
