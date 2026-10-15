# Gmail Manager

肥大化した Gmail を整理するためのローカル Web ツール。
検索条件でメールを絞り込み、一括削除の進捗をリアルタイムで確認できます。

## クイックスタート

```bash
git clone <このリポジトリの URL>
cd gmail-manager
cp .env.local.example server/.env.local
# server/.env.local を編集（Google OAuth 認証情報を設定）
bun install
bun run start
# → ビルド完了後、ブラウザが自動で http://localhost:3001 を開きます
```

> **初回のみ** Google Cloud Console で OAuth クライアントを作成し、`.env.local` に設定が必要です。
> 詳細は[セットアップ](#セットアップ)を参照してください。

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
PORT=3001
```

### 3. 起動

```bash
bun install
bun run start
```

ブラウザが自動で `http://localhost:3001` を開きます。

## 使い方

1. **「Google でログイン」** → Google アカウントで認証
2. 検索条件を入力（カテゴリ・日数・既読状態・ラベル）
3. **「メールを検索」** → 件数を確認
4. **「〇件を削除」** → プログレスバーで進捗確認
5. 完了後、実行時間と処理速度が表示される

## OAuth 利用状況の定期確認

GitHub Actions の「OAuth 利用確認リマインダー」が毎月1日 09:17（日本時間）に、
専用の運用 Issue で `@scottlz0310` に確認を促します。初回は Issue を作成し、
以後は同じ Issue にコメントします。同月の再実行は投稿を増やしません。
Gmail API には接続せず、Google の認証情報や追加の secret は不要です。

- 警告期限は現在不明です。判明したら repository variable `OAUTH_WARNING_DEADLINE` に
  `YYYY-MM-DD` 形式で設定してください。これは表示用で、通知周期は毎月のままです。
- 通知には翌月1日を次回確認日として記載します。警告の実期限が先に来る場合は期限前に対応してください。
- 通知を受け取るには運用 Issue の **Subscribe** と GitHub の通知設定を確認してください。
  この Issue は実装 Issue #142 と別に継続使用し、open のまま維持してください。
- 確認時は Google の警告メール・Cloud Console で対象 OAuth クライアントと実期限を確認し、
  必要に応じてローカルアプリで手動ログインします。実施日・期限・結果だけを Issue に記録し、
  token・client secret・警告メール本文は投稿しないでください。
- **通知だけでは OAuth の利用実績は更新されません。** ログインで警告が解消したかも確認してください。

workflow が main に入った後は、Actions → OAuth 利用確認リマインダー → **Run workflow** で
初回通知と通知経路を確認できます。実際の Issue 作成・コメントを伴います。
実行結果はログと Job summary に残り、API の失敗は workflow の失敗として扱います。
必要な権限は `contents: read` と `issues: write` です。fork では通知ジョブを実行しません。

定期実行は main 上でのみ動作し、GitHub の混雑で遅延・未実行になる場合があります。
公開リポジトリは60日間活動がないと schedule が無効化されるため、Actions の有効状態も確認してください。
実期限の保証が必要な場合は手元のカレンダーにも登録してください。
詳細は [GitHub の schedule 仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)を参照してください。

## 開発

```bash
# 開発サーバー起動（Vite HMR あり / http://localhost:5173）
bun run dev

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
