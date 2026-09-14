"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = {
  id: string;
  name: string;
  quota: number;
};

type GameMode = "quota" | "wolf";

type Guest = {
  tempId: string;
  name: string;
  quota: string;
};

const COURSES: Record<string, number[]> = {
  "KickingBird Golf Club": [
    4,4,3,5,4,3,4,4,4,
    4,3,5,4,3,5,3,4,4,
  ],
  "The Golf Club of Edmond": [
    4,5,3,4,4,4,3,4,5,
    3,4,4,4,3,5,4,3,5,
  ],
};

export default function NewRoundPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [participantOrder, setParticipantOrder] = useState<string[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);

  const [guestName, setGuestName] = useState("");
  const [guestQuota, setGuestQuota] = useState("0");

  const [gameMode, setGameMode] = useState<GameMode>("quota");
  const [roundName, setRoundName] = useState("");
  const [course, setCourse] = useState("KickingBird Golf Club");
  const [holes, setHoles] = useState("18");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [availableRollover, setAvailableRollover] = useState(0);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        { data: profile, error: profileError },
        { data: playerData, error: playerError },
        { data: rolloverData, error: rolloverError },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single(),

        supabase
          .from("players")
          .select("id,name,quota")
          .eq("is_guest", false)
          .order("name"),

        supabase
          .from("rounds")
          .select("id,rollover_out")
          .eq("game_mode", "quota")
          .eq("is_complete", true)
          .eq("rollover_consumed", false)
          .gt("rollover_out", 0)
          .order("completed_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (profileError) setError(profileError.message);
      if (playerError) setError(playerError.message);
      if (rolloverError) setError(rolloverError.message);

      setAvailableRollover(
        Number(rolloverData?.rollover_out || 0)
      );

      setIsAdmin(profile?.role === "admin");

      setPlayers(
        (playerData || []).map((player) => ({
          id: String(player.id),
          name: String(player.name),
          quota: Number(player.quota),
        }))
      );

      setLoading(false);
    }

    load();
  }, [router, supabase]);

  const guestToken = (tempId: string) => `guest:${tempId}`;
  const playerToken = (id: string) => `player:${id}`;

  function totalParticipants() {
    return selectedPlayers.length + guests.length;
  }

  function togglePlayer(id: string) {
    setError("");

    const selected = selectedPlayers.includes(id);

    if (!selected && gameMode === "wolf" && totalParticipants() >= 5) {
      setError("Wolf supports a maximum of 5 players.");
      return;
    }

    setSelectedPlayers((current) =>
      selected
        ? current.filter((playerId) => playerId !== id)
        : [...current, id]
    );

    setParticipantOrder((current) => {
      const token = playerToken(id);

      if (selected) {
        return current.filter((item) => item !== token);
      }

      return [...current, token];
    });
  }

  function addGuest() {
    setError("");

    const cleanName = guestName.trim();

    if (!cleanName) {
      setError("Enter the guest player's name.");
      return;
    }

    if (gameMode === "wolf" && totalParticipants() >= 5) {
      setError("Wolf supports a maximum of 5 players.");
      return;
    }

    if (gameMode === "quota") {
      const numericQuota = Number(guestQuota);

      if (!Number.isFinite(numericQuota) || numericQuota < 0) {
        setError("Enter a valid quota for the guest.");
        return;
      }
    }

    const tempId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const guest: Guest = {
      tempId,
      name: cleanName,
      quota: gameMode === "quota" ? guestQuota : "0",
    };

    setGuests((current) => [...current, guest]);
    setParticipantOrder((current) => [
      ...current,
      guestToken(tempId),
    ]);

    setGuestName("");
    setGuestQuota("0");
  }

  function removeGuest(tempId: string) {
    setGuests((current) =>
      current.filter((guest) => guest.tempId !== tempId)
    );

    setParticipantOrder((current) =>
      current.filter((item) => item !== guestToken(tempId))
    );
  }

  function moveParticipant(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= participantOrder.length
    ) {
      return;
    }

    setParticipantOrder((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function participantName(token: string) {
    if (token.startsWith("player:")) {
      const id = token.replace("player:", "");
      return players.find((player) => player.id === id)?.name || "Player";
    }

    const tempId = token.replace("guest:", "");
    return (
      guests.find((guest) => guest.tempId === tempId)?.name ||
      "Guest"
    );
  }

  async function createRound() {
    setError("");

    if (!isAdmin) {
      setError("Only an administrator can create a round.");
      return;
    }

    if (!roundName.trim()) {
      setError("Please enter a round name.");
      return;
    }

    const participantCount = totalParticipants();

    if (gameMode === "wolf") {
      if (participantCount < 3 || participantCount > 5) {
        setError("Wolf requires 3 to 5 players.");
        return;
      }
    } else if (participantCount < 1) {
      setError("Please select at least one player.");
      return;
    }

    setCreating(true);

    let rolloverSourceId: string | null = null;

    try {
      let claimedRollover = 0;

      /*
       * Quota rollover belongs only to Quota rounds.
       * Wolf never consumes or changes the Quota rollover pot.
       */
      if (gameMode === "quota") {
        const {
          data: rolloverSource,
          error: rolloverLookupError,
        } = await supabase
          .from("rounds")
          .select("id,rollover_out")
          .eq("game_mode", "quota")
          .eq("is_complete", true)
          .eq("rollover_consumed", false)
          .gt("rollover_out", 0)
          .order("completed_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (rolloverLookupError) {
          throw rolloverLookupError;
        }

        if (rolloverSource) {
          const {
            data: claimedSource,
            error: claimError,
          } = await supabase
            .from("rounds")
            .update({ rollover_consumed: true })
            .eq("id", rolloverSource.id)
            .eq("rollover_consumed", false)
            .select("id,rollover_out")
            .maybeSingle();

          if (claimError) {
            throw claimError;
          }

          if (claimedSource) {
            rolloverSourceId = String(claimedSource.id);
            claimedRollover = Number(
              claimedSource.rollover_out || 0
            );
          }
        }
      }

      const {
        data: newRound,
        error: roundError,
      } = await supabase
        .from("rounds")
        .insert({
          name: roundName.trim(),
          course,
          holes: Number(holes),
          pars: (COURSES[course] || []).slice(
            0,
            Number(holes)
          ),
          game_mode: gameMode,
          rollover_in:
            gameMode === "quota" ? claimedRollover : 0,
          rollover_out: 0,
        })
        .select("id")
        .single();

      if (roundError) {
        throw roundError;
      }

      const guestIdByTempId = new Map<string, string>();

      if (guests.length > 0) {
        const {
          data: createdGuests,
          error: guestError,
        } = await supabase
          .from("players")
          .insert(
            guests.map((guest) => ({
              name: guest.name,
              quota:
                gameMode === "quota"
                  ? Number(guest.quota)
                  : 0,
              is_guest: true,
              guest_round_id: newRound.id,
            }))
          )
          .select("id,name");

        if (guestError) {
          throw guestError;
        }

        /*
         * Supabase returns inserted rows in insert order.
         */
        (createdGuests || []).forEach((row, index) => {
          const guest = guests[index];

          if (guest) {
            guestIdByTempId.set(
              guest.tempId,
              String(row.id)
            );
          }
        });
      }

      const orderedPlayerIds = participantOrder
        .map((token) => {
          if (token.startsWith("player:")) {
            return token.replace("player:", "");
          }

          return guestIdByTempId.get(
            token.replace("guest:", "")
          );
        })
        .filter((id): id is string => Boolean(id));

      const { error: rpError } = await supabase
        .from("round_players")
        .insert(
          orderedPlayerIds.map((playerId, index) => ({
            round_id: newRound.id,
            player_id: playerId,
            play_order: index + 1,
          }))
        );

      if (rpError) {
        throw rpError;
      }

      router.push(
        gameMode === "wolf"
          ? `/rounds/${newRound.id}/wolf`
          : `/rounds/${newRound.id}`
      );
    } catch (error: any) {
      console.error("Could not create round:", error);

      if (rolloverSourceId) {
        await supabase
          .from("rounds")
          .update({ rollover_consumed: false })
          .eq("id", rolloverSourceId);
      }

      setError(
        error?.message ||
          error?.details ||
          error?.hint ||
          "Could not create the round."
      );

      setCreating(false);
    }
  }

  const pars = COURSES[course].slice(0, Number(holes));
  const totalPar = pars.reduce((a, b) => a + b, 0);

  if (loading) {
    return <main className="p-8">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded bg-gray-500 px-4 py-2 text-white"
          >
            ← Home
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

        <h1 className="text-3xl font-bold">
          Create New Round
        </h1>

        {!isAdmin && (
          <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
            Only an administrator can create rounds.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-6">
          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-bold">
              1. Choose Game Mode
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setGameMode("quota")}
                className={`rounded-lg border p-5 text-left ${
                  gameMode === "quota"
                    ? "border-blue-600 bg-blue-50"
                    : "bg-white"
                }`}
              >
                <div className="text-xl font-bold">
                  Quota
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Existing quota scoring, leaderboard, payouts,
                  quota updates, and quota history.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGameMode("wolf");

                  /*
                   * Wolf max is 5. If switching from Quota with
                   * more selected, keep the first five in order.
                   */
                  const allowed = participantOrder.slice(0, 5);
                  const allowedPermanent = allowed
                    .filter((item) =>
                      item.startsWith("player:")
                    )
                    .map((item) =>
                      item.replace("player:", "")
                    );
                  const allowedGuestIds = new Set(
                    allowed
                      .filter((item) =>
                        item.startsWith("guest:")
                      )
                      .map((item) =>
                        item.replace("guest:", "")
                      )
                  );

                  setParticipantOrder(allowed);
                  setSelectedPlayers(allowedPermanent);
                  setGuests((current) =>
                    current.filter((guest) =>
                      allowedGuestIds.has(guest.tempId)
                    )
                  );
                }}
                className={`rounded-lg border p-5 text-left ${
                  gameMode === "wolf"
                    ? "border-green-600 bg-green-50"
                    : "bg-white"
                }`}
              >
                <div className="text-xl font-bold">
                  Wolf
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  3–5 players. Completely separate from Quota.
                  $1 = 1 Wolf point.
                </div>
              </button>
            </div>

            {gameMode === "quota" &&
              availableRollover > 0 && (
                <div className="mt-4 rounded border border-green-300 bg-green-50 p-4 font-semibold text-green-800">
                  Quota rollover available: $
                  {availableRollover.toFixed(2)}
                </div>
              )}

            {gameMode === "wolf" && (
              <div className="mt-4 rounded border bg-gray-50 p-4 text-sm">
                Wolf rotates in the player order below. Choose a
                partner or go Lone Wolf on each hole. Point
                transfers are zero-sum, and every point is worth
                $1.
              </div>
            )}
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <label className="mb-2 block font-semibold">
              Round Name
            </label>

            <input
              className="w-full rounded border px-3 py-2"
              placeholder={
                gameMode === "wolf"
                  ? "Saturday Wolf Game"
                  : "Saturday Quota Game"
              }
              value={roundName}
              onChange={(event) =>
                setRoundName(event.target.value)
              }
            />
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-xl font-bold">
              2. Course Settings
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-semibold">
                  Course
                </label>

                <select
                  className="w-full rounded border px-3 py-2"
                  value={course}
                  onChange={(event) =>
                    setCourse(event.target.value)
                  }
                >
                  {Object.keys(COURSES).map((courseName) => (
                    <option key={courseName}>
                      {courseName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold">
                  Holes
                </label>

                <select
                  className="w-full rounded border px-3 py-2"
                  value={holes}
                  onChange={(event) =>
                    setHoles(event.target.value)
                  }
                >
                  <option value="9">9 Holes</option>
                  <option value="18">18 Holes</option>
                </select>
              </div>
            </div>

            <div className="mt-4 rounded border bg-gray-50 p-3">
              White Tees • Par {totalPar}
            </div>
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  3. Add Players
                </h2>

                <p className="text-sm text-gray-500">
                  {gameMode === "wolf"
                    ? "Choose 3–5 total players."
                    : "Choose everyone playing this round."}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {players.map((player) => (
                <label
                  key={player.id}
                  className="flex cursor-pointer items-center gap-4 rounded border p-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayers.includes(
                      player.id
                    )}
                    onChange={() =>
                      togglePlayer(player.id)
                    }
                    className="h-5 w-5"
                  />

                  <div>
                    <div className="font-semibold">
                      {player.name}
                    </div>

                    {gameMode === "quota" && (
                      <div className="text-sm text-gray-500">
                        Quota: {player.quota.toFixed(2)}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 rounded border bg-gray-50 p-4">
              <div className="font-semibold">
                + Guest Player
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Guest players are attached only to this round and
                will not appear in your permanent Players list.
              </p>

              <div
                className={`mt-4 grid gap-3 ${
                  gameMode === "quota"
                    ? "md:grid-cols-[1fr_140px_auto]"
                    : "md:grid-cols-[1fr_auto]"
                }`}
              >
                <input
                  className="rounded border px-3 py-2"
                  placeholder="Guest name"
                  value={guestName}
                  onChange={(event) =>
                    setGuestName(event.target.value)
                  }
                />

                {gameMode === "quota" && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded border px-3 py-2"
                    placeholder="Quota"
                    value={guestQuota}
                    onChange={(event) =>
                      setGuestQuota(event.target.value)
                    }
                  />
                )}

                <button
                  type="button"
                  onClick={addGuest}
                  className="rounded bg-purple-600 px-4 py-2 font-semibold text-white"
                >
                  Add Guest
                </button>
              </div>

              {guests.length > 0 && (
                <div className="mt-4 space-y-2">
                  {guests.map((guest) => (
                    <div
                      key={guest.tempId}
                      className="flex items-center justify-between rounded border bg-white p-3"
                    >
                      <div>
                        <span className="font-semibold">
                          {guest.name}
                        </span>{" "}
                        <span className="text-xs text-gray-500">
                          Guest
                        </span>

                        {gameMode === "quota" && (
                          <span className="ml-2 text-sm text-gray-500">
                            Quota {Number(guest.quota).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeGuest(guest.tempId)
                        }
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {participantOrder.length > 0 && (
            <section className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-xl font-bold">
                {gameMode === "wolf"
                  ? "4. Wolf Rotation Order"
                  : "Round Player Order"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {gameMode === "wolf"
                  ? "The Wolf rotates through this order every hole."
                  : "This order is saved with the round."}
              </p>

              <div className="mt-4 space-y-2">
                {participantOrder.map((token, index) => (
                  <div
                    key={token}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <div className="font-semibold">
                      {index + 1}. {participantName(token)}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() =>
                          moveParticipant(index, -1)
                        }
                        className="rounded bg-gray-200 px-3 py-1 disabled:opacity-40"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        disabled={
                          index ===
                          participantOrder.length - 1
                        }
                        onClick={() =>
                          moveParticipant(index, 1)
                        }
                        className="rounded bg-gray-200 px-3 py-1 disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={createRound}
            disabled={
              !isAdmin ||
              creating ||
              (gameMode === "wolf"
                ? totalParticipants() < 3 ||
                  totalParticipants() > 5
                : totalParticipants() < 1)
            }
            className="w-full rounded bg-green-600 px-6 py-4 text-lg font-semibold text-white disabled:bg-gray-400"
          >
            {creating
              ? "Starting Round..."
              : `Start ${
                  gameMode === "wolf" ? "Wolf" : "Quota"
                } Round`}
          </button>
        </div>
      </div>
    </main>
  );
}
