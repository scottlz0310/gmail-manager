// Hono Context に乗せるカスタム変数の型定義
export type HonoVariables = {
  sessionId: string;
  session: {
    id: string;
    email: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number | null;
    createdAt: number;
  };
};
