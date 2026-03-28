# Manual tests

このディレクトリは TabBeacon の手動確認用ページを置くためのものです。本体コードとは用途が違うため、`manual-tests/` に分けています。

## まず必要なこと

`file://` で開く場合、Edge / Chrome の拡張詳細画面で **Allow access to file URLs** を ON にしてください。

Edge なら:

1. `edge://extensions/` を開く
2. TabBeacon の `Details` を開く
3. `Allow access to file URLs` を ON
4. 拡張を再読み込み

## 含まれているページ

- `tabbeacon-sandbox.html`
  - DOM 条件の手動テスト
  - network 条件の手動テスト
  - アイコンの変化確認

## おすすめの最初のルール

### URL パターン

```text
file:///*manual-tests/*
```

### 条件 1

- source: `dom`
- selectorType: `css`
- query: `[aria-busy="true"]`

### 条件 2

- source: `network`
- matchType: `urlContains`
- value: `postman-echo.com`
- method: `GET`
- resourceKind: `fetch/xhr`

### 条件の結合

- `ANY`

## 注意

- `file://` ページからの network テストはブラウザ制約や CORS の影響を受けることがあります
- その場合でも DOM テストは確認可能です
- network テストが不安定なら、後で `http://localhost` で開く軽いローカルサーバー方式も追加できます
