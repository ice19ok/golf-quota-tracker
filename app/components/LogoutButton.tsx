"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  async function logout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      className="rounded bg-red-600 px-4 py-2 text-white"
    >
      Logout
    </button>
  );
}