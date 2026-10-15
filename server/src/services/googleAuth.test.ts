import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { google } from "googleapis";
import { defaultTokenRefresher, getOAuth2Client } from "./googleAuth";

describe("googleAuth", () => {
  let activeSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    activeSpy?.mockRestore();
    activeSpy = null;
  });

  describe("getOAuth2Client", () => {
    it("引数で指定された値から OAuth2Client を初期化する", () => {
      const client = getOAuth2Client(
        "custom-id",
        "custom-secret",
        "http://localhost:3000/callback"
      );
      expect(client).toBeDefined();

      const authUrl = client.generateAuthUrl({ scope: ["email"] });
      expect(authUrl).toContain("client_id=custom-id");
      expect(authUrl).toContain(encodeURIComponent("http://localhost:3000/callback"));
    });

    it("デフォルト値で OAuth2Client を初期化できる", () => {
      const client = getOAuth2Client();
      expect(client).toBeDefined();

      const authUrl = client.generateAuthUrl({ scope: ["email"] });
      const expectedUri =
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/callback";
      expect(authUrl).toContain(encodeURIComponent(expectedUri));
    });
  });

  describe("defaultTokenRefresher", () => {
    it("refreshAccessToken が成功した場合、RefreshedToken オブジェクトを返す", async () => {
      activeSpy = spyOn(google.auth.OAuth2.prototype, "refreshAccessToken").mockImplementation(
        async () => ({
          credentials: {
            access_token: "mock-access-token",
            refresh_token: "mock-new-refresh-token",
            expiry_date: 1700000000000,
          },
          res: null,
        })
      );

      const result = await defaultTokenRefresher("mock-input-refresh-token");

      expect(activeSpy).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe("mock-access-token");
      expect(result.refreshToken).toBe("mock-new-refresh-token");
      expect(result.expiresAt).toBe(1700000000); // 秒換算
    });

    it("refresh_token や expiry_date が未返却の場合は null にフォールバックする", async () => {
      activeSpy = spyOn(google.auth.OAuth2.prototype, "refreshAccessToken").mockImplementation(
        async () => ({
          credentials: {
            access_token: "mock-access-token-only",
          },
          res: null,
        })
      );

      const result = await defaultTokenRefresher("mock-input-refresh-token");

      expect(result.accessToken).toBe("mock-access-token-only");
      expect(result.refreshToken).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it("access_token がレスポンスに含まれない場合はエラーをスローする", async () => {
      activeSpy = spyOn(google.auth.OAuth2.prototype, "refreshAccessToken").mockImplementation(
        async () => ({
          credentials: {},
          res: null,
        })
      );

      await expect(defaultTokenRefresher("mock-input-refresh-token")).rejects.toThrow(
        "Failed to refresh access token: missing access_token in response"
      );
    });

    it("refreshAccessToken が失敗した場合はエラーをそのまま上位へ伝播させる", async () => {
      activeSpy = spyOn(google.auth.OAuth2.prototype, "refreshAccessToken").mockImplementation(
        async () => {
          throw new Error("invalid_grant: Bad Request");
        }
      );

      await expect(defaultTokenRefresher("mock-input-refresh-token")).rejects.toThrow(
        "invalid_grant: Bad Request"
      );
    });
  });
});
