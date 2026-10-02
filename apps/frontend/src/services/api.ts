import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const REFRESH_BEFORE_EXPIRY_MS = 10 * 60 * 1000;

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  picture?: string | null;
}

export interface Content {
  id: string;
  title: string;
  url: string;
  source: string;
  type: 'article' | 'video' | 'social_post';
  summary: string | null;
  body?: string | null;
  categories?: string[] | null;
  embedCode: string | null;
  createdAt: string;
}

export type CampusRole = 'member' | 'moderator' | 'admin';

export interface Campus {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  city: string | null;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  organization: { id: string; name: string; slug: string };
  myRole: CampusRole | null;
}

export interface CampusMember {
  userId: string;
  name: string;
  picture: string | null;
  role: CampusRole;
  joinedAt: string;
  email?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Course {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  organizationName: string;
  documentCount: number;
}

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export type TagKind = 'topic' | 'skill' | 'language' | 'tool';

export interface TagRef {
  id: string;
  slug: string;
  name: string;
  kind: TagKind;
  usageCount?: number;
}

/** One item of /api/feed: the content plus why the ranker placed it here. */
export interface FeedItem extends Content {
  author: string | null;
  publishedAt: string | null;
  tags: TagRef[];
  score: number;
  reasons: string[];
  liked: boolean;
  saved: boolean;
  seen: boolean;
  matched: boolean;
  matchedTags: string[];
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
  strategy: string;
}

/** §13 / §80 — the append-only behaviour log the backend accepts. */
export type InteractionType =
  | 'view'
  | 'like'
  | 'unlike'
  | 'save'
  | 'unsave'
  | 'share'
  | 'click'
  | 'skip'
  | 'open_external';

export type InteractionSurface =
  | 'feed'
  | 'shorts'
  | 'search'
  | 'explore'
  | 'content'
  | 'topic'
  | 'push';

export interface InteractionInput {
  contentId: string;
  type: InteractionType;
  surface?: InteractionSurface;
  context?: Record<string, string | number | boolean>;
}

export interface InteractionSummary {
  days: number;
  totals: { type: InteractionType; count: number }[];
  topTags: { slug: string; name: string; count: number }[];
}

export interface SearchResults {
  query: string;
  contents: Content[];
  tags: { id: string; slug: string; name: string; kind: TagKind; usageCount: number }[];
  projects: Project[];
}

export interface InterestTag {
  id: string;
  slug: string;
  name: string;
  kind: TagKind;
}

export type ProfileVisibility = 'public' | 'private' | 'school_only';

export type UserLevel = (typeof USER_LEVELS)[number];
export const USER_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;

export type ProjectStatus = 'idea' | 'planned' | 'in_progress' | 'completed' | 'abandoned';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  technologies: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  status: ProjectStatus;
  createdAt: string;
  owner: { id: string; name: string; picture: string | null };
}

export interface MyProfilePayload {
  profile: {
    bio: string | null;
    level: UserLevel;
    learningGoals: string[];
    preferredLanguages: string[];
    visibility: ProfileVisibility;
    onboardedAt: string | null;
  } | null;
  user: { id: string; name: string; email: string; username: string | null; picture: string | null } | null;
  interests: InterestTag[];
  settings: Record<string, unknown>;
}

export interface GroupMember {
  userId: string;
  role: 'member' | 'host';
  joinedAt: string;
  name: string;
  picture: string | null;
}

export interface Group {
  id: string;
  campusId: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  capacity: number | null;
  createdBy: string | null;
  createdAt: string;
  memberCount: number;
  myRole: 'member' | 'host' | null;
  campus?: { id: string; name: string; slug: string; city: string | null };
}

export type RsvpStatus = 'going' | 'interested';

export interface CampusEvent {
  id: string;
  campusId: string;
  groupId: string | null;
  title: string;
  description: string | null;
  location: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  status: 'scheduled' | 'cancelled';
  createdBy: string | null;
  createdAt: string;
  goingCount: number;
  myRsvp: RsvpStatus | null;
  seatsLeft: number | null;
  campus?: { id: string; name: string; slug: string; city: string | null };
}

