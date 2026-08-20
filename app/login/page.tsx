"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showReset, setShowReset] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const emailToUse = resetEmail.trim();

    if (!emailToUse) {
      setError("Please enter your email address.");
      return;
    }

    setResetLoading(true);

    const redirectTo =
      `${window.location.origin}/update-password`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        emailToUse,
        {
          redirectTo,
        }
      );

    if (error) {
      setError(error.message);
      setResetLoading(false);
      return;
    }

    setMessage(
      "Password reset email sent. Check your email and follow the link to choose a new password."
    );
    setResetLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">

        <h1 className="text-3xl font-bold text-gray-900">
          Golf Quota Tracker
        </h1>

        <p className="mt-2 text-gray-600">
          Sign in to continue
        </p>

        {!showReset ? (
          <>
            <form
              onSubmit={handleLogin}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block font-medium mb-1">
                  Email
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="w-full rounded border p-3"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Password
                </label>

                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  className="w-full rounded border p-3"
                  placeholder="Password"
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
                  ? "Signing in..."
                  : "Sign In"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setShowReset(true);
                setResetEmail(email);
                setError("");
                setMessage("");
              }}
              className="mt-4 w-full text-center text-sm font-semibold text-blue-700 hover:underline"
            >
              Forgot password?
            </button>
          </>
        ) : (
          <>
            <form
              onSubmit={handleForgotPassword}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block font-medium mb-1">
                  Email
                </label>

                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) =>
                    setResetEmail(e.target.value)
                  }
                  className="w-full rounded border p-3"
                  placeholder="you@example.com"
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
                disabled={resetLoading}
                className="w-full rounded bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {resetLoading
                  ? "Sending..."
                  : "Send Reset Email"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setShowReset(false);
                setError("");
                setMessage("");
              }}
              className="mt-4 w-full text-center text-sm font-semibold text-gray-700 hover:underline"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </main>
  );
}