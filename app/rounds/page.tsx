"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_QUOTA_POINTS,
  loadQuotaPoints,
  calculatePlayerQuotaPoints,
  type QuotaPoints,
} from "@/lib/quota";

type Player = {
  id: string;
  name: string;
  quota: number;
};

type Round = {
  id: number;
  name: string;
  course: string;
  holes: number;
  playerIds: string[];
  pars?: number[];
};

type Scorecard = {
  roundId: number;
  scores: Record<string, number | "">;
  pars: Record<number, number>;
  savedAt: string;
};

const KICKINGBIRD_WHITE_PARS = [
  4, 4, 3, 5, 4, 3, 4, 4, 4,
  4, 3, 5, 4, 3, 5, 3, 4, 4,
];

const EDMOND_WHITE_PARS = [
  4, 5, 3, 4, 4, 4, 3, 4, 4,
  3, 4, 4, 4, 3, 5, 4, 3, 5,
];

export default function RoundsPage() {
  const supabase = createClient();

  const [rounds, setRounds] =
    useState<Round[]>([]);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [scorecards, setScorecards] =
    useState<Scorecard[]>([]);

  const [quotaPoints, setQuotaPoints] =
    useState<QuotaPoints>(
      DEFAULT_QUOTA_POINTS
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      /*
       * LOAD PLAYERS
       */
      const {
        data: playerData,
        error: playerError,
      } = await supabase
        .from("players")
        .select("id, name, quota")
        .order("name");

      if (playerError) {
        console.error(
          "Could not load players:",
          playerError
        );

        setError(playerError.message);
      } else {
        setPlayers(
          (playerData || []).map(
            (player) => ({
              id: String(player.id),
              name: player.name,
              quota: Number(
                player.quota
              ),
            })
          )
        );
      }

      /*
       * LOAD QUOTA SETTINGS
       *
       * This comes from the shared
       * quota loader.
       */
      const settings = loadQuotaPoints();

      setQuotaPoints(settings);

      /*
       * LOAD ROUNDS
       */
      const savedRounds =
        localStorage.getItem(
          "rounds"
        );

      if (savedRounds) {
        try {
          const parsedRounds =
            JSON.parse(savedRounds);

          if (
            Array.isArray(
              parsedRounds
            )
          ) {
            const cleanedRounds =
              parsedRounds.map(
                (round: any) => ({
                  id: Number(
                    round.id
                  ),

                  name: String(
                    round.name || ""
                  ),

                  course: String(
                    round.course || ""
                  ),

                  holes: Number(
                    round.holes || 18
                  ),

                  playerIds:
                    Array.isArray(
                      round.playerIds
                    )
                      ? round.playerIds.map(
                          (id: any) =>
                            String(id)
                        )
                      : [],

                  pars:
                    Array.isArray(
                      round.pars
                    )
                      ? round.pars.map(
                          (par: any) =>
                            Number(par)
                        )
                      : undefined,
                })
              );

            setRounds(
              cleanedRounds
            );
          }
        } catch (error) {
          console.error(
            "Could not load rounds:",
            error
          );

          setError(
            "Could not load saved rounds."
          );
        }
      }

      /*
       * LOAD SCORECARDS
       */
      const savedScorecards =
        localStorage.getItem(
          "scorecards"
        );

      if (savedScorecards) {
        try {
          const parsedScorecards =
            JSON.parse(
              savedScorecards
            );

          if (
            Array.isArray(
              parsedScorecards
            )
          ) {
            setScorecards(
              parsedScorecards
            );
          }
        } catch (error) {
          console.error(
            "Could not load scorecards:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Could not load page:",
        error
      );

      setError(
        "Could not load your golf rounds."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * GET COURSE PARS
   */
  function getParsForRound(
    round: Round
  ): number[] {
    if (
      round.pars &&
      round.pars.length >=
        round.holes
    ) {
      return round.pars.slice(
        0,
        round.holes
      );
    }

    if (
      round.course ===
      "KickingBird Golf Club"
    ) {
      return KICKINGBIRD_WHITE_PARS.slice(
        0,
        round.holes
      );
    }

    if (
      round.course ===
      "The Golf Club of Edmond"
    ) {
      return EDMOND_WHITE_PARS.slice(
        0,
        round.holes
      );
    }

    return Array(
      round.holes
    ).fill(4);
  }

  /*
   * GET PLAYER POINTS
   *
   * Uses the SAME shared scoring
   * function as the scorecard page.
   */
  function getPlayerPoints(
    playerId: string,
    round: Round
  ) {
    const scorecard =
      scorecards.find(
        (card) =>
          String(
            card.roundId
          ) ===
          String(round.id)
      );

    if (!scorecard) {
      return 0;
    }

    const coursePars =
      getParsForRound(round);

    const pars: Record<
      number,
      number
    > = {};

    for (
      let hole = 1;
      hole <= round.holes;
      hole++
    ) {
      pars[hole] =
        coursePars[hole - 1] ?? 4;
    }

    return calculatePlayerQuotaPoints(
      scorecard.scores || {},
      playerId,
      pars,
      round.holes,
      quotaPoints
    );
  }

  /*
   * DELETE ROUND
   */
  function deleteRound(
    roundId: number
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this round?"
      );

    if (!confirmed) {
      return;
    }

    const updatedRounds =
      rounds.filter(
        (round) =>
          round.id !== roundId
      );

    const updatedScorecards =
      scorecards.filter(
        (card) =>
          String(
            card.roundId
          ) !==
          String(roundId)
      );

    setRounds(
      updatedRounds
    );

    setScorecards(
      updatedScorecards
    );

    localStorage.setItem(
      "rounds",
      JSON.stringify(
        updatedRounds
      )
    );

    localStorage.setItem(
      "scorecards",
      JSON.stringify(
        updatedScorecards
      )
    );
  }

  if (loading) {
    return (
      <main className="p-8">
        <p>
          Loading rounds...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-8">

      {/* HEADER */}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            Golf Rounds
          </h1>

          <p className="mt-1 text-gray-600">
            View and manage your rounds
          </p>
        </div>

        <Link
          href="/rounds/new"
          className="rounded bg-green-600 px-5 py-3 text-center font-semibold text-white hover:bg-green-700"
        >
          + New Round
        </Link>

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* CURRENT SCORING */}

      <div className="mb-8 rounded-lg border bg-gray-50 p-4">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="font-bold">
              Current Quota Scoring
            </h2>

            <p className="text-sm text-gray-600">
              Loaded directly from Quota Settings.
            </p>
          </div>

          <Link
            href="/settings/quota"
            className="rounded bg-purple-600 px-4 py-2 text-center text-white hover:bg-purple-700"
          >
            Edit Quota Settings
          </Link>

        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">

          {[
            ["Ace", quotaPoints.ace],
            ["Eagle", quotaPoints.eagle],
            ["Birdie", quotaPoints.birdie],
            ["Par", quotaPoints.par],
            ["Bogey", quotaPoints.bogey],
            [
              "Double Bogey",
              quotaPoints.doubleBogey,
            ],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                className="rounded border bg-white p-3 text-center"
              >
                <div className="text-xs text-gray-500">
                  {label}
                </div>

                <div className="text-xl font-bold">
                  {value}
                </div>
              </div>
            )
          )}

        </div>

        <p className="mt-3 text-xs text-gray-500">
          Triple Bogey or worse = 0 points
        </p>

      </div>

      {/* NAVIGATION */}

      <div className="mb-8 flex flex-wrap gap-3">

        <Link
          href="/"
          className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
        >
          Home
        </Link>

        <Link
          href="/players"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Players
        </Link>

        <Link
          href="/settings/quota"
          className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
        >
          Quota Settings
        </Link>

      </div>

      {/* NO ROUNDS */}

      {rounds.length === 0 && (
        <div className="rounded-lg border bg-white p-8 text-center">

          <h2 className="mb-2 text-xl font-bold">
            No rounds yet
          </h2>

          <p className="text-gray-600">
            Click{" "}
            <strong>
              + New Round
            </strong>{" "}
            above to create your first
            golf round.
          </p>

        </div>
      )}

      {/* ROUNDS */}

      <div className="space-y-6">

        {rounds
          .slice()
          .reverse()
          .map((round) => {

            const roundPlayers =
              players.filter(
                (player) =>
                  round.playerIds.includes(
                    String(
                      player.id
                    )
                  )
              );

            const coursePars =
              getParsForRound(
                round
              );

            const totalPar =
              coursePars.reduce(
                (
                  total,
                  par
                ) =>
                  total + par,
                0
              );

            const leaderboard =
              roundPlayers
                .map((player) => {

                  const points =
                    getPlayerPoints(
                      player.id,
                      round
                    );

                  const result =
                    points -
                    player.quota;

                  return {
                    player,
                    points,
                    result,
                  };
                })
                .sort(
                  (a, b) =>
                    b.result -
                    a.result
                );

            return (
              <div
                key={round.id}
                className="rounded-lg border bg-white p-6 shadow-sm"
              >

                {/* ROUND HEADER */}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <h2 className="text-2xl font-bold">
                      {round.name}
                    </h2>

                    <p className="mt-1 text-gray-600">
                      {round.course}
                      {" • "}
                      White Tees
                      {" • "}
                      {round.holes} holes
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Course Par:{" "}
                      <strong>
                        {totalPar}
                      </strong>
                    </p>

                  </div>

                  <Link
                    href={`/rounds/${round.id}`}
                    className="rounded bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
                  >
                    Open Round
                  </Link>

                </div>

                {/* PLAYERS */}

                <div className="mt-6">

                  <h3 className="mb-3 font-bold">
                    Players
                  </h3>

                  {roundPlayers.length ===
                  0 ? (
                    <p className="text-sm text-red-600">
                      No players found for
                      this round.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">

                      {roundPlayers.map(
                        (player) => (
                          <div
                            key={
                              player.id
                            }
                            className="rounded bg-gray-100 px-3 py-2"
                          >

                            <span className="font-medium">
                              {player.name}
                            </span>

                            <span className="ml-2 text-sm text-gray-500">
                              Quota{" "}
                              {player.quota}
                            </span>

                          </div>
                        )
                      )}

                    </div>
                  )}

                </div>

                {/* LEADERBOARD */}

                {roundPlayers.length >
                  0 && (
                  <div className="mt-6">

                    <h3 className="mb-3 font-bold">
                      Leaderboard
                    </h3>

                    <div className="space-y-2">

                      {leaderboard.map(
                        (
                          entry,
                          index
                        ) => (

                          <div
                            key={
                              entry
                                .player
                                .id
                            }
                            className="flex items-center justify-between rounded border p-3"
                          >

                            <div className="flex items-center gap-3">

                              <div className="w-6 font-bold">
                                {index +
                                  1}
                              </div>

                              <div>

                                <div className="font-semibold">
                                  {
                                    entry
                                      .player
                                      .name
                                  }
                                </div>

                                <div className="text-sm text-gray-500">
                                  Quota:{" "}
                                  {
                                    entry
                                      .player
                                      .quota
                                  }
                                  {" • "}
                                  Points:{" "}
                                  {
                                    entry.points
                                  }
                                </div>

                              </div>

                            </div>

                            <div
                              className={`text-lg font-bold ${
                                entry.result >
                                0
                                  ? "text-green-600"
                                  : entry.result <
                                    0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {entry.result >
                              0
                                ? "+"
                                : ""}

                              {
                                entry.result
                              }
                            </div>

                          </div>

                        )
                      )}

                    </div>

                  </div>
                )}

                {/* ACTIONS */}

                <div className="mt-6 flex flex-wrap gap-3">

                  <Link
                    href={`/rounds/${round.id}`}
                    className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900"
                  >
                    Scorecard
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      deleteRound(
                        round.id
                      )
                    }
                    className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  >
                    Delete Round
                  </button>

                </div>

              </div>
            );
          })}

      </div>

    </main>
  );
}