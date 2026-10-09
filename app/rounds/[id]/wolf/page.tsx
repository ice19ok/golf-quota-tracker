"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  name: string;
  is_guest: boolean;
};

type Round = {
  id: string;
  name: string;
  course: string;
  holes: number;
  game_mode: string;
  is_complete: boolean;
  completed_at?: string | null;
};

type WolfWinner = "wolf_team" | "opponents" | "tie";

type WolfHole = {
  hole: number;
  wolf_player_id: string;
  partner_player_id: string | null;
  is_lone_wolf: boolean;
  winner: WolfWinner | null;
};

export default function WolfRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);

  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [holes, setHoles] = useState<
    Record<number, WolfHole>
  >({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingHole, setSavingHole] =
    useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("role,player_id")
        .eq("id", user.id)
        .single();

      if (profileRes.error) {
        setError(profileRes.error.message);
        setLoading(false);
        return;
      }

      setIsAdmin(profileRes.data?.role === "admin");
      setCurrentPlayerId(
        profileRes.data?.player_id
          ? String(profileRes.data.player_id)
          : null
      );

      const [roundRes, rpRes, playerRes, wolfRes] =
        await Promise.all([
          supabase
            .from("rounds")
            .select(
              "id,name,course,holes,game_mode,is_complete,completed_at"
            )
            .eq("id", id)
            .single(),

          supabase
            .from("round_players")
            .select("player_id,play_order")
            .eq("round_id", id)
            .order("play_order", { ascending: true }),

          supabase
            .from("players")
            .select("id,name,is_guest"),

          supabase
            .from("wolf_holes")
            .select(
              "hole,wolf_player_id,partner_player_id,is_lone_wolf,winner"
            )
            .eq("round_id", id),
        ]);

      const firstError =
        roundRes.error ||
        rpRes.error ||
        playerRes.error ||
        wolfRes.error;

      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const loadedRound: Round = {
        id: String(roundRes.data.id),
        name: String(roundRes.data.name),
        course: String(roundRes.data.course),
        holes: Number(roundRes.data.holes),
        game_mode: String(roundRes.data.game_mode),
        is_complete: Boolean(roundRes.data.is_complete),
        completed_at: roundRes.data.completed_at,
      };

      setRound(loadedRound);

      const playerMap = new Map(
        (playerRes.data || []).map((player) => [
          String(player.id),
          {
            id: String(player.id),
            name: String(player.name),
            is_guest: Boolean(player.is_guest),
          },
        ])
      );

      const orderedPlayers = (rpRes.data || [])
        .map((rp) =>
          playerMap.get(String(rp.player_id))
        )
        .filter((player): player is Player =>
          Boolean(player)
        );

      setPlayers(orderedPlayers);

      const loadedHoles: Record<number, WolfHole> = {};

      for (const row of wolfRes.data || []) {
        const hole = Number(row.hole);

        loadedHoles[hole] = {
          hole,
          wolf_player_id: String(row.wolf_player_id),
          partner_player_id: row.partner_player_id
            ? String(row.partner_player_id)
            : null,
          is_lone_wolf: Boolean(row.is_lone_wolf),
          winner: (row.winner as WolfWinner | null) || null,
        };
      }

      setHoles(loadedHoles);
      setLoading(false);
    }

    load();
  }, [id, supabase]);

  const isParticipant =
    currentPlayerId !== null &&
    players.some(
      (player) => player.id === currentPlayerId
    );

  const canEdit =
    Boolean(round) &&
    !round?.is_complete &&
    (isAdmin || isParticipant);

  function wolfForHole(hole: number) {
    if (!players.length) {
      return null;
    }

    return players[(hole - 1) % players.length];
  }

  function getHoleState(hole: number): WolfHole {
    const wolf = wolfForHole(hole);

    return (
      holes[hole] || {
        hole,
        wolf_player_id: wolf?.id || "",
        partner_player_id: null,
        is_lone_wolf: false,
        winner: null,
      }
    );
  }

  function updateHoleLocal(
    hole: number,
    changes: Partial<WolfHole>
  ) {
    setHoles((current) => {
      const currentHole = getHoleState(hole);

      return {
        ...current,
        [hole]: {
          ...currentHole,
          ...changes,
        },
      };
    });
  }

  function setLoneWolf(hole: number, lone: boolean) {
    updateHoleLocal(hole, {
      is_lone_wolf: lone,
      partner_player_id: lone
        ? null
        : getHoleState(hole).partner_player_id,
      winner: null,
    });
  }

  async function saveHole(hole: number) {
    if (!round || !canEdit) {
      return;
    }

    const state = getHoleState(hole);
    const wolf = wolfForHole(hole);

    if (!wolf) {
      return;
    }

    if (
      !state.is_lone_wolf &&
      !state.partner_player_id
    ) {
      setError(
        `Choose a partner or Lone Wolf for hole ${hole}.`
      );
      return;
    }

    if (!state.winner) {
      setError(`Choose the winner for hole ${hole}.`);
      return;
    }

    setSavingHole(hole);
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("wolf_holes")
      .upsert(
        {
          round_id: round.id,
          hole,
          wolf_player_id: wolf.id,
          partner_player_id: state.is_lone_wolf
            ? null
            : state.partner_player_id,
          is_lone_wolf: state.is_lone_wolf,
          winner: state.winner,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "round_id,hole",
        }
      );

    if (error) {
      setError(error.message);
    } else {
      updateHoleLocal(hole, {
        wolf_player_id: wolf.id,
      });
      setMessage(`Hole ${hole} saved.`);
      setTimeout(() => setMessage(""), 1200);
    }

    setSavingHole(null);
  }

  function pointsForHole(hole: number) {
    const points = new Map<string, number>();

    for (const player of players) {
      points.set(player.id, 0);
    }

    const state = holes[hole];

    if (!state || !state.winner || state.winner === "tie") {
      return points;
    }

    const wolf = players.find(
      (player) =>
        player.id === state.wolf_player_id
    );

    if (!wolf) {
      return points;
    }

    const opponents = players.filter(
      (player) =>
        player.id !== wolf.id &&
        player.id !== state.partner_player_id
    );

    if (state.is_lone_wolf) {
      if (state.winner === "wolf_team") {
        points.set(wolf.id, opponents.length);

        for (const opponent of opponents) {
          points.set(opponent.id, -1);
        }
      } else if (state.winner === "opponents") {
        points.set(wolf.id, -opponents.length);

        for (const opponent of opponents) {
          points.set(opponent.id, 1);
        }
      }

      return points;
    }

    const partner = players.find(
      (player) =>
        player.id === state.partner_player_id
    );

    if (!partner) {
      return points;
    }

    const wolfTeam = [wolf, partner];
    const losingTeamSize =
      state.winner === "wolf_team"
        ? opponents.length
        : wolfTeam.length;

    const winningTeam =
      state.winner === "wolf_team"
        ? wolfTeam
        : opponents;

    const losingTeam =
      state.winner === "wolf_team"
        ? opponents
        : wolfTeam;

    for (const player of winningTeam) {
      points.set(player.id, losingTeam.length);
    }

    for (const player of losingTeam) {
      points.set(player.id, -winningTeam.length);
    }

    return points;
  }

  const standings = players
    .map((player) => {
      let points = 0;

      for (
        let hole = 1;
        hole <= (round?.holes || 0);
        hole++
      ) {
        points += pointsForHole(hole).get(player.id) || 0;
      }

      return {
        ...player,
        points,
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      return a.name.localeCompare(b.name);
    });

  const netPoints = standings.reduce(
    (sum, player) => sum + player.points,
    0
  );

  async function finishRound() {
    if (
      !round ||
      !isAdmin ||
      round.is_complete ||
      finishing
    ) {
      return;
    }

    const incompleteHoles = Array.from(
      { length: round.holes },
      (_, index) => index + 1
    ).filter((hole) => !holes[hole]?.winner);

    if (incompleteHoles.length > 0) {
      setError(
        `Finish the Wolf result for every hole first. Missing: ${incompleteHoles.join(
          ", "
        )}`
      );
      return;
    }

    if (
      !window.confirm(
        "Complete this Wolf round? It will be locked and cannot be reopened by players."
      )
    ) {
      return;
    }

    setFinishing(true);
    setError("");

    const completedAt = new Date().toISOString();

    const {
      data: claimedRound,
      error: claimError,
    } = await supabase
      .from("rounds")
      .update({
        is_complete: true,
        completed_at: completedAt,
      })
      .eq("id", round.id)
      .eq("is_complete", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      setError(claimError.message);
      setFinishing(false);
      return;
    }

    if (!claimedRound) {
      setRound((current) =>
        current
          ? { ...current, is_complete: true }
          : current
      );
      setMessage("This Wolf round was already completed.");
      setFinishing(false);
      return;
    }

    setRound((current) =>
      current
        ? {
            ...current,
            is_complete: true,
            completed_at: completedAt,
          }
        : current
    );

    setMessage("Wolf round completed and locked.");
    setFinishing(false);
  }

  if (loading) {
    return <main className="p-8">Loading Wolf round...</main>;
  }

  if (!round) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">
          Round Not Found
        </h1>
        {error && (
          <p className="mt-3 text-red-600">
            {error}
          </p>
        )}
      </main>
    );
  }

  if (round.game_mode !== "wolf") {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">
          This is a Quota round
        </h1>

        <Link
          href={`/rounds/${round.id}`}
          className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Open Quota Round
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/rounds"
          className="rounded bg-gray-500 px-4 py-2 text-white"
        >
          ← Rounds
        </Link>

        <Link
          href="/"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Home
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">
              {round.name}
            </h1>

            <span className="rounded bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              Wolf
            </span>

            {round.is_complete && (
              <span className="rounded bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-700">
                Completed
              </span>
            )}
          </div>

          <p className="mt-2 text-gray-600">
            {round.course} • {round.holes} holes • $1 per point
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded border border-green-300 bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      <section className="mt-8 rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              Wolf Standings
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              1 point = $1. Positive means collect; negative means pay.
            </p>
          </div>

          <div
            className={`rounded px-3 py-2 text-sm font-semibold ${
              netPoints === 0
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-700"
            }`}
          >
            Net: {netPoints > 0 ? "+" : ""}
            {netPoints} points
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">
                  Place
                </th>
                <th className="border p-3 text-left">
                  Player
                </th>
                <th className="border p-3 text-center">
                  Points
                </th>
                <th className="border p-3 text-center">
                  Money
                </th>
              </tr>
            </thead>

            <tbody>
              {standings.map((player, index) => (
                <tr key={player.id}>
                  <td className="border p-3 font-bold">
                    {index + 1}
                  </td>

                  <td className="border p-3 font-semibold">
                    {player.name}

                    {player.is_guest && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        Guest
                      </span>
                    )}

                    {currentPlayerId === player.id && (
                      <span className="ml-2 text-xs font-normal text-blue-600">
                        You
                      </span>
                    )}
                  </td>

                  <td className="border p-3 text-center font-bold">
                    {player.points > 0 ? "+" : ""}
                    {player.points}
                  </td>

                  <td className="border p-3 text-center font-bold">
                    {player.points > 0
                      ? `+$${player.points.toFixed(2)}`
                      : player.points < 0
                      ? `-$${Math.abs(player.points).toFixed(2)}`
                      : "$0.00"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold">
          Hole Results
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Wolf rotates automatically from the player order selected when the round was created.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {Array.from(
            { length: round.holes },
            (_, index) => index + 1
          ).map((hole) => {
            const wolf = wolfForHole(hole);
            const state = getHoleState(hole);
            const holePoints = pointsForHole(hole);

            if (!wolf) {
              return null;
            }

            return (
              <div
                key={hole}
                className="rounded-lg border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-500">
                      Hole {hole}
                    </div>

                    <div className="mt-1 text-xl font-bold">
                      Wolf: {wolf.name}
                    </div>
                  </div>

                  {holes[hole]?.winner && (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      Saved
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setLoneWolf(hole, false)
                    }
                    className={`rounded border px-3 py-2 font-semibold ${
                      !state.is_lone_wolf
                        ? "border-blue-600 bg-blue-50"
                        : ""
                    } disabled:opacity-50`}
                  >
                    Choose Partner
                  </button>

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      setLoneWolf(hole, true)
                    }
                    className={`rounded border px-3 py-2 font-semibold ${
                      state.is_lone_wolf
                        ? "border-purple-600 bg-purple-50"
                        : ""
                    } disabled:opacity-50`}
                  >
                    Lone Wolf
                  </button>
                </div>

                {!state.is_lone_wolf && (
                  <div className="mt-4">
                    <label className="mb-2 block font-semibold">
                      Partner
                    </label>

                    <select
                      disabled={!canEdit}
                      className="w-full rounded border px-3 py-2"
                      value={
                        state.partner_player_id || ""
                      }
                      onChange={(event) =>
                        updateHoleLocal(hole, {
                          partner_player_id:
                            event.target.value || null,
                          winner: null,
                        })
                      }
                    >
                      <option value="">
                        Select partner
                      </option>

                      {players
                        .filter(
                          (player) =>
                            player.id !== wolf.id
                        )
                        .map((player) => (
                          <option
                            key={player.id}
                            value={player.id}
                          >
                            {player.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="mt-4">
                  <label className="mb-2 block font-semibold">
                    Winner
                  </label>

                  <select
                    disabled={!canEdit}
                    className="w-full rounded border px-3 py-2"
                    value={state.winner || ""}
                    onChange={(event) =>
                      updateHoleLocal(hole, {
                        winner:
                          (event.target.value ||
                            null) as WolfWinner | null,
                      })
                    }
                  >
                    <option value="">
                      Select result
                    </option>

                    <option value="wolf_team">
                      {state.is_lone_wolf
                        ? `${wolf.name} — Lone Wolf`
                        : "Wolf + Partner"}
                    </option>

                    <option value="opponents">
                      Opponents
                    </option>

                    <option value="tie">
                      Tie / Push
                    </option>
                  </select>
                </div>

                {state.winner && (
                  <div className="mt-4 rounded bg-gray-50 p-3 text-sm">
                    <div className="font-semibold">
                      Hole Point Transfer
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {players.map((player) => {
                        const points =
                          holePoints.get(player.id) || 0;

                        return (
                          <span
                            key={player.id}
                            className="rounded border bg-white px-2 py-1"
                          >
                            {player.name}:{" "}
                            <strong>
                              {points > 0 ? "+" : ""}
                              {points}
                            </strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {canEdit && (
                  <button
                    type="button"
                    disabled={savingHole === hole}
                    onClick={() => saveHole(hole)}
                    className="mt-4 w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:bg-gray-400"
                  >
                    {savingHole === hole
                      ? "Saving..."
                      : `Save Hole ${hole}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isAdmin && (
        <section className="mt-8 rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">
            Complete Wolf Round
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            Completing the round locks all Wolf results. It does
            not change any player's Quota.
          </p>

          <button
            type="button"
            disabled={round.is_complete || finishing}
            onClick={finishRound}
            className="mt-4 rounded bg-green-600 px-5 py-3 font-semibold text-white disabled:bg-gray-400"
          >
            {round.is_complete
              ? "Round Completed"
              : finishing
              ? "Completing..."
              : "Complete Wolf Round"}
          </button>
        </section>
      )}
    </main>
  );
}
