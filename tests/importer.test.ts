import { describe, it, expect, vi } from "vitest";
import { mkdtemp, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importPlaylist,
  durationSeconds,
  writeAtomic,
} from "../scripts/importer";
import { A, B, C } from "./fixtures";
import { TOPICS } from "../src/lib/catalog";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const item = (id: string, position: number) => ({
  contentDetails: { videoId: id },
  snippet: { position },
});
const video = (id: string, extras = {}) => ({
  id,
  snippet: {
    title: "Synthetic sleep and memory tip",
    description: "Synthetic fixture",
    channelTitle: "Test channel",
  },
  contentDetails: { duration: "PT3M2S" },
  status: { embeddable: true, privacyStatus: "public" },
  ...extras,
});
const key = "synthetic-test-key-not-a-credential";
describe("YouTube importer with mocked HTTP only", () => {
  it("imports all matching new topics and series labels with classifier provenance", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [item(A, 0)] }))
      .mockResolvedValueOnce(
        response({
          items: [
            video(A, {
              snippet: {
                title:
                  "Transformation Tuesdays: Sleep, memory, longevity, exercise and food",
                description: "Synthetic metadata only",
                channelTitle: "Synthetic channel",
              },
            }),
          ],
        }),
      );
    const { catalog } = await importPlaylist({ apiKey: key, fetcher });
    expect(catalog.classifierVersion).toBe("keywords-v2");
    expect(catalog.clips[0].categories).toEqual([...TOPICS]);
  });
  it("paginates, enriches, skips duplicates/missing/nonembeddable/private, and applies overrides", async () => {
    const ids = [A, B, C, "TEST_PRIV01", "TEST_MISS01"],
      fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          response({ items: ids.map(item), nextPageToken: "page2" }),
        )
        .mockResolvedValueOnce(
          response({ items: [item(A, 5), item("bad", 6)] }),
        )
        .mockResolvedValueOnce(
          response({
            items: [
              video(A),
              video(B),
              video(C, { status: { embeddable: false } }),
              video("TEST_PRIV01", { status: { privacyStatus: "private" } }),
            ],
          }),
        );
    const { catalog, report } = await importPlaylist({
      apiKey: key,
      fetcher,
      overrides: { [A]: ["food"] },
    });
    expect(catalog.clips.map((c) => c.id)).toEqual([A, B]);
    expect(catalog.clips[0].categories).toEqual(["food"]);
    expect(catalog.clips[1].categories).toEqual(["sleep", "brain-health"]);
    expect(catalog.clips[0].durationSeconds).toBe(182);
    expect(
      new URL(fetcher.mock.calls[1][0]).searchParams.get("pageToken"),
    ).toBe("page2");
    // Assert the documented auth contract on every page and video batch. A
    // permissive mock would otherwise accept the wrong credential transport.
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(url).searchParams.get("key")).toBe(key);
      expect(init.headers).toBeUndefined();
    }
    expect(report.skipped).toEqual({
      duplicate: 1,
      invalidOrMissingId: 1,
      notEmbeddable: 1,
      privateOrDeleted: 1,
      missingVideo: 1,
    });
  });
  it("batches videos at 50 and retains stable source ordering on rerun", async () => {
    const ids = Array.from(
        { length: 53 },
        (_, i) => `TEST${String(i).padStart(7, "0")}`,
      ),
      fetcher = vi.fn(async (url: string) => {
        const u = new URL(url);
        if (u.pathname.endsWith("playlistItems"))
          return u.searchParams.has("pageToken")
            ? response({
                items: ids.slice(50).map((id, i) => item(id, i + 50)),
              })
            : response({
                items: ids.slice(0, 50).map(item),
                nextPageToken: "next",
              });
        const batch = u.searchParams.get("id")!.split(",");
        expect(batch.length).toBeLessThanOrEqual(50);
        return response({ items: batch.reverse().map((id) => video(id)) });
      });
    const options = { apiKey: key, fetcher, now: new Date("2026-10-30") },
      first = await importPlaylist(options);
    expect(first.catalog.clips.map((c) => c.id)).toEqual(ids);
    expect(await importPlaylist(options)).toEqual(first);
  });
  it.each([
    [
      403,
      { error: { errors: [{ reason: "quotaExceeded" }] } },
      /quota exhausted/,
    ],
    [403, {}, /Enable YouTube Data API/],
    [404, {}, /not found/],
    [500, {}, /HTTP 500/],
    [200, {}, /Malformed/],
    [200, { items: [] }, /No eligible videos/],
    [200, { items: [null] }, /Malformed/],
  ])("diagnoses HTTP %s safely", async (status, body, message) => {
    await expect(
      importPlaylist({
        apiKey: key,
        fetcher: async () => response(body, status),
      }),
    ).rejects.toThrow(message);
  });
  it("rejects missing keys before making a request", async () => {
    const fetcher = vi.fn();
    await expect(
      importPlaylist({ apiKey: undefined, fetcher }),
    ).rejects.toThrow(/Missing YOUTUBE_API_KEY/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ["accessNotConfigured", "errors", /project that owns this API key/],
    ["SERVICE_DISABLED", "details", /project that owns this API key/],
    ["API_KEY_SERVICE_BLOCKED", "details", /Under API restrictions/],
    [
      "API_KEY_HTTP_REFERRER_BLOCKED",
      "details",
      /website\/referrer restrictions/,
    ],
    ["API_KEY_IP_ADDRESS_BLOCKED", "details", /outbound public IP/],
    ["ipRefererBlocked", "errors", /application restrictions/],
    ["API_KEY_INVALID", "details", /already-exported YOUTUBE_API_KEY/],
    ["keyInvalid", "errors", /already-exported YOUTUBE_API_KEY/],
    ["API_KEY_EXPIRED", "details", /expired/],
    ["playlistItemsNotAccessible", "errors", /owner-authorized OAuth/],
    ["CREDENTIALS_MISSING", "details", /key query parameter/],
    ["forbidden", "errors", /generic reason does not identify/],
  ])(
    "diagnoses %s from %s without printing raw API data",
    async (reason, source, guidance) => {
      const body = {
        error: {
          status: "PERMISSION_DENIED",
          message: `Do not print ${key}`,
          [source]: [
            {
              reason,
              metadata: { key, request: `https://example.test/?key=${key}` },
            },
          ],
        },
      };
      const error = await importPlaylist({
        apiKey: key,
        fetcher: async () => response(body, 403),
      }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw new Error("Expected import to fail");
      expect(error.message).toContain(`reason: ${reason}`);
      expect(error.message).toMatch(guidance);
      expect(error.message).not.toContain(key);
      expect(error.message).not.toContain("example.test");
    },
  );
  it("finds a specific ErrorInfo reason even when the legacy reason is generic", async () => {
    await expect(
      importPlaylist({
        apiKey: key,
        fetcher: async () =>
          response(
            {
              error: {
                errors: [{ reason: "forbidden" }],
                details: [{ reason: "SERVICE_DISABLED" }],
              },
            },
            403,
          ),
      }),
    ).rejects.toThrow(/reason: SERVICE_DISABLED/);
  });
  it.each([
    [
      "metadata IPv4",
      {
        details: [
          {
            reason: "API_KEY_IP_ADDRESS_BLOCKED",
            metadata: { callerIp: "203.0.113.42" },
          },
        ],
      },
      "Google-observed caller IP: 203.0.113.42",
    ],
    [
      "metadata IPv6",
      {
        details: [
          {
            reason: "API_KEY_IP_ADDRESS_BLOCKED",
            metadata: { callerIp: "2001:db8::42" },
          },
        ],
      },
      "Google-observed caller IP: 2001:db8::42",
    ],
    [
      "legacy message",
      {
        message: `Requests from this IP address 203.0.113.43 are blocked. Do not print ${key}`,
      },
      "Google-observed caller IP: 203.0.113.43",
    ],
    [
      "legacy nested message",
      {
        errors: [
          {
            reason: "ipRefererBlocked",
            message: `Requests from IP address '2001:db8::43' are blocked. ${key}`,
          },
        ],
      },
      "Google-observed caller IP: 2001:db8::43",
    ],
    [
      "empty caller IP",
      { message: `Requests from this IP address <empty> are blocked. ${key}` },
      "Google reported an empty caller IP",
    ],
    ["absent caller IP", {}, "Google did not include a valid caller IP"],
    [
      "invalid caller IP",
      {
        details: [
          {
            reason: "API_KEY_IP_ADDRESS_BLOCKED",
            metadata: { callerIp: `https://example.test/?key=${key}` },
          },
        ],
        message: `Requests from this IP address 999.999.999.999 are blocked. ${key}`,
      },
      "Google did not include a valid caller IP",
    ],
  ])(
    "safely diagnoses %s on Google's IP rejection",
    async (_label, extra, expected) => {
      const error = await importPlaylist({
        apiKey: key,
        fetcher: async () =>
          response(
            {
              error: {
                errors: [{ reason: "API_KEY_IP_ADDRESS_BLOCKED" }],
                ...extra,
              },
            },
            403,
          ),
      }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw new Error("Expected import to fail");
      expect(error.message).toContain(expected);
      expect(error.message).not.toContain(key);
      expect(error.message).not.toContain("example.test");
    },
  );
  it("never echoes unknown reason strings or messages, even if they contain credentials", async () => {
    const error = await importPlaylist({
      apiKey: key,
      fetcher: async () =>
        response(
          {
            error: {
              message: key,
              errors: [{ reason: key }],
              details: [{ reason: key }],
            },
          },
          403,
        ),
    }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error("Expected import to fail");
    expect(error.message).toContain("reason: unspecified");
    expect(error.message).not.toContain(key);
  });
  it("redacts low-level failures and non-JSON bodies", async () => {
    await expect(
      importPlaylist({
        apiKey: key,
        fetcher: async () => {
          throw new Error(key);
        },
      }),
    ).rejects.toThrow(/Cannot reach/);
    await expect(
      importPlaylist({
        apiKey: key,
        fetcher: async () => new Response("<html>"),
      }),
    ).rejects.toThrow(/non-JSON/);
  });
  it("never includes the credential-bearing URL or echoed API response in diagnostics", async () => {
    for (const mode of ["network", "response"] as const) {
      const error = await importPlaylist({
        apiKey: key,
        fetcher: async (url) => {
          expect(new URL(url).searchParams.get("key")).toBe(key);
          if (mode === "network") throw new Error(`Failed request: ${url}`);
          return response(
            {
              error: {
                errors: [{ reason: "forbidden", message: url }],
                message: url,
              },
            },
            403,
          );
        },
      }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error)) throw new Error("Expected import to fail");
      expect(error.message).not.toContain(key);
      expect(error.message).not.toContain("https://www.googleapis.com");
      expect(error.message).not.toContain("?key=");
    }
  });
  it("rejects repeated page tokens and incomplete video metadata", async () => {
    await expect(
      importPlaylist({
        apiKey: key,
        fetcher: async () => response({ items: [], nextPageToken: "loop" }),
      }),
    ).rejects.toThrow(/repeated/);
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [item(A, 0)] }))
      .mockResolvedValueOnce(response({ items: [{ id: A }] }));
    await expect(importPlaylist({ apiKey: key, fetcher })).rejects.toThrow(
      /missing video status/,
    );
  });
  it("atomically replaces validated output; a failed import does not change existing catalog", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tesh-import-")),
      path = join(dir, "clips.json");
    try {
      await writeAtomic(path, { existing: "good" });
      const before = await readFile(path, "utf8");
      await expect(
        (async () => {
          const { catalog } = await importPlaylist({
            apiKey: key,
            fetcher: async () => response({}, 403),
          });
          await writeAtomic(path, catalog);
        })(),
      ).rejects.toThrow();
      expect(await readFile(path, "utf8")).toBe(before);
      expect(await readdir(dir)).toEqual(["clips.json"]);
      await writeAtomic(path, { refreshed: true });
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
        refreshed: true,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each([
    ["PT1H2M3S", 3723],
    ["P1DT2H", 93600],
    ["PT0S", 0],
    ["bad", null],
    ["P", null],
  ])("parses duration %s", (input, output) => {
    expect(durationSeconds(input as string)).toBe(output);
  });
});
