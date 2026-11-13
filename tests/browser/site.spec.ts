import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { A, B, C, fixtureCatalog, fixtureClip } from "../fixtures";
import type { PlayerOptions, YouTubePlayer } from "../../src/lib/youtubePlayer";
// SYNTHETIC browser fixtures and player double; not evidence of live playback.
const catalog = fixtureCatalog([
  fixtureClip(A, { title: "Synthetic sleep idea one" }),
  fixtureClip(B, {
    title: "Synthetic sleep idea two",
    categories: ["sleep", "brain-health"],
  }),
  fixtureClip(C, { title: "Synthetic finance idea", categories: ["finance"] }),
  fixtureClip("TEST_OTHER1", {
    title: "Synthetic uncategorized idea",
    categories: ["uncategorized"],
  }),
]);
interface TestPlayer extends YouTubePlayer {
  options: PlayerOptions;
  seekCount: number;
  playCount: number;
  destroyed: boolean;
}
declare global {
  interface Window {
    __testPlayers: TestPlayer[];
  }
}
async function fixtures(page: Page) {
  await page.route(/\/data\/clips\.json(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export default ${JSON.stringify(catalog)};`,
    }),
  );
  await page.addInitScript(() => {
    window.__testPlayers = [];
    window.YT = {
      Player: class implements TestPlayer {
        seekCount = 0;
        playCount = 0;
        destroyed = false;
        iframe: HTMLIFrameElement;
        constructor(
          target: HTMLElement,
          public options: PlayerOptions,
        ) {
          this.iframe = document.createElement("iframe");
          this.iframe.title = "Synthetic test player";
          target.replaceWith(this.iframe);
          window.__testPlayers.push(this);
          setTimeout(() => options.events.onReady({ target: this }), 0);
        }
        seekTo() {
          this.seekCount++;
        }
        playVideo() {
          this.playCount++;
        }
        destroy() {
          this.destroyed = true;
          this.iframe.remove();
        }
        getIframe() {
          return this.iframe;
        }
      },
    };
  });
}
const queue = (page: Page) =>
  page.evaluate(() => localStorage.getItem("life-wisdom:queues:v1"));
const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
test("empty catalog: honest state, keyboard navigation, no YouTube requests, accessible landmarks", async ({
  page,
}) => {
  await page.route(/\/data\/clips\.json(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `export default ${JSON.stringify(fixtureCatalog())};`,
    }),
  );
  const errors: string[] = [],
    youtubeRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/youtube\.com/.test(r.url())) youtubeRequests.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByText("Good things are on their way.")).toBeVisible();
  await expect(page.locator(".category-card")).toHaveCount(4);
  for (const button of await page.locator(".category-card").all())
    await expect(button).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "A Little Life Wisdom home" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Your little collection." }),
  ).toBeFocused();
  await expect(page.getByText("A place for your favorites.")).toBeVisible();
  await page.getByRole("button", { name: "Explore the topics" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
  expect(youtubeRequests).toEqual([]);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
});
test("all pools, unique draws, save/reload/replay/saved playback and browser back", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("/");
  for (const name of ["Brain Health", "Finance", "Surprise Me"]) {
    await page
      .getByRole("button", { name: new RegExp(`${name}.*clips? to explore`) })
      .click();
    await expect(
      page.getByRole("button", { name: "Replay", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Home", exact: true }).click();
  }
  await page.getByRole("button", { name: /FOR A QUIETER MIND Sleep/ }).click();
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeEnabled();
  const first = await page.locator("h1").innerText();
  await page.getByRole("button", { name: "Save Clip", exact: true }).click();
  const savedQueue = await queue(page);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  expect(await queue(page)).toBe(savedQueue);
  expect(
    await page.evaluate(() => window.__testPlayers.at(-1)!.seekCount),
  ).toBe(1);
  await page.getByRole("button", { name: "Play Another", exact: true }).click();
  await expect(page.locator("h1")).not.toHaveText(first);
  const second = await page.locator("h1").innerText();
  await page.getByRole("button", { name: "Play Another", exact: true }).click();
  await expect(page.locator("h1")).not.toHaveText(second);
  await expect(page.getByText(/freshly shuffled round/).last()).toBeVisible();
  const beforeSaved = await queue(page);
  await page.getByRole("button", { name: /^Saved Clips/ }).click();
  await page.locator(".saved-open").click();
  await expect(page.locator("h1")).toHaveText(first);
  expect(await queue(page)).toBe(beforeSaved);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Saved", exact: true }),
  ).toBeVisible();
  expect(await queue(page)).toBe(beforeSaved);
  await page.getByRole("button", { name: "Back to Saved Clips" }).click();
  await page.goBack();
  await expect(page.locator("h1")).toHaveText(first);
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await page.getByRole("button", { name: /^Saved Clips/ }).click();
  await expect(page.getByText("A place for your favorites.")).toBeVisible();
});
for (const width of [320, 390, 768, 1440]) {
  test(`responsive layout, visible 200×200 player and accessibility at ${width}px`, async ({
    page,
  }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /FOR A QUIETER MIND Sleep/ }),
    ).toBeEnabled();
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: /FOR A QUIETER MIND Sleep/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Replay", exact: true }),
    ).toBeEnabled();
    const frame = await page.locator("iframe").boundingBox();
    expect(frame!.width).toBeGreaterThanOrEqual(200);
    expect(frame!.height).toBeGreaterThanOrEqual(200);
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `test-results/playback-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save Clip", exact: true }).click();
    await page.getByRole("button", { name: /^Saved Clips/ }).click();
    await noOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.locator(".remove-saved").click();
    await expect(page.getByText("A place for your favorites.")).toBeVisible();
  });
}
test("player error, autoplay restriction, ended state and cleanup recovery", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixtures(page);
  await page.goto("/");
  await page.getByRole("button", { name: /FOR A QUIETER MIND Sleep/ }).click();
  await expect(
    page.getByRole("button", { name: "Replay", exact: true }),
  ).toBeEnabled();
  const originalQueue = await queue(page);
  await page.evaluate(() =>
    window.__testPlayers.at(-1)!.options.events.onStateChange({ data: 0 }),
  );
  await expect(page.getByText(/That’s a little wisdom/)).toBeVisible();
  expect(await queue(page)).toBe(originalQueue);
  await page.evaluate(() =>
    window.__testPlayers.at(-1)!.options.events.onAutoplayBlocked(),
  );
  await expect(page.getByText(/Your browser paused autoplay/)).toBeVisible();
  await page.evaluate(() =>
    window.__testPlayers.at(-1)!.options.events.onError({ data: 100 }),
  );
  await expect(page.getByText(/removed or made private/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open on YouTube/ }),
  ).toHaveAttribute("href", /https:\/\/www.youtube.com\/watch\?v=/);
  await page.getByRole("button", { name: "Play Another", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.__testPlayers.slice(0, -1).every((p) => p.destroyed),
    ),
  ).toBe(true);
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  expect(
    await page.evaluate(() => window.__testPlayers.every((p) => p.destroyed)),
  ).toBe(true);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(errors).toEqual([]);
});
