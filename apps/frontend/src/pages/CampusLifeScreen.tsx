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
    return <div className="flex-1 overflow-y-auto px-4 py-5 text-sm text-muted-foreground">Loading…</div>;
  }

  if (campuses.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-5 pb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
          <div className="p-5 rounded-2xl bg-secondary border border-border text-center">
            <p className="text-sm text-muted-foreground">Join a campus to meet its students.</p>
          </div>
        </div>
      </div>
    );
  }

  const groupedIds = new Set(myGroups.map((group) => group.id));
  const sectionTitle = "text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]";
  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex flex-wrap gap-2">
          {campuses.map((campus) => (
            <button
              key={campus.id}
              onClick={() => setCampusId(campus.id)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-mono transition-colors ${
                campus.id === campusId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {campus.organization.name} — {campus.name}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-secondary border border-border">
          {(["groups", "events"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                view === key ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "groups" ? <Users size={13} /> : <Calendar size={13} />}
              {key === "groups" ? "Groups" : "Events"}
            </button>
          ))}
        </div>

        {view === "groups" ? (
          <>
            <section className="space-y-3">
              <h2 className={sectionTitle}>My groups · {myGroups.length}</h2>
              {myGroups.length === 0 && (
                <p className="text-sm text-muted-foreground">You have not joined a group yet.</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {myGroups.map((group) => (
                  <div key={group.id} className="p-3 rounded-xl bg-secondary border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {group.campus?.name ?? "campus"} · {group.memberCount} members
                        </p>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary/80 shrink-0">
                        {group.myRole}
                      </span>
                    </div>
                    <button
                      onClick={() => handleLeaveGroup(group)}
                      disabled={busyId === group.id}
                      className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Leave
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className={sectionTitle}>Groups on this campus</h2>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  placeholder="Search a group…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {campusGroups
                  .filter((group) => !groupedIds.has(group.id))
                  .map((group) => (
                    <div key={group.id} className="p-3 rounded-xl bg-secondary border border-border flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {group.topic ? `${group.topic} · ` : ""}
                          {group.capacity === null
                            ? `${group.memberCount} members`
                            : `${group.memberCount}/${group.capacity} members`}
                        </p>
                        {group.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{group.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleJoinGroup(group)}
                        disabled={busyId === group.id || (group.capacity !== null && group.memberCount >= group.capacity)}
                        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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

            <section className="space-y-2 p-4 rounded-2xl bg-secondary border border-border">
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
                  className="shrink-0 flex items-center gap-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Plus size={13} />
                  Create
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className={sectionTitle}>On this campus</h2>
                <button
                  onClick={() => setIncludePast((prev) => !prev)}
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  {includePast ? "Upcoming only" : "Include past"}
                </button>
              </div>

              <div className="space-y-2">
                {campusEvents.map((event) => (
                  <div key={event.id} className="p-3 rounded-xl bg-secondary border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">{formatWhen(event.startsAt)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 truncate">
                          <MapPin size={11} />
                          {event.location}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                        {seatsLabel(event)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        onClick={() => handleRsvp(event, "going")}
                        disabled={busyId === event.id || event.status === "cancelled"}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${
                          event.myRsvp === "going"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Check size={12} />
                        Going
                      </button>
                      <button
                        onClick={() => handleRsvp(event, "interested")}
                        disabled={busyId === event.id || event.status === "cancelled"}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${
                          event.myRsvp === "interested"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Ticket size={12} />
                        Interested
                      </button>
                      {userId && event.createdBy === userId && event.status === "scheduled" && (
                        <button
                          onClick={() => handleCancelEvent(event)}
                          disabled={busyId === event.id}
                          className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          Cancel event
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {campusEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className={sectionTitle}>Mine · {myEvents.length}</h2>
              <div className="space-y-2">
                {myEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-xl bg-secondary border border-border flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {event.campus?.name ?? "campus"} · {formatWhen(event.startsAt)}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                      {event.myRsvp ?? (event.createdBy === userId ? "hosting" : "—")}
                    </span>
                  </div>
                ))}
              </div>
              {myEvents.length === 0 && <p className="text-sm text-muted-foreground">No event linked to you yet.</p>}
            </section>

            <section className="space-y-2 p-4 rounded-2xl bg-secondary border border-border">
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
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
