# Playwright Observer for TabBeacon

ブラウザ操作中の DOM・ネットワーク変化を観測するスクリプト。ChatGPT などでの AI 思考中状態を検知する条件を特定するために使用。

**使用ブラウザ**：Microsoft Edge（プロファイル互換性のため）

## セットアップ

```bash
cd playwright-observer
npm install
```

## 準備：Edge プロファイルのコピー

> ⚠️ Edge がプロファイルを使用中だと lock されて読み込めません。

### 手動コピー方法

1. PowerShell / cmd を開く
2. 以下を実行（プロファイルをコピー）：

```powershell
# テスト用プロファイル作成
Copy-Item -Path "C:\Users\{User Name}\AppData\Local\Microsoft\Edge\User Data" `
          -Destination "C:\Users\{User Name}\AppData\Local\Microsoft\Edge\User Data - Playwright" `
          -Recurse -Force
```

または、エクスプローラー手動操作：
- `C:\Users\{User Name}\AppData\Local\Microsoft\Edge\User Data` をコピー
- 同じ場所に `User Data - Playwright` として貼付

これで Edge のデフォルト動作に影響なく playwright で利用可能になります。

## 実行

### 基本的な起動

```bash
npm start
# または
npm run observe
```

最初の `https://` ページ（拡張機能やdevtools を除く）に自動的に接続します。

### 監視対象を指定

**ワイルドカードパターンで指定**（推奨）：

```bash
# Gemini を監視
npm start -- --url-pattern gemini.google.com/*

# ChatGPT を監視
npm start -- --url-pattern chatgpt.com/*

# Claude を監視
npm start -- --url-pattern claude.ai/*

# ショートハンド
npm start -- -p gemini.google.com/*
```

**部分一致で指定**（シンプル）：

```bash
npm start -- gemini
npm start -- chatgpt
```

**環境変数で指定**：

```powershell
# PowerShell
$env:TARGET_URL="gemini.google.com/*"
npm start

# または bash
TARGET_URL="gemini.google.com/*" npm start
```

## 使い方

1. ブラウザが開いたら、監視対象のサイト（ChatGPT、Gemini など）にアクセス（既にログインしていれば使用可能）
2. 監視対象を操作中、ターミナルにリアルタイムで DOM・Network イベントが表示されます
3. 端末で以下のコマンドを入力：
   - **s** / **snapshot**：現在のページ状態をスナップショット保存
   - **r** / **report**：これまでのデータをレポート出力
   - **q** / **exit**：終了してファイルに全データを保存
   - **Enter**：スキップ（次のコマンド待ち）

## 観測内容

### DOM 監視
- `aria-busy` 属性の変化
- `aria-live`, `aria-disabled` などの ARIA 属性
- Stop/Cancel/Interrupt ボタンの検知
- 新しく追加/削除されたノード

### ネットワーク監視
- リクエスト/レスポンスのメタデータ
  - Method (POST, GET など)
  - URL とリソースタイプ
  - ステータスコード
  - Content-Type
- WebSocket 接続の検知
- リクエスト開始～終了のタイムライン

### 出力ファイル

`observations/` ディレクトリに保存：

- `snapshot-*.json` — ページ状態のスナップショット
- `report-*.json` — 全観測データ含む最終レポート

## Edge プロファイルの利用

デフォルトではこのパスを使用：
```
C:\Users\{User Name}\AppData\Local\Microsoft\Edge\User Data - Playwright
```

別のプロファイルを使う場合、環境変数 `EDGE_PROFILE_PATH` を設定：

```powershell
$env:EDGE_PROFILE_PATH="C:\path\to\your\profile"
npm start
```

> 📌 **Note**：実際のシステム Edge（`msedge.exe`）を使用するため、プロファイルは Edge と互換性があります。

## 出力例

### Timeline

```json
{
  "timestamp": "2026-03-31T14:30:12.345Z",
  "event": "network.requestWillBeSent",
  "method": "POST",
  "url": "https://chatgpt.com/api/chatgpt/...",
  "resourceType": "xhr"
}
```

### Busy Elements

```json
{
  "tagName": "div",
  "className": "message-content",
  "id": "msg-123",
  "selector": "div.message-content"
}
```

### Network Requests

```json
{
  "timestamp": "2026-03-31T14:30:12.345Z",
  "requestId": "req-001",
  "method": "POST",
  "url": "https://chatgpt.com/api/chatgpt/...",
  "resourceType": "fetch",
  "statusCode": 200,
  "contentType": "application/json"
}
```

## 次のステップ

1. ChatGPT でプロンプトを送信してレスポンス生成を観察
2. DOM と network ログを確認して、安定した検知ルール候補を特定
3. 結果を `../notes/` に保存
4. TabBeacon の `options.js` にプリセットを追加
