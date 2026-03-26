"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();

    let subscription: ReturnType<
      typeof supabase.auth.onAuthStateChange
    >["data"]["subscription"] | null = null;

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        router.push("/");
        return;
      }

      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN") {
          router.push("/");
        }
      });

      subscription = data.subscription;
    };

    void init();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">認証中...</p>
    </div>
  );
}
