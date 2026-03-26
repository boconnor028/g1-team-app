"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

type Tournament = {
  id: string;
  name: string;
  city: string;
  dates: string;
  hotel: string;
};

type SavedEvent = {
  id: string;
  title: string;
  type: "Dinner" | "Activity";
  dateLabel: string;
  location: string;
  response: "yes" | "no" | "maybe";
  guestCount: number;
};

type TournamentResponse = {
  id: string;
  userId: string;
  userEmail: string;
  tournamentId: string;
  tournamentName: string;
  attendance: "yes" | "no" | "maybe" | "";
  arrivalDate: string;
  arrivalHour: string;
  arrivalMinute: string;
  arrivalPeriod: string;
  hotelReservationName: string;
  familyCount: number;
  events: SavedEvent[];
  updatedAt: string;
};

const ADMIN_EMAILS = [
  "brendanm.oc@gmail.com",
  // add more admin emails here if needed
];

export default function AdminResponsesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [responses, setResponses] = useState<TournamentResponse[]>([]);

  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadTournaments() {
      try {
        setLoadingTournaments(true);

        const snapshot = await getDocs(collection(db, "tournaments"));
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Tournament, "id">),
        }));

        setTournaments(data);
      } catch (error) {
        console.error(error);
        setStatusMessage("There was a problem loading tournaments.");
      } finally {
        setLoadingTournaments(false);
      }
    }

    if (authChecked && isAdmin) {
      loadTournaments();
    }
  }, [authChecked, isAdmin]);

  useEffect(() => {
    async function loadResponses() {
      if (!selectedTournamentId) {
        setResponses([]);
        return;
      }

      try {
        setLoadingResponses(true);

        const responsesQuery = query(
          collection(db, "responses"),
          where("tournamentId", "==", selectedTournamentId)
        );

        const snapshot = await getDocs(responsesQuery);

        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TournamentResponse, "id">),
        }));

        setResponses(data);
      } catch (error) {
        console.error(error);
        setStatusMessage("There was a problem loading responses.");
      } finally {
        setLoadingResponses(false);
      }
    }

    if (isAdmin) {
      loadResponses();
    }
  }, [selectedTournamentId, isAdmin]);

  const selectedTournament = useMemo(() => {
    return tournaments.find((t) => t.id === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  const summary = useMemo(() => {
    const yesCount = responses.filter((r) => r.attendance === "yes").length;
    const noCount = responses.filter((r) => r.attendance === "no").length;
    const maybeCount = responses.filter((r) => r.attendance === "maybe").length;

    const totalPeopleAttending = responses
      .filter((r) => r.attendance === "yes")
      .reduce((sum, r) => sum + (r.familyCount || 0), 0);

    return {
      totalResponses: responses.length,
      yesCount,
      noCount,
      maybeCount,
      totalPeopleAttending,
    };
  }, [responses]);

  const eventSummaries = useMemo(() => {
    const map: Record<
      string,
      {
        title: string;
        type: string;
        dateLabel: string;
        location: string;
        yesFamilies: number;
        maybeFamilies: number;
        totalGuests: number;
      }
    > = {};

    for (const response of responses) {
      for (const event of response.events || []) {
        if (!map[event.id]) {
          map[event.id] = {
            title: event.title,
            type: event.type,
            dateLabel: event.dateLabel,
            location: event.location,
            yesFamilies: 0,
            maybeFamilies: 0,
            totalGuests: 0,
          };
        }

        if (event.response === "yes") {
          map[event.id].yesFamilies += 1;
          map[event.id].totalGuests += event.guestCount || 0;
        }

        if (event.response === "maybe") {
          map[event.id].maybeFamilies += 1;
        }
      }
    }

    return Object.entries(map).map(([id, value]) => ({
      id,
      ...value,
    }));
  }, [responses]);

  function formatArrival(response: TournamentResponse) {
    if (!response.arrivalDate) return "—";

    const date = new Date(`${response.arrivalDate}T12:00:00`);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${formattedDate} ${response.arrivalHour}:${response.arrivalMinute} ${response.arrivalPeriod}`;
  }

  function formatUpdatedAt(updatedAt: string) {
    if (!updatedAt) return "—";

    const date = new Date(updatedAt);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-sm">
          Loading...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Please Log In</h1>
          <p className="mt-2 text-slate-600">
            You need to be logged in to access the admin responses dashboard.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-slate-900">
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-slate-600">
            Your account is not authorized for the admin responses dashboard.
          </p>
          <p className="mt-2 text-sm text-slate-500">Logged in as: {user.email}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-slate-900">
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              G1 Football Academy
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Admin Responses Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              View family responses, attendance, arrivals, and event headcounts.
            </p>
            <p className="mt-2 text-sm text-slate-500">Logged in as: {user.email}</p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="rounded-2xl border border-slate-300 px-5 py-3 font-medium"
            >
              Admin Panel
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-slate-300 px-5 py-3 font-medium"
            >
              Home
            </Link>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-6 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
            {statusMessage}
          </div>
        )}

        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Select Tournament</h2>
          <p className="mt-2 text-slate-600">
            Choose a tournament to review all submitted family responses.
          </p>

          <div className="mt-4">
            {loadingTournaments ? (
              <p className="text-slate-600">Loading tournaments...</p>
            ) : (
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
              >
                <option value="">Select a tournament</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {selectedTournament && (
          <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              {selectedTournament.city}
            </p>
            <h2 className="mt-2 text-3xl font-semibold">{selectedTournament.name}</h2>
            <p className="mt-2 text-slate-600">{selectedTournament.dates}</p>
            <p className="mt-1 text-sm text-slate-500">
              Hotel: {selectedTournament.hotel}
            </p>
          </section>
        )}

        {selectedTournamentId && (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-5">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Responses</p>
                <p className="mt-2 text-3xl font-semibold">{summary.totalResponses}</p>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Yes</p>
                <p className="mt-2 text-3xl font-semibold">{summary.yesCount}</p>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">No</p>
                <p className="mt-2 text-3xl font-semibold">{summary.noCount}</p>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Maybe</p>
                <p className="mt-2 text-3xl font-semibold">{summary.maybeCount}</p>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">People Attending</p>
                <p className="mt-2 text-3xl font-semibold">{summary.totalPeopleAttending}</p>
              </div>
            </section>

            <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Event Headcounts</h2>
              <p className="mt-2 text-slate-600">
                Summary of family responses and guest counts by event.
              </p>

              <div className="mt-6 space-y-4">
                {loadingResponses ? (
                  <p className="text-slate-600">Loading responses...</p>
                ) : eventSummaries.length === 0 ? (
                  <p className="text-slate-600">No event response data yet.</p>
                ) : (
                  eventSummaries.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                            {event.type}
                          </div>
                          <h3 className="mt-3 text-xl font-semibold">{event.title}</h3>
                          <p className="mt-1 text-sm text-slate-600">{event.dateLabel}</p>
                          <p className="mt-1 text-sm text-slate-500">{event.location}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Yes Families
                            </p>
                            <p className="mt-2 text-2xl font-semibold">{event.yesFamilies}</p>
                          </div>

                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Maybe Families
                            </p>
                            <p className="mt-2 text-2xl font-semibold">{event.maybeFamilies}</p>
                          </div>

                          <div className="rounded-2xl bg-white p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Guest Count
                            </p>
                            <p className="mt-2 text-2xl font-semibold">{event.totalGuests}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Family Responses</h2>
              <p className="mt-2 text-slate-600">
                Detailed family-level response data for this tournament.
              </p>

              <div className="mt-6 overflow-x-auto">
                {loadingResponses ? (
                  <p className="text-slate-600">Loading responses...</p>
                ) : responses.length === 0 ? (
                  <p className="text-slate-600">No responses submitted yet.</p>
                ) : (
                  <table className="min-w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-left text-sm text-slate-500">
                        <th className="px-3 py-2">Family Email</th>
                        <th className="px-3 py-2">Attendance</th>
                        <th className="px-3 py-2">Hotel Reservation</th>
                        <th className="px-3 py-2">Arrival</th>
                        <th className="px-3 py-2">Family Count</th>
                        <th className="px-3 py-2">Event Responses</th>
                        <th className="px-3 py-2">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responses.map((response) => (
                        <tr key={response.id} className="bg-slate-50 text-sm">
                          <td className="rounded-l-2xl px-3 py-3 font-medium">
                            {response.userEmail || "—"}
                          </td>
                          <td className="px-3 py-3 uppercase">
                            {response.attendance || "—"}
                          </td>
                          <td className="px-3 py-3">
                            {response.hotelReservationName || "—"}
                          </td>
                          <td className="px-3 py-3">{formatArrival(response)}</td>
                          <td className="px-3 py-3">{response.familyCount ?? "—"}</td>
                          <td className="px-3 py-3">
                            <div className="space-y-2">
                              {(response.events || []).length === 0 ? (
                                <span>—</span>
                              ) : (
                                response.events.map((event) => (
                                  <div key={event.id} className="rounded-xl bg-white px-3 py-2">
                                    <p className="font-medium">{event.title}</p>
                                    <p className="text-xs text-slate-500">
                                      {event.response.toUpperCase()} · Guests: {event.guestCount}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="rounded-r-2xl px-3 py-3">
                            {formatUpdatedAt(response.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}