# Gmail Manager

肥大化した Gmail を整理するためのローカル Web ツール。
検索条件でメールを絞り込み、一括削除の進捗をリアルタイムで確認できます。

## スクリーンショット

| ログイン | 検索 | 削除進捗 |
|--------|------|--------|
| Google OAuth でワンクリックログイン | カテゴリ・期間・既読状態・ラベルで絞り込み | SSE でプログレスバーをリアルタイム更新 |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | [Hono](https://hono.dev/) + [Bun](https://bun.sh/) |
| フロントエンド | [Vite](https://vitejs.dev/) + React + Tailwind CSS v4 |
| DB | SQLite (`bun:sqlite`) + [Drizzle ORM](https://orm.drizzle.team/) |
| Auth | Google OAuth 直実装（`googleapis`） |
| 進捗通知 | SSE（Server-Sent Events） |

## 必要なもの

- [Bun](https://bun.sh/) v1.x 以上
- Google Cloud Console プロジェクト（OAuth クライアント作成済み）

## セットアップ

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **API とサービス → 認証情報** から OAuth 2.0 クライアント ID を作成
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みのリダイレクト URI: `http://localhost:3001/api/auth/callback`
3. **API とサービス → ライブラリ** で **Gmail API** を有効化

### 2. 環境変数

```bash
cp .env.local.example server/.env.local
```

`server/.env.local` を編集:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/auth/callback"
CLIENT_ORIGIN="http://localhost:5173"
PORT=3001
```

### 3. 起動

```bash
bun install
bun run dev
```

ブラウザで http://localhost:5173 を開く。

## 使い方

1. **「Google でログイン」** → Google アカウントで認証
2. 検索条件を入力（カテゴリ・日数・既読状態・ラベル）
3. **「メールを検索」** → 件数を確認
4. **「〇件を削除」** → プログレスバーで進捗確認
5. 完了後、実行時間と処理速度が表示される

## 開発

```bash
# 型チェック
bun run typecheck

# Lint
bun run lint

# Lint + 自動修正
bun run lint:fix

# Git hooks のインストール（初回のみ）
bun run prepare
```

## プロジェクト構成

```
gmail-manager/
  server/               # Hono バックエンド
    src/
      routes/           # auth.ts, mails.ts, jobs.ts
      services/         # GmailService.ts, JobRunner.ts
      db/               # schema.ts, index.ts
      middleware/       # session.ts
    index.ts
  client/               # Vite + React フロントエンド
    src/
      components/       # LoginPage, Dashboard, SearchForm, DeleteProgress
      App.tsx
  data/                 # SQLite DB（gitignore）
  .env.local.example
```

## ライセンス

MIT
