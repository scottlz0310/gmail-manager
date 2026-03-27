import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import LoginPage from "./components/LoginPage";

interface Me {
  loggedIn: boolean;
  email?: string;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ loggedIn: false }));
  }, []);

  if (me === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (!me.loggedIn) return <LoginPage />;
  return <Dashboard email={me.email ?? ""} onLogout={() => setMe({ loggedIn: false })} />;
}
