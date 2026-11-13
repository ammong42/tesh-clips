import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import {
  parseCatalog,
  PLAYLIST_ID,
  VIDEO_ID,
  isRecord,
  type Clip,
} from "../src/lib/catalog";
import { categorize, CLASSIFIER_VERSION, parseOverrides } from "./categorize";
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
type SkipReason =
  | "invalidOrMissingId"
  | "duplicate"
  | "privateOrDeleted"
  | "notEmbeddable"
  | "missingVideo";
export interface ImportReport {
  playlistId: string;
  importedAt: string;
  playlistItems: number;
  imported: number;
  skipped: Record<SkipReason, number>;
  duration: {
    known: number;
    unknown: number;
    totalSeconds: number;
    longestSeconds: number;
  };
}
export function durationSeconds(value: string): number | null {
  const m =
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value,
    );
  if (!m || !m.slice(1).some(Boolean)) return null;
  const result =
    Number(m[1] || 0) * 86400 +
    Number(m[2] || 0) * 3600 +
    Number(m[3] || 0) * 60 +
    Number(m[4] || 0);
  return Number.isFinite(result) ? result : null;
}
// Only emit known labels/instructions and strictly validated caller IP literals,
// never raw API messages, request URLs, keys, or project identifiers.
const ACCESS_DIAGNOSTICS = {
  SERVICE_DISABLED:
    "Enable YouTube Data API v3 in the Google Cloud project that owns this API key (APIs & Services → Library). Enabling it in another project does not enable this key. Wait a few minutes after enabling, then retry.",
  accessNotConfigured:
    "Enable YouTube Data API v3 in the Google Cloud project that owns this API key (APIs & Services → Library). Enabling it in another project does not enable this key. Wait a few minutes after enabling, then retry.",
  API_KEY_SERVICE_BLOCKED:
    "Edit this key in Google Cloud → APIs & Services → Credentials. Under API restrictions, allow YouTube Data API v3.",
  API_KEY_HTTP_REFERRER_BLOCKED:
    "This key has website/referrer restrictions, which do not work for the Node importer. Use a separate CLI key restricted to YouTube Data API v3 and, when stable, your outbound public IP address.",
  API_KEY_IP_ADDRESS_BLOCKED:
    "This key's IP-address restriction does not match this computer's outbound public IP. Update the key's allowed IP in Google Cloud → APIs & Services → Credentials; a VPN/proxy can change the outbound IP.",
  ipRefererBlocked:
    "Check this key's application restrictions in Google Cloud → APIs & Services → Credentials. Website/referrer restrictions do not work for the Node importer; an IP restriction must match your outbound public IP (including any VPN/proxy).",
  API_KEY_INVALID:
    "The key was rejected. Copy the API key from Google Cloud → APIs & Services → Credentials into your ignored .env file. An already-exported YOUTUBE_API_KEY takes precedence over .env; update or unset that older binding before retrying.",
  keyInvalid:
    "The key was rejected. Copy the API key from Google Cloud → APIs & Services → Credentials into your ignored .env file. An already-exported YOUTUBE_API_KEY takes precedence over .env; update or unset that older binding before retrying.",
  API_KEY_EXPIRED:
    "This API key has expired. Replace it with an active key in your ignored .env file or existing YOUTUBE_API_KEY environment binding.",
  playlistItemsNotAccessible:
    "The playlist items are not accessible with this API key. Verify playlist visibility and the playlist ID. Private playlists require owner-authorized OAuth, which this API-key importer does not support.",
  CREDENTIALS_MISSING:
    "YouTube did not recognize a caller credential. Use the latest importer, which sends the key as YouTube's documented key query parameter, and check the printed credential source. Never print or share the request URL.",
  forbidden:
    "YouTube denied this request. This generic reason does not identify a particular setting: check API enablement, the active key's restrictions and playlist visibility. An unregistered-caller response can also indicate that the API did not recognize the supplied credential.",
} as const;

function callerIpDiagnostic(error: Record<string, unknown>): string {
  if (Array.isArray(error.details)) {
    for (const detail of error.details) {
      if (!isRecord(detail) || !isRecord(detail.metadata)) continue;
      const ip = detail.metadata.callerIp;
      if (typeof ip === "string" && isIP(ip))
        return ` Google-observed caller IP: ${ip}. Add this exact address to the IP restrictions on the key actually used by this command.`;
    }
  }
  // Older responses put the caller IP in a fixed sentence. Extract only a
  // validated IP, never print the surrounding message (which may contain keys).
  const messages = [
    error.message,
    ...(Array.isArray(error.errors)
      ? error.errors.filter(isRecord).map((e) => e.message)
      : []),
  ];
  for (const message of messages) {
    if (typeof message !== "string") continue;
    const match =
      /Requests from (?:this )?IP address\s+['"]?([A-Fa-f0-9:.]+)['"]?\s+(?:are|is) blocked/i.exec(
        message,
      );
    if (match && isIP(match[1]))
      return ` Google-observed caller IP: ${match[1]}. Add this exact address to the IP restrictions on the key actually used by this command.`;
    if (
      /Requests from (?:this )?IP address\s+<empty>\s+(?:are|is) blocked/i.test(
        message,
      )
    )
      return " Google reported an empty caller IP. An external IP-check service cannot establish a matching address for this request; check the credential source and proxy route.";
  }
  return " Google did not include a valid caller IP in this rejection. Check that the key being edited is the key used by this command; an exported YOUTUBE_API_KEY overrides .env.";
}

