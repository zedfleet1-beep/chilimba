/**
 * Evolution API client.
 * Inspired by techproof's implementation for robustness.
 */
import { env } from '@/env';
import { logger } from './logger';

const DEFAULTS = {
  timeoutMs: 30_000,
  retryAttempts: 3,
  retryInitialDelayMs: 1_000,
  retryMaxDelayMs: 10_000,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Evolution request timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function backoffDelay(attempt: number) {
  const exp = DEFAULTS.retryInitialDelayMs * 2 ** attempt;
  const capped = Math.min(exp, DEFAULTS.retryMaxDelayMs);
  const jitter = capped * Math.random() * 0.25;
  return Math.floor(capped + jitter);
}

function isRetriable(response: Response | null, error: any): boolean {
  if (error) return true; // network/timeout
  if (!response) return false;
  return response.status >= 500 || response.status === 429;
}

export interface EvolutionResult {
  ok: boolean;
  status?: number;
  data?: any;
  error?: string;
}

export interface WhatsAppGroupOption {
  jid: string;
  name: string;
  participantCount?: number;
}

async function evolutionRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<EvolutionResult> {
  if (!env.EVOLUTION_ENABLED) {
    return { ok: false, error: 'WhatsApp is not enabled on this server' };
  }

  const baseUrl = env.EVOLUTION_URL.replace(/\/$/, '');
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    apikey: env.EVOLUTION_API_KEY,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= DEFAULTS.retryAttempts; attempt++) {
    try {
      const response = await withTimeout(
        fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        }),
        DEFAULTS.timeoutMs,
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        return { ok: true, status: response.status, data };
      }
      lastError = new Error(`Evolution API responded ${response.status}: ${JSON.stringify(data)}`);
      if (!isRetriable(response, null)) break;
    } catch (err) {
      lastError = err;
      if (!isRetriable(null, err)) break;
    }
    if (attempt < DEFAULTS.retryAttempts) {
      await sleep(backoffDelay(attempt));
    }
  }

  return {
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function normalizeGroupJid(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('@g.us')) return trimmed.replace(/\s/g, '');
  return `${trimmed.replace(/\D/g, '')}@g.us`;
}

function parseGroupsPayload(data: unknown): WhatsAppGroupOption[] {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { groups?: unknown })?.groups)
      ? (data as { groups: unknown[] }).groups
      : Array.isArray((data as { response?: unknown })?.response)
        ? (data as { response: unknown[] }).response
        : [];

  const out: WhatsAppGroupOption[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const jidRaw = (r.id ?? r.jid ?? r.remoteJid ?? r.groupJid) as string | undefined;
    if (!jidRaw || typeof jidRaw !== 'string') continue;
    const jid = normalizeGroupJid(jidRaw);
    const name = String(r.subject ?? r.name ?? r.pushName ?? 'WhatsApp group');
    const participantCount =
      typeof r.size === 'number'
        ? r.size
        : typeof r.participants === 'number'
          ? r.participants
          : Array.isArray(r.participants)
            ? r.participants.length
            : undefined;
    out.push({ jid, name, participantCount });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Groups the connected Evolution instance has joined. */
export async function fetchWhatsAppGroups(): Promise<{ groups: WhatsAppGroupOption[]; error?: string }> {
  const instance = encodeURIComponent(env.EVOLUTION_INSTANCE);
  const attempts = [
    () => evolutionRequest('GET', `/group/fetchAllGroups/${instance}?getParticipants=false`),
    () => evolutionRequest('GET', `/group/fetchAllGroups/${instance}`),
    () => evolutionRequest('POST', `/group/fetchAllGroups/${instance}`, { getParticipants: false }),
  ];

  for (const run of attempts) {
    const result = await run();
    if (result.ok) {
      const groups = parseGroupsPayload(result.data);
      if (groups.length > 0) return { groups };
    }
  }

  const last = await attempts[0]();
  return { groups: [], error: last.error ?? 'Could not load WhatsApp groups' };
}

/** Best-effort display phone for the linked WhatsApp business line. */
export async function fetchEvolutionDisplayPhone(): Promise<string | null> {
  if (env.CHILIMBA_WHATSAPP_PHONE) {
    return env.CHILIMBA_WHATSAPP_PHONE;
  }
  const instance = encodeURIComponent(env.EVOLUTION_INSTANCE);
  const result = await evolutionRequest('GET', `/instance/connectionState/${instance}`);
  if (!result.ok) return null;
  const data = result.data as Record<string, unknown> | undefined;
  const nested = data?.instance as Record<string, unknown> | undefined;
  const phone = (nested?.owner ?? data?.owner ?? data?.number ?? data?.phone) as string | undefined;
  return phone ? phone.replace(/\s/g, '') : null;
}

/**
 * Send a text message via Evolution API.
 * Strips '+' from phone number as required by the API.
 */
export async function sendWhatsAppText(phone: string, text: string): Promise<EvolutionResult> {
  if (!env.EVOLUTION_ENABLED) {
    logger.info({ phone }, 'WhatsApp send skipped (EVOLUTION_ENABLED=false)');
    return { ok: true, data: { skipped: true } };
  }

  const isGroupJid = phone.includes('@g.us');
  const number = isGroupJid ? phone.replace(/\s/g, '') : phone.replace(/[^0-9]/g, '');
  if (!number) {
    return { ok: false, error: 'Empty destination after normalization' };
  }

  const baseUrl = env.EVOLUTION_URL.replace(/\/$/, '');
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`;
  const headers = {
    apikey: env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  };
  const body = { number, text };

  let lastError: any = null;

  for (let attempt = 0; attempt <= DEFAULTS.retryAttempts; attempt++) {
    try {
      const response = await withTimeout(
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
        DEFAULTS.timeoutMs
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return { ok: true, status: response.status, data };
      }

      lastError = new Error(`Evolution API responded ${response.status}: ${JSON.stringify(data)}`);
      if (!isRetriable(response, null)) break;
    } catch (err) {
      lastError = err;
      if (!isRetriable(null, err)) break;
    }

    if (attempt < DEFAULTS.retryAttempts) {
      const delay = backoffDelay(attempt);
      logger.debug({ phone, attempt: attempt + 1, delay, err: lastError?.message }, 'Retrying WhatsApp send');
      await sleep(delay);
    }
  }

  return {
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}