export interface CourseDocument {
  id: string;
  courseId: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  period: string | null;
  academicYear: string | null;
  status: DocumentStatus;
  downloads: number;
  uploaderId: string | null;
  createdAt: string;
  isMine: boolean;
  canModerate: boolean;
}

export const api = {
  getToken(): string | null {
    return localStorage.getItem('teachtalk_token');
  },

  setToken(token: string): void {
    localStorage.setItem('teachtalk_token', token);
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('teachtalk_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: User): void {
    localStorage.setItem('teachtalk_user', JSON.stringify(user));
  },

  logout(): void {
    localStorage.removeItem('teachtalk_token');
    localStorage.removeItem('teachtalk_user');
  },

  handleSessionExpired(): void {
    this.logout();
    toast.error("Votre session a expiré. Connectez-vous à nouveau.");
    setTimeout(() => window.location.reload(), 1500);
  },

  _refreshing: null as Promise<boolean> | null,

  decodeToken(token: string): Record<string, any> | null {
    try {
      const base64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
      if (!base64) return null;
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  },

  async tryRefresh(): Promise<boolean> {
    if (this._refreshing) return this._refreshing;
    const token = this.getToken();
    if (!token) return false;
    this._refreshing = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) return false;
        this.setToken(data.token);
        if (data.user) this.setUser(data.user);
        return true;
      } catch {
        return false;
      } finally {
        this._refreshing = null;
      }
    })();
    return this._refreshing;
  },

  scheduleTokenRefresh(): void {
    const token = this.getToken();
    if (!token) return;
    const payload = this.decodeToken(token);
    if (!payload || typeof payload.exp !== "number") return;
    const remainingMs = payload.exp * 1000 - Date.now();
    if (remainingMs <= 0) {
      this.tryRefresh();
      return;
    }
    const delay = Math.max(0, remainingMs - REFRESH_BEFORE_EXPIRY_MS);
    window.setTimeout(() => {
      this.tryRefresh().then((success) => {
        if (success) this.scheduleTokenRefresh();
      });
    }, delay);
  },

  async fetchWithAuth(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (response.status === 401 && retry) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.fetchWithAuth(path, options, false);
      }
      this.handleSessionExpired();
    }
    return response;
  },

  async register(name: string, email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Inscription impossible' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async login(email: string, password: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Connexion impossible' };
      }
      this.setToken(data.token);
      this.setUser(data.user);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async googleLogin(credential: string): Promise<{ success: boolean; token?: string; user?: User; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Échec de la connexion Google' };
      }
      this.setToken(data.token);
      this.setUser(data.user);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  /** §49 OAuth: the browser is handed to the backend, which redirects to GitHub. */
  githubStartUrl(): string {
    return `${API_URL}/auth/github`;
  },

  /** The callback returns the JWT in the URL fragment; adopt it, then load /me. */
  async adoptGithubToken(token: string): Promise<{ success: boolean; user?: User; error?: string }> {
    this.setToken(token);
    const me = await this.getMe();
    if (!me.success) {
      this.logout();
      return { success: false, error: me.error || 'Échec de la connexion GitHub' };
    }
    return { success: true, user: me.user };
  },

  async updateProfile(name: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de mettre à jour le profil' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getMe(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/me');
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de charger le profil' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getContents(limit?: number, offset?: number, search?: string, type?: string, categories?: string[]): Promise<Content[]> {
    const url = new URL(`${API_URL}/content`);
    if (limit !== undefined) url.searchParams.append('limit', limit.toString());
    if (offset !== undefined) url.searchParams.append('offset', offset.toString());
    if (search) url.searchParams.append('search', search);
    if (type) url.searchParams.append('type', type);
    if (categories && categories.length > 0) url.searchParams.append('categories', categories.join(','));

    const response = await this.fetchWithAuth(`/content${url.search}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.statusText}`);
    }
    return response.json();
  },

  async getBookmarks(): Promise<Content[]> {
    const response = await this.fetchWithAuth('/content/bookmarks');
    if (!response.ok) {
      throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
    }
    return response.json();
  },

  async addBookmark(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/content/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible d’enregistrer le favori' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async deleteBookmark(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/content/bookmarks/${contentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de retirer le favori' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getLikes(): Promise<string[]> {
    const response = await this.fetchWithAuth('/content/likes');
    if (!response.ok) {
      throw new Error(`Impossible de récupérer les likes : ${response.statusText}`);
    }
    const data = await response.json();
    return data.likedIds ?? [];
  },

  async addLike(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/content/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible d’enregistrer le like' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async deleteLike(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/content/likes/${contentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de retirer le like' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async createContent(input: { title: string; url: string; source: string; type: string; summary?: string }): Promise<{ success: boolean; content?: Content; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de créer le contenu' };
      }
      return { success: true, content: data.content };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async markContentRead(contentId: string): Promise<void> {
    try {
      await this.fetchWithAuth('/content/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentId }),
      });
    } catch (err) {
      console.error("Failed to sync read marker:", err);
    }
  },

  async syncReadingBatch(contentIds: string[]): Promise<void> {
    if (contentIds.length === 0) return;
    try {
      await this.fetchWithAuth('/content/read/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentIds }),
      });
    } catch (err) {
      console.error("Failed to sync reading batch:", err);
    }
  },

  async getServerReading(): Promise<{ readIds: string[]; readDates: string[] } | null> {
    try {
      const response = await this.fetchWithAuth('/content/read');
      if (!response.ok) return null;
      const data = await response.json();
      return { readIds: Array.isArray(data.readIds) ? data.readIds : [], readDates: Array.isArray(data.readDates) ? data.readDates : [] };
    } catch (err) {
      console.error("Failed to fetch server reading history:", err);
      return null;
    }
  },

  async getOrganizations(): Promise<Organization[]> {
    const response = await this.fetchWithAuth('/organizations');
    if (!response.ok) {
      throw new Error(`Failed to fetch organizations: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.organizations) ? data.organizations : [];
  },

  async getCampuses(options: { search?: string; organizationId?: string } = {}): Promise<Campus[]> {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.organizationId) params.set('organizationId', options.organizationId);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/campuses${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch campuses: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.campuses) ? data.campuses : [];
  },

  async getMyCampuses(): Promise<Campus[]> {
    const response = await this.fetchWithAuth('/campuses/mine');
    if (!response.ok) {
      throw new Error(`Failed to fetch your campuses: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.campuses) ? data.campuses : [];
  },

  async getCampusMembers(campusId: string): Promise<CampusMember[]> {
    const response = await this.fetchWithAuth(`/campuses/${campusId}/members`);
    if (!response.ok) {
      throw new Error(`Failed to fetch campus members: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.members) ? data.members : [];
  },

  async joinCampus(campusId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/campuses/${campusId}/join`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to join this campus' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async leaveCampus(campusId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/campuses/${campusId}/membership`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de quitter ce campus' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getCourses(options: { organizationId?: string; search?: string } = {}): Promise<Course[]> {
    const params = new URLSearchParams();
    if (options.organizationId) params.set('organizationId', options.organizationId);
    if (options.search) params.set('search', options.search);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/courses${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch courses: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.courses) ? data.courses : [];
  },

  async createCourse(organizationId: string, name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, name }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to create the course' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getDocuments(
    courseId: string,
    options: { search?: string; period?: string; academicYear?: string; sort?: 'recent' | 'downloads' } = {}
  ): Promise<CourseDocument[]> {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.period) params.set('period', options.period);
    if (options.academicYear) params.set('academicYear', options.academicYear);
    if (options.sort) params.set('sort', options.sort);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/courses/${courseId}/documents${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch documents: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.documents) ? data.documents : [];
  },

  // No Content-Type header here: the browser has to add the multipart boundary itself.
  async uploadDocument(
    courseId: string,
    input: { file: File; title?: string; period?: string; academicYear?: string; campusId?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const form = new FormData();
      form.append('file', input.file);
      if (input.title) form.append('title', input.title);
      if (input.period) form.append('period', input.period);
      if (input.academicYear) form.append('academicYear', input.academicYear);
      if (input.campusId) form.append('campusId', input.campusId);

      const response = await this.fetchWithAuth(`/courses/${courseId}/documents`, {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Upload failed' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  /** Returns a short-lived presigned bucket URL; the file never passes through the API. */
  async getDownloadUrl(documentId: string): Promise<{ success: boolean; url?: string; fileName?: string; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/documents/${documentId}/download`);
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Download is not available' };
      }
      return { success: true, url: data.url, fileName: data.fileName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async setDocumentStatus(documentId: string, status: DocumentStatus): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/documents/${documentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de mettre à jour le document' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/documents/${documentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de supprimer le document' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getMyGroups(): Promise<Group[]> {
    const response = await this.fetchWithAuth('/groups/mine');
    if (!response.ok) {
      throw new Error(`Failed to fetch your groups: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.groups) ? data.groups : [];
  },

  async getCampusGroups(campusId: string, options: { search?: string; sort?: 'recent' | 'popular' | 'name' } = {}): Promise<Group[]> {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.sort) params.set('sort', options.sort);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/campuses/${campusId}/groups${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.groups) ? data.groups : [];
  },

  async createGroup(campusId: string, input: { name: string; topic?: string; description?: string; capacity?: number | null }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/campuses/${campusId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to create the group' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async joinGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/groups/${groupId}/join`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to join this group' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async leaveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/groups/${groupId}/membership`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de quitter ce groupe' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getMyEvents(): Promise<CampusEvent[]> {
    const response = await this.fetchWithAuth('/events/mine');
    if (!response.ok) {
      throw new Error(`Failed to fetch your events: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.events) ? data.events : [];
  },

  async getCampusEvents(campusId: string, options: { includePast?: boolean } = {}): Promise<CampusEvent[]> {
    const query = options.includePast ? '?includePast=true' : '';

    const response = await this.fetchWithAuth(`/campuses/${campusId}/events${query}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data.events) ? data.events : [];
  },

  async createEvent(campusId: string, input: { title: string; location: string; startsAt: string; endsAt?: string; description?: string; capacity?: number | null }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/campuses/${campusId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) {
        const fields = data.fields ? Object.values(data.fields).flat().join(' ') : '';
        return { success: false, error: data.error || fields || data.message || 'Failed to create the event' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async rsvpEvent(eventId: string, status: RsvpStatus): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to save your response' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async cancelRsvp(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/events/${eventId}/rsvp`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Impossible de retirer votre réponse' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async cancelEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || data.message || 'Failed to cancel the event' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  /* ------------------------------------------------------------------
     Discovery: taxonomy (§9), personalized feed (§10/§11), profile
     (§14-§17) and the behaviour log (§13/§80).
  ------------------------------------------------------------------ */

  async getFeed(options: {
    limit?: number;
    cursor?: string;
    type?: 'article' | 'video' | 'social_post';
    source?: string;
    shape?: 'short' | 'long';
    match?: 'all' | 'interests';
  } = {}): Promise<FeedPage> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.type) params.set('type', options.type);
    if (options.source) params.set('source', options.source);
    if (options.shape) params.set('shape', options.shape);
    if (options.match) params.set('match', options.match);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/feed${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('feed_unavailable');
    const data = await response.json();
    return {
      items: Array.isArray(data.items) ? data.items : [],
      nextCursor: data.nextCursor ?? null,
      strategy: String(data.strategy ?? 'hybrid'),
    };
  },

  async getContent(contentId: string): Promise<{ content: Content; tags: TagRef[] }> {
    const response = await this.fetchWithAuth(`/content/${contentId}`);
    if (!response.ok) throw new Error('content_unavailable');
    const data = await response.json();
    return { content: data.content, tags: Array.isArray(data.tags) ? data.tags : [] };
  },

  async getTags(options: { kind?: TagKind; q?: string; limit?: number } = {}): Promise<TagRef[]> {
    const params = new URLSearchParams();
    if (options.kind) params.set('kind', options.kind);
    if (options.q) params.set('q', options.q);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();

    const response = await this.fetchWithAuth(`/tags${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('tags_unavailable');
    const data = await response.json();
    return Array.isArray(data.tags) ? data.tags : [];
  },

  async getTagContents(slug: string, options: { limit?: number; offset?: number } = {}): Promise<{ tag: TagRef; contents: Content[]; total: number }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    const response = await this.fetchWithAuth(`/tags/${encodeURIComponent(slug)}/contents?${params}`);
    if (!response.ok) throw new Error('tag_unavailable');
    const data = await response.json();
    return { tag: data.tag, contents: Array.isArray(data.contents) ? data.contents : [], total: Number(data.total ?? 0) };
  },

  /** Public projects only (§48): a student's work is invisible until they publish it. */
  async getProjects(options: { limit?: number; q?: string; status?: ProjectStatus } = {}): Promise<Project[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.q) params.set('q', options.q);
    if (options.status) params.set('status', options.status);
    const query = params.toString();

    const response = await this.fetchWithAuth(`/projects${query ? `?${query}` : ''}`);
    if (!response.ok) throw new Error('projects_unavailable');
    const data = await response.json();
    return Array.isArray(data.projects) ? data.projects : [];
  },

  /** §35 / §56: one query across contents, tags and public projects. */
  async search(q: string, limit = 8): Promise<SearchResults> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    const response = await this.fetchWithAuth(`/search?${params}`);
    if (!response.ok) throw new Error('search_unavailable');
    const data = await response.json();
    return {
      query: data.query ?? q,
      contents: Array.isArray(data.contents) ? data.contents : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  },

  async getMyProfile(): Promise<MyProfilePayload> {
    const response = await this.fetchWithAuth('/users/me/profile');
    if (!response.ok) throw new Error('profile_unavailable');
    const data = await response.json();
    return {
      profile: data.profile ?? null,
      user: data.user ?? null,
      interests: Array.isArray(data.interests) ? data.interests : [],
      settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
    };
  },

  async updateMyProfile(patch: {
    username?: string;
    bio?: string | null;
    level?: UserLevel;
    learningGoals?: string[];
    preferredLanguages?: string[];
    visibility?: ProfileVisibility;
  }): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const response = await this.fetchWithAuth('/users/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || data.error || 'Impossible de enregistrer le profil' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async getMyInterests(): Promise<InterestTag[]> {
    const response = await this.fetchWithAuth('/users/me/interests');
    if (!response.ok) throw new Error('interests_unavailable');
    const data = await response.json();
    return Array.isArray(data.tags) ? data.tags : [];
  },

  async saveMyInterests(slugs: string[]): Promise<{ success: boolean; error?: string; tags?: InterestTag[] }> {
    try {
      const response = await this.fetchWithAuth('/users/me/interests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: slugs }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || data.error || 'Centres d’intérêt non enregistrés' };
      return { success: true, tags: Array.isArray(data.tags) ? data.tags : [] };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  async savePreferences(settings: Record<string, string | number | boolean | string[]>): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth('/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /** §16: goals, interests and the "done" stamp travel in one request. */
  async completeOnboarding(input: {
    tags?: string[];
    level?: UserLevel;
    learningGoals?: string[];
    preferredLanguages?: string[];
    bio?: string;
    username?: string;
    skipped?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/users/me/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || data.error || 'Onboarding non enregistré' };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur réseau' };
    }
  },

  /** Fire-and-forget: telemetry must never block or fail what the user sees. */
  async recordInteractions(items: InteractionInput[], options: { keepalive?: boolean } = {}): Promise<boolean> {
    try {
      const response = await this.fetchWithAuth('/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        keepalive: options.keepalive ?? false,
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /** §80: aggregated view of the user's own behaviour log over a window. */
  async getInteractionSummary(days = 30): Promise<InteractionSummary> {
    const response = await this.fetchWithAuth(`/interactions/summary?days=${days}`);
    if (!response.ok) throw new Error('interaction_summary_unavailable');
    const data = await response.json();
    return {
      days: data.days ?? days,
      totals: Array.isArray(data.totals) ? data.totals : [],
      topTags: Array.isArray(data.topTags) ? data.topTags : [],
    };
  }
};
