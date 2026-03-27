import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LoginButton from "./LoginButton";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Gmail Manager</h1>
      <LoginButton />
    </main>
  );
}
