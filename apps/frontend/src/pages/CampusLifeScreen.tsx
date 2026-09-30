import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  MapPin,
  Plus,
  Search,
  Ticket,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, Campus, CampusEvent, Group, RsvpStatus } from "../services/api";

interface CampusLifeScreenProps {
  onBack: () => void;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function seatsLabel(event: CampusEvent): string {
  if (event.status === "cancelled") return "Cancelled";
  if (event.seatsLeft === null) return `${event.goingCount} going`;
  return event.seatsLeft === 0 ? "Full" : `${event.seatsLeft} seats left`;
}

export function CampusLifeScreen({ onBack }: CampusLifeScreenProps) {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState<string | null>(null);
  const [view, setView] = useState<"groups" | "events">("groups");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [campusGroups, setCampusGroups] = useState<Group[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupTopic, setGroupTopic] = useState("");
  const [groupCapacity, setGroupCapacity] = useState("");

  const [myEvents, setMyEvents] = useState<CampusEvent[]>([]);
  const [campusEvents, setCampusEvents] = useState<CampusEvent[]>([]);
  const [includePast, setIncludePast] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventCapacity, setEventCapacity] = useState("");

  const refreshGroups = useCallback(async (selectedCampusId: string | null, search: string) => {
    const [mine, all] = await Promise.all([
      api.getMyGroups(),
      selectedCampusId ? api.getCampusGroups(selectedCampusId, { search: search || undefined }) : Promise.resolve([]),
    ]);
    setMyGroups(mine);
    setCampusGroups(all);
  }, []);

