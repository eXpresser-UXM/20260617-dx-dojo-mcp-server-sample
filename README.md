# 店舗売上データ管理用 MCP サンプルコード

![このリポジトリの説明。店舗・日ごとに売り上げデータが CSV で管理されているシステムにおいて、MCP を使ってデータを操作する様子](docs/top.webp)

このプロジェクトは、CSV で管理している店舗売上データを MCP サーバー経由で取得・保存できるようにしたサンプルです。現在の実装では、店舗一覧とメニュー一覧の取得、取得可能日付の一覧化、期間指定の明細取得、1 日分の売上保存を提供しています。

## 必要な環境

- Node.js 20 以降
- npm, npx が使えること
- MCP クライアント 例: Claude Desktop, MCP Inspector

## セットアップ

リポジトリをクローンして依存関係をインストールします。

```bash
git clone https://github.com/eXpresser-UXM/20260617-dx-dojo-mcp-server-sample.git
cd 20260617-dx-dojo-mcp-server-sample
npm install
```

MCP サーバーが正しく起動するか確認するには、インスペクタを使います。

```bash
npm run inspect
```

起動するとブラウザが開くので、左側ペインの Connect を押して接続します。接続できると、右側ペインでサーバー名の「売上管理システム」が表示されます。上部の Tools から List Tools を開くと、登録済みツールの一覧が確認できます。

![MCP Inspector でツール一覧を確認する画面](docs/inspector.webp)

## MCP クライアント設定例

Claude Desktop などの MCP クライアントから使う場合は、次のように設定します。`/path/to/this/project` はこのプロジェクトのルートに置き換えてください。

```json
{
  "mcpServers": {
    "dx-dojo-sample-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/path/to/this/project/mcp/main-stdio.ts"
      ]
    }
  }
}
```

クライアントを再起動したあと、たとえば次のような指示で動作確認できます。

```prompt
2025年12月の全店舗の売上を確認してください。
```

## 全体像

- エントリポイントは [mcp/main-stdio.ts](mcp/main-stdio.ts)
- サーバーの組み立ては [mcp/mcp-server.ts](mcp/mcp-server.ts)
- 個別の機能は [mcp/tools](mcp/tools) 配下
- データ本体は [storage](storage) 配下の JSON と CSV

## 登録されているツール

### [mcp/tools/get-stores.ts](mcp/tools/get-stores.ts)

店舗名の一覧を [storage/_stores.json](storage/_stores.json) から取得します。売上データの保存や参照の前に、対象店舗を確認するときに使います。

### [mcp/tools/get-items.ts](mcp/tools/get-items.ts)

メニュー一覧を [storage/_menus.json](storage/_menus.json) から取得します。メニュー名と単価を確認したいときに使います。

### [mcp/tools/list-available-date.ts](mcp/tools/list-available-date.ts)

`storage` 配下の CSV を走査して、店舗ごとに取得可能な日付をまとめて返します。ファイル名は `YYYYMMDD_店舗名.csv` の形式を前提にしています。

### [mcp/tools/get-sales-rowdata.ts](mcp/tools/get-sales-rowdata.ts)

指定した店舗名と期間の売上明細を返します。存在しない日付の CSV は無視し、ある日だけをまとめて返します。返却される明細はメニュー名、単価、数量、金額です。

### [mcp/tools/save-daily-sales.ts](mcp/tools/save-daily-sales.ts)

1 日分の売上明細を CSV として保存します。店舗名の妥当性を確認し、メニュー一覧に存在する商品だけを受け付けます。保存時の金額は単価と数量から再計算されます。

## データ配置

- [storage/_stores.json](storage/_stores.json): 店舗名一覧
- [storage/_menus.json](storage/_menus.json): メニュー一覧
- [storage/csv](storage/csv): 日別売上 CSV

## 使い方の流れ

1. 店舗名とメニュー名を取得する
2. 取得可能日付を確認する
3. 期間を指定して売上明細を取得する
4. 必要に応じて 1 日分の売上を保存する

この流れに沿うと、AI クライアントからでも手作業でも扱いやすくなります。
