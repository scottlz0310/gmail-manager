"use client";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
    >
      ログアウト
    </button>
  );
}
