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

本ツールは自分用のローカル運用を前提とし、各利用者が自分の Google Cloud プロジェクトと
OAuth クライアントを用意する方式（BYO クライアント）を採用します。
同意画面は **外部（External）・テスト中（Testing）** のまま利用し、必要時に再ログインします。
現時点で、第三者向けのホスティングや Production への切り替えは予定していません。

1. [Google Cloud Console](https://console.cloud.google.com/) で自分のプロジェクトを作成・選択
2. **API とサービス → ライブラリ** で **Gmail API** を有効化
3. **Google Auth Platform → ブランディング** でアプリ名・ユーザーサポートメール・
   デベロッパーの連絡先を設定
4. **対象（Audience）** でユーザーの種類を **外部**、公開ステータスを **テスト中** にし、
   **テストユーザー** にログインする自分の Gmail アドレスを追加
5. **データアクセス（Data Access）** に実装が要求する権限を登録
   - `https://mail.google.com/`：メールの読み書き・送信・**ゴミ箱を経由しない完全削除**を含む制限付きスコープ
   - `https://www.googleapis.com/auth/userinfo.email`：ログインしたメールアドレスの識別。
     実装では Google の認可リクエストに `email` という短縮名を指定
   - 既存設定が `gmail.modify` のみなら、上記の実装上の要求と照合してください。
     [完全削除 API `users.messages.batchDelete`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/batchDelete)
     は `https://mail.google.com/` が必要で、`gmail.modify` では実行できません
6. **クライアント → クライアントを作成** から OAuth 2.0 クライアントを作成
   - アプリケーションの種類：**ウェブ アプリケーション**
   - 承認済みのリダイレクト URI：`http://localhost:3001/api/auth/callback`
7. 作成したクライアントの ID とシークレットを、次の手順で `server/.env.local` に設定

クライアントシークレットは作成時に安全に保管してください。
Google の現在の仕様では、作成後の表示・ダウンロードはできません。
紛失時や古いシークレットの整理は、利用中の設定を確認してから行います。
認証情報・token・SQLite のセッション DB を Git や Issue に貼り付けないでください。
詳細は [OAuth クライアントの管理](https://support.google.com/cloud/answer/15549257?hl=en)を参照してください。

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

### 4. 初回ログインと再ログイン

1. **Google でログイン** を選び、テストユーザーに登録した自分のアカウントを選択
2. アプリ名・自分で作成した OAuth クライアントであること・要求権限を確認して同意
3. 「このアプリは Google で確認されていません」と表示された場合は、上記を確認した上で、
   **詳細 → アプリへ移動** が表示される場合に限り、その導線で同意画面へ進む

「アクセスをブロックしました」と表示された場合は、選択プロジェクト・テストユーザー登録・
ログインアカウント・リダイレクト URI を確認してください。
組織の管理者ポリシーによる制限や、続行できない画面を回避しないでください。

本ツールが採用する Testing 運用では、次の期限を区別します。

| 対象 | 挙動・運用 |
| --- | --- |
| access token / アプリのセッション | 保存された refresh token を使って有効期限（通常1時間）直前に自動更新されます。refresh token が有効な間はセッションが維持されます。Cookie の30日設定はセッションの最長保持期間であり、refresh token の失効や取消し時は再ログインが必要です。 |
| refresh token | External + Testing で Gmail スコープを要求するため、原則7日で失効します。このため、前回の認証から7日以上経過した後の初回アクセス時には再ログインが必要になります。 |
| 未使用 OAuth クライアント | 6か月使用されないと削除対象になります。Google の警告と最終利用日を定期確認し、実期限に対応してください。Cloud SDK 自体へのログインは本アプリの利用とは別です。 |

Testing 環境下では refresh token 自体の7日制限は access token 更新を行っても延長されません。また、refresh token が
取消し・未使用・パスワード変更等で失効しないことも保証されません。
無人運用や最小権限の設計方針は [docs/gmail-manager.md](docs/gmail-manager.md#85-無人運用最小権限の設計方針143) を参照してください。
失効条件の詳細は [Google OAuth 2.0 の公式説明](https://developers.google.com/identity/protocols/oauth2)を参照してください。

### 個人利用と Google の審査

現在は本人のアカウントを自分のローカル環境で扱う個人利用とし、Testing を維持します。
Google は個人利用・開発やテスト等の審査例外を定めていますが、BYO という方式だけで
どの配布形態でも審査不要になるわけではありません。
第三者向けホスティングや提供範囲の拡大を行う場合は、restricted scope の審査と
サーバーを介するデータのセキュリティ評価（CASA）、定期再評価の適用条件を再確認します。
詳細は [Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)を参照してください。

Android アプリではないため、Android デベロッパー確認の期限を本ツールの OAuth 期限として扱いません。

## 使い方

1. **「Google でログイン」** → Google アカウントで認証
2. 検索条件を入力（カテゴリ・日数・既読状態・ラベル）
3. **「メールを検索」** → 件数を確認
4. **「〇件を削除」** → プログレスバーで進捗確認
5. 完了後、実行時間と処理速度が表示される

## OAuth 利用状況の定期確認

GitHub Actions の「OAuth 利用確認リマインダー」が毎月1日 09:17（日本時間）に、
専用の運用 Issue で担当ユーザー `@scottlz0310-user` に確認を促します。初回は Issue を作成し、
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
      services/         # GmailService.ts, JobRunner.ts, googleAuth.ts
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
