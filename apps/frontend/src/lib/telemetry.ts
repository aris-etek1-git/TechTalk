import { api, InteractionInput } from "../services/api";

/* §13/§80: the behaviour log is append-only, so the client only ever sends new
   events. They are buffered because a click must not wait on the network, and
   because one request per visible card would be a tenth of the feed's traffic. */
const FLUSH_SIZE = 12;
const FLUSH_DELAY_MS = 5000;
/* A card that flashes past the viewport while scrolling is not an impression. */
export const DWELL_MS = 1200;

let buffer: InteractionInput[] = [];
let timer: number | null = null;

const keyOf = (item: InteractionInput) => `${item.contentId}|${item.type}|${item.surface ?? ""}`;

async function send(keepalive: boolean): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (buffer.length === 0) return;
  const items = buffer.splice(0, FLUSH_SIZE * 4);
  // A refused batch is dropped, not retried: events the server rejected (unknown
  // content, expired session) will never become valid later.
  await api.recordInteractions(items, { keepalive });
}

export function flushInteractions(keepalive = false): void {
  void send(keepalive);
}

export function trackInteraction(input: InteractionInput): void {
  if (!api.getToken()) return;
  if (buffer.some((item) => keyOf(item) === keyOf(input))) return;
  buffer.push(input);
  if (buffer.length >= FLUSH_SIZE) {
    flushInteractions();
    return;
  }
  if (timer === null) timer = window.setTimeout(() => flushInteractions(), FLUSH_DELAY_MS);
}

/**
 * Sends whatever is still buffered when the tab hides or unloads. keepalive lets
 * the request survive the navigation, which is the difference between a log and
 * a guess about what the user actually watched.
 */
export function startTelemetryLifecycle(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("pagehide", () => flushInteractions(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushInteractions(true);
  });
}
