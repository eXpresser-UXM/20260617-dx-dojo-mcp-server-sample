import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import path from "path";
import { fileURLToPath } from "url";

// それぞれのツール実装は「サーバーに登録する関数」として形をそろえる。
// こうしておくと、どのツールも同じ使い方で server.registerTool を呼び出せる。
export type RegisterTool = (server: McpServer) => ReturnType<McpServer['registerTool']>;

// このプロジェクトは ESM 形式なので、Node.js の __dirname をそのまま使えない。
// そのため、今このファイルがどこにあるかを URL から逆算している。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// projectRoot は「このリポジトリのルート」を表す基準点。
// CSV や JSON へのアクセスを、実行場所に左右されず安定させるために使う。
export const projectRoot = path.resolve(__dirname, '../');