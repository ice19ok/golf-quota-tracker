"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_QUOTA_POINTS, loadQuotaPoints, calculatePlayerQuotaPoints, type QuotaPoints } from "@/lib/quota";

type Player = { id: string; name: string; quota: number };
type Round = { id: string; name: string; course: string; holes: number; is_complete: boolean; completed_at?: string | null; rollover_in: number; rollover_out: number };
type ScoreRow = { id?: string; round_id: string; player_id: string; hole: number; score: number };

const COURSES: Record<string, number[]> = {
  "KickingBird Golf Club": [4,4,3,5,4,3,4,4,4, 4,3,5,4,3,5,3,4,4],
  "The Golf Club of Edmond": [4,5,3,4,4,4,3,4,5, 3,4,4,4,3,5,4,3,5],
};

export default function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = useMemo(() => createClient(), []);
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Record<string, number | "">>({});
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [finishingRound, setFinishingRound] = useState(false);
  const [error, setError] = useState("");
  const [quotaPoints, setQuotaPoints] = useState<QuotaPoints>(DEFAULT_QUOTA_POINTS);

  useEffect(()=>{
    async function load() {
      const { id } = await params;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href="/login"; return; }
      const profileRes = await supabase.from("profiles").select("role,player_id").eq("id", user.id).single();
      if (profileRes.error) { setError(profileRes.error.message); setLoading(false); return; }
      setIsAdmin(profileRes.data?.role === "admin");
      setCurrentPlayerId(profileRes.data?.player_id ? String(profileRes.data.player_id) : null);
      setQuotaPoints(loadQuotaPoints());
      const [roundRes, rpRes, playerRes, scoreRes] = await Promise.all([
        supabase.from("rounds").select("id,name,course,holes,is_complete,completed_at,rollover_in,rollover_out").eq("id", id).single(),
        supabase.from("round_players").select("player_id").eq("round_id", id),
        supabase.from("players").select("id,name,quota").order("name"),
        supabase.from("scores").select("id,round_id,player_id,hole,score").eq("round_id", id),
      ]);
      const firstError = roundRes.error || rpRes.error || playerRes.error || scoreRes.error;
      if (firstError) { setError(firstError.message); setLoading(false); return; }
      setRound({ ...roundRes.data, id:String(roundRes.data.id), holes:Number(roundRes.data.holes), is_complete:Boolean(roundRes.data.is_complete), rollover_in:Number(roundRes.data.rollover_in || 0), rollover_out:Number(roundRes.data.rollover_out || 0) });
      const ids = new Set((rpRes.data || []).map(x=>String(x.player_id)));
      setPlayers((playerRes.data || []).filter(p=>ids.has(String(p.id))).map(p=>({id:String(p.id),name:p.name,quota:Number(p.quota)})));
      const map: Record<string, number | ""> = {};
      for (const s of (scoreRes.data || []) as ScoreRow[]) map[`${s.player_id}-${s.hole}`] = Number(s.score);
      setScores(map);
      setLoading(false);
    }
    load();
  }, [params, supabase]);

  const parsArray = round ? (COURSES[round.course] || Array(18).fill(4)).slice(0, round.holes) : [];
  const pars = Object.fromEntries(parsArray.map((p,i)=>[i+1,p])) as Record<number,number>;
  const totalPar = parsArray.reduce((a,b)=>a+b,0);

  /*
   * SCORECARD PLAYER ORDER
   *
   * The player linked to the logged-in account
   * is shown first. Everyone else is alphabetical.
   */
  const scorecardPlayers = [...players].sort((a, b) => {
    if (currentPlayerId) {
      if (a.id === currentPlayerId && b.id !== currentPlayerId) return -1;
      if (b.id === currentPlayerId && a.id !== currentPlayerId) return 1;
    }

    return a.name.localeCompare(b.name);
  });

  function canEdit(playerId: string) { return !round?.is_complete && (isAdmin || currentPlayerId === playerId); }

  async function updateScore(playerId: string, hole: number, raw: string) {
    if (!round || !canEdit(playerId)) return;
    const key = `${playerId}-${hole}`;
    if (raw === "") {
      setScores(c=>({...c,[key]:""}));
      const { error } = await supabase.from("scores").delete().eq("round_id",round.id).eq("player_id",playerId).eq("hole",hole);
      if (error) setError(error.message); else setMessage("Saved");
      return;
    }
    const score = Number(raw); if (!Number.isInteger(score) || score < 1 || score > 15) return;
    setScores(c=>({...c,[key]:score})); setMessage("Saving...");
    const { error } = await supabase.from("scores").upsert({ round_id:round.id, player_id:playerId, hole, score }, { onConflict:"round_id,player_id,hole" });
    if (error) { setError(error.message); setMessage(""); } else { setMessage("Saved"); setTimeout(()=>setMessage(""),1200); }
  }

  function getPoints(playerId:string) { return round ? calculatePlayerQuotaPoints(scores,playerId,pars,round.holes,quotaPoints) : 0; }
  function getTotal(playerId:string) { if(!round)return 0; let t=0; for(let h=1;h<=round.holes;h++){const v=scores[`${playerId}-${h}`]; if(typeof v==="number")t+=v;} return t; }
  function getPlayingQuota(q: number) {
    return Math.round(q);
  }

  function newQuota(q: number, p: number) {
    const exact = (q + p) / 2;
    return Math.max(0, Math.round((exact + Number.EPSILON) * 100) / 100);
  }

  function formatQuota(q: number) {
    return q.toFixed(2);
  }

  const leaderboard = players
    .map((player) => {
      const points = getPoints(player.id);
      const playingQuota = getPlayingQuota(player.quota);
      const result = points - playingQuota;

      return {
        ...player,
        points,
        playingQuota,
        result,
        totalScore: getTotal(player.id),
        eligibleForPayout: result >= 0,
      };
    })
    .sort((a, b) => {
      /*
       * Players who hit or beat quota are always ranked ahead
       * of players who missed quota for payout purposes.
       */
      if (a.eligibleForPayout !== b.eligibleForPayout) {
        return a.eligibleForPayout ? -1 : 1;
      }

      if (b.result !== a.result) {
        return b.result - a.result;
      }

      if (b.points !== a.points) {
        return b.points - a.points;
      }

      if (a.totalScore !== b.totalScore) {
        return a.totalScore - b.totalScore;
      }

      return a.name.localeCompare(b.name);
    });

  const eligiblePlayers = leaderboard.filter(
    (player) => player.eligibleForPayout
  );

  const entryFee = 10;
  const newEntryMoney = players.length * entryFee;
  const rolloverIn = round?.rollover_in ?? 0;
  const totalPot = newEntryMoney + rolloverIn;

  function roundToNearestFive(amount: number) {
    return Math.round(amount / 5) * 5;
  }

  const eligibleCount = eligiblePlayers.length;

  let firstPlacePayout = 0;
  let secondPlacePayout = 0;
  let thirdPlacePayout = 0;
  let rolloverOut = 0;

  if (eligibleCount >= 3) {
    thirdPlacePayout = 10;
    const remainingAfterThird = Math.max(0, totalPot - thirdPlacePayout);
    firstPlacePayout = roundToNearestFive(remainingAfterThird * 0.7);
    secondPlacePayout =
      totalPot - thirdPlacePayout - firstPlacePayout;
  } else if (eligibleCount === 2) {
    firstPlacePayout = roundToNearestFive(totalPot * 0.7);
    secondPlacePayout = totalPot - firstPlacePayout;
  } else if (eligibleCount === 1) {
    firstPlacePayout = totalPot;
  } else {
    rolloverOut = totalPot;
  }

  /*
   * Keep payouts pending whenever a tie affects a paid position.
   * This avoids assigning prize money arbitrarily.
   */
  const hasPayoutTie =
    eligibleCount >= 2 &&
    (
      eligiblePlayers[0]?.result === eligiblePlayers[1]?.result ||
      (
        eligibleCount >= 3 &&
        eligiblePlayers[1]?.result === eligiblePlayers[2]?.result
      ) ||
      (
        eligibleCount > 3 &&
        eligiblePlayers[2]?.result === eligiblePlayers[3]?.result
      )
    );

  function getPayout(playerId: string) {
    if (hasPayoutTie || eligibleCount === 0) {
      return 0;
    }

    const eligibleIndex = eligiblePlayers.findIndex(
      (player) => player.id === playerId
    );

    if (eligibleIndex === 0) return firstPlacePayout;
    if (eligibleIndex === 1) return secondPlacePayout;
    if (eligibleIndex === 2) return thirdPlacePayout;

    return 0;
  }

  async function finishRound() {
    if (!isAdmin || !round || round.is_complete || finishingRound) {
      return;
    }

    if (
      !window.confirm(
        "Finish this round and update all player quotas? This can only be done once."
      )
    ) {
      return;
    }

    setFinishingRound(true);
    setError("");
    setMessage("Finishing round...");

    /*
     * FIRST CLAIM THE ROUND.
     *
     * This update only succeeds while is_complete is false.
     * It prevents a second click, refresh, or another admin
     * from running the quota update again.
     */
    const completedAt = new Date().toISOString();

    const {
      data: claimedRound,
      error: claimError,
    } = await supabase
      .from("rounds")
      .update({
        is_complete: true,
        completed_at: completedAt,
        rollover_out: rolloverOut,
      })
      .eq("id", round.id)
      .eq("is_complete", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      setError(claimError.message);
      setMessage("");
      setFinishingRound(false);
      return;
    }

    /*
     * If no row was returned, another completion already
     * claimed this round. Do NOT touch quotas again.
     */
    if (!claimedRound) {
      setRound((current) =>
        current ? { ...current, is_complete: true } : current
      );
      setMessage(
        "This round was already completed. Quotas were not updated again."
      );
      setFinishingRound(false);
      return;
    }

    const quotaUpdates = players.map((p) => ({
      id: p.id,
      oldQuota: p.quota,
      newQuota: newQuota(p.quota, getPoints(p.id)),
    }));

    for (const update of quotaUpdates) {
      const { error } = await supabase
        .from("players")
        .update({ quota: update.newQuota })
        .eq("id", update.id);

      if (error) {
        /*
         * Re-open the round if an update failed, but do not
         * automatically retry quotas. This makes the failure visible
         * instead of silently applying another adjustment.
         */
        await supabase
          .from("rounds")
          .update({
            is_complete: false,
            completed_at: null,
            rollover_out: 0,
          })
          .eq("id", round.id);

        setError(
          `Quota update failed: ${error.message}. The round was left open so it can be corrected safely.`
        );
        setMessage("");
        setFinishingRound(false);
        return;
      }
    }

    setPlayers((current) =>
      current.map((p) => {
        const update = quotaUpdates.find(
          (item) => item.id === p.id
        );

        return update
          ? { ...p, quota: update.newQuota }
          : p;
      })
    );

    setRound((current) =>
      current
        ? {
            ...current,
            is_complete: true,
            completed_at: completedAt,
            rollover_out: rolloverOut,
          }
        : current
    );

    setMessage(
      eligibleCount === 0
        ? `Round completed. $${rolloverOut.toFixed(2)} rolls over to the next round.`
        : "Round completed and quotas updated once."
    );
    setFinishingRound(false);
  }

  if (loading) return <main className="p-8">Loading scorecard...</main>;
  if (!round) return <main className="p-8"><h1 className="text-2xl font-bold">Round Not Found</h1><p className="mt-3 text-red-600">{error}</p></main>;

  if (round.is_complete && !isAdmin) {
    return (
      <main className="mx-auto max-w-3xl p-6 md:p-8">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Round Completed</h1>
          <p className="mt-3 text-gray-600">
            This round is closed and can no longer be reopened.
          </p>
          <Link
            href="/rounds"
            className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Back to Rounds
          </Link>
        </div>
      </main>
    );
  }

  return <main className="mx-auto max-w-full p-4 md:p-8">
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/" className="rounded bg-gray-500 px-4 py-2 text-white">Home</Link><Link href="/rounds" className="rounded bg-blue-600 px-4 py-2 text-white">Rounds</Link><Link href="/players" className="rounded bg-purple-600 px-4 py-2 text-white">Players</Link></div>
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">{round.name}</h1><p className="text-gray-600">{round.course} • White Tees • {round.holes} Holes • Par {totalPar}</p><p className="mt-2 text-sm text-gray-500">{isAdmin ? "Admin: you can edit every player." : currentPlayerId ? "You can see all scores and edit only your own." : "Your login is not linked to a player yet, so scores are view-only."}</p></div><div>{message}</div></div>
    {error && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
    {isAdmin && (
      <div className="mt-6 rounded border border-green-300 bg-green-50 p-4">
        <button
          type="button"
          onClick={finishRound}
          disabled={round.is_complete || finishingRound}
          className={`rounded px-5 py-3 font-semibold text-white ${
            round.is_complete || finishingRound
              ? "cursor-not-allowed bg-gray-400"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {round.is_complete
            ? "Round Completed"
            : finishingRound
            ? "Finishing..."
            : "Finish Round & Update Quotas"}
        </button>

        <p className="mt-2 text-sm text-green-800">
          {round.is_complete
            ? "This round is closed. Quotas have already been updated."
            : "Use this once after the round is complete."}
        </p>
      </div>
    )}
    <section className="mt-8 rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            Leaderboard
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Only players who hit or beat their Playing Quota (Result 0 or higher) are eligible for the top three.
          </p>
        </div>

        <div className="rounded bg-gray-100 px-4 py-3 text-sm">
          <div>
            Entry Fee: <strong>${entryFee}</strong> per player
          </div>
          <div>
            New Entry Money: <strong>${newEntryMoney.toFixed(2)}</strong>
          </div>
          {rolloverIn > 0 && (
            <div>
              Rollover Added: <strong>${rolloverIn.toFixed(2)}</strong>
            </div>
          )}
          <div>
            Total Pot: <strong>${totalPot.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border bg-gray-50 p-4">
        <div className="font-semibold">
          Payout
        </div>

        {eligibleCount >= 3 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              1st: <strong>${firstPlacePayout.toFixed(2)}</strong>
            </div>
            <div>
              2nd: <strong>${secondPlacePayout.toFixed(2)}</strong>
            </div>
            <div>
              3rd: <strong>${thirdPlacePayout.toFixed(2)}</strong>
            </div>
          </div>
        )}

        {eligibleCount === 2 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              1st (70%): <strong>${firstPlacePayout.toFixed(2)}</strong>
            </div>
            <div>
              2nd (30%): <strong>${secondPlacePayout.toFixed(2)}</strong>
            </div>
          </div>
        )}

        {eligibleCount === 1 && (
          <div className="mt-2">
            1st receives the full pot: <strong>${firstPlacePayout.toFixed(2)}</strong>
          </div>
        )}

        {eligibleCount === 0 && (
          <div className="mt-2 rounded border border-yellow-300 bg-yellow-50 p-3 font-medium text-yellow-800">
            No player hit quota. The full <strong>${rolloverOut.toFixed(2)}</strong> pot rolls to the next round.
          </div>
        )}

        {hasPayoutTie && (
          <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm font-medium text-yellow-800">
            There is a tie affecting a paid position. Payouts are pending until the tie is resolved.
          </div>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-3 text-left">Place</th>
              <th className="border p-3 text-left">Player</th>
              <th className="border p-3 text-center">Playing Quota</th>
              <th className="border p-3 text-center">Points</th>
              <th className="border p-3 text-center">Result</th>
              <th className="border p-3 text-center">Winnings</th>
            </tr>
          </thead>

          <tbody>
            {leaderboard.map((player, index) => {
              const payout = getPayout(player.id);

              return (
                <tr key={player.id}>
                  <td className="border p-3 font-bold">
                    {player.eligibleForPayout
                      ? eligiblePlayers.findIndex((p) => p.id === player.id) + 1
                      : "—"}
                  </td>

                  <td className="border p-3 font-semibold">
                    {player.name}
                    {currentPlayerId === player.id && (
                      <span className="ml-2 text-xs font-normal text-blue-600">
                        You
                      </span>
                    )}
                  </td>

                  <td className="border p-3 text-center">
                    {player.playingQuota}
                  </td>

                  <td className="border p-3 text-center">
                    {player.points}
                  </td>

                  <td className="border p-3 text-center font-bold">
                    {player.result > 0 ? "+" : ""}
                    {player.result}
                  </td>

                  <td className="border p-3 text-center font-bold">
                    {hasPayoutTie &&
                    player.eligibleForPayout &&
                    eligiblePlayers.findIndex((p) => p.id === player.id) <
                      Math.min(3, eligibleCount)
                      ? "Pending"
                      : payout > 0
                      ? `$${payout.toFixed(2)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>

    <div className="mt-8 overflow-x-auto rounded border">
      <table className="min-w-max border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="sticky left-0 z-30 w-16 min-w-16 border bg-gray-100 p-3 text-center">
              Hole
            </th>

            <th className="sticky left-16 z-30 w-16 min-w-16 border bg-gray-100 p-3 text-center shadow-[2px_0_4px_rgba(0,0,0,0.12)]">
              Par
            </th>

            {scorecardPlayers.map((p) => (
              <th
                key={p.id}
                className="min-w-[110px] border p-3"
              >
                {p.name}
                {currentPlayerId === p.id && (
                  <div className="mt-1 text-xs font-normal text-blue-600">
                    You
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            { length: round.holes },
            (_, i) => i + 1
          ).map((h) => (
            <tr key={h}>
              <td className="sticky left-0 z-20 w-16 min-w-16 border bg-white p-3 text-center font-bold">
                {h}
              </td>

              <td className="sticky left-16 z-20 w-16 min-w-16 border bg-white p-2 text-center font-bold shadow-[2px_0_4px_rgba(0,0,0,0.12)]">
                {pars[h]}
              </td>

              {scorecardPlayers.map((p) => {
                const key = `${p.id}-${h}`;
                const editable = canEdit(p.id);

                return (
                  <td key={p.id} className="border p-2">
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={scores[key] ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        updateScore(
                          p.id,
                          h,
                          e.target.value
                        )
                      }
                      className={`w-20 rounded border p-2 text-center ${
                        editable
                          ? "bg-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="bg-gray-100">
            <td className="sticky left-0 z-20 w-16 min-w-16 border bg-gray-100 p-3 text-center font-bold">
              Total
            </td>

            <td className="sticky left-16 z-20 w-16 min-w-16 border bg-gray-100 p-3 text-center font-bold shadow-[2px_0_4px_rgba(0,0,0,0.12)]">
              {totalPar}
            </td>

            {scorecardPlayers.map((p) => (
              <td
                key={p.id}
                className="border p-3 text-center font-bold"
              >
                {getTotal(p.id)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
    <div className="mt-8">
      <h2 className="mb-4 text-2xl font-bold">
        Quota Results
      </h2>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          const pts = getPoints(p.id);
          const playingQuota = getPlayingQuota(p.quota);
          const result = pts - playingQuota;
          const nextQuota = newQuota(p.quota, pts);

          return (
            <div
              key={p.id}
              className="rounded border p-4"
            >
              <h3 className="text-xl font-bold">
                {p.name}
              </h3>

              <div className="mt-3">
                Overall Quota:{" "}
                <strong>{formatQuota(p.quota)}</strong>
              </div>

              <div>
                Playing Quota:{" "}
                <strong>{playingQuota}</strong>
              </div>

              <div>
                Points: <strong>{pts}</strong>
              </div>

              <div>
                Result:{" "}
                <strong>
                  {result > 0 ? "+" : ""}
                  {result}
                </strong>
              </div>

              <div className="mt-3 border-t pt-3">
                Next Overall Quota:{" "}
                <strong>{formatQuota(nextQuota)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </main>;
}

