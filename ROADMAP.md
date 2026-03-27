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

## Phase 2: 自分で使って詰める

- [ ] ChatGPT で busy 判定の実測
- [ ] 誤検知の整理
- [ ] busy 判定の優先順位見直し
- [ ] 1週間の実使用で有用性を確認
- [ ] CPU 負荷と違和感の確認

## Phase 3: 条件エンジンを少し拡張

- [ ] `exists / notExists / textIncludes / attributeEquals` を追加
- [ ] CSS / XPath の両対応を維持
- [ ] 複数条件の OR 対応
- [ ] ルールの簡易バリデーション

## Phase 4: 設定体験の改善

- [ ] 要素ピッカー
- [ ] 現在のページからルールを追加
- [ ] テスト実行ボタン
- [ ] import / export

## Phase 5: 公開前の整理

- [ ] `<all_urls>` をやめて権限を絞る
- [ ] optional permissions の検討
- [ ] README のスクリーンショット追加
- [ ] ストア掲載文面の作成
- [ ] ライセンス決定

## Phase 6: 拡張候補

- [ ] done / error 状態の表示
- [ ] サイト別の軽いプリセット
- [ ] favicon オーバーレイの表示バリエーション
- [ ] 一時停止トグル

## 判断基準

このプロジェクトは、機能が増えたら成功ではなく、次を満たしたら成功とみなす。

- 別タブ作業中に busy 状態がすぐ分かる
- 誤判定が少ない
- 常用しても邪魔にならない
- 自分が継続して使いたくなる
