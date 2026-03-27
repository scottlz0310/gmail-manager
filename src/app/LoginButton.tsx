"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LoginButton() {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://mail.google.com/",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError("ログインに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Google でログイン
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
