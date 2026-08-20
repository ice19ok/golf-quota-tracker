import LogoutButton from "@/app/components/LogoutButton";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold">
        Golf Quota Tracker
      </h1>

      <p className="mt-2 text-gray-600">
        Track rounds, scores, and quota results.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href="/rounds"
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Rounds
        </Link>

        <Link
          href="/rounds/new"
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          New Round
        </Link>

        <Link
          href="/players"
          className="rounded bg-gray-700 px-4 py-2 text-white"
        >
          Players
        </Link>

        <Link
          href="/account"
          className="rounded bg-purple-600 px-4 py-2 text-white"
        >
          Account
        </Link>

        <LogoutButton />
      </div>
    </main>
  );
}