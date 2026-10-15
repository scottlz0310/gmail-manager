import { google } from "googleapis";

export interface RefreshedToken {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number | null; // Unix timestamp in seconds
}

export type TokenRefresher = (refreshToken: string) => Promise<RefreshedToken>;

export function getOAuth2Client(
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/callback"
) {
  return new google.auth.OAuth2({
    clientId: clientId || undefined,
    clientSecret: clientSecret || undefined,
    redirectUri,
  });
}

export const defaultTokenRefresher: TokenRefresher = async (
  refreshToken: string
): Promise<RefreshedToken> => {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh access token: missing access_token in response");
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? null,
    expiresAt: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
  };
};
