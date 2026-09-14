"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  name: string;
  quota: number;
};

export default function PlayersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [players, setPlayers] = useState<Player[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [quota, setQuota] = useState("0");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuota, setEditQuota] = useState("0");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const [profileResult, playersResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single(),

        supabase
          .from("players")
          .select("id, name, quota")
          .eq("is_guest", false)
          .order("name"),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (playersResult.error) {
        throw playersResult.error;
      }

      setIsAdmin(profileResult.data?.role === "admin");

      setPlayers(
        (playersResult.data || []).map((player) => ({
          id: String(player.id),
          name: String(player.name),
          quota: Number(player.quota),
        }))
      );
    } catch (error: any) {
      console.error("Could not load players page:", error);

      setError(
        error?.message ||
          error?.details ||
          "Could not load players."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAdmin) {
      setError("Only an administrator can add players.");
      return;
    }

    const cleanName = name.trim();
    const numericQuota = Number(quota);

    if (!cleanName) {
      setError("Please enter a player name.");
      return;
    }

    if (
      !Number.isFinite(numericQuota) ||
      numericQuota < 0
    ) {
      setError("Quota must be 0 or greater.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
        .from("players")
        .insert({
          name: cleanName,
          quota: numericQuota,
        })
        .select("id, name, quota")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          "Player was added but no player record was returned."
        );
      }

      const newPlayer: Player = {
        id: String(data.id),
        name: String(data.name),
        quota: Number(data.quota),
      };

      setPlayers((current) =>
        [...current, newPlayer].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setName("");
      setQuota("0");
      setMessage(`${newPlayer.name} was added.`);
    } catch (error: any) {
      console.error("Could not add player:", error);

      setError(
        error?.message ||
          error?.details ||
          "Could not add the player."
      );
    } finally {
      setSaving(false);
    }
  }


  function startEditing(player: Player) {
    if (!isAdmin) {
      return;
    }

    setEditingId(player.id);
    setEditName(player.name);
    setEditQuota(String(player.quota));
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditQuota("0");
  }

  async function savePlayerEdits(playerId: string) {
    if (!isAdmin) {
      setError("Only an administrator can edit players.");
      return;
    }

    const cleanName = editName.trim();
    const numericQuota = Number(editQuota);

    if (!cleanName) {
      setError("Please enter a player name.");
      return;
    }

    if (!Number.isFinite(numericQuota) || numericQuota < 0) {
      setError("Quota must be 0 or greater.");
      return;
    }

    setUpdatingId(playerId);
    setError("");
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("players")
        .update({
          name: cleanName,
          quota: numericQuota,
        })
        .eq("id", playerId)
        .select("id, name, quota")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("No updated player record was returned.");
      }

      const updatedPlayer: Player = {
        id: String(data.id),
        name: String(data.name),
        quota: Number(data.quota),
      };

      setPlayers((current) =>
        current
          .map((player) =>
            player.id === playerId ? updatedPlayer : player
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setEditingId(null);
      setEditName("");
      setEditQuota("0");
      setMessage(`${updatedPlayer.name} was updated.`);
    } catch (error: any) {
      console.error("Could not update player:", error);

      setError(
        error?.message ||
          error?.details ||
          "Could not update the player."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function deletePlayer(player: Player) {
    if (!isAdmin) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${player.name}? This will remove the player from the player list.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(player.id);
    setError("");
    setMessage("");

    try {
      /*
       * Remove the player from round membership first.
       * If you have foreign-key cascade rules, this is still safe.
       */
      const {
        error: roundPlayerError,
      } = await supabase
        .from("round_players")
        .delete()
        .eq("player_id", player.id);

      if (roundPlayerError) {
        throw roundPlayerError;
      }

      /*
       * Remove scores belonging to this player.
       */
      const {
        error: scoreError,
      } = await supabase
        .from("scores")
        .delete()
        .eq("player_id", player.id);

      if (scoreError) {
        throw scoreError;
      }

      /*
       * Unlink any user profile from this player
       * before deleting the player record.
       */
      const {
        error: unlinkError,
      } = await supabase
        .from("profiles")
        .update({
          player_id: null,
        })
        .eq("player_id", player.id);

      if (unlinkError) {
        throw unlinkError;
      }

      const {
        error: deleteError,
      } = await supabase
        .from("players")
        .delete()
        .eq("id", player.id);

      if (deleteError) {
        throw deleteError;
      }

      setPlayers((current) =>
        current.filter(
          (existingPlayer) =>
            existingPlayer.id !== player.id
        )
      );

      setMessage(`${player.name} was deleted.`);
    } catch (error: any) {
      console.error("Could not delete player:", error);

      setError(
        error?.message ||
          error?.details ||
          "Could not delete the player."
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p>Loading players...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
        >
          Home
        </Link>

        <Link
          href="/rounds"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Rounds
        </Link>

        {isAdmin && (
          <Link
            href="/rounds/new"
            className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            New Round
          </Link>
        )}
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Players
        </h1>

        <p className="mt-2 text-gray-600">
          {isAdmin
            ? "Add and manage golfers and their starting quotas."
            : "View golfers and their current quotas."}
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-6 rounded border border-green-300 bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      {isAdmin && (
        <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Add New Player
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            After adding the player, link that player to a user account from Manage Users.
          </p>

          <form
            onSubmit={addPlayer}
            className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto]"
          >
            <div>
              <label className="mb-2 block font-semibold">
                Player Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Player name"
                className="w-full rounded border px-3 py-2"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                Starting Quota
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={quota}
                onChange={(event) =>
                  setQuota(event.target.value)
                }
                className="w-full rounded border px-3 py-2"
                disabled={saving}
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded bg-purple-600 px-5 py-2 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {saving
                  ? "Adding..."
                  : "+ Add Player"}
              </button>
            </div>
          </form>

          <div className="mt-4">
            <Link
              href="/admin/users"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Manage Users / Link Player Accounts
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              Player List
            </h2>

            <p className="text-sm text-gray-500">
              {players.length} player
              {players.length === 1 ? "" : "s"}
            </p>
          </div>

          {isAdmin && (
            <Link
              href="/rounds/new"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Round
            </Link>
          )}
        </div>

        {players.length === 0 ? (
          <div className="rounded border border-yellow-300 bg-yellow-50 p-5 text-yellow-800">
            No players have been added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => {
              const isEditing = editingId === player.id;

              return (
                <div
                  key={player.id}
                  className="rounded-lg border p-4"
                >
                  {isEditing ? (
                    <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
                      <div>
                        <label className="mb-2 block font-semibold">
                          Player Name
                        </label>

                        <input
                          type="text"
                          value={editName}
                          onChange={(event) =>
                            setEditName(event.target.value)
                          }
                          className="w-full rounded border px-3 py-2"
                          disabled={updatingId === player.id}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block font-semibold">
                          Quota
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editQuota}
                          onChange={(event) =>
                            setEditQuota(event.target.value)
                          }
                          className="w-full rounded border px-3 py-2"
                          disabled={updatingId === player.id}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            savePlayerEdits(player.id)
                          }
                          disabled={updatingId === player.id}
                          className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                          {updatingId === player.id
                            ? "Saving..."
                            : "Save"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={updatingId === player.id}
                          className="rounded bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          {player.name}
                        </div>

                        <div className="text-sm text-gray-500">
                          Current Quota:{" "}
                          <strong>{player.quota.toFixed(2)}</strong>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(player)}
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deletePlayer(player)
                            }
                            disabled={
                              deletingId === player.id
                            }
                            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                          >
                            {deletingId === player.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
