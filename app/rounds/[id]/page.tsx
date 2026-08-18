"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Player = {
  id: number;
  name: string;
  quota: number;
};

type Round = {
  id: number;
  name: string;
  course: string;
  holes: number;
  playerIds: number[];
  pars?: number[];
};

type Scorecard = {
  roundId: number;
  scores: Record<string, number | "">;
  pars: Record<number, number>;
  savedAt: string;
};

/*
 * WHITE TEE COURSE PARS
 *
 * KickingBird Golf Club
 * Par 70
 */
const KICKINGBIRD_WHITE_PARS = [
  4, 4, 3, 5, 4, 3, 4, 4, 4,
  4, 3, 5, 4, 3, 5, 3, 4, 4,
];

/*
 * The Golf Club of Edmond
 * White Tees
 * Par 70
 */
const EDMOND_WHITE_PARS = [
  4, 5, 3, 4, 4, 4, 3, 4, 5,
  3, 4, 4, 4, 3, 4, 4, 3, 5,
];

/*
 * Get the correct pars for the selected course.
 */
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

  // Fallback
  return Array(18).fill(4);
}

export default function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [round, setRound] =
    useState<Round | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [scores, setScores] =
    useState<Record<string, number | "">>(
      {}
    );

  const [pars, setPars] =
    useState<Record<number, number>>({});

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [savedMessage, setSavedMessage] =
    useState("");

  useEffect(() => {
    async function loadRound() {

      const { id } = await params;

      const savedRounds =
        localStorage.getItem("rounds");

      const savedPlayers =
        localStorage.getItem("players");

      const savedScorecards =
        localStorage.getItem("scorecards");

      let foundRound: Round | null =
        null;

      /*
       * LOAD ROUND
       */

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

            setRound(foundRound);

            /*
             * ALWAYS start with the
             * correct course pars.
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

      /*
       * LOAD PLAYERS
       */

      if (savedPlayers) {

        try {

          setPlayers(
            JSON.parse(
              savedPlayers
            )
          );

        } catch (error) {

          console.error(
            "Error loading players:",
            error
          );

        }
      }

      /*
       * LOAD SAVED SCORECARD
       */

      if (
        savedScorecards &&
        foundRound
      ) {

        try {

          const scorecards:
            Scorecard[] =
            JSON.parse(
              savedScorecards
            );

          const savedScorecard =
            scorecards.find(
              (card) =>
                card.roundId ===
                foundRound!.id
            );

          if (savedScorecard) {

            /*
             * Keep the player's scores.
             */

            setScores(
              savedScorecard.scores
            );

            /*
             * IMPORTANT:
             *
             * Do NOT blindly load the old
             * saved pars.
             *
             * The old scorecard may contain
             * Par 4 for every hole.
             *
             * Course pars are the source
             * of truth.
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

            setPars(correctPars);
          }

        } catch (error) {

          console.error(
            "Error loading scorecard:",
            error
          );

        }
      }

      setLoading(false);
    }

    loadRound();

  }, [params]);

  /*
   * AUTOMATICALLY SAVE
   */

  useEffect(() => {

    if (!round || loading) return;

    const saveAutomatically = () => {

      setSaving(true);

      const savedScorecards =
        localStorage.getItem(
          "scorecards"
        );

      let scorecards:
        Scorecard[] = [];

      if (savedScorecards) {

        try {

          scorecards =
            JSON.parse(
              savedScorecards
            );

        } catch (error) {

          console.error(
            "Could not load scorecards:",
            error
          );

        }
      }

      const scorecard:
        Scorecard = {
          roundId: round.id,
          scores,
          pars,
          savedAt:
            new Date().toISOString(),
        };

      const existingIndex =
        scorecards.findIndex(
          (card) =>
            card.roundId ===
            round.id
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

      localStorage.setItem(
        "scorecards",
        JSON.stringify(
          scorecards
        )
      );

      setSaving(false);

      setSavedMessage(
        "Saved"
      );

      setTimeout(() => {
        setSavedMessage("");
      }, 1500);
    };

    saveAutomatically();

  }, [
    scores,
    pars,
    round,
    loading,
  ]);

  /*
   * UPDATE SCORE
   */

  function updateScore(
    playerId: number,
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

    setScores((current) => ({
      ...current,
      [key]: score,
    }));
  }

  /*
   * MANUALLY CHANGE PAR
   */

  function updatePar(
    hole: number,
    value: string
  ) {

    setPars((current) => ({
      ...current,
      [hole]: Number(value),
    }));
  }

  /*
   * QUOTA POINTS
   */

 function getPlayerPoints(
  playerId: number
) {
  if (!round) return 0;

  const quotaPoints = JSON.parse(
    localStorage.getItem("quotaPoints") ||
      JSON.stringify({
        ace: 5,
        eagle: 4,
        birdie: 3,
        par: 2,
        bogey: 1,
        doubleBogey: 0,
      })
  );

  let totalPoints = 0;

  for (
    let hole = 1;
    hole <= round.holes;
    hole++
  ) {
    const key = `${playerId}-${hole}`;

    const score = scores[key];

    const par = pars[hole] || 4;

    if (
      score === "" ||
      score === undefined
    ) {
      continue;
    }

    const difference =
      Number(score) - par;

    if (Number(score) === 1) {
      totalPoints += quotaPoints.ace;
    } else if (difference <= -2) {
      totalPoints += quotaPoints.eagle;
    } else if (difference === -1) {
      totalPoints += quotaPoints.birdie;
    } else if (difference === 0) {
      totalPoints += quotaPoints.par;
    } else if (difference === 1) {
      totalPoints += quotaPoints.bogey;
    } else {
      totalPoints +=
        quotaPoints.doubleBogey;
    }
  }

  return totalPoints;
}
  /*
   * TOTAL SCORE
   */

  function getPlayerTotalScore(
    playerId: number
  ) {

    if (!round) return 0;

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

        <h1 className="text-2xl font-bold mb-4">
          Round Not Found
        </h1>

        <Link
          href="/rounds"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Back to Rounds
        </Link>

      </main>
    );
  }

  const roundPlayers =
    players.filter(
      (player) =>
        round.playerIds.includes(
          player.id
        )
    );

  /*
   * TOTAL COURSE PAR
   */

  const totalPar =
    Array.from(
      {
        length:
          round.holes,
      },
      (_, index) =>
        pars[index + 1] || 4
    ).reduce(
      (total, par) =>
        total + par,
      0
    );

  return (
    <main className="p-4 md:p-8 max-w-full mx-auto">

      {/* Navigation */}

      <div className="flex gap-3 mb-6">

        <Link
          href="/"
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Home
        </Link>

        <Link
          href="/rounds"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Rounds
        </Link>

      </div>

      {/* Header */}

      <div className="flex justify-between items-start">

        <div>

          <h1 className="text-3xl font-bold">
            {round.name}
          </h1>

          <p className="text-gray-600 mt-1">
            {round.course}
            {" • "}
            White Tees
            {" • "}
            {round.holes} Holes
          </p>

          <p className="text-sm text-gray-500 mt-1">

            Course Par:{" "}

            <strong>
              {totalPar}
            </strong>

          </p>

        </div>

        <div className="text-sm text-gray-500">

          {saving
            ? "Saving..."
            : savedMessage ||
              "All changes saved"}

        </div>

      </div>

      {/* SCORECARD */}

      <div className="mt-8 overflow-x-auto border rounded">

        <table className="border-collapse min-w-max">

          <thead>

            <tr className="bg-gray-100">

              <th className="border p-3 text-left sticky left-0 bg-gray-100">
                Hole
              </th>

              <th className="border p-3">
                Par
              </th>

              {roundPlayers.map(
                (player) => (

                  <th
                    key={
                      player.id
                    }
                    className="border p-3 min-w-[110px]"
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
                length:
                  round.holes,
              },
              (_, index) =>
                index + 1
            ).map((hole) => (

              <tr key={hole}>

                <td className="border p-3 font-bold sticky left-0 bg-white">
                  {hole}
                </td>

                <td className="border p-2">

                  <select
                    value={
                      pars[hole] || 4
                    }
                    onChange={(e) =>
                      updatePar(
                        hole,
                        e.target.value
                      )
                    }
                    className="border rounded p-2 w-16"
                  >

                    <option value="3">
                      3
                    </option>

                    <option value="4">
                      4
                    </option>

                    <option value="5">
                      5
                    </option>

                  </select>

                </td>

                {roundPlayers.map(
                  (player) => {

                    const key =
                      `${player.id}-${hole}`;

                    return (

                      <td
                        key={
                          player.id
                        }
                        className="border p-2"
                      >

                        <input
                          type="number"
                          min="1"
                          max="15"
                          value={
                            scores[
                              key
                            ] ?? ""
                          }
                          onChange={(
                            e
                          ) =>
                            updateScore(
                              player.id,
                              hole,
                              e.target
                                .value
                            )
                          }
                          className="border rounded p-2 w-20 text-center"
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
                    key={
                      player.id
                    }
                    className="border p-3 font-bold text-center"
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

        <h2 className="text-2xl font-bold mb-4">
          Quota Results
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

          {roundPlayers.map(
            (player) => {

              const points =
                getPlayerPoints(
                  player.id
                );

              const result =
                points -
                player.quota;

              return (

                <div
                  key={
                    player.id
                  }
                  className="border rounded p-4"
                >

                  <h3 className="text-xl font-bold">
                    {player.name}
                  </h3>

                  <div className="mt-3 space-y-1">

                    <div>
                      Quota:{" "}
                      <strong>
                        {player.quota}
                      </strong>
                    </div>

                    <div>
                      Points:{" "}
                      <strong>
                        {points}
                      </strong>
                    </div>

                    <div className="text-lg">

                      Result:{" "}

                      <strong>
                        {result > 0
                          ? "+"
                          : ""}
                        {result}
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