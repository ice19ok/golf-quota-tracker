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

  /*
   * The quota each player had
   * when this round started.
   *
   * This prevents an old round
   * from changing after we update
   * the player's quota.
   */
  startingQuotas?: Record<string, number>;

  /*
   * Whether the quota adjustment
   * has already been applied.
   */
  quotaAdjusted?: boolean;
};

/*
 * KICKINGBIRD GOLF CLUB
 * WHITE TEES
 * PAR 70
 */
const KICKINGBIRD_WHITE_PARS = [
  4, 4, 3, 5, 4, 3, 4, 4, 4,
  4, 3, 5, 4, 3, 5, 3, 4, 4,
];

/*
 * THE GOLF CLUB OF EDMOND
 * WHITE TEES
 * PAR 70
 */
const EDMOND_WHITE_PARS = [
  4, 5, 3, 4, 4, 4, 3, 4, 5,
  3, 4, 4, 4, 3, 5, 4, 3, 5,
];

function getCoursePars(
  courseName: string
): number[] {
  if (
    courseName ===
    "KickingBird Golf Club"
  ) {
    return KICKINGBIRD_WHITE_PARS;
  }

  if (
    courseName ===
    "The Golf Club of Edmond"
  ) {
    return EDMOND_WHITE_PARS;
  }

  return Array(18).fill(4);
}

