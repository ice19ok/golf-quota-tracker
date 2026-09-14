"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Round = {
  id: string;
  name: string;
  course: string;
  holes: number;
  game_mode: "quota" | "wolf";
  is_complete: boolean;
  completed_at?: string | null;
};

type Player = {
  id: string;
  name: string;
  quota: number;
  is_guest: boolean;
};

type RoundPlayer = {
  round_id: string;
  player_id: string;
  play_order: number | null;
};

export default function RoundsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundPlayers, setRoundPlayers] =
    useState<RoundPlayer[]>([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [
      profileRes,
      roundsRes,
      playersRes,
      rpRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),

      supabase
        .from("rounds")
        .select(
          "id,name,course,holes,game_mode,is_complete,completed_at"
        )
        .order("id", { ascending: false }),

      supabase
        .from("players")
        .select("id,name,quota,is_guest")
        .order("name"),

      supabase
        .from("round_players")
        .select("round_id,player_id,play_order"),
    ]);

    const firstError =
      profileRes.error ||
      roundsRes.error ||
      playersRes.error ||
      rpRes.error;

    if (firstError) {
      setError(firstError.message);
    }

    setIsAdmin(profileRes.data?.role === "admin");

    setRounds(
      (roundsRes.data || []).map((round) => ({
        id: String(round.id),
        name: String(round.name),
        course: String(round.course),
        holes: Number(round.holes),
        game_mode:
          round.game_mode === "wolf"
            ? "wolf"
            : "quota",
        is_complete: Boolean(round.is_complete),
        completed_at: round.completed_at,
      }))
    );

    setPlayers(
      (playersRes.data || []).map((player) => ({
        id: String(player.id),
        name: String(player.name),
        quota: Number(player.quota),
        is_guest: Boolean(player.is_guest),
      }))
    );

    setRoundPlayers(
      (rpRes.data || []).map((rp) => ({
        round_id: String(rp.round_id),
        player_id: String(rp.player_id),
        play_order:
          rp.play_order === null
            ? null
            : Number(rp.play_order),
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function deleteRound(id: string) {
    if (
      !isAdmin ||
      !window.confirm(
        "Delete this round and all of its game data?"
      )
    ) {
      return;
    }

    const deletes = [
      await supabase
        .from("wolf_holes")
        .delete()
        .eq("round_id", id),

      await supabase
        .from("scores")
        .delete()
        .eq("round_id", id),

      await supabase
        .from("round_players")
        .delete()
        .eq("round_id", id),
    ];

    const deleteError = deletes.find(
      (result) => result.error
    )?.error;

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const { error: roundError } = await supabase
      .from("rounds")
      .delete()
      .eq("id", id);

    if (roundError) {
      setError(roundError.message);
      return;
    }

    await loadData();
  }

  if (loading) {
    return <main className="p-8">Loading rounds...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Golf Rounds
          </h1>

          <p className="text-gray-600">
            Quota and Wolf history
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/rounds/new"
            className="rounded bg-green-600 px-5 py-3 font-semibold text-white"
          >
            + New Round
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded bg-gray-500 px-4 py-2 text-white"
        >
          Home
        </Link>

        <Link
          href="/players"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Players
        </Link>

        <Link
          href="/settings/quota"
          className="rounded bg-purple-600 px-4 py-2 text-white"
        >
          Quota Settings
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!rounds.length && (
        <div className="rounded border bg-white p-8 text-center">
          No rounds yet.
        </div>
      )}

      <div className="space-y-6">
        {rounds.map((round) => {
          const orderedRoundPlayers = roundPlayers
            .filter(
              (item) => item.round_id === round.id
            )
            .sort(
              (a, b) =>
                (a.play_order ?? 999) -
                (b.play_order ?? 999)
            );

          const rPlayers = orderedRoundPlayers
            .map((rp) =>
              players.find(
                (player) =>
                  player.id === rp.player_id
              )
            )
            .filter(
              (player): player is Player =>
                Boolean(player)
            );

          const roundUrl =
            round.game_mode === "wolf"
              ? `/rounds/${round.id}/wolf`
              : `/rounds/${round.id}`;

          return (
            <div
              key={round.id}
              className="rounded-lg border bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold">
                      {round.name}
                    </h2>

                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        round.game_mode === "wolf"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {round.game_mode === "wolf"
                        ? "Wolf"
                        : "Quota"}
                    </span>

                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        round.is_complete
                          ? "bg-gray-200 text-gray-700"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {round.is_complete
                        ? "Completed"
                        : "Open"}
                    </span>
                  </div>

                  <p className="text-gray-600">
                    {round.course} • White Tees •{" "}
                    {round.holes} holes
                    {round.game_mode === "wolf"
                      ? " • $1 per point"
                      : ""}
                  </p>
                </div>

                {round.is_complete ? (
                  isAdmin ? (
                    <Link
                      href={roundUrl}
                      className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
                    >
                      View Completed Round
                    </Link>
                  ) : (
                    <span className="rounded bg-gray-300 px-4 py-2 font-semibold text-gray-700">
                      Closed
                    </span>
                  )
                ) : (
                  <Link
                    href={roundUrl}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Open Round
                  </Link>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {rPlayers.map((player, index) => (
                  <span
                    key={player.id}
                    className="rounded bg-gray-100 px-3 py-2"
                  >
                    {round.game_mode === "wolf" && (
                      <span className="mr-1 text-xs font-semibold text-gray-500">
                        {index + 1}.
                      </span>
                    )}

                    {player.name}

                    {player.is_guest && (
                      <span className="ml-1 text-xs text-gray-500">
                        (Guest)
                      </span>
                    )}

                    {round.game_mode === "quota" && (
                      <span className="ml-2 text-sm text-gray-500">
                        {round.is_complete
                          ? `Overall Quota ${player.quota.toFixed(
                              2
                            )}`
                          : `Playing Quota ${Math.round(
                              player.quota
                            )}`}
                      </span>
                    )}
                  </span>
                ))}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() =>
                    deleteRound(round.id)
                  }
                  className="mt-6 rounded bg-red-600 px-4 py-2 text-white"
                >
                  Delete Round
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
