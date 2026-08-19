"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  name: string;
  quota: number;
};

type Profile = {
  id: string;
  player_id: string | null;
};

export default function AdminUsersPage() {
  const supabase = createClient();

  const [players, setPlayers] = useState<Player[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (!profile || profile.role !== "admin") {
      setError(
        "You must be an Admin to access this page."
      );
      setLoading(false);
      return;
    }

    const { data: playerData, error: playerError } =
      await supabase
        .from("players")
        .select("id, name, quota")
        .order("name");

    if (playerError) {
      setError(playerError.message);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, player_id");

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    setPlayers(playerData || []);
    setProfiles(profileData || []);
    setLoading(false);
  }

  function playerHasLogin(id: string) {
    return profiles.some(
      (profile) =>
        profile.player_id === id
    );
  }

  async function createUser() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }

    if (!password) {
      setError("Enter a password.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (role === "user" && !playerId) {
    setError(
    "Select a player for this User account."
    );
    return;
 }

    setCreating(true);

    try {
      const response =
        await fetch(
          "/api/admin/users",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              password,
              playerId,
              role,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Could not create user."
        );
        setCreating(false);
        return;
      }

      setMessage(
        `User created successfully for ${result.player.name}.`
      );

      setEmail("");
      setPassword("");
      setPlayerId("");
      setRole("user");

      await loadData();
    } catch (error) {
      console.error(error);

      setError(
        "Could not connect to the server."
      );
    }

    setCreating(false);
  }

  if (loading) {
    return (
      <main className="p-8">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl">

{/* Navigation */}

<div className="mb-6 flex flex-wrap gap-3">

  <Link
    href="/"
    className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
  >
    ← Home
  </Link>

  <Link
    href="/players"
    className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
  >
    Players
  </Link>

  <Link
    href="/rounds"
    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
  >
    Rounds
  </Link>

</div>

        <h1 className="text-3xl font-bold">
          User Management
        </h1>

        <p className="mt-2 text-gray-600">
          Create logins and attach them to
          existing players.
        </p>

        {error && (
          <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded border border-green-300 bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}

        {/* CREATE USER */}

        <div className="mt-6 rounded-lg bg-white p-6 shadow">

          <h2 className="text-xl font-bold">
            Create User
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block font-medium">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="player@example.com"
                className="w-full rounded border px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-2 block font-medium">
                Initial Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Minimum 6 characters"
                className="w-full rounded border px-3 py-2"
              />
            </div>

          </div>

<div className="mt-4">

  <label className="mb-2 block font-medium">
    Role
  </label>

  <select
    value={role}
    onChange={(e) =>
      setRole(
        e.target.value as
          | "user"
          | "admin"
      )
    }
    className="w-full rounded border px-3 py-2"
  >
    <option value="user">
      User — Can enter their own scores
    </option>

    <option value="admin">
      Admin — Full access
    </option>
  </select>

</div>
          {role === "user" && (
  <div className="mt-4">

    <label className="mb-2 block font-medium">
      Attach to Player
    </label>

    <select
      value={playerId}
      onChange={(e) =>
        setPlayerId(e.target.value)
      }
      className="w-full rounded border px-3 py-2"
    >
      <option value="">
        Select a player
      </option>

      {players.map((player) => {
        const hasLogin =
          playerHasLogin(player.id);

        return (
          <option
            key={player.id}
            value={player.id}
            disabled={hasLogin}
          >
            {player.name} — Quota{" "}
            {player.quota}
            {hasLogin
              ? " — Login already assigned"
              : ""}
          </option>
        );
      })}
    </select>

  </div>
)}

          <button
            onClick={createUser}
            disabled={creating}
            className="mt-6 rounded bg-green-600 px-5 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {creating
              ? "Creating..."
              : "Create User"}
          </button>

        </div>

        {/* PLAYER LOGIN STATUS */}

        <div className="mt-8 rounded-lg bg-white shadow">

          <div className="border-b p-4">
            <h2 className="text-xl font-bold">
              Player Login Status
            </h2>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3 text-left">
                    Player
                  </th>

                  <th className="p-3 text-left">
                    Quota
                  </th>

                  <th className="p-3 text-left">
                    Login
                  </th>
                </tr>
              </thead>

              <tbody>

                {players.map((player) => {

                  const hasLogin =
                    playerHasLogin(
                      player.id
                    );

                  return (
                    <tr
                      key={player.id}
                      className="border-b"
                    >

                      <td className="p-3 font-medium">
                        {player.name}
                      </td>

                      <td className="p-3">
                        {player.quota}
                      </td>

                      <td className="p-3">

                        {hasLogin ? (
                          <span className="font-medium text-green-600">
                            ✓ Login assigned
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            No login
                          </span>
                        )}

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

            {players.length === 0 && (
              <div className="p-6 text-gray-500">
                No players have been created yet.
              </div>
            )}

          </div>

        </div>

      </div>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-block rounded bg-gray-500 px-5 py-2 font-medium text-white hover:bg-gray-600"
        >
          ← Back to Home
        </Link>
      </div>

    </main>
  );
}