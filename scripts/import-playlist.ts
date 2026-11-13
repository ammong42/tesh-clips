import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { importPlaylist, writeAtomic } from "./importer";
const root = fileURLToPath(new URL("../", import.meta.url));
const keyWasExported = process.env.YOUTUBE_API_KEY !== undefined;
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.error("Unable to read local .env. Check permissions and syntax.");
    process.exit(1);
  }
}
try {
  if (process.env.YOUTUBE_API_KEY?.trim())
    console.log(
      keyWasExported
        ? "Credential source: existing YOUTUBE_API_KEY environment variable (takes precedence over .env)."
        : "Credential source: local .env file.",
    );
  const overrides = JSON.parse(
    await readFile(resolve(root, "data/category-overrides.json"), "utf8"),
  ) as unknown;
  const { catalog, report } = await importPlaylist({
    apiKey: process.env.YOUTUBE_API_KEY,
    overrides,
  });
  await writeAtomic(resolve(root, "data/clips.json"), catalog);
  try {
    await writeAtomic(resolve(root, "data/import-report.json"), report);
  } catch {
    console.warn(
      "Catalog saved, but the local import report could not be written. Check data directory permissions.",
    );
  }
  console.log(
    `Imported ${report.imported} unique eligible videos from ${report.playlistItems} playlist items. No duration filtering.`,
  );
  console.log(`Skipped: ${JSON.stringify(report.skipped)}`);
  console.log(`Durations: ${JSON.stringify(report.duration)}`);
  console.log(
    "Catalog saved to data/clips.json. Reload the dev server or rebuild the site.",
  );
} catch (error) {
  console.error(
    error instanceof SyntaxError
      ? "Invalid category-overrides.json. Existing catalog preserved."
      : error instanceof Error
        ? error.message
        : "Import failed; existing catalog preserved.",
  );
  process.exitCode = 1;
}
