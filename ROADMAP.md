# ROADMAP

## 目的

AI チャットや Web アプリの「処理中」を、通知音やデスクトップ通知に頼らず、タブの favicon だけで静かに把握できるようにする。

## Phase 1: 動く最小土台

- [x] Manifest V3 の最小構成
- [x] content script による DOM 監視
- [x] favicon への busy 表示
- [x] options page でのルール編集
- [x] CSS / XPath / auto 判定
- [x] `aria-busy` と Stop 系 UI による Smart busy detection

## Phase 2: 使えるルールエンジンへ育てる

- [x] リピータブルな条件フィールド
- [x] ルール単位の `ANY / ALL` 条件結合
- [x] 複数 DOM 条件の評価
- [x] 旧 `busyQuery` 形式からの後方互換読み込み
- [x] 同一 URL にマッチした複数ルールを OR として評価
- [x] ルールに `origin / slug / readonly` を追加
- [x] options UI に network 条件編集 UI を追加
- [ ] `exists / notExists / textIncludes / attributeEquals` を追加
- [ ] ルールの簡易バリデーション
- [ ] 設定画面からのテスト実行ボタン

## Phase 3: ChatGPT での実測と安定化

- [x] ローカル手動テストページを追加
- [x] sandbox にログコピー、状態リセット、重複実行ガードを追加
- [x] sandbox で `aria-busy` の追加 / 削除に応じた busy / idle を確認
- [x] 元 favicon 未定義ページ向けの favicon restore fallback を追加
- [x] `content.js` の UTF-8 hotfix を main に反映
- [ ] ChatGPT の現行 DOM で busy 判定を実測
- [ ] 誤検知の整理
- [ ] `aria-busy` 以外の壊れにくいシグナル候補を整理
- [ ] 1週間の実使用で有用性を確認
- [ ] CPU 負荷と違和感の確認
- [ ] favicon 復元まわりの edge case を追加洗い出し

## Phase 4: Network 監視の実装プラン

- [x] ルールスキーマに `source: dom | network` を追加
- [x] `background.service_worker` を追加
- [x] タブ単位・ルール単位の in-flight request カウンタの最小実装
- [x] network 条件として `urlContains / pathPrefix / regex` を実装
- [x] network 条件として `method / resourceKind` フィルタを実装
- [x] DOM と network の hybrid 判定の土台を実装
- [ ] request 終了後のクールダウンを実装
- [ ] 関係ない通信を避けるための除外戦略を整理
- [ ] WebSocket / streaming fetch / SSE の扱い方針を整理
- [ ] network 条件の診断 UI を追加

## Phase 5: 設定体験の改善

- [x] 条件行ごとの source 切り替え UI
- [x] 条件カードの折りたたみ
- [x] ルールカードの折りたたみ
- [x] ルールカードをデフォルトで閉じる
- [x] Rules → rule → Conditions → condition の視覚差異を追加
- [x] `System preset` をユーザールールより低彩度で表示
- [x] デバッグツール表示スイッチを追加
- [x] ローカル sandbox 用デバッグプリセット追加ボタンを実装
- [x] システムプリセットの重複追加防止を実装
- [x] 設定画面フッターのバージョン表示
- [ ] 要素ピッカー
- [ ] 現在のページからルールを追加
- [x] import / export
- [ ] ユーザー向けエラーメッセージとヒント表示を拡充
- [ ] デバッグ表示または診断モード

## Phase 6: 公開前の整理

- [x] `_locales/en` と `_locales/ja` を追加
- [x] options UI の i18n 化を開始
- [x] README を現状実装に合わせて更新
- [x] ROADMAP を現状進捗に合わせて更新
- [ ] content / background 側のユーザー向け文言も i18n 化
- [ ] `<all_urls>` をやめて権限を絞る
- [ ] optional permissions の検討
- [ ] README のスクリーンショット追加
- [ ] ストア掲載文面の作成
- [ ] ライセンス決定

## Phase 7: 拡張候補

- [ ] done / error 状態の表示
- [ ] サイト別の軽いプリセット
- [ ] favicon オーバーレイの表示バリエーション
- [ ] 一時停止トグル

## 次の着手候補

- network 条件の診断 UI を追加して、どの request が busy 判定に効いたか見えるようにする
- ChatGPT 本番 DOM / network を実測し、誤検知と壊れにくいシグナル候補を整理する
- `<all_urls>` をやめる前提で、権限と optional permissions の設計を詰める

## 判断基準

このプロジェクトは、機能が増えたら成功ではなく、次を満たしたら成功とみなす。

- 別タブ作業中に busy 状態がすぐ分かる
- 誤判定が少ない
- 常用しても邪魔にならない
- 自分が継続して使いたくなる
