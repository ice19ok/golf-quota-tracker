"use client";

import { useEffect, useState } from "react";

type Player = {
  id: number;
  name: string;
  quota: number;
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load saved players when the page opens
  useEffect(() => {
    const savedPlayers = localStorage.getItem("players");

    if (savedPlayers) {
      try {
        setPlayers(JSON.parse(savedPlayers));
      } catch (error) {
        console.error("Could not load players:", error);
      }
    }

    setLoaded(true);
  }, []);

  // Save players whenever the list changes
  // BUT only after the initial load is complete
  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem("players", JSON.stringify(players));
  }, [players, loaded]);

  function addPlayer() {
    if (!name.trim() || !quota) return;

    const newPlayer: Player = {
      id: Date.now(),
      name: name.trim(),
      quota: Number(quota),
    };

    setPlayers((currentPlayers) => [
      ...currentPlayers,
      newPlayer,
    ]);

    setName("");
    setQuota("");
  }

  function deletePlayer(id: number) {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player.id !== id)
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">
        Players
      </h1>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-4">
          Add Player
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <input
            className="border rounded p-2"
            placeholder="Player Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="number"
            className="border rounded p-2"
            placeholder="Quota"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          />
        </div>

        <button
          onClick={addPlayer}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Player
        </button>
      </div>

      <div className="border rounded">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3">Player</th>
              <th className="text-left p-3">Quota</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-b">
                <td className="p-3">{player.name}</td>
                <td className="p-3">{player.quota}</td>
                <td className="p-3">
                  <button
                    onClick={() => deletePlayer(player.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {players.length === 0 && (
          <div className="p-4 text-gray-500">
            No players added yet.
          </div>
        )}
      </div>
    </main>
  );
}