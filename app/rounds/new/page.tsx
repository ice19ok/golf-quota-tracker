"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string; quota: number };

const COURSES: Record<string, number[]> = {
  "KickingBird Golf Club": [4,4,3,5,4,3,4,4,4, 4,3,5,4,3,5,3,4,4],
  "The Golf Club of Edmond": [4,5,3,4,4,4,3,4,5, 3,4,4,4,3,5,4,3,5],
};

export default function NewRoundPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const [
        { data: profile, error: profileError },
        { data: playerData, error: playerError },
        { data: rolloverData, error: rolloverError },
      ] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),
        supabase.from("players").select("id,name,quota").order("name"),
        supabase
          .from("rounds")
          .select("id,rollover_out")
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
      setAvailableRollover(Number(rolloverData?.rollover_out || 0));
      setIsAdmin(profile?.role === "admin");
      setPlayers((playerData || []).map(p => ({ id: String(p.id), name: p.name, quota: Number(p.quota) })));
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  function togglePlayer(id: string) {
    setSelectedPlayers(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  async function createRound() {
    setError("");
    if (!isAdmin) { setError("Only an administrator can create a round."); return; }
    if (!roundName.trim()) { setError("Please enter a round name."); return; }
    if (!selectedPlayers.length) { setError("Please select at least one player."); return; }
    setCreating(true);
    let rolloverSourceId: string | null = null;
    let claimedRollover = 0;

    try {
      const { data: rolloverSource, error: rolloverLookupError } =
        await supabase
          .from("rounds")
          .select("id,rollover_out")
          .eq("is_complete", true)
          .eq("rollover_consumed", false)
          .gt("rollover_out", 0)
          .order("completed_at", { ascending: true })
          .limit(1)
          .maybeSingle();

      if (rolloverLookupError) throw rolloverLookupError;

      if (rolloverSource) {
        const { data: claimedSource, error: claimError } =
          await supabase
            .from("rounds")
            .update({ rollover_consumed: true })
            .eq("id", rolloverSource.id)
            .eq("rollover_consumed", false)
            .select("id,rollover_out")
            .maybeSingle();

        if (claimError) throw claimError;

        if (claimedSource) {
          rolloverSourceId = String(claimedSource.id);
          claimedRollover = Number(claimedSource.rollover_out || 0);
        }
      }

      const { data: newRound, error: roundError } = await supabase
        .from("rounds")
        .insert({
          name: roundName.trim(),
          course,
          holes: Number(holes),
          pars: (COURSES[course] || []).slice(0, Number(holes)),
          rollover_in: claimedRollover,
          rollover_out: 0,
        })
        .select("id")
        .single();
      if (roundError) throw roundError;
      const { error: rpError } = await supabase.from("round_players").insert(
        selectedPlayers.map(playerId => ({ round_id: newRound.id, player_id: playerId }))
      );
      if (rpError) {
        await supabase.from("rounds").delete().eq("id", newRound.id);

        if (rolloverSourceId) {
          await supabase
            .from("rounds")
            .update({ rollover_consumed: false })
            .eq("id", rolloverSourceId);
        }

        throw rpError;
      }
      router.push(`/rounds/${newRound.id}`);
    } catch (e: any) {
      if (rolloverSourceId) {
        await supabase
          .from("rounds")
          .update({ rollover_consumed: false })
          .eq("id", rolloverSourceId);
      }

      console.error("Could not create round:", e);

      const message =
        e?.message ||
        e?.details ||
        e?.hint ||
        (typeof e === "string" ? e : JSON.stringify(e));

      setError(
        message
          ? `Could not create the round: ${message}`
          : "Could not create the round."
      );

      setCreating(false);
    }
  }

  const pars = COURSES[course].slice(0, Number(holes));
  const totalPar = pars.reduce((a,b) => a+b, 0);

  if (loading) return <main className="p-8">Loading...</main>;

  return <main className="min-h-screen bg-gray-100 p-6"><div className="mx-auto max-w-4xl">
    <div className="mb-6 flex flex-wrap gap-3">
      <Link href="/" className="rounded bg-gray-500 px-4 py-2 text-white">← Home</Link>
      <Link href="/rounds" className="rounded bg-blue-600 px-4 py-2 text-white">Rounds</Link>
      <Link href="/players" className="rounded bg-purple-600 px-4 py-2 text-white">Players</Link>
    </div>
    <h1 className="text-3xl font-bold">Create New Round</h1>

    {availableRollover > 0 && (
      <div className="mt-4 rounded border border-green-300 bg-green-50 p-4 font-semibold text-green-800">
        Rollover available for this round: ${availableRollover.toFixed(2)}
      </div>
    )}
    {!isAdmin && <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">Only an administrator can create rounds.</div>}
    {error && <div className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>}
    <div className="mt-6 space-y-6">
      <div className="rounded-lg bg-white p-6 shadow"><label className="mb-2 block font-semibold">Round Name</label><input className="w-full rounded border px-3 py-2" placeholder="Saturday Quota Game" value={roundName} onChange={e=>setRoundName(e.target.value)} /></div>
      <div className="rounded-lg bg-white p-6 shadow"><h2 className="text-xl font-bold">Course Settings</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><div><label className="mb-2 block font-semibold">Course</label><select className="w-full rounded border px-3 py-2" value={course} onChange={e=>setCourse(e.target.value)}>{Object.keys(COURSES).map(c=><option key={c}>{c}</option>)}</select></div><div><label className="mb-2 block font-semibold">Holes</label><select className="w-full rounded border px-3 py-2" value={holes} onChange={e=>setHoles(e.target.value)}><option value="9">9 Holes</option><option value="18">18 Holes</option></select></div></div><div className="mt-4 rounded border bg-gray-50 p-3">White Tees • Par {totalPar}</div></div>
      <div className="rounded-lg bg-white p-6 shadow"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Select Players</h2><p className="text-sm text-gray-500">Choose everyone playing this round.</p></div><div className="flex flex-wrap gap-2"><Link href="/players" className="rounded bg-purple-600 px-3 py-2 text-sm font-semibold text-white">+ Add Player</Link>{players.length>0 && <><button type="button" onClick={()=>setSelectedPlayers(players.map(p=>p.id))} className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Select All</button><button type="button" onClick={()=>setSelectedPlayers([])} className="rounded bg-gray-500 px-3 py-2 text-sm font-semibold text-white">Clear</button></>}</div></div>
      {players.length===0 ? <div className="mt-6 rounded border border-yellow-300 bg-yellow-50 p-5">No players found. Add a player first.</div> : <div className="mt-6 space-y-2">{players.map(p=><label key={p.id} className="flex cursor-pointer items-center gap-4 rounded border p-4"><input type="checkbox" checked={selectedPlayers.includes(p.id)} onChange={()=>togglePlayer(p.id)} className="h-5 w-5"/><div><div className="font-semibold">{p.name}</div><div className="text-sm text-gray-500">Quota: {p.quota}</div></div></label>)}</div>}</div>
      <button type="button" onClick={createRound} disabled={!isAdmin || creating || !selectedPlayers.length} className="w-full rounded bg-green-600 px-6 py-4 text-lg font-semibold text-white disabled:bg-gray-400">{creating ? "Starting Round..." : "Start Round"}</button>
    </div>
  </div></main>;
}
