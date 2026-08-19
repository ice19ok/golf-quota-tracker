"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  pars: number[];
};

const COURSES: Record<string, number[]> = {
  "KickingBird Golf Club": [
    4, 4, 3, 5, 4, 3, 4, 4, 4,
    4, 3, 5, 4, 3, 5, 3, 4, 4,
  ],

  "The Golf Club of Edmond": [
    4, 5, 3, 4, 4, 4, 3, 4, 5,
    3, 4, 4, 4, 3, 5, 4, 3, 5,
  ],
};

const COURSE_NAMES = Object.keys(COURSES);

export default function NewRoundPage() {
  const router = useRouter();
  const supabase = createClient();

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [selectedPlayers, setSelectedPlayers] =
    useState<string[]>([]);

  const [roundName, setRoundName] =
    useState("");

  const [course, setCourse] =
    useState("KickingBird Golf Club");

  const [holes, setHoles] =
    useState("18");

  const [loadingPlayers, setLoadingPlayers] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * LOAD PLAYERS FROM SUPABASE
   */
  useEffect(() => {
    async function loadPlayers() {
      setLoadingPlayers(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("players")
        .select("id, name, quota")
        .order("name");

      if (error) {
        console.error(
          "Could not load players:",
          error
        );

        setError(error.message);
        setPlayers([]);
        setLoadingPlayers(false);
        return;
      }

      setPlayers(data || []);
      setLoadingPlayers(false);
    }

    loadPlayers();
  }, []);

  /*
   * SELECT / DESELECT PLAYER
   */
  function togglePlayer(
    playerId: string
  ) {
    setSelectedPlayers(
      (current) => {
        if (
          current.includes(
            playerId
          )
        ) {
          return current.filter(
            (id) =>
              id !== playerId
          );
        }

        return [
          ...current,
          playerId,
        ];
      }
    );
  }

  /*
   * SELECT ALL
   */
  function selectAllPlayers() {
    setSelectedPlayers(
      players.map(
        (player) => player.id
      )
    );
  }

  /*
   * CLEAR ALL
   */
  function clearAllPlayers() {
    setSelectedPlayers([]);
  }

  /*
   * CREATE ROUND
   */
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

    const coursePars =
      COURSES[course];

    if (!coursePars) {
      alert(
        "Could not find the par information for this course."
      );
      return;
    }

    const numberOfHoles =
      Number(holes);

    const selectedPars =
      coursePars.slice(
        0,
        numberOfHoles
      );

    const newRound: Round = {
      id: Date.now(),

      name:
        roundName.trim(),

      course,

      holes:
        numberOfHoles,

      playerIds:
        selectedPlayers,

      pars:
        selectedPars,
    };

    /*
     * LOAD EXISTING ROUNDS
     */
    let rounds: Round[] = [];

    try {
      const savedRounds =
        localStorage.getItem(
          "rounds"
        );

      if (savedRounds) {
        const parsed =
          JSON.parse(
            savedRounds
          );

        if (
          Array.isArray(parsed)
        ) {
          rounds =
            parsed;
        }
      }
    } catch (error) {
      console.error(
        "Could not load rounds:",
        error
      );
    }

    /*
     * SAVE ROUND
     */
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
     * Remove any old scorecard
     * with this round ID.
     */
    try {
      const savedScorecards =
        localStorage.getItem(
          "scorecards"
        );

      if (savedScorecards) {
        const scorecards =
          JSON.parse(
            savedScorecards
          );

        if (
          Array.isArray(
            scorecards
          )
        ) {
          const cleaned =
            scorecards.filter(
              (card: any) =>
                String(
                  card.roundId
                ) !==
                String(
                  newRound.id
                )
            );

          localStorage.setItem(
            "scorecards",
            JSON.stringify(
              cleaned
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Could not clean scorecards:",
        error
      );
    }

    /*
     * GO DIRECTLY TO SCORECARD
     */
    router.push(
      `/rounds/${newRound.id}`
    );
  }

  /*
   * COURSE PAR PREVIEW
   */
  const selectedCoursePars =
    COURSES[course] || [];

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

  /*
   * LOADING
   */
  if (loadingPlayers) {
    return (
      <main className="mx-auto max-w-4xl p-8">

        <h1 className="text-3xl font-bold">
          Create New Round
        </h1>

        <p className="mt-4 text-gray-600">
          Loading players...
        </p>

      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">

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

      </div>

      {/* TITLE */}

      <h1 className="text-3xl font-bold">
        Create New Round
      </h1>

      <p className="mt-2 text-gray-600">
        Set up your round and select
        the players.
      </p>

      {/* ERROR */}

      {error && (
        <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-6">

        {/* ROUND NAME */}

        <div>

          <label className="mb-2 block font-semibold">
            Round Name
          </label>

          <input
            className="w-full rounded border p-3"
            placeholder="Saturday Quota Game"
            value={roundName}
            onChange={(e) =>
              setRoundName(
                e.target.value
              )
            }
          />

        </div>

        {/* COURSE */}

        <div>

          <label className="mb-2 block font-semibold">
            Course
          </label>

          <select
            className="w-full rounded border p-3"
            value={course}
            onChange={(e) =>
              setCourse(
                e.target.value
              )
            }
          >

            {COURSE_NAMES.map(
              (courseName) => (
                <option
                  key={
                    courseName
                  }
                  value={
                    courseName
                  }
                >
                  {courseName}
                </option>
              )
            )}

          </select>

        </div>

        {/* TEES */}

        <div>

          <label className="mb-2 block font-semibold">
            Tees
          </label>

          <div className="rounded border bg-gray-50 p-3">
            White Tees
          </div>

        </div>

        {/* HOLES */}

        <div>

          <label className="mb-2 block font-semibold">
            Holes
          </label>

          <select
            className="w-full rounded border p-3"
            value={holes}
            onChange={(e) =>
              setHoles(
                e.target.value
              )
            }
          >

            <option value="9">
              9 Holes
            </option>

            <option value="18">
              18 Holes
            </option>

          </select>

        </div>

        {/* COURSE PAR */}

        <div className="rounded-lg border bg-white p-5">

          <div className="mb-4 flex items-center justify-between">

            <h2 className="text-lg font-bold">
              White Tee Course Par
            </h2>

            <div className="text-xl font-bold">
              Par {totalPar}
            </div>

          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-9">

            {selectedHoles.map(
              (par, index) => (

                <div
                  key={index}
                  className="rounded border bg-gray-50 p-2 text-center"
                >

                  <div className="text-xs text-gray-500">
                    Hole{" "}
                    {index + 1}
                  </div>

                  <div className="text-xl font-bold">
                    {par}
                  </div>

                </div>

              )
            )}

          </div>

        </div>

        {/* PLAYERS */}

        <div>

          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold">
                Select Players
              </h2>

              <p className="text-sm text-gray-500">
                Check the players who
                are playing this round.
              </p>

            </div>

            {players.length > 0 && (

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={
                    selectAllPlayers
                  }
                  className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={
                    clearAllPlayers
                  }
                  className="rounded bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600"
                >
                  Clear All
                </button>

              </div>

            )}

          </div>

          {/* NO PLAYERS */}

          {players.length ===
          0 ? (

            <div className="rounded border bg-white p-5">

              <p className="mb-4 text-gray-600">
                No players have been
                added yet.
              </p>

              <Link
                href="/players"
                className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
              >
                Add Players
              </Link>

            </div>

          ) : (

            <div className="space-y-2">

              {players.map(
                (player) => {

                  const isSelected =
                    selectedPlayers.includes(
                      player.id
                    );

                  return (

                    <label
                      key={
                        player.id
                      }
                      className={`flex cursor-pointer items-center gap-3 rounded border p-4 transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                    >

                      <input
                        type="checkbox"
                        checked={
                          isSelected
                        }
                        onChange={() =>
                          togglePlayer(
                            player.id
                          )
                        }
                        className="h-5 w-5"
                      />

                      <div className="flex-1">

                        <div className="text-lg font-semibold">
                          {
                            player.name
                          }
                        </div>

                        <div className="text-sm text-gray-500">
                          Quota:{" "}
                          {
                            player.quota
                          }
                        </div>

                      </div>

                      {isSelected && (

                        <div className="font-semibold text-blue-600">
                          Selected
                        </div>

                      )}

                    </label>

                  );
                }
              )}

            </div>

          )}

        </div>

        {/* SELECTED COUNT */}

        {players.length > 0 && (

          <div className="rounded bg-gray-100 p-4">

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

        {/* START ROUND */}

        <button
          type="button"
          onClick={
            createRound
          }
          disabled={
            saving ||
            players.length ===
              0 ||
            selectedPlayers.length ===
              0
          }
          className="w-full rounded bg-green-600 px-6 py-4 text-lg font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {saving
            ? "Starting Round..."
            : "Start Round"}
        </button>

      </div>

    </main>
  );
}