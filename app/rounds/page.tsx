"use client";

import { getGolfCourse } from "../../lib/courses";
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

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    const savedRounds =
      localStorage.getItem("rounds");

    const savedPlayers =
      localStorage.getItem("players");

    const savedScorecards =
      localStorage.getItem("scorecards");

    if (savedRounds) {
      try {
        setRounds(JSON.parse(savedRounds));
      } catch (error) {
        console.error(
          "Could not load rounds:",
          error
        );
      }
    }

    if (savedPlayers) {
      try {
        setPlayers(JSON.parse(savedPlayers));
      } catch (error) {
        console.error(
          "Could not load players:",
          error
        );
      }
    }

    if (savedScorecards) {
      try {
        setScorecards(
          JSON.parse(savedScorecards)
        );
      } catch (error) {
        console.error(
          "Could not load scorecards:",
          error
        );
      }
    }

    setLoading(false);
  }

  function getParsForRound(round: Round) {
    // New rounds already have their pars saved.
    if (
      round.pars &&
      round.pars.length > 0
    ) {
      return round.pars;
    }

    // Fallback for older rounds.
    if (
      round.course ===
      "KickingBird Golf Club"
    ) {
      const course =
        getGolfCourse(round.course);

      return (
        course?.pars.slice(
          0,
          round.holes
        ) || []
      );
    }

    if (
      round.course ===
      "The Golf Club of Edmond"
    ) {
      const course =
        getGolfCourse(
          "golf-club-edmond"
        );

      return (
        course?.pars.slice(
          0,
          round.holes
        ) || []
      );
    }

    return Array(
      round.holes
    ).fill(4);
  }

  function getPlayerPoints(
    playerId: number,
    round: Round
  ) {
    const scorecard =
      scorecards.find(
        (card) =>
          card.roundId ===
          round.id
      );

    if (!scorecard) return 0;

    const coursePars =
      getParsForRound(round);

    let points = 0;

    for (
      let hole = 1;
      hole <= round.holes;
      hole++
    ) {
      const key =
        `${playerId}-${hole}`;

      const score =
        scorecard.scores[key];

      const par =
        coursePars[hole - 1] ||
        scorecard.pars[hole] ||
        4;

      if (
        score === "" ||
        score === undefined
      ) {
        continue;
      }

      const difference =
        Number(score) - par;

      if (difference >= 2) {
        points += 0;
      } else if (
        difference === 1
      ) {
        points += 1;
      } else if (
        difference === 0
      ) {
        points += 2;
      } else if (
        difference === -1
      ) {
        points += 3;
      } else {
        points += 4;
      }
    }

    return points;
  }

  function deleteRound(
    roundId: number
  ) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this round?"
      );

    if (!confirmed) return;

    const updatedRounds =
      rounds.filter(
        (round) =>
          round.id !== roundId
      );

    const updatedScorecards =
      scorecards.filter(
        (card) =>
          card.roundId !== roundId
      );

    setRounds(updatedRounds);
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
        <p>Loading rounds...</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">

      {/* Header */}

      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-3xl font-bold">
            Golf Rounds
          </h1>

          <p className="text-gray-600 mt-1">
            View and manage your rounds
          </p>
        </div>

        <Link
          href="/rounds/new"
          className="bg-green-600 text-white px-5 py-3 rounded font-semibold"
        >
          + New Round
        </Link>

      </div>

      {/* Navigation */}

      <div className="flex gap-3 mb-8">

        <Link
          href="/"
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Home
        </Link>

        <Link
          href="/players"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Players
        </Link>

        <Link
          href="/settings/quota"
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Quota Settings
        </Link>

      </div>

      {/* No rounds */}

      {rounds.length === 0 && (
        <div className="border rounded p-8 text-center">

          <h2 className="text-xl font-bold mb-2">
            No rounds yet
          </h2>

          <p className="text-gray-600 mb-5">
            Create your first golf round.
          </p>

          <Link
            href="/rounds/new"
            className="bg-green-600 text-white px-5 py-3 rounded"
          >
            Create Round
          </Link>

        </div>
      )}

      {/* Rounds */}

      <div className="space-y-6">

        {rounds
          .slice()
          .reverse()
          .map((round) => {

            const roundPlayers =
              players.filter(
                (player) =>
                  round.playerIds.includes(
                    player.id
                  )
              );

            return (
              <div
                key={round.id}
                className="border rounded-lg p-6"
              >

                {/* Round Header */}

                <div className="flex justify-between items-start">

                  <div>

                    <h2 className="text-2xl font-bold">
                      {round.name}
                    </h2>

                    <p className="text-gray-600 mt-1">
                      {round.course}
                      {" • "}
                      White Tees
                      {" • "}
                      {round.holes} holes
                    </p>

                  </div>

                  <Link
                    href={`/rounds/${round.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    Open Round
                  </Link>

                </div>

                {/* Leaderboard */}

                <div className="mt-6">

                  <h3 className="font-bold mb-3">
                    Leaderboard
                  </h3>

                  <div className="space-y-2">

                    {roundPlayers
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
                      )
                      .map(
                        (
                          entry,
                          index
                        ) => (

                          <div
                            key={
                              entry.player.id
                            }
                            className="flex items-center justify-between border rounded p-3"
                          >

                            <div className="flex items-center gap-3">

                              <div className="font-bold w-6">
                                {index + 1}
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
                                  : ""
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

                {/* Actions */}

                <div className="mt-5 flex gap-3">

                  <Link
                    href={`/rounds/${round.id}`}
                    className="bg-gray-800 text-white px-4 py-2 rounded"
                  >
                    Scorecard
                  </Link>

                  <button
                    onClick={() =>
                      deleteRound(
                        round.id
                      )
                    }
                    className="bg-red-600 text-white px-4 py-2 rounded"
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
