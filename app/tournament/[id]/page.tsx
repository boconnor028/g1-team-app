"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

type AttendanceStatus = "yes" | "no" | "maybe" | "";
type EventResponse = "yes" | "no" | "maybe";

type TripEvent = {
  id: string;
  title: string;
  type: "Dinner" | "Activity";
  dateLabel: string;
  location: string;
  response: EventResponse;
  guestCount: number;
};

type Tournament = {
  name: string;
  city: string;
  dates: string;
  hotel: string;
};

export default function TournamentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loadingTournament, setLoadingTournament] = useState(true);

  const [attendance, setAttendance] = useState<AttendanceStatus>("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalHour, setArrivalHour] = useState("6");
  const [arrivalMinute, setArrivalMinute] = useState("15");
  const [arrivalPeriod, setArrivalPeriod] = useState("PM");
  const [hotelReservationName, setHotelReservationName] = useState("");
  const [familyCount, setFamilyCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const hourOptions = useMemo(
    () => ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    []
  );

  const minuteOptions = useMemo(() => ["00", "15", "30", "45"], []);

  const formattedArrival = useMemo(() => {
    if (!arrivalDate) {
      return `Not selected at ${arrivalHour}:${arrivalMinute} ${arrivalPeriod}`;
    }

    const date = new Date(`${arrivalDate}T12:00:00`);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${formattedDate} at ${arrivalHour}:${arrivalMinute} ${arrivalPeriod}`;
  }, [arrivalDate, arrivalHour, arrivalMinute, arrivalPeriod]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadTournamentAndEvents() {
      try {
        setLoadingTournament(true);

        const tournamentRef = doc(db, "tournaments", id);
        const tournamentSnap = await getDoc(tournamentRef);

        if (!tournamentSnap.exists()) {
          setTournament(null);
          setEvents([]);
          return;
        }

        setTournament(tournamentSnap.data() as Tournament);

        const eventsSnapshot = await getDocs(
          collection(db, "tournaments", id, "events")
        );

        const loadedEvents: TripEvent[] = eventsSnapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          title: eventDoc.data().title || "",
          type: (eventDoc.data().type || "Activity") as "Dinner" | "Activity",
          dateLabel: eventDoc.data().dateLabel || "",
          location: eventDoc.data().location || "",
          response: "no",
          guestCount: 0,
        }));

        setEvents(loadedEvents);
      } catch (error) {
        console.error(error);
        setStatusMessage("There was a problem loading the tournament.");
      } finally {
        setLoadingTournament(false);
      }
    }

    if (id) {
      loadTournamentAndEvents();
    }
  }, [id]);

  useEffect(() => {
    async function loadTournamentResponse() {
      if (!user || !tournament) return;

      const responseId = `${user.uid}_${id}`;
      const docRef = doc(db, "responses", responseId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        setAttendance((data.attendance as AttendanceStatus) || "");
        setArrivalDate(data.arrivalDate || "");
        setArrivalHour(data.arrivalHour || "6");
        setArrivalMinute(data.arrivalMinute || "15");
        setArrivalPeriod(data.arrivalPeriod || "PM");
        setHotelReservationName(data.hotelReservationName || "");
        setFamilyCount(data.familyCount || 0);

        const savedEvents = (data.events as TripEvent[]) || [];
        setEvents((currentEvents) =>
          currentEvents.map((event) => {
            const savedEvent = savedEvents.find((e) => e.id === event.id);
            return savedEvent
              ? {
                  ...event,
                  response: savedEvent.response,
                  guestCount: savedEvent.guestCount,
                }
              : event;
          })
        );

        setStatusMessage("Saved response loaded.");
      } else {
        setAttendance("");
        setArrivalDate("");
        setArrivalHour("6");
        setArrivalMinute("15");
        setArrivalPeriod("PM");
        setHotelReservationName("");
        setFamilyCount(0);
        setStatusMessage("");
      }
    }

    loadTournamentResponse();
  }, [user, id, tournament]);

  function responseButtonClass(
    current: EventResponse | AttendanceStatus,
    selected: EventResponse
  ) {
    if (current === selected) {
      if (selected === "yes") return "bg-emerald-600 text-white";
      if (selected === "no") return "bg-slate-900 text-white";
      return "bg-blue-600 text-white";
    }

    return "border border-slate-300 bg-white";
  }

  function updateEventResponse(eventId: string, response: EventResponse) {
    setEvents((prevEvents) =>
      prevEvents.map((event) => {
        if (event.id !== eventId) return event;

        return {
          ...event,
          response,
          guestCount:
            response === "yes"
              ? Math.min(event.guestCount || familyCount, familyCount)
              : 0,
        };
      })
    );
  }

  function updateEventGuestCount(eventId: string, guestCount: number) {
    setEvents((prevEvents) =>
      prevEvents.map((event) =>
        event.id === eventId
          ? {
              ...event,
              guestCount,
            }
          : event
      )
    );
  }

  async function saveResponse() {
    if (!user || !tournament) return;

    try {
      const responseId = `${user.uid}_${id}`;

      await setDoc(doc(db, "responses", responseId), {
        userId: user.uid,
        userEmail: user.email || "",
        tournamentId: id,
        tournamentName: tournament.name,
        attendance,
        arrivalDate,
        arrivalHour,
        arrivalMinute,
        arrivalPeriod,
        hotelReservationName,
        familyCount,
        events,
        updatedAt: new Date().toISOString(),
      });

      setStatusMessage("Response saved successfully.");
    } catch (error) {
      console.error(error);
      setStatusMessage("There was a problem saving your response.");
    }
  }

  if (!authChecked || loadingTournament) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-lg font-medium">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Please Log In</h1>
          <p className="mt-2 text-slate-600">
            You need to be logged in to view and save tournament responses.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-slate-900"
          >
            ← Back to login
          </Link>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Tournament Not Found</h1>
          <p className="mt-2 text-slate-600">
            We could not find that tournament.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-slate-900"
          >
            ← Back to tournament home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/" className="text-sm font-medium text-slate-900">
            ← Back to tournament home
          </Link>
        </div>

        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            {tournament.city}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {tournament.name}
          </h1>
          <p className="mt-2 text-slate-600">{tournament.dates}</p>
          <p className="mt-1 text-sm text-slate-500">
            Hotel: {tournament.hotel}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Logged in as: {user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Trip Attendance</h2>
            <p className="mt-2 text-slate-600">
              Let the team know whether your family will attend this tournament.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAttendance("yes")}
                className={`rounded-2xl px-4 py-2 ${responseButtonClass(attendance, "yes")}`}
              >
                Yes
              </button>
              <button
                onClick={() => setAttendance("no")}
                className={`rounded-2xl px-4 py-2 ${responseButtonClass(attendance, "no")}`}
              >
                No
              </button>
              <button
                onClick={() => setAttendance("maybe")}
                className={`rounded-2xl px-4 py-2 ${responseButtonClass(attendance, "maybe")}`}
              >
                Maybe
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Current response:{" "}
              <span className="font-semibold">
                {attendance ? attendance.toUpperCase() : "Not selected"}
              </span>
            </p>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Arrival Info</h2>
            <p className="mt-2 text-slate-600">
              Enter your hotel reservation name and expected arrival details.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Hotel Reservation Name
                </label>
                <input
                  type="text"
                  value={hotelReservationName}
                  onChange={(e) => setHotelReservationName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  placeholder="Enter the name on the hotel reservation"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Arrival Day
                </label>
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Arrival Time
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={arrivalHour}
                    onChange={(e) => setArrivalHour(e.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  >
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>

                  <select
                    value={arrivalMinute}
                    onChange={(e) => setArrivalMinute(e.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  >
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>

                  <select
                    value={arrivalPeriod}
                    onChange={(e) => setArrivalPeriod(e.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 p-3"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                Reservation name:{" "}
                <span className="font-semibold">
                  {hotelReservationName || "Not entered"}
                </span>
              </p>
              <p>
                Current arrival:{" "}
                <span className="font-semibold">{formattedArrival}</span>
              </p>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
            <h2 className="text-xl font-semibold">Family Members Attending</h2>
            <p className="mt-2 text-slate-600">
              Select the total number of people attending this trip including the athlete.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Total Attending
              </label>

              <select
                value={familyCount}
                onChange={(e) => {
                  const newCount = Number(e.target.value);
                  setFamilyCount(newCount);

                  setEvents((prevEvents) =>
                    prevEvents.map((event) => ({
                      ...event,
                      guestCount:
                        event.response === "yes"
                          ? Math.min(event.guestCount, newCount)
                          : 0,
                    }))
                  );
                }}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Total attending: <span className="font-semibold">{familyCount}</span>
            </p>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
            <h2 className="text-xl font-semibold">Dinner & Activities</h2>
            <p className="mt-2 text-slate-600">
              Respond to optional dinners and activities for this tournament.
            </p>

            <div className="mt-6 space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {event.type}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold">{event.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{event.dateLabel}</p>
                      <p className="mt-1 text-sm text-slate-500">{event.location}</p>
                    </div>

                    <div className="w-full max-w-md space-y-4">
                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">
                          Will you attend?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateEventResponse(event.id, "yes")}
                            className={`rounded-2xl px-4 py-2 ${responseButtonClass(
                              event.response,
                              "yes"
                            )}`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => updateEventResponse(event.id, "no")}
                            className={`rounded-2xl px-4 py-2 ${responseButtonClass(
                              event.response,
                              "no"
                            )}`}
                          >
                            No
                          </button>
                          <button
                            onClick={() => updateEventResponse(event.id, "maybe")}
                            className={`rounded-2xl px-4 py-2 ${responseButtonClass(
                              event.response,
                              "maybe"
                            )}`}
                          >
                            Maybe
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Number of guests attending
                        </label>
                        <select
                          value={event.guestCount}
                          disabled={event.response !== "yes" || familyCount === 0}
                          onChange={(e) =>
                            updateEventGuestCount(event.id, Number(e.target.value))
                          }
                          className="w-full rounded-2xl border border-slate-300 bg-white p-3 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          {Array.from({ length: familyCount + 1 }, (_, i) => i).map((num) => (
                            <option key={num} value={num}>
                              {num}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          Max allowed: {familyCount} total family members attending the trip.
                        </p>
                      </div>

                      <p className="text-sm text-slate-600">
                        Current RSVP:{" "}
                        <span className="font-semibold uppercase">{event.response}</span>
                        {" · "}
                        Guests: <span className="font-semibold">{event.guestCount}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm md:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Save Response</h2>
                <p className="mt-2 text-slate-600">
                  Save your family’s response for this tournament.
                </p>
              </div>

              <button
                onClick={saveResponse}
                className="rounded-2xl bg-slate-900 px-6 py-3 font-medium text-white"
              >
                Save Tournament Response
              </button>
            </div>

            {statusMessage && (
              <p className="mt-4 text-sm text-slate-600">{statusMessage}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}