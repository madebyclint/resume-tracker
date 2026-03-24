/**
 * Analytics service — fire-and-forget, never throws.
 * Batches events and flushes to /api/analytics/events.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_SIZE = 10;

export type EventType = 'page_view' | 'session' | 'job' | 'feature' | 'search' | 'error';

interface QueuedEvent {
  sessionId: string;
  eventType: EventType;
  eventName: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

class AnalyticsService {
  private queue: QueuedEvent[] = [];
  private enabled = true;
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.startFlushTimer();

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private getOrCreateSessionId(): string {
    try {
      const key = 'analytics_session_id';
      const existing = sessionStorage.getItem(key);
      if (existing) return existing;
      const id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      // Discard queued events when going into dev mode
      this.queue = [];
    }
  }

  track(eventType: EventType, eventName: string, properties?: Record<string, unknown>) {
    if (!this.enabled) return;

    this.queue.push({
      sessionId: this.sessionId,
      eventType,
      eventName,
      properties,
      createdAt: new Date().toISOString(),
    });

    if (this.queue.length >= FLUSH_SIZE) {
      this.flush();
    }
  }

  flush() {
    if (!this.enabled || this.queue.length === 0) return;

    const batch = this.queue.splice(0, 50);

    const token = localStorage.getItem('auth_token');
    if (!token) return; // not logged in — discard

    // Fire-and-forget
    fetch(`${API_BASE_URL}/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
      // keepalive allows delivery during page unload
      keepalive: true,
    }).catch(() => {
      // Silently discard — analytics failures must never break the app
    });
  }
}

export const analytics = new AnalyticsService();
