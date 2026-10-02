import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, Course, CourseDocument, Organization } from "../services/api";

interface AnnalsScreenProps {
  onBack: () => void;
}

const PERIODS = ["S1", "S2", "S3", "S4", "S5"];

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1048576) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1048576).toFixed(1)} MB`;
}

export function AnnalsScreen({ onBack }: AnnalsScreenProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseQuery, setCourseQuery] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [docQuery, setDocQuery] = useState("");
  const [period, setPeriod] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [sort, setSort] = useState<"recent" | "downloads">("recent");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadPeriod, setUploadPeriod] = useState("");
  const [uploadYear, setUploadYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Uploads record which campus the paper came from; the map is built once when
  // the joined campuses arrive, before any upload can happen.
  const campusByOrganizationRef = useRef<Map<string, string>>(new Map());

  const loadCourses = useCallback(async (orgId: string, search: string) => {
    setLoadingCourses(true);
    try {
      setCourses(await api.getCourses({ organizationId: orgId, search: search || undefined }));
    } catch (err: any) {
      toast.error(err.message || "Failed to load courses");
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  // Courses and documents both live under an organization, so the school list
  // is built from the campuses the student already joined.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const campuses = await api.getMyCampuses();
        if (cancelled) return;
        const seen = new Map<string, Organization>();
        const campusByOrg = new Map<string, string>();
        for (const campus of campuses) {
          if (!seen.has(campus.organization.id)) {
            seen.set(campus.organization.id, campus.organization);
            campusByOrg.set(campus.organization.id, campus.id);
          }
        }
        setOrganizations([...seen.values()]);
        campusByOrganizationRef.current = campusByOrg;
        const first = seen.values().next().value;
        if (first) {
          setOrganizationId(first.id);
          await loadCourses(first.id, "");
        }
      } catch (err: any) {
        if (!cancelled) toast.error(err.message || "Failed to load your schools");
      } finally {
        if (!cancelled) setLoadingOrganizations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCourses]);

  useEffect(() => {
    const search = courseQuery.trim();
    if (!organizationId) return;
    const timer = window.setTimeout(() => {
      loadCourses(organizationId, search);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [courseQuery, organizationId, loadCourses]);

  const loadDocuments = useCallback(async () => {
    if (!course) return;
    setLoadingDocuments(true);
    try {
      setDocuments(
        await api.getDocuments(course.id, {
          search: docQuery.trim() || undefined,
          period: period || undefined,
          academicYear: academicYear.trim() || undefined,
          sort,
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setLoadingDocuments(false);
    }
  }, [course, docQuery, period, academicYear, sort]);

  useEffect(() => {
    if (!course) return;
    const timer = window.setTimeout(loadDocuments, 350);
    return () => window.clearTimeout(timer);
  }, [course, loadDocuments]);

  async function selectOrganization(orgId: string) {
    setOrganizationId(orgId);
    setCourse(null);
    setDocuments([]);
    setCourseQuery("");
    await loadCourses(orgId, "");
  }

  async function handleCreateCourse(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!organizationId || newCourseName.trim().length < 2) return;
    setCreatingCourse(true);
    const result = await api.createCourse(organizationId, newCourseName.trim());
    setCreatingCourse(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Course created");
    setNewCourseName("");
    await loadCourses(organizationId, courseQuery.trim());
  }

  async function handleUpload() {
    const file = fileInput.current?.files?.[0];
    if (!course || !file) {
      toast.error("Choose a PDF, PNG or JPEG file first.");
      return;
    }
    setUploading(true);
    const result = await api.uploadDocument(course.id, {
      file,
      title: uploadTitle.trim() || undefined,
      period: uploadPeriod || undefined,
      academicYear: uploadYear.trim() || undefined,
      campusId: campusByOrganizationRef.current.get(course.organizationId),
    });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    setUploadTitle("");
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Uploaded — waiting for a moderator to approve it.");
    await Promise.all([loadDocuments(), loadCourses(course.organizationId, courseQuery.trim())]);
  }

  async function handleDownload(doc: CourseDocument) {
    setBusyId(doc.id);
    const result = await api.getDownloadUrl(doc.id);
    setBusyId(null);
    if (!result.success || !result.url) {
      toast.error(result.error);
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = result.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function handleStatus(doc: CourseDocument, status: "approved" | "rejected") {
    setBusyId(doc.id);
    const result = await api.setDocumentStatus(doc.id, status);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (status === "approved") await loadDocuments();
    else setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  async function handleDelete(doc: CourseDocument) {
    setBusyId(doc.id);
    const result = await api.deleteDocument(doc.id);
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  if (loadingOrganizations) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="tt-skeleton h-8 w-40" />
          <div className="tt-skeleton h-24" />
          <div className="tt-skeleton h-24" />
          <div className="tt-skeleton h-24" />
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="tt-fade-up mx-auto max-w-2xl space-y-5 pb-8">
          <button
            onClick={onBack}
            className="tt-btn -ml-2 gap-2 p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
          <div className="tt-card tt-ring-brand p-8 text-center">
            <div className="tt-glass mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-muted-foreground">
              <BookOpen size={22} />
            </div>
            <p className="text-sm text-muted-foreground">
              Join a campus first — past papers are shared inside your school.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (course) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="tt-fade-up mx-auto max-w-2xl space-y-6 pb-8">
          <button
            onClick={() => {
              const orgId = course.organizationId;
              setCourse(null);
              setDocuments([]);
              void loadCourses(orgId, courseQuery.trim());
            }}
            className="tt-btn -ml-2 gap-2 p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">All courses</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="tt-brand-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight text-foreground">{course.name}</h2>
              <p className="truncate text-[11px] font-mono text-muted-foreground">{course.organizationName}</p>
            </div>
          </div>

          <section className="tt-card space-y-3 p-5">
            <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Add a past paper
            </h3>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="tt-field w-full px-4 py-3 text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-primary-foreground"
            />
            <input
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Title — defaults to the file name"
              className="tt-field w-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={uploadPeriod}
                onChange={(event) => setUploadPeriod(event.target.value)}
                className="tt-field px-4 py-2.5 text-sm text-foreground"
              >
                <option value="">Semester</option>
                {PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                value={uploadYear}
                onChange={(event) => setUploadYear(event.target.value)}
                placeholder="2025-2026"
                className="tt-field min-w-[120px] flex-1 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="tt-btn tt-btn-brand shrink-0 px-5 py-2.5 text-sm"
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={docQuery}
                  onChange={(event) => setDocQuery(event.target.value)}
                  placeholder="Search titles…"
                  className="tt-field w-full py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="tt-field px-3 py-2.5 text-xs text-foreground"
              >
                <option value="">All semesters</option>
                {PERIODS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <input
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                placeholder="Year"
                className="tt-field w-28 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as "recent" | "downloads")}
                className="tt-field px-3 py-2.5 text-xs text-foreground"
              >
                <option value="recent">Newest</option>
                <option value="downloads">Most downloaded</option>
              </select>
            </div>

            {loadingDocuments && (
              <div className="space-y-2.5">
                <div className="tt-skeleton h-[72px]" />
                <div className="tt-skeleton h-[72px]" />
                <div className="tt-skeleton h-[72px]" />
              </div>
            )}

            {!loadingDocuments && documents.length === 0 && (
              <div className="tt-card p-8 text-center">
                <div className="tt-glass mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-muted-foreground">
                  <FileText size={20} />
                </div>
                <p className="text-sm text-muted-foreground">No past paper matches these filters yet.</p>
              </div>
            )}

            <div className="tt-stagger space-y-2.5">
              {documents.map((doc) => (
                <div key={doc.id} className="tt-card tt-card-hover group px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="tt-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors group-hover:text-foreground">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{doc.title}</p>
                      <p className="truncate text-[11px] font-mono text-muted-foreground">
                        {doc.period ? `${doc.period} · ` : ""}
                        {doc.academicYear ? `${doc.academicYear} · ` : ""}
                        {formatBytes(doc.sizeBytes)} · {doc.downloads} downloads
                        {doc.status !== "approved" ? ` · ${doc.status}` : ""}
                      </p>
                      {doc.isMine && doc.status === "pending" && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Only you see this until a moderator approves it.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={busyId === doc.id}
                        className="tt-btn p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground md:opacity-50 md:group-hover:opacity-100"
                        aria-label="Télécharger"
                      >
                        <Download size={14} />
                      </button>
                      {doc.canModerate && doc.status !== "approved" && (
                        <button
                          onClick={() => handleStatus(doc, "approved")}
                          disabled={busyId === doc.id}
                          className="tt-btn p-2 text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                          aria-label="Approuver"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {doc.canModerate && doc.status !== "rejected" && (
                        <button
                          onClick={() => handleStatus(doc, "rejected")}
                          disabled={busyId === doc.id}
                          className="tt-btn p-2 text-destructive transition-colors hover:bg-destructive/10"
                          aria-label="Rejeter"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {(doc.isMine || doc.canModerate) && (
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={busyId === doc.id}
                          className="tt-btn p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="tt-fade-up mx-auto max-w-2xl space-y-6 pb-8">
        <button
          onClick={onBack}
          className="tt-btn -ml-2 gap-2 p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        {organizations.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => selectOrganization(org.id)}
                className={`px-4 py-1.5 text-xs ${
                  org.id === organizationId
                    ? "tt-btn tt-btn-brand"
                    : "tt-btn tt-btn-ghost text-muted-foreground hover:text-foreground"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Courses</h2>
          <div className="relative">
            <BookOpen size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="Search a course…"
              className="tt-field w-full py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {loadingCourses && (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="tt-skeleton h-[96px]" />
              <div className="tt-skeleton h-[96px]" />
              <div className="tt-skeleton h-[96px]" />
              <div className="tt-skeleton h-[96px]" />
            </div>
          )}

          {!loadingCourses && courses.length === 0 && (
            <p className="tt-card p-6 text-center text-sm text-muted-foreground">
              No course yet. Add the first one below so students can share its papers.
            </p>
          )}

          <div className="tt-stagger grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {courses.map((item) => (
              <button
                key={item.id}
                onClick={() => setCourse(item)}
                className="tt-card tt-card-hover group flex items-center gap-3 p-4 text-left"
              >
                <span className="tt-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors group-hover:text-foreground">
                  <BookOpen size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                  <span className="block truncate text-[11px] font-mono text-muted-foreground">{item.slug}</span>
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    {item.documentCount} paper{item.documentCount === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleCreateCourse}
          className="tt-card flex items-end gap-3 p-5"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              New course
            </span>
            <input
              value={newCourseName}
              onChange={(event) => setNewCourseName(event.target.value)}
              placeholder="Databases — Advanced SQL"
              className="tt-field mt-1 w-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </label>
          <button
            type="submit"
            disabled={creatingCourse || newCourseName.trim().length < 2}
            className="tt-btn tt-btn-brand shrink-0 px-5 py-3 text-sm"
          >
            <Plus size={13} />
            {creatingCourse ? "…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
