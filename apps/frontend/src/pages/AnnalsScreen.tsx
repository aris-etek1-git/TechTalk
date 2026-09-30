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
    return <div className="flex-1 overflow-y-auto px-4 py-5 text-sm text-muted-foreground">Loading…</div>;
  }

  if (organizations.length === 0) {
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
        <div className="max-w-2xl mx-auto space-y-5 pb-8">
          <button
            onClick={() => {
              const orgId = course.organizationId;
              setCourse(null);
              setDocuments([]);
              void loadCourses(orgId, courseQuery.trim());
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">All courses</span>
          </button>

          <div>
            <h2 className="text-lg font-semibold text-foreground">{course.name}</h2>
            <p className="text-[11px] font-mono text-muted-foreground">{course.organizationName}</p>
          </div>

          <section className="space-y-3 p-4 rounded-2xl bg-secondary border border-border">
            <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">
              Add a past paper
            </h3>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="text-xs text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-[11px]"
            />
            <input
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Title — defaults to the file name"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={uploadPeriod}
                onChange={(event) => setUploadPeriod(event.target.value)}
                className="px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={docQuery}
                  onChange={(event) => setDocQuery(event.target.value)}
                  placeholder="Search titles…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="px-2.5 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground"
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
                className="w-24 px-2.5 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground"
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as "recent" | "downloads")}
                className="px-2.5 py-2 rounded-xl bg-secondary border border-border text-xs text-foreground"
              >
                <option value="recent">Newest</option>
                <option value="downloads">Most downloaded</option>
              </select>
            </div>

            {loadingDocuments && <p className="text-sm text-muted-foreground">Loading…</p>}

            {!loadingDocuments && documents.length === 0 && (
              <p className="text-sm text-muted-foreground">No past paper matches these filters yet.</p>
            )}

            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="p-3 rounded-xl bg-secondary border border-border">
                  <div className="flex items-start gap-3">
                    <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {doc.period ? `${doc.period} · ` : ""}
                        {doc.academicYear ? `${doc.academicYear} · ` : ""}
                        {formatBytes(doc.sizeBytes)} · {doc.downloads} downloads
                        {doc.status !== "approved" ? ` · ${doc.status}` : ""}
                      </p>
                      {doc.isMine && doc.status === "pending" && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Only you see this until a moderator approves it.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={busyId === doc.id}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors disabled:opacity-50"
                        aria-label="Download"
                      >
                        <Download size={14} />
                      </button>
                      {doc.canModerate && doc.status !== "approved" && (
                        <button
                          onClick={() => handleStatus(doc, "approved")}
                          disabled={busyId === doc.id}
                          className="p-2 rounded-lg text-emerald-500 hover:bg-background transition-colors disabled:opacity-50"
                          aria-label="Approve"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {doc.canModerate && doc.status !== "rejected" && (
                        <button
                          onClick={() => handleStatus(doc, "rejected")}
                          disabled={busyId === doc.id}
                          className="p-2 rounded-lg text-red-500 hover:bg-background transition-colors disabled:opacity-50"
                          aria-label="Reject"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {(doc.isMine || doc.canModerate) && (
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={busyId === doc.id}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-background transition-colors disabled:opacity-50"
                          aria-label="Delete"
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
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
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
                className={`px-3 py-1.5 rounded-full border text-[11px] font-mono transition-colors ${
                  org.id === organizationId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">Courses</h2>
          <div className="relative">
            <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={courseQuery}
              onChange={(event) => setCourseQuery(event.target.value)}
              placeholder="Search a course…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {loadingCourses && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loadingCourses && courses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No course yet. Add the first one below so students can share its papers.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {courses.map((item) => (
              <button
                key={item.id}
                onClick={() => setCourse(item)}
                className="text-left p-3 rounded-xl bg-secondary border border-border hover:border-primary/40 transition-colors"
              >
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">{item.slug}</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {item.documentCount} paper{item.documentCount === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <form
          onSubmit={handleCreateCourse}
          className="space-y-2 p-4 rounded-2xl bg-secondary border border-border flex items-end gap-2"
        >
          <label className="flex-1 space-y-1.5">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">
              New course
            </span>
            <input
              value={newCourseName}
              onChange={(event) => setNewCourseName(event.target.value)}
              placeholder="Databases — Advanced SQL"
              className="w-full mt-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="submit"
            disabled={creatingCourse || newCourseName.trim().length < 2}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus size={13} />
            {creatingCourse ? "…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
