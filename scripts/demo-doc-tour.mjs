/**
 * Headed demo — sidebar, tabs, buttons, copy. Watch BOT cursor (~3–4 min).
 */
import * as act from "../dist/actions.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP = 5000;
const SHORT = 2500;

async function safe(fn, label) {
  try {
    await fn();
    console.log(`   ✓ ${label}`);
    return true;
  } catch (e) {
    console.log(`   · ${label}: ${(e.message || e).toString().slice(0, 70)}`);
    return false;
  }
}

async function open(path, title) {
  console.log(`\n━━ ${title} ━━`);
  await act.navigate(`https://playwright.dev${path}`);
  await wait(STEP);
  const info = await act.getPageInfo();
  console.log(`   ${info.title}`);
}

console.log("\n📺 BOT tour — buttons & links (Chromium 창을 보세요)\n");

await act.closeSession().catch(() => {});
await open("/docs/intro", "Intro");

await safe(() => act.clickRole("link", "Installation", { exact: false }), 'content link "Installation"');
await wait(STEP);
await safe(() => act.goBack(), "back to intro");
await wait(STEP);

await open("/docs/installation", "Installation");

for (const tab of ["npm", "yarn", "pnpm"]) {
  await safe(() => act.clickRole("tab", tab), `tab ${tab}`);
  await wait(SHORT);
}
await safe(() => act.clickSelector(".tabs__item"), "first tab item");
await wait(SHORT);

await open("/docs/writing-tests", "Writing tests");

await safe(
  () => act.clickSelector('button[aria-label="Copy code to clipboard"], button.clean-btn'),
  "copy code button"
);
await wait(SHORT);
await safe(() => act.scroll("down", 600), "scroll");
await wait(SHORT);
await safe(() => act.clickRole("link", "Locators", { exact: false }), 'link "Locators"');
await wait(STEP);
await safe(() => act.goBack(), "back");
await wait(STEP);

await open("/docs/running-tests", "Running tests");
await safe(() => act.clickText("CLI", { exact: false }), 'mention "CLI"');
await wait(SHORT);
await safe(() => act.goBack(), "back");
await wait(STEP);

await open("/docs/codegen", "Codegen");
await safe(() => act.clickRole("link", "Test generator", { exact: false }), "Test generator");
await wait(STEP);
await safe(() => act.goBack(), "back");
await wait(STEP);

await open("/docs/mcp", "MCP");
await safe(() => act.scroll("down", 500), "scroll");
await wait(SHORT);
await safe(() => act.clickRole("link", "Browsers", { exact: false }), 'sidebar-style "Browsers"');
await wait(STEP);

await open("/docs/locators", "Locators");
await safe(() => act.clickRole("link", "Actions", { exact: false }), 'link "Actions"');
await wait(STEP);

await open("/docs/intro", "Back to intro");

console.log("\n━━ Header UI ━━");
await safe(() => act.clickRole("link", "Docs"), "nav Docs");
await wait(SHORT);
await safe(() => act.clickRole("link", "API", { exact: false }), "nav API");
await wait(STEP);
await safe(() => act.clickRole("link", "Docs"), "nav Docs again");
await wait(SHORT);

await safe(() => act.clickRole("button", "Search"), "Search button");
await wait(SHORT);
await safe(() => act.typeText("click", false), 'type in search "click"');
await wait(SHORT);
await safe(() => act.pressKey("Escape"), "Escape close search");
await wait(SHORT);

await safe(() => act.clickRole("button", "Switch between dark and light mode"), "theme toggle");
await wait(STEP);
await safe(() => act.clickRole("button", "Switch between dark and light mode"), "theme toggle back");
await wait(STEP);

console.log("\n✅ Tour finished — 12s 후 종료\n");
await wait(12_000);
await act.closeSession();
