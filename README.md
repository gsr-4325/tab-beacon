# README

## 概要

TabBeacon は、Web ページ上の状態変化を監視し、タブの favicon に busy 表示を重ねる Chrome / Edge 向け Manifest V3 拡張の実験プロジェクトです。最初の主用途は、ChatGPT などの AI チャットが考え中かどうかを、別タブ作業中でも視覚的に把握しやすくすることです。

現在の manifest version は `0.3.1` です。

## 現在の到達点

- DOM 条件と network 条件を 1 ルール内で混在可能
- selectorType は `auto / css / xpath`
- `auto` 指定時は CSS / XPath を自動判定
- ルール単位で `ANY / ALL` 条件結合
- 複数ルールが同一 URL にマッチした場合は OR 評価
- Smart busy detection
  - `aria-busy="true"`
  - Stop / Cancel / Interrupt / 停止 / 中断 系の UI 文言
- favicon busy overlay アニメーション
- 元 favicon が無いページでも fallback icon を復元可能
- options page からルール編集
- 条件カードの折りたたみ
- ルールカードの折りたたみ（デフォルトで閉じる）
- `user / system preset` の区別
- ローカル sandbox 用デバッグプリセット
- `_locales/en` と `_locales/ja` の土台
- 設定画面フッターのバージョン表示

## ユーザー確認済みの挙動

次は会話中に実際に確認できたものです。

- `aria-busy` 要素の追加で busy overlay が始まる
- `aria-busy` 要素の削除で busy overlay が止まる
- sandbox 上で favicon の busy / idle 反映が正しく動く
- Rules セクションの視覚的差異は意図どおり
- `content.js` の UTF-8 問題は main に hotfix 済み

## 主要ファイル

- `manifest.json` : Manifest V3 定義
- `background.js` : タブ単位 / ルール単位の network 監視の最小実装
- `content.js` : DOM 監視、Smart busy detection、favicon 更新
- `options.html` / `options.js` / `options.css` : 設定画面
- `i18n.js` : options UI の i18n 補助
- `_locales/en/messages.json` / `_locales/ja/messages.json` : locale 文字列
- `manual-tests/tabbeacon-sandbox.html` : ローカル手動テストページ
- `ROADMAP.md` : 実装進捗と未着手タスク

## ローカルで試す

### 拡張の読み込み

1. Chrome なら `chrome://extensions`、Edge なら `edge://extensions` を開く
2. 右上のデベロッパーモードを ON
3. 「パッケージ化されていない拡張機能を読み込む」を選ぶ
4. このリポジトリのルートを読み込む
5. 設定画面を開く

### sandbox のテスト

1. 拡張の詳細で **Allow access to file URLs** を ON にする
2. 設定画面の Debug tools を開く
3. **Install local sandbox preset** を押す
4. `manual-tests/tabbeacon-sandbox.html` を `file://` で開く
5. `aria-busy 要素を追加` / `削除` や `5秒 busy シナリオ` を試す

## まだ割り切っている点

- `content_scripts` と `host_permissions` はまだ `"<all_urls>"`
- Smart busy detection はヒューリスティックで、サイト別の厳密最適化はまだ未着手
- network 監視は最小土台で、クールダウンや除外戦略は未実装
- content / background 側のユーザー向け文言の i18n はまだ途中
- import / export、要素ピッカー、診断 UI は未実装
- ライセンスは未設定

## 次の AI への引き継ぎメモ

- まず `ROADMAP.md` を見て、完了済みと未完了を確認する
- issue は main の実装より古いことがあるので、着手前に現状コードと直近コミットを照合する
- 最近の安定化で重要だったのは次の 2 点
  - favicon 復元 fallback の追加
  - `content.js` の UTF-8 hotfix
- 直近で次に進めるなら、network 条件の診断 UI、ChatGPT 実測、権限の絞り込みの順が妥当

## ライセンス

未設定
