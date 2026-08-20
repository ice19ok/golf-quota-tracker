"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_QUOTA_POINTS, loadQuotaPoints, calculatePlayerQuotaPoints, type QuotaPoints } from "@/lib/quota";

type Player = { id: string; name: string; quota: number };
type Round = { id: string; name: string; course: string; holes: number };
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
        supabase.from("rounds").select("id,name,course,holes").eq("id", id).single(),
        supabase.from("round_players").select("player_id").eq("round_id", id),
        supabase.from("players").select("id,name,quota").order("name"),
        supabase.from("scores").select("id,round_id,player_id,hole,score").eq("round_id", id),
      ]);
      const firstError = roundRes.error || rpRes.error || playerRes.error || scoreRes.error;
      if (firstError) { setError(firstError.message); setLoading(false); return; }
      setRound({ ...roundRes.data, id:String(roundRes.data.id), holes:Number(roundRes.data.holes) });
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

  function canEdit(playerId: string) { return isAdmin || currentPlayerId === playerId; }

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
  function newQuota(q:number,p:number){const d=p-q;if(!d)return q;const a=Math.ceil(Math.abs(d)/2);return d>0?q+a:Math.max(0,q-a);}

  async function finishRound() {
    if (!isAdmin) return;
    if (!window.confirm("Finish this round and update all player quotas? This should only be done once.")) return;
    setMessage("Updating quotas...");
    for (const p of players) {
      const { error } = await supabase.from("players").update({ quota:newQuota(p.quota,getPoints(p.id)) }).eq("id",p.id);
      if (error) { setError(error.message); setMessage(""); return; }
    }
    setPlayers(ps=>ps.map(p=>({...p,quota:newQuota(p.quota,getPoints(p.id))})));
    setMessage("Quotas updated");
  }

  if (loading) return <main className="p-8">Loading scorecard...</main>;
  if (!round) return <main className="p-8"><h1 className="text-2xl font-bold">Round Not Found</h1><p className="mt-3 text-red-600">{error}</p></main>;

  return <main className="mx-auto max-w-full p-4 md:p-8">
    <div className="mb-6 flex flex-wrap gap-3"><Link href="/" className="rounded bg-gray-500 px-4 py-2 text-white">Home</Link><Link href="/rounds" className="rounded bg-blue-600 px-4 py-2 text-white">Rounds</Link><Link href="/players" className="rounded bg-purple-600 px-4 py-2 text-white">Players</Link></div>
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">{round.name}</h1><p className="text-gray-600">{round.course} • White Tees • {round.holes} Holes • Par {totalPar}</p><p className="mt-2 text-sm text-gray-500">{isAdmin ? "Admin: you can edit every player." : currentPlayerId ? "You can see all scores and edit only your own." : "Your login is not linked to a player yet, so scores are view-only."}</p></div><div>{message}</div></div>
    {error && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
    {isAdmin && <div className="mt-6 rounded border border-green-300 bg-green-50 p-4"><button type="button" onClick={finishRound} className="rounded bg-green-600 px-5 py-3 font-semibold text-white">Finish Round & Update Quotas</button><p className="mt-2 text-sm text-green-800">Use this once after the round is complete.</p></div>}
    <div className="mt-8 overflow-x-auto rounded border"><table className="min-w-max border-collapse"><thead><tr className="bg-gray-100"><th className="sticky left-0 border bg-gray-100 p-3">Hole</th><th className="border p-3">Par</th>{players.map(p=><th key={p.id} className="min-w-[110px] border p-3">{p.name}</th>)}</tr></thead><tbody>{Array.from({length:round.holes},(_,i)=>i+1).map(h=><tr key={h}><td className="sticky left-0 border bg-white p-3 font-bold">{h}</td><td className="border p-2 text-center font-bold">{pars[h]}</td>{players.map(p=>{const key=`${p.id}-${h}`;const editable=canEdit(p.id);return <td key={p.id} className="border p-2"><input type="number" min="1" max="15" value={scores[key]??""} disabled={!editable} onChange={e=>updateScore(p.id,h,e.target.value)} className={`w-20 rounded border p-2 text-center ${editable?"bg-white":"bg-gray-100 text-gray-500"}`}/></td>})}</tr>)}</tbody><tfoot><tr className="bg-gray-100"><td className="border p-3 font-bold">Total</td><td className="border p-3 font-bold">{totalPar}</td>{players.map(p=><td key={p.id} className="border p-3 text-center font-bold">{getTotal(p.id)}</td>)}</tr></tfoot></table></div>
    <div className="mt-8"><h2 className="mb-4 text-2xl font-bold">Quota Results</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{players.map(p=>{const pts=getPoints(p.id), result=pts-p.quota;return <div key={p.id} className="rounded border p-4"><h3 className="text-xl font-bold">{p.name}</h3><div className="mt-3">Quota: <strong>{p.quota}</strong></div><div>Points: <strong>{pts}</strong></div><div>Result: <strong>{result>0?"+":""}{result}</strong></div><div className="mt-3 border-t pt-3">Next Quota: <strong>{newQuota(p.quota,pts)}</strong></div></div>})}</div></div>
  </main>;
}