const apiError = (status: number, body: unknown) => {
  const error = isRecord(body) && isRecord(body.error) ? body.error : {};
  // Legacy YouTube errors and modern google.rpc.ErrorInfo use separate arrays.
  const reasons = [error.errors, error.details].flatMap((entries) =>
    Array.isArray(entries) ? entries.filter(isRecord).map((e) => e.reason) : [],
  );
  const specific = Object.keys(ACCESS_DIAGNOSTICS).find((reason) =>
    reasons.includes(reason),
  ) as keyof typeof ACCESS_DIAGNOSTICS | undefined;
  if (specific) {
    const caller =
      specific === "API_KEY_IP_ADDRESS_BLOCKED" ||
      specific === "ipRefererBlocked"
        ? callerIpDiagnostic(error)
        : "";
    return `YouTube API access failed (HTTP ${status}; reason: ${specific}). ${ACCESS_DIAGNOSTICS[specific]}${caller} Existing catalog preserved.`;
  }
  if (
    reasons.includes("quotaExceeded") ||
    reasons.includes("dailyLimitExceeded") ||
    reasons.includes("QUOTA_EXCEEDED") ||
    reasons.includes("RATE_LIMIT_EXCEEDED") ||
    status === 429
  )
    return "YouTube quota exhausted or rate limited. Wait for quota reset (Pacific time) or review quota in Google Cloud; existing catalog preserved.";
  if (status === 404 || reasons.includes("playlistNotFound"))
    return `Playlist ${PLAYLIST_ID} was not found or is inaccessible. Verify the ID and playlist visibility; API-key access requires a public accessible playlist.`;
  if (status === 401 || status === 403 || status === 400)
    return `YouTube API access failed (HTTP ${status}; reason: unspecified). Enable YouTube Data API v3 in the project that owns this key, verify its API/IP restrictions, and check playlist visibility. Google did not provide a recognized specific reason; check the API metrics/errors in that same project's Google Cloud Console. Private playlists require owner-authorized OAuth, which this API-key importer does not support. Existing catalog preserved.`;
  return `YouTube API request failed (HTTP ${status}). Try again later; existing catalog preserved.`;
};
export async function importPlaylist({
  apiKey,
  fetcher = fetch,
  overrides: input = {},
  now = new Date(),
}: {
  apiKey: string | undefined;
  fetcher?: Fetcher;
  overrides?: unknown;
  now?: Date;
}) {
  if (!apiKey?.trim())
    throw new Error(
      "Missing YOUTUBE_API_KEY. Create a YouTube Data API v3 key and set it in your local environment or ignored .env file; see README. Existing catalog preserved.",
    );
  const overrides = parseOverrides(input);
  async function request(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    // YouTube's official discovery spec declares API keys in the query, not
    // only an X-Goog-Api-Key header. Never log this URL or low-level exceptions:
    // both may now contain the key. Keep credentials developer-side and TLS on.
    // https://github.com/googleapis/google-api-nodejs-client/blob/main/discovery/youtube-v3.json
    url.searchParams.set("key", apiKey!);
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        "Cannot reach YouTube Data API (network, TLS, or timeout). Allow www.googleapis.com and preserve TLS verification/proxy settings. Existing catalog preserved.",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        `YouTube returned a non-JSON response (HTTP ${response.status}); existing catalog preserved.`,
      );
    }
    if (!response.ok) throw new Error(apiError(response.status, body));
    if (
      !isRecord(body) ||
      !Array.isArray(body.items) ||
      !body.items.every(isRecord)
    )
      throw new Error(
        "Malformed YouTube API response: expected an items array. Existing catalog preserved.",
      );
    return body;
  }
  const report: ImportReport = {
    playlistId: PLAYLIST_ID,
    importedAt: now.toISOString(),
    playlistItems: 0,
    imported: 0,
    skipped: {
      invalidOrMissingId: 0,
      duplicate: 0,
      privateOrDeleted: 0,
      notEmbeddable: 0,
      missingVideo: 0,
    },
    duration: { known: 0, unknown: 0, totalSeconds: 0, longestSeconds: 0 },
  };
  const entries = new Map<string, number>();
  let pageToken = "";
  const seenTokens = new Set<string>();
  do {
    const page = await request("playlistItems", {
      part: "snippet,contentDetails",
      playlistId: PLAYLIST_ID,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items as Record<string, unknown>[]) {
      const position = report.playlistItems++;
      const snippet = isRecord(item.snippet) ? item.snippet : {};
      const details = isRecord(item.contentDetails) ? item.contentDetails : {};
      const id =
        details.videoId ??
        (isRecord(snippet.resourceId) ? snippet.resourceId.videoId : null);
      if (typeof id !== "string" || !VIDEO_ID.test(id)) {
        report.skipped.invalidOrMissingId++;
        continue;
      }
      if (entries.has(id)) {
        report.skipped.duplicate++;
        continue;
      }
      entries.set(
        id,
        Number.isInteger(snippet.position) && (snippet.position as number) >= 0
          ? (snippet.position as number)
          : position,
      );
    }
    if (
      page.nextPageToken !== undefined &&
      (typeof page.nextPageToken !== "string" || !page.nextPageToken)
    )
      throw new Error(
        "Malformed YouTube pagination token; existing catalog preserved.",
      );
    pageToken = (page.nextPageToken as string) || "";
    if (pageToken && seenTokens.has(pageToken))
      throw new Error(
        "YouTube returned a repeated pagination token; import stopped and existing catalog preserved.",
      );
    seenTokens.add(pageToken);
  } while (pageToken);
  const ids = [...entries.keys()],
    clips: Clip[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    const page = await request("videos", {
      part: "snippet,contentDetails,status",
      id: batch.join(","),
    });
    const videos = new Map<string, Record<string, unknown>>();
    for (const item of page.items as Record<string, unknown>[]) {
      if (
        typeof item.id !== "string" ||
        !batch.includes(item.id) ||
        videos.has(item.id)
      )
        throw new Error(
          "Malformed YouTube video response: unexpected or duplicate video ID; existing catalog preserved.",
        );
      videos.set(item.id, item);
    }
    for (const id of batch) {
      const video = videos.get(id);
      if (!video) {
        report.skipped.missingVideo++;
        continue;
      }
      if (!isRecord(video.status))
        throw new Error(
          "Malformed YouTube response: missing video status; existing catalog preserved.",
        );
      if (
        video.status.privacyStatus === "private" ||
        ["deleted", "rejected", "failed"].includes(
          video.status.uploadStatus as string,
        )
      ) {
        report.skipped.privateOrDeleted++;
        continue;
      }
      if (typeof video.status.embeddable !== "boolean")
        throw new Error(
          "Malformed YouTube response: unknown embeddability; existing catalog preserved.",
        );
      if (!video.status.embeddable) {
        report.skipped.notEmbeddable++;
        continue;
      }
      if (
        !isRecord(video.snippet) ||
        !isRecord(video.contentDetails) ||
        typeof video.snippet.title !== "string" ||
        !video.snippet.title.trim() ||
        typeof video.snippet.description !== "string" ||
        typeof video.snippet.channelTitle !== "string" ||
        typeof video.contentDetails.duration !== "string"
      )
        throw new Error(
          "Malformed YouTube response: missing video metadata; existing catalog preserved.",
        );
      const snippet = video.snippet,
        title = snippet.title as string,
        description = snippet.description as string;
      const thumbnails = isRecord(snippet.thumbnails) ? snippet.thumbnails : {};
      const thumb = [
        thumbnails.high,
        thumbnails.medium,
        thumbnails.default,
      ].find(
        (t) =>
          isRecord(t) &&
          typeof t.url === "string" &&
          t.url.startsWith("https://"),
      );
      clips.push({
        id,
        title,
        description,
        channelTitle: snippet.channelTitle as string,
        thumbnailUrl: isRecord(thumb) ? (thumb.url as string) : null,
        durationSeconds: durationSeconds(video.contentDetails.duration),
        position: entries.get(id)!,
        categories: categorize(id, title, description, overrides),
        embeddable: true,
      });
    }
  }
  if (!clips.length)
    throw new Error(
      `No eligible videos were returned for ${PLAYLIST_ID}. Playlist may be empty, private, removed, or entirely non-embeddable. Check visibility/access; existing catalog preserved. Skipped: ${JSON.stringify(report.skipped)}`,
    );
  clips.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const catalog = parseCatalog({
    schemaVersion: 1,
    playlistId: PLAYLIST_ID,
    importedAt: report.importedAt,
    classifierVersion: CLASSIFIER_VERSION,
    clips,
  });
  report.imported = clips.length;
  for (const clip of clips) {
    if (clip.durationSeconds === null) report.duration.unknown++;
    else {
      report.duration.known++;
      report.duration.totalSeconds += clip.durationSeconds;
      report.duration.longestSeconds = Math.max(
        report.duration.longestSeconds,
        clip.durationSeconds,
      );
    }
  }
  return { catalog, report };
}
export async function writeAtomic(path: string, value: unknown) {
  const temp = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temp, path);
  } finally {
    await unlink(temp).catch(() => {});
  }
}
