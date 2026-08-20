"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = useMemo(() => createClient(), []);

  const [currentPassword, setCurrentPassword] =
    useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleChangePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (newPassword.length < 6) {
      setError(
        "New password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password changed successfully.");
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
        >
          Home
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">
          Account
        </h1>

        <p className="mt-2 text-gray-600">
          Change your password.
        </p>

        <form
          onSubmit={handleChangePassword}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="mb-1 block font-medium">
              Current Password
            </label>

            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)
              }
              className="w-full rounded border p-3"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">
              New Password
            </label>

            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              className="w-full rounded border p-3"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium">
              Confirm New Password
            </label>

            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              className="w-full rounded border p-3"
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
            className="w-full rounded bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading
              ? "Changing..."
              : "Change Password"}
          </button>
        </form>
      </div>
    </main>
  );
}