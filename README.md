# TabBeacon

TabBeacon は、Web ページ上の要素状態を監視して、タブの favicon に状態を重ねて表示する Chrome 拡張の実験プロジェクトです。最初の主用途は、AI チャットが考え中かどうかを別タブ作業中でも視覚的に把握できるようにすることです。

## 現在の状態

このリポジトリには、Manifest V3 ベースの MVP 土台が入っています。

- content script ベースでページの状態を監視
- favicon に簡易スピナーを重ねて busy 状態を表示
- options page からルールを編集
- selectorType: `auto / css / xpath`
- `auto` 指定時は入力文字列から CSS / XPath を自動判定
- Smart busy detection
  - `aria-busy="true"`
  - Stop / Cancel / Interrupt / 停止 / 中断 系の UI 文言

## いまの設計方針

- まずは **小さく動く MVP** を優先する
- サイト別プリセットを増やしすぎず、まずは自分で使って検証する
- CSS セレクタだけでなく XPath も扱う
- 壊れにくさを上げるために `aria-*` 系のシグナルを優先する
- favicon アニメーションは毎回の生描画ではなく、事前生成フレームを再利用する

## まだ割り切っている点

- `content_scripts` と `host_permissions` はいま `"<all_urls>"` を使っている
  - MVP をすぐ試せるようにするための割り切り
  - 公開前には権限を絞る予定
- 条件はまだ 1 ルール 1 busyQuery の最小構成
- cross-origin の都合で元 favicon を描けない場合はフォールバックアイコンを使う
- Smart busy detection はまだヒューリスティック

## ディレクトリ構成

- `manifest.json` : Manifest V3 定義
- `content.js` : DOM 監視と favicon 更新
- `options.html` / `options.js` / `options.css` : 設定画面
- `icons/` : 拡張アイコン
- `ROADMAP.md` : 今後の進め方

## ローカルで試す

1. Chrome で `chrome://extensions` を開く
2. 右上のデベロッパーモードを ON
3. 「パッケージ化されていない拡張機能を読み込む」を選ぶ
4. このリポジトリのルートを読み込む
5. 拡張の詳細からオプション画面を開く
6. ChatGPT などのルールを設定して busy 状態の見え方を確認する

## 直近で確認したいこと

- ChatGPT の現行 DOM で `aria-busy` と Stop 系検知がどれだけ安定するか
- 別タブ作業時に本当に「待ち時間の認知コスト」が減るか
- 誤検知や CPU 負荷が気にならないか

## ライセンス

未設定
