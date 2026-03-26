"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

type Tournament = {
  id: string;
  name: string;
  city: string;
  dates: string;
  hotel: string;
};

type AdminEvent = {
  id: string;
  title: string;
  type: "Dinner" | "Activity";
  dateLabel: string;
  location: string;
};

const ADMIN_EMAILS = ["brendanm.oc@gmail.com", "sdelacruz@g1footballacademy.com","moconnor@g1footballacademy.com"];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [newTournamentId, setNewTournamentId] = useState("");
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentCity, setNewTournamentCity] = useState("");
  const [newTournamentDates, setNewTournamentDates] = useState("");
  const [newTournamentHotel, setNewTournamentHotel] = useState("");

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventType, setNewEventType] = useState<"Dinner" | "Activity">("Dinner");
  const [newEventDateLabel, setNewEventDateLabel] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");

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
    async function loadSelectedTournamentAndEvents() {
      if (!selectedTournamentId) {
        setSelectedTournament(null);
        setEvents([]);
        return;
      }

      try {
        setLoadingEvents(true);

        const tournamentRef = doc(db, "tournaments", selectedTournamentId);
        const tournamentSnap = await getDoc(tournamentRef);

        if (tournamentSnap.exists()) {
          setSelectedTournament({
            id: tournamentSnap.id,
            ...(tournamentSnap.data() as Omit<Tournament, "id">),
          });
        } else {
          setSelectedTournament(null);
        }

        const eventsSnapshot = await getDocs(
          collection(db, "tournaments", selectedTournamentId, "events")
        );

        const loadedEvents = eventsSnapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdminEvent, "id">),
        }));

        setEvents(loadedEvents);
      } catch (error) {
        console.error(error);
        setStatusMessage("There was a problem loading events.");
      } finally {
        setLoadingEvents(false);
      }
    }

    if (isAdmin) {
      loadSelectedTournamentAndEvents();
    }
  }, [selectedTournamentId, isAdmin]);

  async function refreshTournaments() {
    const snapshot = await getDocs(collection(db, "tournaments"));
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Tournament, "id">),
    }));
    setTournaments(data);
  }

  async function refreshEvents(tournamentId: string) {
    const eventsSnapshot = await getDocs(
      collection(db, "tournaments", tournamentId, "events")
    );

    const loadedEvents = eventsSnapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminEvent, "id">),
    }));

    setEvents(loadedEvents);
  }

  async function handleCreateTournament() {
    const trimmedId = newTournamentId.trim();
    const trimmedName = newTournamentName.trim();
    const trimmedCity = newTournamentCity.trim();
    const trimmedDates = newTournamentDates.trim();
    const trimmedHotel = newTournamentHotel.trim();

    if (!trimmedId || !trimmedName || !trimmedCity || !trimmedDates || !trimmedHotel) {
      setStatusMessage("Please complete all tournament fields.");
      return;
    }

    try {
      await setDoc(doc(db, "tournaments", trimmedId), {
        name: trimmedName,
        city: trimmedCity,
        dates: trimmedDates,
        hotel: trimmedHotel,
      });

      setStatusMessage(`Tournament "${trimmedName}" created.`);

      setNewTournamentId("");
      setNewTournamentName("");
      setNewTournamentCity("");
      setNewTournamentDates("");
      setNewTournamentHotel("");

      await refreshTournaments();
    } catch (error) {
      console.error(error);
      setStatusMessage("There was a problem creating the tournament.");
    }
  }

  async function handleCreateEvent() {
    if (!selectedTournamentId) {
      setStatusMessage("Please select a tournament first.");
      return;
    }

    const trimmedTitle = newEventTitle.trim();
    const trimmedDateLabel = newEventDateLabel.trim();
    const trimmedLocation = newEventLocation.trim();

    if (!trimmedTitle || !trimmedDateLabel || !trimmedLocation) {
      setStatusMessage("Please complete all event fields.");
      return;
    }

    try {
      await addDoc(collection(db, "tournaments", selectedTournamentId, "events"), {
        title: trimmedTitle,
        type: newEventType,
        dateLabel: trimmedDateLabel,
        location: trimmedLocation,
      });

      setStatusMessage(`Event "${trimmedTitle}" added.`);

      setNewEventTitle("");
      setNewEventType("Dinner");
      setNewEventDateLabel("");
      setNewEventLocation("");

      await refreshEvents(selectedTournamentId);
    } catch (error) {
      console.error(error);
      setStatusMessage("There was a problem creating the event.");
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          Loading...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Please Log In</h1>
          <p className="mt-2 text-slate-600">
            You need to be logged in to access the admin page.
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
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-slate-600">
            Your account is not authorized for admin access.
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              G1 Football Academy
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Admin Panel
            </h1>
            <p className="mt-2 text-slate-600">
              Create tournaments and manage tournament events inside the app.
            </p>
            <p className="mt-2 text-sm text-slate-500">Logged in as: {user.email}</p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-slate-300 px-5 py-3 font-medium"
          >
            Back to Home
          </Link>
        </div>

        {statusMessage && (
          <div className="mb-6 rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
            {statusMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Create Tournament</h2>
            <p className="mt-2 text-slate-600">
              Add a new tournament that families can see on the home screen.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tournament ID
                </label>
                <input
                  type="text"
                  value={newTournamentId}
                  onChange={(e) => setNewTournamentId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: houston-2026"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: Houston Tournament"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  City
                </label>
                <input
                  type="text"
                  value={newTournamentCity}
                  onChange={(e) => setNewTournamentCity(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: Houston, TX"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Dates
                </label>
                <input
                  type="text"
                  value={newTournamentDates}
                  onChange={(e) => setNewTournamentDates(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: April 17–19, 2026"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Hotel
                </label>
                <input
                  type="text"
                  value={newTournamentHotel}
                  onChange={(e) => setNewTournamentHotel(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: The Westin Galleria Houston"
                />
              </div>

              <button
                onClick={handleCreateTournament}
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white"
              >
                Create Tournament
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Existing Tournaments</h2>
            <p className="mt-2 text-slate-600">
              Select a tournament to view and add its events.
            </p>

            <div className="mt-6">
              {loadingTournaments ? (
                <p className="text-slate-600">Loading tournaments...</p>
              ) : tournaments.length === 0 ? (
                <p className="text-slate-600">No tournaments found yet.</p>
              ) : (
                <div className="space-y-3">
                  {tournaments.map((tournament) => (
                    <button
                      key={tournament.id}
                      onClick={() => setSelectedTournamentId(tournament.id)}
                      className={`w-full rounded-2xl border p-4 text-left ${
                        selectedTournamentId === tournament.id
                          ? "border-slate-900 bg-slate-100"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="text-lg font-semibold">{tournament.name}</p>
                      <p className="text-sm text-slate-600">{tournament.city}</p>
                      <p className="text-sm text-slate-500">{tournament.dates}</p>
                      <p className="text-sm text-slate-500">Hotel: {tournament.hotel}</p>
                      <p className="mt-2 text-xs text-slate-400">ID: {tournament.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Create Event</h2>
            <p className="mt-2 text-slate-600">
              Add a dinner or activity to the selected tournament.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Selected tournament:{" "}
              <span className="font-semibold">
                {selectedTournament ? selectedTournament.name : "None selected"}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Event Title
                </label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: Team Dinner"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Event Type
                </label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as "Dinner" | "Activity")}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                >
                  <option value="Dinner">Dinner</option>
                  <option value="Activity">Activity</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Date / Time Label
                </label>
                <input
                  type="text"
                  value={newEventDateLabel}
                  onChange={(e) => setNewEventDateLabel(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: Friday · 7:00 PM"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Location
                </label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="example: Hotel Restaurant"
                />
              </div>

              <button
                onClick={handleCreateEvent}
                className="w-full rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white"
              >
                Add Event
              </button>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Tournament Events</h2>
            <p className="mt-2 text-slate-600">
              Events currently attached to the selected tournament.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Selected tournament:{" "}
              <span className="font-semibold">
                {selectedTournament ? selectedTournament.name : "None selected"}
              </span>
            </div>

            <div className="mt-6">
              {!selectedTournamentId ? (
                <p className="text-slate-600">Select a tournament to view events.</p>
              ) : loadingEvents ? (
                <p className="text-slate-600">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-slate-600">No events added yet.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {event.type}
                      </div>
                      <p className="mt-3 text-lg font-semibold">{event.title}</p>
                      <p className="text-sm text-slate-600">{event.dateLabel}</p>
                      <p className="text-sm text-slate-500">{event.location}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}