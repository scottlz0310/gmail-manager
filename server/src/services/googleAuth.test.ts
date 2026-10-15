import { describe, expect, it } from "bun:test";
import { getOAuth2Client } from "./googleAuth";

describe("googleAuth", () => {
  it("getOAuth2Client は引数で指定された値から OAuth2Client を初期化する", () => {
    const client = getOAuth2Client("custom-id", "custom-secret", "http://localhost:3000/callback");
    expect(client).toBeDefined();

    const authUrl = client.generateAuthUrl({ scope: ["email"] });
    expect(authUrl).toContain("client_id=custom-id");
    expect(authUrl).toContain(encodeURIComponent("http://localhost:3000/callback"));
  });

  it("getOAuth2Client はデフォルト値で OAuth2Client を初期化できる", () => {
    const client = getOAuth2Client();
    expect(client).toBeDefined();

    const authUrl = client.generateAuthUrl({ scope: ["email"] });
    const expectedUri =
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/callback";
    expect(authUrl).toContain(encodeURIComponent(expectedUri));
  });
});
