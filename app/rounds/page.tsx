"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Round = { id: string; name: string; course: string; holes: number; is_complete: boolean; completed_at?: string | null };
type Player = { id: string; name: string; quota: number };
type RoundPlayer = { round_id: string; player_id: string };

export default function RoundsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundPlayers, setRoundPlayers] = useState<RoundPlayer[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const [profileRes, roundsRes, playersRes, rpRes] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("rounds").select("id,name,course,holes,is_complete,completed_at").order("id", { ascending: false }),
      supabase.from("players").select("id,name,quota").order("name"),
      supabase.from("round_players").select("round_id,player_id"),
    ]);
    const firstError = profileRes.error || roundsRes.error || playersRes.error || rpRes.error;
    if (firstError) setError(firstError.message);
    setIsAdmin(profileRes.data?.role === "admin");
    setRounds((roundsRes.data || []).map(r=>({ ...r, id:String(r.id), holes:Number(r.holes), is_complete:Boolean(r.is_complete) })));
    setPlayers((playersRes.data || []).map(p=>({ id:String(p.id), name:p.name, quota:Number(p.quota) })));
    setRoundPlayers((rpRes.data || []).map(r=>({ round_id:String(r.round_id), player_id:String(r.player_id) })));
    setLoading(false);
  }

  useEffect(()=>{ loadData(); }, []);

  async function deleteRound(id: string) {
    if (!isAdmin || !window.confirm("Delete this round and its scores?")) return;
    const { error: scoreError } = await supabase.from("scores").delete().eq("round_id", id);
    if (scoreError) { setError(scoreError.message); return; }
    const { error: rpError } = await supabase.from("round_players").delete().eq("round_id", id);
    if (rpError) { setError(rpError.message); return; }
    const { error: roundError } = await supabase.from("rounds").delete().eq("id", id);
    if (roundError) { setError(roundError.message); return; }
    await loadData();
  }

  if (loading) return <main className="p-8">Loading rounds...</main>;

  return <main className="mx-auto max-w-6xl p-8">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Golf Rounds</h1><p className="text-gray-600">Shared rounds stored in Supabase</p></div>{isAdmin && <Link href="/rounds/new" className="rounded bg-green-600 px-5 py-3 font-semibold text-white">+ New Round</Link>}</div>
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/" className="rounded bg-gray-500 px-4 py-2 text-white">Home</Link><Link href="/players" className="rounded bg-blue-600 px-4 py-2 text-white">Players</Link><Link href="/settings/quota" className="rounded bg-purple-600 px-4 py-2 text-white">Quota Settings</Link></div>
    {error && <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>}
    {!rounds.length && <div className="rounded border bg-white p-8 text-center">No rounds yet.</div>}
    <div className="space-y-6">
      {rounds.map((round) => {
        const ids = roundPlayers
          .filter((x) => x.round_id === round.id)
          .map((x) => x.player_id);

        const rPlayers = players.filter((p) =>
          ids.includes(p.id)
        );

        return (
          <div
            key={round.id}
            className="rounded-lg border bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold">
                    {round.name}
                  </h2>

                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      round.is_complete
                        ? "bg-gray-200 text-gray-700"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {round.is_complete ? "Completed" : "Open"}
                  </span>
                </div>

                <p className="text-gray-600">
                  {round.course} • White Tees • {round.holes} holes
                </p>
              </div>

              <Link
                href={`/rounds/${round.id}`}
                className="rounded bg-blue-600 px-4 py-2 text-white"
              >
                {round.is_complete ? "View Round" : "Open Round"}
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {rPlayers.map((p) => (
                <span
                  key={p.id}
                  className="rounded bg-gray-100 px-3 py-2"
                >
                  {p.name}{" "}
                  <span className="text-sm text-gray-500">
                    {round.is_complete
                      ? `Overall Quota ${p.quota.toFixed(2)}`
                      : `Playing Quota ${Math.round(p.quota)}`}
                  </span>
                </span>
              ))}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => deleteRound(round.id)}
                className="mt-6 rounded bg-red-600 px-4 py-2 text-white"
              >
                Delete Round
              </button>
            )}
          </div>
        );
      })}
    </div>
  </main>;
}