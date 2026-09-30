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
    toast.error("Your session has expired. Please sign in again.");
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
        return { success: false, error: data.error || 'Registration failed' };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
        return { success: false, error: data.error || 'Login failed' };
      }
      this.setToken(data.token);
      this.setUser(data.user);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
        return { success: false, error: data.error || 'Google Sign-In failed' };
      }
      this.setToken(data.token);
      this.setUser(data.user);
      return { success: true, token: data.token, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
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
        return { success: false, error: data.error || 'Failed to update profile' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getMe(): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const response = await this.fetchWithAuth('/auth/me');
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch profile' };
      }
      this.setUser(data.user);
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
        return { success: false, error: data.error || 'Failed to add bookmark' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async deleteBookmark(contentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/content/bookmarks/${contentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete bookmark' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async leaveCampus(campusId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/campuses/${campusId}/membership`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to leave this campus' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
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
        return { success: false, error: data.error || 'Failed to update the document' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/documents/${documentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to remove the document' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async leaveGroup(groupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/groups/${groupId}/membership`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to leave this group' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async cancelRsvp(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchWithAuth(`/events/${eventId}/rsvp`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to remove your response' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
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
      return { success: false, error: err.message || 'Network error' };
    }
  }
};
