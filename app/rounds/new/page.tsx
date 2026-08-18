"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  pars: number[];
};

const COURSES = {
  "KickingBird Golf Club": [
    4, 4, 3, 5, 4, 3, 4, 4, 5,
    4, 3, 5, 4, 3, 5, 3, 4, 4,
  ],

  "The Golf Club of Edmond": [
    4, 5, 3, 4, 4, 4, 3, 4, 5,
    3, 4, 4, 4, 3, 4, 4, 3, 5,
  ],
};

export default function NewRoundPage() {
  const router = useRouter();

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [selectedPlayers, setSelectedPlayers] =
    useState<number[]>([]);

  const [roundName, setRoundName] =
    useState("");

  const [course, setCourse] =
    useState(
      "KickingBird Golf Club"
    );

  const [holes, setHoles] =
    useState("18");

  useEffect(() => {
    const savedPlayers =
      localStorage.getItem(
        "players"
      );

    if (savedPlayers) {
      try {
        setPlayers(
          JSON.parse(
            savedPlayers
          )
        );
      } catch (error) {
        console.error(
          "Could not load players:",
          error
        );
      }
    }
  }, []);

  function togglePlayer(
    playerId: number
  ) {
    setSelectedPlayers(
      (currentPlayers) => {

        if (
          currentPlayers.includes(
            playerId
          )
        ) {
          return currentPlayers.filter(
            (id) =>
              id !== playerId
          );
        }

        return [
          ...currentPlayers,
          playerId,
        ];
      }
    );
  }

  function createRound() {

    if (!roundName.trim()) {
      alert(
        "Please enter a round name."
      );
      return;
    }

    if (
      selectedPlayers.length === 0
    ) {
      alert(
        "Please select at least one player."
      );
      return;
    }

    /*
     * Get the correct pars for the
     * selected course.
     */

    const coursePars =
      COURSES[
        course as keyof typeof COURSES
      ];

    /*
     * Only use the number of holes
     * selected.
     */

    const selectedPars =
      coursePars.slice(
        0,
        Number(holes)
      );

    const newRound: Round = {
      id: Date.now(),
      name: roundName.trim(),
      course,
      holes: Number(holes),
      playerIds:
        selectedPlayers,

      /*
       * THIS IS THE IMPORTANT PART.
       *
       * The round now permanently
       * stores the hole-by-hole pars.
       */

      pars: selectedPars,
    };

    const savedRounds =
      localStorage.getItem(
        "rounds"
      );

    let rounds: Round[] = [];

    if (savedRounds) {
      try {
        rounds =
          JSON.parse(
            savedRounds
          );
      } catch (error) {
        console.error(
          "Could not load rounds:",
          error
        );
      }
    }

    rounds.push(
      newRound
    );

    localStorage.setItem(
      "rounds",
      JSON.stringify(
        rounds
      )
    );

    /*
     * IMPORTANT:
     *
     * Remove any old scorecard
     * accidentally associated with
     * this round ID.
     *
     * Normally there won't be one,
     * but this keeps things clean.
     */

    const savedScorecards =
      localStorage.getItem(
        "scorecards"
      );

    if (savedScorecards) {
      try {

        const scorecards =
          JSON.parse(
            savedScorecards
          );

        const cleaned =
          scorecards.filter(
            (card: any) =>
              card.roundId !==
              newRound.id
          );

        localStorage.setItem(
          "scorecards",
          JSON.stringify(
            cleaned
          )
        );

      } catch (error) {
        console.error(
          "Could not clean scorecards:",
          error
        );
      }
    }

    router.push(
      `/rounds/${newRound.id}`
    );
  }

  /*
   * Display the pars for the
   * selected course.
   */

  const selectedCoursePars =
    COURSES[
      course as keyof typeof COURSES
    ];

  const selectedHoles =
    selectedCoursePars.slice(
      0,
      Number(holes)
    );

  const totalPar =
    selectedHoles.reduce(
      (total, par) =>
        total + par,
      0
    );

  return (
    <main className="p-8 max-w-4xl mx-auto">

      {/* Navigation */}

      <div className="flex gap-4 mb-6">

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

        <Link
          href="/players"
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Players
        </Link>

      </div>

      <h1 className="text-3xl font-bold">
        Create New Round
      </h1>

      <div className="mt-6 space-y-6">

        {/* Round Name */}

        <div>

          <label className="block font-semibold mb-2">
            Round Name
          </label>

          <input
            className="border p-2 rounded w-full"
            placeholder="Saturday Quota Game"
            value={roundName}
            onChange={(e) =>
              setRoundName(
                e.target.value
              )
            }
          />

        </div>

        {/* Course */}

        <div>

          <label className="block font-semibold mb-2">
            Course
          </label>

          <select
            className="border p-2 rounded w-full"
            value={course}
            onChange={(e) =>
              setCourse(
                e.target.value
              )
            }
          >

            <option>
              KickingBird Golf Club
            </option>

            <option>
              The Golf Club of Edmond
            </option>

          </select>

        </div>

        {/* Tee */}

        <div>

          <label className="block font-semibold mb-2">
            Tees
          </label>

          <div className="border rounded p-3 bg-gray-50">
            White Tees
          </div>

        </div>

        {/* Holes */}

        <div>

          <label className="block font-semibold mb-2">
            Holes
          </label>

          <select
            className="border p-2 rounded w-full"
            value={holes}
            onChange={(e) =>
              setHoles(
                e.target.value
              )
            }
          >

            <option value="9">
              9
            </option>

            <option value="18">
              18
            </option>

          </select>

        </div>

        {/* Course Preview */}

        <div className="border rounded-lg p-4">

          <h2 className="font-bold text-lg mb-3">
            White Tee Course Par
          </h2>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">

            {selectedHoles.map(
              (par, index) => (

                <div
                  key={index}
                  className="border rounded p-2 text-center"
                >

                  <div className="text-xs text-gray-500">
                    Hole {index + 1}
                  </div>

                  <div className="text-xl font-bold">
                    {par}
                  </div>

                </div>

              )
            )}

          </div>

          <div className="mt-4 text-lg">
            Course Par:{" "}
            <strong>
              {totalPar}
            </strong>
          </div>

        </div>

        {/* Players */}

        <div>

          <h2 className="text-xl font-bold mb-3">
            Select Players
          </h2>

          {players.length === 0 ? (

            <div className="border rounded p-4">

              <p className="text-gray-600 mb-3">
                No players have been
                added yet.
              </p>

              <Link
                href="/players"
                className="bg-blue-600 text-white px-4 py-2 rounded inline-block"
              >
                Add Players
              </Link>

            </div>

          ) : (

            <div className="space-y-2">

              {players.map(
                (player) => (

                  <label
                    key={player.id}
                    className="flex items-center gap-3 border rounded p-3 cursor-pointer hover:bg-gray-50"
                  >

                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(
                        player.id
                      )}
                      onChange={() =>
                        togglePlayer(
                          player.id
                        )
                      }
                      className="w-5 h-5"
                    />

                    <div>

                      <div className="font-semibold">
                        {player.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        Quota:{" "}
                        {player.quota}
                      </div>

                    </div>

                  </label>

                )
              )}

            </div>

          )}

        </div>

        {/* Selected Count */}

        {selectedPlayers.length >
          0 && (

          <div className="bg-gray-100 rounded p-4">

            <strong>
              {
                selectedPlayers.length
              }
            </strong>{" "}
            player
            {selectedPlayers.length !==
            1
              ? "s"
              : ""}{" "}
            selected

          </div>

        )}

        {/* Start Round */}

        <button
          onClick={createRound}
          disabled={
            players.length === 0
          }
          className="bg-green-600 text-white px-6 py-3 rounded font-semibold disabled:bg-gray-400"
        >
          Start Round
        </button>

      </div>

    </main>
  );
}
