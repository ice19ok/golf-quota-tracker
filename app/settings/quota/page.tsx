"use client";

import { useEffect, useState } from "react";

type QuotaPoints = {
  ace: number;
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  doubleBogey: number;
};

const defaultPoints: QuotaPoints = {
  ace: 5,
  eagle: 4,
  birdie: 3,
  par: 2,
  bogey: 1,
  doubleBogey: 0,
};

export default function QuotaSettingsPage() {
  const [points, setPoints] =
    useState<QuotaPoints>(defaultPoints);

  const [saved, setSaved] =
    useState(false);

  useEffect(() => {
    const savedPoints =
      localStorage.getItem("quotaPoints");

    if (savedPoints) {
      try {
        setPoints(
          JSON.parse(savedPoints)
        );
      } catch (error) {
        console.error(
          "Could not load quota points:",
          error
        );
      }
    }
  }, []);

  const handleChange = (
    key: keyof QuotaPoints,
    value: string
  ) => {
    setPoints((current) => ({
      ...current,
      [key]: Number(value),
    }));

    setSaved(false);
  };

  const savePoints = () => {
    localStorage.setItem(
      "quotaPoints",
      JSON.stringify(points)
    );

    setSaved(true);
  };

  const resetDefaults = () => {
    setPoints(defaultPoints);

    localStorage.setItem(
      "quotaPoints",
      JSON.stringify(defaultPoints)
    );

    setSaved(true);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-xl">

        <h1 className="text-3xl font-bold text-gray-900">
          Quota Scoring
        </h1>

        <p className="mt-2 text-gray-600">
          Set the points awarded for each golf score.
        </p>

        <div className="mt-6 rounded-lg bg-white p-6 shadow">

          <div className="space-y-4">

            <PointRow
              label="Ace"
              value={points.ace}
              onChange={(value) =>
                handleChange("ace", value)
              }
            />

            <PointRow
              label="Eagle"
              value={points.eagle}
              onChange={(value) =>
                handleChange("eagle", value)
              }
            />

            <PointRow
              label="Birdie"
              value={points.birdie}
              onChange={(value) =>
                handleChange("birdie", value)
              }
            />

            <PointRow
              label="Par"
              value={points.par}
              onChange={(value) =>
                handleChange("par", value)
              }
            />

            <PointRow
              label="Bogey"
              value={points.bogey}
              onChange={(value) =>
                handleChange("bogey", value)
              }
            />

            <PointRow
              label="Double Bogey"
              value={points.doubleBogey}
              onChange={(value) =>
                handleChange(
                  "doubleBogey",
                  value
                )
              }
            />

          </div>

          <div className="mt-6 flex gap-3">

            <button
              onClick={savePoints}
              className="rounded bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>

            <button
              onClick={resetDefaults}
              className="rounded bg-gray-600 px-5 py-2 font-medium text-white hover:bg-gray-700"
            >
              Reset Defaults
            </button>

          </div>

          {saved && (
            <p className="mt-4 text-sm font-medium text-green-600">
              Quota points saved!
            </p>
          )}

        </div>

      </div>
    </main>
  );
}

function PointRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">

      <label className="text-lg font-medium text-gray-800">
        {label}
      </label>

      <input
        type="number"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-24 rounded border border-gray-300 px-3 py-2 text-center text-lg"
      />

    </div>
  );
}