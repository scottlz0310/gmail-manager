"use client";

import { createBrowserClient } from "@/lib/supabase/client";

export default function Home() {
  const handleLogin = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/gmail.modify",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Gmail Manager</h1>
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Google でログイン
      </button>
    </main>
  );
}
