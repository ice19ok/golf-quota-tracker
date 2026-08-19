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
    3, 4, 4, 4, 3, 4, 4, 3, 5,
  ],
};

const COURSE_NAMES = Object.keys(COURSES);

export default function NewRoundPage() {
  const router = useRouter();
  const supabase = createClient();

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] =
    useState<string[]>([]);

  const [roundName, setRoundName] = useState("");
  const [course, setCourse] =
    useState("KickingBird Golf Club");
  const [holes, setHoles] = useState("18");

  const [loadingPlayers, setLoadingPlayers] =
    useState(true);

  const [creatingRound, setCreatingRound] =
    useState(false);

  const [error, setError] = useState("");

  /*
   * LOAD PLAYERS FROM SUPABASE
   */
  useEffect(() => {
    loadPlayers();
  }, []);

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

    const { data, error } = await supabase
      .from("players")
      .select("id, name, quota")
      .order("name");

    if (error) {
      console.error("Could not load players:", error);
      setError(error.message);
      setLoadingPlayers(false);
      return;
    }

    setPlayers(data || []);
    setLoadingPlayers(false);
  }

  /*
   * SELECT / DESELECT PLAYER
   */
  function togglePlayer(playerId: string) {
    setSelectedPlayers((currentPlayers) => {
      if (currentPlayers.includes(playerId)) {
        return currentPlayers.filter(
          (id) => id !== playerId
        );
      }

      return [...currentPlayers, playerId];
    });
  }

  /*
   * SELECT ALL
   */
  function selectAllPlayers() {
    setSelectedPlayers(
      players.map((player) => player.id)
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
  async function createRound() {
    setError("");

    if (!roundName.trim()) {
      setError("Please enter a round name.");
      return;
    }

    if (selectedPlayers.length === 0) {
      setError("Please select at least one player.");
      return;
    }

    const numberOfHoles = Number(holes);

    const coursePars = COURSES[course];

    if (!coursePars) {
      setError(
        "Could not find the par information for this course."
      );
      return;
    }

    const selectedPars = coursePars.slice(
      0,
      numberOfHoles
    );

    setCreatingRound(true);

    /*
     * For now, save the round in localStorage
     * using the selected Supabase player IDs.
     *
     * This keeps compatibility with your
     * existing round/scorecard pages.
     */

    const newRound: Round = {
      id: Date.now(),
      name: roundName.trim(),
      course,
      holes: numberOfHoles,
      playerIds: selectedPlayers,
      pars: selectedPars,
    };

    let rounds: Round[] = [];

    try {
      const savedRounds =
        localStorage.getItem("rounds");

      if (savedRounds) {
        const parsedRounds =
          JSON.parse(savedRounds);

        if (Array.isArray(parsedRounds)) {
          rounds = parsedRounds;
        }
      }
    } catch (error) {
      console.error(
        "Could not load existing rounds:",
        error
      );
    }

    rounds.push(newRound);

    localStorage.setItem(
      "rounds",
      JSON.stringify(rounds)
    );

    /*
     * Remove any old scorecard associated
     * with this round ID.
     */
    try {
      const savedScorecards =
        localStorage.getItem("scorecards");

      if (savedScorecards) {
        const scorecards =
          JSON.parse(savedScorecards);

        if (Array.isArray(scorecards)) {
          const cleaned =
            scorecards.filter(
              (card: any) =>
                card.roundId !== newRound.id
            );

          localStorage.setItem(
            "scorecards",
            JSON.stringify(cleaned)
          );
        }
      }
    } catch (error) {
      console.error(
        "Could not clean scorecards:",
        error
      );
    }

    router.push(
      `/rounds/${newRound.id}`
    );
  }

  /*
   * CURRENT COURSE PARS
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
      (total, par) => total + par,
      0
    );

  return (
    <main className="min-h-screen bg-gray-100 p-6">

      <div className="mx-auto max-w-4xl">

        {/* NAVIGATION */}

        <div className="mb-6 flex flex-wrap gap-3">

          <Link
            href="/"
            className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
          >
            ← Home
          </Link>

          <Link
            href="/rounds"
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Rounds
          </Link>

          <Link
            href="/players"
            className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
          >
            Players
          </Link>

        </div>

        {/* TITLE */}

        <h1 className="text-3xl font-bold">
          Create New Round
        </h1>

        <p className="mt-2 text-gray-600">
          Set up the course and select the
          players for this round.
        </p>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-6">

          {/* ROUND NAME */}

          <div className="rounded-lg bg-white p-6 shadow">

            <label className="mb-2 block font-semibold">
              Round Name
            </label>

            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Saturday Quota Game"
              value={roundName}
              onChange={(e) =>
                setRoundName(e.target.value)
              }
            />

          </div>

          {/* COURSE SETTINGS */}

          <div className="rounded-lg bg-white p-6 shadow">

            <h2 className="text-xl font-bold">
              Course Settings
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">

              {/* COURSE */}

              <div>

                <label className="mb-2 block font-semibold">
                  Course
                </label>

                <select
                  className="w-full rounded border px-3 py-2"
                  value={course}
                  onChange={(e) =>
                    setCourse(e.target.value)
                  }
                >

                  {COURSE_NAMES.map(
                    (courseName) => (
                      <option
                        key={courseName}
                        value={courseName}
                      >
                        {courseName}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* HOLES */}

              <div>

                <label className="mb-2 block font-semibold">
                  Holes
                </label>

                <select
                  className="w-full rounded border px-3 py-2"
                  value={holes}
                  onChange={(e) =>
                    setHoles(e.target.value)
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

            </div>

            {/* TEES */}

            <div className="mt-4">

              <label className="mb-2 block font-semibold">
                Tees
              </label>

              <div className="rounded border bg-gray-50 p-3">
                White Tees
              </div>

            </div>

          </div>

          {/* COURSE PAR */}

          <div className="rounded-lg bg-white p-6 shadow">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-bold">
                White Tee Course Par
              </h2>

              <div className="text-xl font-bold">
                Par {totalPar}
              </div>

            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-9">

              {selectedHoles.map(
                (par, index) => (

                  <div
                    key={index}
                    className="rounded border bg-gray-50 p-2 text-center"
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
              <strong>{totalPar}</strong>
            </div>

          </div>

          {/* PLAYERS */}

          <div className="rounded-lg bg-white p-6 shadow">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-xl font-bold">
                  Select Players
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Check the players who will play
                  in this round.
                </p>

              </div>

              {players.length > 0 && (

                <div className="flex gap-2">

                  <button
                    type="button"
                    onClick={selectAllPlayers}
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={clearAllPlayers}
                    className="rounded bg-gray-500 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-600"
                  >
                    Clear All
                  </button>

                </div>

              )}

            </div>

            {/* LOADING */}

            {loadingPlayers && (

              <div className="mt-6 rounded border bg-gray-50 p-5 text-gray-600">
                Loading players...
              </div>

            )}

            {/* NO PLAYERS */}

            {!loadingPlayers &&
              players.length === 0 && (

                <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-5">

                  <p className="font-semibold text-yellow-800">
                    No players found.
                  </p>

                  <p className="mt-1 text-sm text-yellow-700">
                    Go to the Players page and
                    add a player first.
                  </p>

                  <Link
                    href="/players"
                    className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Go to Players
                  </Link>

                </div>

              )}

            {/* PLAYER LIST */}

            {!loadingPlayers &&
              players.length > 0 && (

                <div className="mt-6 space-y-2">

                  {players.map((player) => {

                    const isSelected =
                      selectedPlayers.includes(
                        player.id
                      );

                    return (

                      <label
                        key={player.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >

                        {/* CHECKBOX */}

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            togglePlayer(
                              player.id
                            )
                          }
                          className="h-5 w-5 cursor-pointer"
                        />

                        {/* PLAYER INFO */}

                        <div className="flex-1">

                          <div className="text-lg font-semibold">
                            {player.name}
                          </div>

                          <div className="text-sm text-gray-500">
                            Quota:{" "}
                            {player.quota}
                          </div>

                        </div>

                        {/* SELECTED */}

                        {isSelected && (

                          <span className="font-semibold text-blue-600">
                            Selected
                          </span>

                        )}

                      </label>

                    );
                  })}

                </div>

              )}

            {/* SELECTED COUNT */}

            {!loadingPlayers &&
              players.length > 0 && (

                <div className="mt-4 rounded bg-gray-100 p-4">

                  <strong>
                    {selectedPlayers.length}
                  </strong>{" "}
                  player
                  {selectedPlayers.length !== 1
                    ? "s"
                    : ""}{" "}
                  selected

                </div>

              )}

          </div>

          {/* START ROUND */}

          <button
            type="button"
            onClick={createRound}
            disabled={
              loadingPlayers ||
              players.length === 0 ||
              selectedPlayers.length === 0 ||
              creatingRound
            }
            className="w-full rounded bg-green-600 px-6 py-4 text-lg font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {creatingRound
              ? "Starting Round..."
              : "Start Round"}
          </button>

        </div>

      </div>

    </main>
  );
}