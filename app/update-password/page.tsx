"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully.");

    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-gray-900">
          Set New Password
        </h1>

        <p className="mt-2 text-gray-600">
          Enter and confirm your new password.
        </p>

        <form
          onSubmit={handleUpdatePassword}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="block font-medium mb-1">
              New Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              className="w-full rounded border p-3"
              placeholder="New password"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              Confirm Password
            </label>

            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              className="w-full rounded border p-3"
              placeholder="Confirm new password"
            />
          </div>

          {error && (
            <div className="rounded bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded bg-green-100 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading
              ? "Updating..."
              : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}