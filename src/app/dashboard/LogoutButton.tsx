"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    const supabase = createBrowserClient();

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage("ログアウトに失敗しました。時間をおいて再度お試しください。");
      setIsLoading(false);
      return;
    }

    router.replace("/");
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        {isLoading ? "ログアウト中..." : "ログアウト"}
      </button>
      {errorMessage && (
        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
