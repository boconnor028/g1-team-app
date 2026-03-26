"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";

type Tournament = {
  id: string;
  name: string;
  city: string;
  dates: string;
  hotel: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // 🔐 Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 Load tournaments from Firebase
  useEffect(() => {
    async function loadTournaments() {
      try {
        const snapshot = await getDocs(collection(db, "tournaments"));

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Tournament, "id">),
        }));

        setTournaments(data);
      } catch (error) {
        console.error(error);
        setStatusMessage("Error loading tournaments.");
      } finally {
        setLoadingTournaments(false);
      }
    }

    loadTournaments();
  }, []);

  async function handleAuth() {
    setStatusMessage("");

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatusMessage("Account created successfully.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setStatusMessage("Logged in successfully.");
      }
    } catch (error: any) {
      setStatusMessage(error.message || "Authentication failed.");
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      setStatusMessage("Logged out.");
    } catch (error: any) {
      setStatusMessage(error.message || "Logout failed.");
    }
  }

  // 🔒 LOGIN SCREEN
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            G1 Football Academy
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Team Travel Login
          </h1>

          <div className="mt-6 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border p-3"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border p-3"
            />

            <button
              onClick={handleAuth}
              className="w-full rounded-2xl bg-black py-3 text-white"
            >
              {isSignUp ? "Create Account" : "Log In"}
            </button>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full rounded-2xl border py-3"
            >
              {isSignUp
                ? "Already have an account? Log In"
                : "Need an account? Sign Up"}
            </button>

            {statusMessage && (
              <p className="text-sm text-slate-600">{statusMessage}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // 🏠 TOURNAMENT HOME
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex justify-between rounded-3xl bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-3xl font-semibold">Tournament Home</h1>
            <p className="mt-2 text-slate-600">
              Welcome, {user.email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-2xl border px-4 py-2"
          >
            Log Out
          </button>
        </div>

        {loadingTournaments ? (
          <p>Loading tournaments...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {tournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournament/${tournament.id}`}
                className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-md"
              >
                <h2 className="text-2xl font-semibold">
                  {tournament.name}
                </h2>
                <p className="mt-2 text-slate-600">
                  {tournament.city}
                </p>
                <p className="text-sm text-slate-500">
                  {tournament.dates}
                </p>
                <p className="text-sm text-slate-500">
                  Hotel: {tournament.hotel}
                </p>

                <p className="mt-4 text-sm font-medium">
                  Open →
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}