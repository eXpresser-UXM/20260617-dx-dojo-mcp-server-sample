import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import path from "path";
import { fileURLToPath } from "url";

// ツール登録関数の共通シグネチャ。
// 各 tool ファイルで同じ型を使うことで、戻り値や引数の整合性を保ちやすくする。
export type RegisterTool = (server: McpServer) => ReturnType<McpServer['registerTool']>;
// プロンプト登録関数の共通シグネチャ。
export type RegisterPrompt = (server: McpServer) => ReturnType<McpServer['registerPrompt']>;
// リソース登録関数の共通シグネチャ（今後の拡張用）。
export type RegisterResource = (server: McpServer) => ReturnType<McpServer['registerResource']>;

// ESM 環境では __dirname が使えないため、現在ファイルの URL からパスを組み立てる。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// mcp ディレクトリの一つ上をプロジェクトルートとして扱う。
// storage などの相対パス参照をどのファイルからでも統一するための基準値。
export const projectRoot = path.resolve(__dirname, '../');