export default function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = createClient();

  const [round, setRound] =
    useState<Round | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [scores, setScores] =
    useState<Record<string, number | "">>({});

  const [pars, setPars] =
    useState<Record<number, number>>({});

  /*
   * Quota used when this round started.
   */
  const [startingQuotas, setStartingQuotas] =
    useState<Record<string, number>>({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [savedMessage, setSavedMessage] =
    useState("");

  const [updatingQuotas, setUpdatingQuotas] =
    useState(false);

  const [quotaUpdateMessage, setQuotaUpdateMessage] =
    useState("");

  const [quotaPoints, setQuotaPoints] =
    useState<QuotaPoints>(
      DEFAULT_QUOTA_POINTS
    );

  /*
   * LOAD ROUND
   */
  useEffect(() => {
    async function loadRound() {
      try {
        const { id } = await params;

        /*
         * LOAD QUOTA SCORING SETTINGS
         */
        const settings =
          loadQuotaPoints();

        setQuotaPoints(settings);

        /*
         * CHECK LOGIN
         */
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          window.location.href =
            "/login";
          return;
        }

        /*
         * LOAD ROUNDS
         */
        const savedRounds =
          localStorage.getItem("rounds");

        let foundRound: Round | null = null;

        if (savedRounds) {
          try {
            const rounds: Round[] =
              JSON.parse(savedRounds);

            foundRound =
              rounds.find(
                (r) =>
                  String(r.id) ===
                  String(id)
              ) || null;

            if (foundRound) {
              foundRound = {
                ...foundRound,

                playerIds:
                  Array.isArray(
                    foundRound.playerIds
                  )
                    ? foundRound.playerIds.map(
                        (playerId) =>
                          String(playerId)
                      )
                    : [],
              };

              setRound(foundRound);

              /*
               * ALWAYS USE OFFICIAL
               * COURSE PARS.
               */
              const coursePars =
                getCoursePars(
                  foundRound.course
                );

              const startingPars:
                Record<number, number> =
                {};

              for (
                let hole = 1;
                hole <= foundRound.holes;
                hole++
              ) {
                startingPars[hole] =
                  coursePars[
                    hole - 1
                  ] ?? 4;
              }

              setPars(startingPars);
            }
          } catch (error) {
            console.error(
              "Error loading rounds:",
              error
            );
          }
        }

        if (!foundRound) {
          setLoading(false);
          return;
        }

        /*
         * LOAD PLAYERS
         */
        const {
          data: playerData,
          error: playerError,
        } =
          await supabase
            .from("players")
            .select(
              "id, name, quota"
            )
            .order("name");

        if (playerError) {
          console.error(
            "Could not load players:",
            playerError
          );
        } else {
          const loadedPlayers =
            (playerData || []).map(
              (player) => ({
                id: String(
                  player.id
                ),
                name: player.name,
                quota: Number(
                  player.quota
                ),
              })
            );

          setPlayers(
            loadedPlayers
          );

          /*
           * LOAD SCORECARD
           */
          const savedScorecards =
            localStorage.getItem(
              "scorecards"
            );

          let existingScorecard:
            Scorecard | undefined;

          if (savedScorecards) {
            try {
              const scorecards:
                Scorecard[] =
                JSON.parse(
                  savedScorecards
                );

              existingScorecard =
                scorecards.find(
                  (card) =>
                    String(
                      card.roundId
                    ) ===
                    String(
                      foundRound!.id
                    )
                );

              if (existingScorecard) {
                setScores(
                  existingScorecard.scores ||
                    {}
                );

                /*
                 * REBUILD PARS FROM
                 * THE COURSE.
                 */
                const coursePars =
                  getCoursePars(
                    foundRound.course
                  );

                const correctPars:
                  Record<number, number> =
                  {};

                for (
                  let hole = 1;
                  hole <= foundRound.holes;
                  hole++
                ) {
                  correctPars[hole] =
                    coursePars[
                      hole - 1
                    ] ?? 4;
                }

                setPars(
                  correctPars
                );

                /*
                 * Restore the original
                 * quotas for this round.
                 */
                if (
                  existingScorecard.startingQuotas
                ) {
                  setStartingQuotas(
                    existingScorecard.startingQuotas
                  );
                }
              }
            } catch (error) {
              console.error(
                "Error loading scorecard:",
                error
              );
            }
          }

          /*
           * If this is a brand new round,
           * save the players' current quotas
           * as the starting quotas.
           */
          if (
            !existingScorecard?.startingQuotas
          ) {
            const initialQuotas:
              Record<string, number> =
              {};

            for (
              const player of loadedPlayers
            ) {
              initialQuotas[
                String(player.id)
              ] = Number(
                player.quota
              );
            }

            setStartingQuotas(
              initialQuotas
            );
          }
        }
      } catch (error) {
        console.error(
          "Error loading round:",
          error
        );
      }

      setLoading(false);
    }

    loadRound();
  }, [params]);

  /*
   * AUTOMATICALLY SAVE SCORECARD
   */
  useEffect(() => {
    if (!round || loading) {
      return;
    }

    let scorecards:
      Scorecard[] = [];

    const savedScorecards =
      localStorage.getItem(
        "scorecards"
      );

    if (savedScorecards) {
      try {
        const parsed =
          JSON.parse(
            savedScorecards
          );

        if (Array.isArray(parsed)) {
          scorecards = parsed;
        }
      } catch (error) {
        console.error(
          "Could not load scorecards:",
          error
        );
      }
    }

    /*
     * Preserve the existing
     * quotaAdjusted value.
     */
    const existingScorecard =
      scorecards.find(
        (card) =>
          String(card.roundId) ===
          String(round.id)
      );

    const scorecard: Scorecard = {
      roundId: round.id,
      scores,
      pars,

      startingQuotas:
        Object.keys(
          startingQuotas
        ).length > 0
          ? startingQuotas
          : existingScorecard
              ?.startingQuotas,

      quotaAdjusted:
        existingScorecard
          ?.quotaAdjusted ??
        false,

      savedAt:
        new Date().toISOString(),
    };

    const existingIndex =
      scorecards.findIndex(
        (card) =>
          String(card.roundId) ===
          String(round.id)
      );

    if (existingIndex >= 0) {
      scorecards[
        existingIndex
      ] = scorecard;
    } else {
      scorecards.push(
        scorecard
      );
    }

    setSaving(true);

    localStorage.setItem(
      "scorecards",
      JSON.stringify(
        scorecards
      )
    );

    setSaving(false);
    setSavedMessage("Saved");

    const timer =
      setTimeout(() => {
        setSavedMessage("");
      }, 1500);

    return () => {
      clearTimeout(timer);
    };
  }, [
    scores,
    pars,
    round,
    loading,
    startingQuotas,
  ]);

  /*
   * UPDATE SCORE
   */
  function updateScore(
    playerId: string,
    hole: number,
    value: string
  ) {
    const key =
      `${playerId}-${hole}`;

    if (value === "") {
      setScores((current) => ({
        ...current,
        [key]: "",
      }));

      return;
    }

    const score =
      Number(value);

    if (
      !Number.isFinite(score) ||
      score < 1
    ) {
      return;
    }

    setScores((current) => ({
      ...current,
      [key]: score,
    }));
  }

  /*
   * GET PLAYER QUOTA POINTS
   */
  function getPlayerPoints(
    playerId: string
  ) {
    if (!round) {
      return 0;
    }

    return calculatePlayerQuotaPoints(
      scores,
      playerId,
      pars,
      round.holes,
      quotaPoints
    );
  }

  /*
   * GET PLAYER TOTAL SCORE
   */
  function getPlayerTotalScore(
    playerId: string
  ) {
    if (!round) {
      return 0;
    }

    let total = 0;

    for (
      let hole = 1;
      hole <= round.holes;
      hole++
    ) {
      const key =
        `${playerId}-${hole}`;

      const score =
        scores[key];

      if (
        typeof score ===
        "number"
      ) {
        total += score;
      }
    }

    return total;
  }

  /*
   * GET STARTING QUOTA
   *
   * This is the quota used
   * for this round, even if the
   * player's current Supabase
   * quota has since changed.
   */
  function getPlayerStartingQuota(
    playerId: string
  ) {
    const savedQuota =
      startingQuotas[
        String(playerId)
      ];

    if (
      typeof savedQuota ===
      "number"
    ) {
      return savedQuota;
    }

    const player =
      players.find(
        (p) =>
          String(p.id) ===
          String(playerId)
      );

    return player?.quota ?? 0;
  }

  /*
   * CALCULATE NEW QUOTA
   *
   * RULE:
   *
   * Difference is divided by 2.
   *
   * Fractions ALWAYS round UP.
   *
   * Example:
   *
   * Quota 6
   * Points 9
   *
   * Difference = 3
   * 3 / 2 = 1.5
   * Round UP = 2
   *
   * New quota = 8
   */
  function calculateNewQuota(
    currentQuota: number,
    points: number
  ) {
    const difference =
      points - currentQuota;

    if (difference === 0) {
      return currentQuota;
    }

    const adjustment =
      Math.ceil(
        Math.abs(difference) / 2
      );

    if (difference > 0) {
      return (
        currentQuota +
        adjustment
      );
    }

    return Math.max(
      0,
      currentQuota -
        adjustment
    );
  }

  /*
   * CHECK IF QUOTA HAS ALREADY
   * BEEN UPDATED FOR THIS ROUND.
   */
  function hasQuotaBeenAdjusted() {
    if (!round) {
      return false;
    }

    const savedScorecards =
      localStorage.getItem(
        "scorecards"
      );

    if (!savedScorecards) {
      return false;
    }

    try {
      const scorecards:
        Scorecard[] =
        JSON.parse(
          savedScorecards
        );

      const scorecard =
        scorecards.find(
          (card) =>
            String(card.roundId) ===
            String(round.id)
        );

      return (
        scorecard?.quotaAdjusted ===
        true
      );
    } catch {
      return false;
    }
  }

  /*
   * UPDATE QUOTAS AFTER ROUND
   *
   * This is the button that
   * applies the new quotas.
   */
  async function updatePlayerQuotas() {
    if (!round) {
      return;
    }

    if (
      hasQuotaBeenAdjusted()
    ) {
      setQuotaUpdateMessage(
        "Quotas have already been updated for this round."
      );
      return;
    }

    if (
      roundPlayers.length === 0
    ) {
      setQuotaUpdateMessage(
        "There are no players in this round."
      );
      return;
    }

    /*
     * Make sure there is at
     * least one score entered.
     */
    const hasScores =
      roundPlayers.some(
        (player) => {
          for (
            let hole = 1;
            hole <= round.holes;
            hole++
          ) {
            const key =
              `${player.id}-${hole}`;

            if (
              typeof scores[key] ===
              "number"
            ) {
              return true;
            }
          }

          return false;
        }
      );

    if (!hasScores) {
      setQuotaUpdateMessage(
        "Enter scores before updating quotas."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Finish this round and update player quotas based on the results?"
      );

    if (!confirmed) {
      return;
    }

    setUpdatingQuotas(true);
    setQuotaUpdateMessage("");

    try {
      /*
       * Build updates for every
       * player in the round.
       */
      const quotaUpdates =
        roundPlayers.map(
          (player) => {
            const points =
              getPlayerPoints(
                player.id
              );

            const oldQuota =
              getPlayerStartingQuota(
                player.id
              );

            const newQuota =
              calculateNewQuota(
                oldQuota,
                points
              );

            return {
              player,
              points,
              oldQuota,
              newQuota,
            };
          }
        );

      /*
       * UPDATE SUPABASE
       */
      for (
        const update of quotaUpdates
      ) {
        const {
          error,
        } = await supabase
          .from("players")
          .update({
            quota:
              update.newQuota,
          })
          .eq(
            "id",
            update.player.id
          );

        if (error) {
          throw error;
        }
      }

      /*
       * UPDATE LOCAL PLAYER STATE
       */
      setPlayers(
        (currentPlayers) =>
          currentPlayers.map(
            (player) => {
              const update =
                quotaUpdates.find(
                  (item) =>
                    String(
                      item.player.id
                    ) ===
                    String(
                      player.id
                    )
                );

              if (!update) {
                return player;
              }

              return {
                ...player,
                quota:
                  update.newQuota,
              };
            }
          )
      );

      /*
       * MARK THIS ROUND AS
       * QUOTA ADJUSTED.
       */
      const savedScorecards =
        localStorage.getItem(
          "scorecards"
        );

      let scorecards:
        Scorecard[] = [];

      if (savedScorecards) {
        try {
          const parsed =
            JSON.parse(
              savedScorecards
            );

          if (Array.isArray(parsed)) {
            scorecards = parsed;
          }
        } catch {
          scorecards = [];
        }
      }

      const scorecardIndex =
        scorecards.findIndex(
          (card) =>
            String(card.roundId) ===
            String(round.id)
        );

      if (
        scorecardIndex >= 0
      ) {
        scorecards[
          scorecardIndex
        ] = {
          ...scorecards[
            scorecardIndex
          ],
          startingQuotas,
          quotaAdjusted:
            true,
          savedAt:
            new Date().toISOString(),
        };
      } else {
        scorecards.push({
          roundId: round.id,
          scores,
          pars,
          startingQuotas,
          quotaAdjusted:
            true,
          savedAt:
            new Date().toISOString(),
        });
      }

      localStorage.setItem(
        "scorecards",
        JSON.stringify(
          scorecards
        )
      );

      /*
       * Build a summary message.
       */
      const summary =
        quotaUpdates
          .map(
            (update) =>
              `${update.player.name}: ${update.oldQuota} → ${update.newQuota}`
          )
          .join(" • ");

      setQuotaUpdateMessage(
        `Quotas updated: ${summary}`
      );
    } catch (error) {
      console.error(
        "Could not update quotas:",
        error
      );

      setQuotaUpdateMessage(
        "There was a problem updating the quotas. Please try again."
      );
    } finally {
      setUpdatingQuotas(false);
    }
  }

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="p-8">
        <p>
          Loading scorecard...
        </p>
      </main>
    );
  }

  /*
   * ROUND NOT FOUND
   */
  if (!round) {
    return (
      <main className="p-8">
        <h1 className="mb-4 text-2xl font-bold">
          Round Not Found
        </h1>

        <Link
          href="/rounds"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Back to Rounds
        </Link>
      </main>
    );
  }

  /*
   * ONLY PLAYERS SELECTED
   * FOR THIS ROUND
   */
  const roundPlayers =
    players.filter(
      (player) =>
        round.playerIds.some(
          (playerId) =>
            String(playerId) ===
            String(player.id)
        )
    );

  /*
   * TOTAL COURSE PAR
   */
  const totalPar =
    Array.from(
      {
        length: round.holes,
      },
      (_, index) =>
        pars[index + 1] ?? 4
    ).reduce(
      (total, par) =>
        total + par,
      0
    );

  const quotasAlreadyUpdated =
    hasQuotaBeenAdjusted();

  return (
    <main className="mx-auto max-w-full p-4 md:p-8">

      {/* NAVIGATION */}

      <div className="mb-6 flex flex-wrap gap-3">

        <Link
          href="/"
          className="rounded bg-gray-500 px-4 py-2 text-white"
        >
          Home
        </Link>

        <Link
          href="/rounds"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Rounds
        </Link>

        <Link
          href="/players"
          className="rounded bg-purple-600 px-4 py-2 text-white"
        >
          Players
        </Link>

        <Link
          href="/settings/quota"
          className="rounded bg-indigo-600 px-4 py-2 text-white"
        >
          Quota Settings
        </Link>

      </div>

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">

        <div>

          <h1 className="text-3xl font-bold">
            {round.name}
          </h1>

          <p className="mt-1 text-gray-600">
            {round.course}
            {" • "}
            White Tees
            {" • "}
            {round.holes} Holes
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Course Par:{" "}
            <strong>
              {totalPar}
            </strong>
          </p>

          {/* CURRENT QUOTA SETTINGS */}

          <div className="mt-3 rounded border bg-gray-50 p-3">

            <p className="mb-2 font-semibold">
              Quota Scoring Settings
            </p>

            <div className="flex flex-wrap gap-3 text-sm">

              <span>
                Ace:{" "}
                <strong>
                  {quotaPoints.ace}
                </strong>
              </span>

              <span>
                Eagle:{" "}
                <strong>
                  {quotaPoints.eagle}
                </strong>
              </span>

              <span>
                Birdie:{" "}
                <strong>
                  {quotaPoints.birdie}
                </strong>
              </span>

              <span>
                Par:{" "}
                <strong>
                  {quotaPoints.par}
                </strong>
              </span>

              <span>
                Bogey:{" "}
                <strong>
                  {quotaPoints.bogey}
                </strong>
              </span>

              <span>
                Double Bogey:{" "}
                <strong>
                  {quotaPoints.doubleBogey}
                </strong>
              </span>

              <span>
                Triple+:{" "}
                <strong>
                  0
                </strong>
              </span>

            </div>

          </div>

        </div>

        <div className="text-sm text-gray-500">
          {saving
            ? "Saving..."
            : savedMessage ||
              "All changes saved"}
        </div>

      </div>

      {/* QUOTA ADJUSTMENT */}

      <div className="mt-6 rounded-lg border border-green-300 bg-green-50 p-5">

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <h2 className="text-xl font-bold text-green-900">
              Finish Round & Update Quotas
            </h2>

            <p className="mt-1 text-sm text-green-800">
              Quota increases or decreases by
              half of the difference between
              the player's points and quota.
              Fractions always round up.
            </p>

            <p className="mt-2 text-sm font-semibold text-green-900">
              Example: Quota 6 + Points 9
              → New Quota 8
            </p>

          </div>

          <button
            type="button"
            onClick={
              updatePlayerQuotas
            }
            disabled={
              updatingQuotas ||
              quotasAlreadyUpdated ||
              roundPlayers.length === 0
            }
            className={`rounded px-5 py-3 font-semibold text-white ${
              quotasAlreadyUpdated
                ? "cursor-not-allowed bg-gray-400"
                : updatingQuotas
                ? "cursor-wait bg-green-500"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {quotasAlreadyUpdated
              ? "Quotas Updated"
              : updatingQuotas
              ? "Updating..."
              : "Finish Round & Update Quotas"}
          </button>

        </div>

        {quotaUpdateMessage && (
          <div className="mt-4 rounded border border-green-300 bg-white p-3 text-sm font-medium text-green-800">
            {quotaUpdateMessage}
          </div>
        )}

      </div>

      {/* PLAYER WARNING */}

      {roundPlayers.length === 0 && (
        <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-4">

          <p className="font-semibold text-yellow-800">
            No players are showing
            for this round.
          </p>

          <p className="mt-1 text-sm text-yellow-700">
            The round was created
            with player IDs that
            could not be matched
            to the current players
            in Supabase.
          </p>

        </div>
      )}

      {/* SCORECARD */}

      <div className="mt-8 overflow-x-auto rounded border">

        <table className="min-w-max border-collapse">

          <thead>

            <tr className="bg-gray-100">

              <th className="sticky left-0 border bg-gray-100 p-3 text-left">
                Hole
              </th>

              <th className="border p-3">
                Par
              </th>

              {roundPlayers.map(
                (player) => (
                  <th
                    key={player.id}
                    className="min-w-[110px] border p-3"
                  >
                    {player.name}
                  </th>
                )
              )}

            </tr>

          </thead>

          <tbody>

            {Array.from(
              {
                length: round.holes,
              },
              (_, index) =>
                index + 1
            ).map((hole) => (

              <tr key={hole}>

                <td className="sticky left-0 border bg-white p-3 font-bold">
                  {hole}
                </td>

                <td className="border p-2">

                  <div className="w-16 p-2 text-center font-bold">
                    {pars[hole] ?? 4}
                  </div>

                </td>

                {roundPlayers.map(
                  (player) => {

                    const key =
                      `${player.id}-${hole}`;

                    return (
                      <td
                        key={player.id}
                        className="border p-2"
                      >

                        <input
                          type="number"
                          min="1"
                          max="15"
                          value={
                            scores[key] ??
                            ""
                          }
                          onChange={(e) =>
                            updateScore(
                              player.id,
                              hole,
                              e.target.value
                            )
                          }
                          className="w-20 rounded border p-2 text-center"
                        />

                      </td>
                    );
                  }
                )}

              </tr>

            ))}

          </tbody>

          <tfoot>

            <tr className="bg-gray-100">

              <td className="border p-3 font-bold">
                Total
              </td>

              <td className="border p-3 font-bold">
                {totalPar}
              </td>

              {roundPlayers.map(
                (player) => (

                  <td
                    key={player.id}
                    className="border p-3 text-center font-bold"
                  >
                    {getPlayerTotalScore(
                      player.id
                    )}
                  </td>

                )
              )}

            </tr>

          </tfoot>

        </table>

      </div>

      {/* QUOTA RESULTS */}

      <div className="mt-8">

        <h2 className="mb-4 text-2xl font-bold">
          Quota Results
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

          {roundPlayers.map(
            (player) => {

              /*
               * IMPORTANT:
               *
               * Use the quota from the
               * START of this round.
               */
              const currentQuota =
                getPlayerStartingQuota(
                  player.id
                );

              const points =
                getPlayerPoints(
                  player.id
                );

              const result =
                points -
                currentQuota;

              const newQuota =
                calculateNewQuota(
                  currentQuota,
                  points
                );

              return (
                <div
                  key={player.id}
                  className="rounded border p-4"
                >

                  <h3 className="text-xl font-bold">
                    {player.name}
                  </h3>

                  <div className="mt-3 space-y-1">

                    <div>
                      Starting Quota:{" "}
                      <strong>
                        {currentQuota}
                      </strong>
                    </div>

                    <div>
                      Points:{" "}
                      <strong>
                        {points}
                      </strong>
                    </div>

                    <div>
                      Result:{" "}

                      <strong
                        className={
                          result > 0
                            ? "text-green-600"
                            : result < 0
                            ? "text-red-600"
                            : "text-gray-600"
                        }
                      >
                        {result > 0
                          ? "+"
                          : ""}
                        {result}
                      </strong>

                    </div>

                    <div className="mt-3 border-t pt-3 text-lg">

                      Next Quota:{" "}

                      <strong>
                        {newQuota}
                      </strong>

                    </div>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

    </main>
  );
}