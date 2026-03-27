import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const user = session.user;

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Gmail Manager</h1>
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-6 inline-block">
        <p className="text-green-800 font-medium">ログイン済み</p>
        <p className="text-sm text-green-700 mt-1">{user.email}</p>
      </div>
      <div className="mt-4">
        <LogoutButton />
      </div>
    </main>
  );
}