  const refreshEvents = useCallback(async (selectedCampusId: string | null, past: boolean) => {
    const [mine, all] = await Promise.all([
      api.getMyEvents(),
      selectedCampusId ? api.getCampusEvents(selectedCampusId, { includePast: past }) : Promise.resolve([]),
    ]);
    setMyEvents(mine);
    setCampusEvents(all);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const joined = await api.getMyCampuses();
        if (cancelled) return;
        setCampuses(joined);
        setUserId(api.getUser()?.id ?? null);
        if (joined.length > 0) setCampusId(joined[0].id);
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || "Failed to load your campuses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = window.setTimeout(() => {
      const run = view === "groups" ? refreshGroups(campusId, groupQuery.trim()) : refreshEvents(campusId, includePast);
      run.catch((err: any) => toast.error(err.message || "Load failed"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [view, campusId, groupQuery, includePast, loading, refreshGroups, refreshEvents]);

  async function handleJoinGroup(group: Group) {
    setBusyId(group.id);
    const result = await api.joinGroup(group.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`You joined ${group.name}`);
    await refreshGroups(campusId, groupQuery.trim());
  }

  async function handleLeaveGroup(group: Group) {
    setBusyId(group.id);
    const result = await api.leaveGroup(group.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    await refreshGroups(campusId, groupQuery.trim());
  }

  async function handleCreateGroup() {
    if (!campusId || groupName.trim().length < 2) return;
    const result = await api.createGroup(campusId, {
      name: groupName.trim(),
      topic: groupTopic.trim() || undefined,
      capacity: groupCapacity.trim() ? Number(groupCapacity) : null,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Group created — you host it.");
    setGroupName("");
    setGroupTopic("");
    setGroupCapacity("");
    await refreshGroups(campusId, groupQuery.trim());
  }

  async function handleRsvp(event: CampusEvent, status: RsvpStatus) {
    setBusyId(event.id);
    const result = event.myRsvp === status ? await api.cancelRsvp(event.id) : await api.rsvpEvent(event.id, status);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    await refreshEvents(campusId, includePast);
  }

  async function handleCancelEvent(event: CampusEvent) {
    setBusyId(event.id);
    const result = await api.cancelEvent(event.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    await refreshEvents(campusId, includePast);
  }

  async function handleCreateEvent() {
    if (!campusId) return;
    if (!eventTitle.trim() || !eventLocation.trim() || !eventStartsAt) {
      toast.error("Title, place and date are required.");
      return;
    }
    const result = await api.createEvent(campusId, {
      title: eventTitle.trim(),
      location: eventLocation.trim(),
      startsAt: new Date(eventStartsAt).toISOString(),
      capacity: eventCapacity.trim() ? Number(eventCapacity) : null,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Event created.");
    setEventTitle("");
    setEventLocation("");
    setEventStartsAt("");
    setEventCapacity("");
    await refreshEvents(campusId, includePast);
  }

  if (loading) {
    return (
      <div className="tt-scrollbar flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4 pb-8">
          <div className="tt-skeleton h-8 w-36 rounded-full" />
          <div className="tt-skeleton h-12 rounded-full" />
          <div className="tt-skeleton h-28 rounded-2xl" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (campuses.length === 0) {
    return (
      <div className="tt-scrollbar flex-1 overflow-y-auto px-4 py-6">
        <div className="tt-fade-up mx-auto max-w-2xl space-y-6 pb-8">
          <button
            onClick={onBack}
            className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
          <div className="tt-card tt-ring-brand p-8 text-center">
            <div className="tt-glass tt-btn mx-auto mb-4 h-14 w-14 rounded-full text-muted-foreground">
              <Users size={22} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Join a campus to meet its students.</p>
          </div>
        </div>
      </div>
    );
  }

  const groupedIds = new Set(myGroups.map((group) => group.id));
  const sectionTitle = "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground";
  const inputClass = "tt-field w-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground";

  return (
    <div className="tt-scrollbar flex-1 overflow-y-auto px-4 py-6">
      <div className="tt-fade-up mx-auto max-w-2xl space-y-7 pb-8">
        <button
          onClick={onBack}
          className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex flex-wrap gap-2">
          {campuses.map((campus) => (
            <button
              key={campus.id}
              onClick={() => setCampusId(campus.id)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                campus.id === campusId
                  ? "border-transparent bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {campus.organization.name} — {campus.name}
            </button>
          ))}
        </div>

        <div className="tt-surface flex gap-1 rounded-full p-1">
          {(["groups", "events"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors ${
                view === key ? "bg-surface-3 text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "groups" ? <Users size={13} /> : <Calendar size={13} />}
              {key === "groups" ? "Groups" : "Events"}
            </button>
          ))}
        </div>

        {view === "groups" ? (
          <>
            <section className="space-y-4">
              <h2 className={sectionTitle}>My groups · {myGroups.length}</h2>
              {myGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">You have not joined a group yet.</p>
              )}
              <div className="tt-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
                {myGroups.map((group) => (
                  <div key={group.id} className="tt-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{group.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {group.campus?.name ?? "campus"} · {group.memberCount} members
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {group.myRole}
                      </span>
                    </div>
                    <button
                      onClick={() => handleLeaveGroup(group)}
                      disabled={busyId === group.id}
                      className="mt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      Leave
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className={sectionTitle}>Groups on this campus</h2>
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Search a group…"
                  className="tt-field w-full py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="tt-stagger grid grid-cols-1 gap-3 md:grid-cols-2">
                {campusGroups
                  .filter((group) => !groupedIds.has(group.id))
                  .map((group) => (
                    <div key={group.id} className="tt-card tt-card-hover flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{group.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {group.topic ? `${group.topic} · ` : ""}
                          {group.capacity === null
                            ? `${group.memberCount} members`
                            : `${group.memberCount}/${group.capacity} members`}
                        </p>
                        {group.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleJoinGroup(group)}
                        disabled={busyId === group.id || (group.capacity !== null && group.memberCount >= group.capacity)}
                        className="tt-btn tt-btn-brand shrink-0 gap-1.5 px-4 py-2 text-xs"
                      >
                        <UserPlus size={12} />
                        {group.capacity !== null && group.memberCount >= group.capacity ? "Full" : "Join"}
                      </button>
                    </div>
                  ))}
              </div>

              {campusGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">No group here yet — start one below.</p>
              )}
            </section>

            <section className="tt-card space-y-3 p-5">
              <h3 className={sectionTitle}>New group</h3>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Revision — System Administration"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  value={groupTopic}
                  onChange={(event) => setGroupTopic(event.target.value)}
                  placeholder="topic (revision, sport…)"
                  className={`${inputClass} flex-1`}
                />
                <input
                  value={groupCapacity}
                  onChange={(event) => setGroupCapacity(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="max"
                  inputMode="numeric"
                  className={`${inputClass} w-20`}
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={groupName.trim().length < 2}
                  className="tt-btn tt-btn-brand shrink-0 gap-1.5 px-4 py-2.5 text-sm"
                >
                  <Plus size={13} />
                  Create
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className={sectionTitle}>On this campus</h2>
                <button
                  onClick={() => setIncludePast((prev) => !prev)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {includePast ? "Upcoming only" : "Include past"}
                </button>
              </div>

              <div className="tt-stagger space-y-3">
                {campusEvents.map((event) => (
                  <div key={event.id} className="tt-card p-4">
                    <div className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-0.5 w-1 shrink-0 self-stretch rounded-full"
                        style={{ background: "var(--brand-gradient)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-tight text-foreground">{event.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{formatWhen(event.startsAt)}</p>
                            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <MapPin size={11} />
                              {event.location}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                            {seatsLabel(event)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleRsvp(event, "going")}
                            disabled={busyId === event.id || event.status === "cancelled"}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              event.myRsvp === "going"
                                ? "bg-primary text-primary-foreground shadow-glow"
                                : "border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Check size={12} />
                            Going
                          </button>
                          <button
                            onClick={() => handleRsvp(event, "interested")}
                            disabled={busyId === event.id || event.status === "cancelled"}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                              event.myRsvp === "interested"
                                ? "bg-primary text-primary-foreground shadow-glow"
                                : "border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Ticket size={12} />
                            Interested
                          </button>
                          {userId && event.createdBy === userId && event.status === "scheduled" && (
                            <button
                              onClick={() => handleCancelEvent(event)}
                              disabled={busyId === event.id}
                              className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                            >
                              Cancel event
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {campusEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
              )}
            </section>

            <section className="space-y-4">
              <h2 className={sectionTitle}>Mine · {myEvents.length}</h2>
              <div className="tt-stagger space-y-3">
                {myEvents.map((event) => (
                  <div key={event.id} className="tt-card flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-tight text-foreground">{event.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {event.campus?.name ?? "campus"} · {formatWhen(event.startsAt)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {event.myRsvp ?? (event.createdBy === userId ? "hosting" : "—")}
                    </span>
                  </div>
                ))}
              </div>
              {myEvents.length === 0 && <p className="text-sm text-muted-foreground">No event linked to you yet.</p>}
            </section>

            <section className="tt-card space-y-3 p-5">
              <h3 className={sectionTitle}>New event</h3>
              <input
                value={eventTitle}
                onChange={(event) => setEventTitle(event.target.value)}
                placeholder="After-work C++ — pizza and past exams"
                className={inputClass}
              />
              <input
                value={eventLocation}
                onChange={(event) => setEventLocation(event.target.value)}
                placeholder="Place — Bloc C, room 302"
                className={inputClass}
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={eventStartsAt}
                  onChange={(event) => setEventStartsAt(event.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <input
                  value={eventCapacity}
                  onChange={(event) => setEventCapacity(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="max"
                  inputMode="numeric"
                  className={`${inputClass} w-20`}
                />
              </div>
              <button
                onClick={handleCreateEvent}
                disabled={eventTitle.trim().length < 3 || !eventLocation.trim() || !eventStartsAt}
                className="tt-btn tt-btn-brand w-full gap-1.5 px-4 py-2.5 text-sm"
              >
                <Plus size={13} />
                Create event
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
