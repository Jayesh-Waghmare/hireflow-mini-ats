import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createCandidateHandler } from "../server/candidate-service.ts";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const output = process.env.AUDIT_OUTPUT || "work/reliability";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-http2"],
});
const failures = [];
const record = (index, extra = {}) => ({
  id: randomUUID(),
  name: `Candidate ${String(index).padStart(2, "0")}`,
  email: `candidate${index}@example.com`,
  role: "Frontend Developer",
  stage: "Applied",
  location: "Pune",
  skills: "React",
  experience: 1,
  notes: "",
  source: "Other",
  createdAt: new Date(Date.now() - index * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  history: JSON.stringify([
    { text: "Added to Applied", at: new Date().toISOString() },
  ]),
  ...extra,
});

async function check(name, initial, run, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/Failed to load resource|net::ERR_FAILED/.test(message.text())
    )
      errors.push(message.text());
  });
  const workspace = randomUUID();
  let records = structuredClone(initial);
  const fault = {
    postDelay: 0,
    reads: false,
    nextPost: false,
    dropPostResponse: false,
    postNumber: 0,
    deletes: false,
  };
  let posts = 0;
  const handle = createCandidateHandler({
    async read() {
      return structuredClone(records);
    },
    async update(_, transform) {
      records = transform(structuredClone(records));
    },
  });
  await page.route("**/api/candidates*", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "POST") posts++;
    if (method === "POST" && fault.postDelay)
      await new Promise((resolve) => setTimeout(resolve, fault.postDelay));
    if (
      (method === "GET" && fault.reads) ||
      (method === "POST" && (fault.nextPost || fault.postNumber === posts)) ||
      (method === "DELETE" && fault.deletes)
    ) {
      fault.nextPost = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Storage temporarily unavailable. Please retry.",
        }),
      });
    }
    const response = await handle(
      new Request(request.url(), {
        method,
        headers: {
          ...request.headers(),
          cookie: `hireflow_workspace=${workspace}`,
        },
        ...(method === "POST" ? { body: request.postData() } : {}),
      }),
    );
    if (method === "POST" && fault.dropPostResponse) {
      fault.dropPostResponse = false;
      return route.abort("failed");
    }
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    });
  });
  try {
    await run({ page, fault, records: () => records, posts: () => posts });
    assert.deepEqual(errors, [], "Unexpected browser errors");
    console.log("PASS: " + name);
  } catch (error) {
    failures.push(name + ": " + error.message);
    await page.screenshot({
      path: `${output}/${name.replaceAll(/[^a-z0-9]+/gi, "-")}.png`,
      fullPage: true,
      animations: "disabled",
    });
    console.log("FAIL: " + name + ": " + error.message);
  } finally {
    await context.close();
  }
}
async function start(page, count) {
  await page.goto(base);
  await page.getByText("Total candidates", { exact: true }).waitFor();
  if (count)
    await page
      .getByRole("button", { name: new RegExp(`Candidates.*${count}$`) })
      .waitFor({ state: "attached" });
}
async function addForm(
  page,
  name = "Saved Candidate",
  email = "saved@example.com",
) {
  await page
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
}
const submit = (page) =>
  page
    .getByRole("dialog")
    .getByRole("button", { name: "Add candidate", exact: true })
    .click();

try {
  await check(
    "page and keyboard focus survive opening a profile",
    Array.from({ length: 13 }, (_, i) => record(i)),
    async ({ page }) => {
      await start(page, 13);
      await page.getByRole("button", { name: /Candidates.*13/ }).click();
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .click();
      const row = page.locator("tbody tr").first();
      const name = await row.locator("strong").innerText();
      await row.press("Enter");
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForTimeout(150);
      assert.match(
        await page.locator(".table-pagination").innerText(),
        /Page 2 of 2/,
      );
      assert.equal(
        await page.evaluate(
          () => document.activeElement?.querySelector("strong")?.textContent,
        ),
        name,
      );
      await row.press("Enter");
      await page
        .getByRole("button", { name: "Edit candidate", exact: true })
        .click();
      await page.getByLabel("Recruiter notes").fill("Reviewed from page two");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.match(
        await page.locator(".table-pagination").innerText(),
        /Page 2 of 2/,
      );
    },
  );
  await check(
    "a confirmed save does not depend on a follow-up read",
    [],
    async ({ page, fault, records }) => {
      await start(page, 0);
      fault.reads = true;
      await addForm(page);
      await submit(page);
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: /Candidates.*1/ }).waitFor();
      assert.equal(records().length, 1);
    },
  );
  await check(
    "a lost save response is reconciled without a second POST",
    [],
    async ({ page, fault, records, posts }) => {
      await start(page, 0);
      fault.dropPostResponse = true;
      await addForm(page);
      await submit(page);
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(posts(), 1);
      assert.equal(records().length, 1);
      await page.getByRole("button", { name: /Candidates.*1/ }).waitFor();
    },
  );
  await check(
    "failed stage and delete requests stay visible and can be retried",
    [record(0)],
    async ({ page, fault, records }) => {
      await start(page, 1);
      await page.getByRole("button", { name: /Candidates.*1/ }).click();
      await page.locator("tbody tr").first().click();
      fault.nextPost = true;
      await page.getByLabel("Move to stage").selectOption("Interview");
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.equal(
        await page.getByLabel("Move to stage").inputValue(),
        "Applied",
      );
      await page.getByLabel("Move to stage").selectOption("Interview");
      await page
        .getByText("Moved from Applied to Interview", { exact: true })
        .waitFor();
      fault.deletes = true;
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page
        .getByRole("button", { name: "Yes, delete", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.equal(records().length, 1);
      fault.deletes = false;
      await page
        .getByRole("button", { name: "Yes, delete", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(records().length, 0);
    },
  );
  await check(
    "failed initial loading blocks edits and offers reconnection",
    [],
    async ({ page, fault }) => {
      fault.reads = true;
      await page.goto(base);
      await page
        .getByRole("button", { name: "Retry connection", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Add candidate", exact: true })
          .isDisabled(),
        true,
      );
      fault.reads = false;
      await page
        .getByRole("button", { name: "Retry connection", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Load sample candidates", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Add candidate", exact: true })
          .isEnabled(),
        true,
      );
    },
  );
  await check(
    "interrupted samples resume without losing or duplicating candidates",
    [],
    async ({ page, fault, records }) => {
      await start(page, 0);
      fault.postNumber = 4;
      await page
        .getByRole("button", { name: "Load sample candidates", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Retry sample loading", exact: true })
        .waitFor();
      await page.getByRole("button", { name: /Candidates.*3/ }).waitFor();
      assert.equal(records().length, 3);
      await page
        .getByRole("button", { name: "Retry sample loading", exact: true })
        .click();
      await page.getByRole("button", { name: /Candidates.*9/ }).waitFor();
      assert.equal(records().length, 9);
      assert.equal(
        new Set(records().map((candidate) => candidate.email)).size,
        9,
      );
    },
  );
  await check(
    "mobile navigation traps focus and long profiles remain usable",
    [
      record(0, {
        name: "Long " + "n".repeat(90),
        email: "a".repeat(150) + "@example.com",
        notes: "a".repeat(1000),
        skills: "React, React, , TypeScript",
      }),
    ],
    async ({ page }) => {
      await start(page, 0);
      assert.equal(
        await page.getByRole("button", { name: /Candidates.*1/ }).count(),
        0,
      );
      const toggle = page.getByRole("button", {
        name: "Toggle navigation",
        exact: true,
      });
      await toggle.click();
      await page
        .getByRole("dialog", { name: "Navigation", exact: true })
        .waitFor();
      for (let index = 0; index < 9; index++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
          true,
        );
      }
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        await toggle.evaluate((element) => element === document.activeElement),
        true,
      );
      await toggle.click();
      await page.getByRole("button", { name: /Candidates.*1/ }).click();
      await page.locator("tbody tr").first().click();
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page
          .locator(".drawer")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
        true,
      );
      assert.equal(await page.locator(".drawer .skill-chips span").count(), 2);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.screenshot({
        path: output + "/mobile-long-profile.png",
        animations: "disabled",
      });
    },
    true,
  );
  await check(
    "required fields and duplicates preserve editable form values",
    [record(0)],
    async ({ page, posts, fault }) => {
      await start(page, 1);
      await page
        .getByRole("button", { name: "Add candidate", exact: true })
        .click();
      await submit(page);
      assert.equal(posts(), 0);
      await page.getByLabel("Full name").fill("Duplicate candidate");
      await page.getByLabel("Email address").fill("not-an-email");
      await submit(page);
      assert.equal(posts(), 0);
      await page.getByLabel("Email address").fill("CANDIDATE0@EXAMPLE.COM");
      await submit(page);
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.match(
        await page.getByRole("dialog").getByRole("alert").innerText(),
        /already exists/,
      );
      assert.equal(
        await page.getByLabel("Full name").inputValue(),
        "Duplicate candidate",
      );
      await page.getByLabel("Email address").fill("corrected@example.com");
      fault.postDelay = 1200;
      await submit(page);
      assert.equal(await page.getByLabel("Full name").isDisabled(), true);
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(posts(), 2);
    },
  );
  await check(
    "CSV exports only matching records and preserves quoted multiline values",
    [
      record(0, { name: "=SUM(1,1)", skills: 'React, "Quotes"\nNew line' }),
      record(1, { skills: "Other" }),
    ],
    async ({ page }) => {
      await start(page, 2);
      await page.getByRole("button", { name: /Candidates.*2/ }).click();
      await page
        .getByRole("textbox", { name: "Search candidates" })
        .fill("Quotes");
      const downloaded = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const stream = await (await downloaded).createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const csv = Buffer.concat(chunks)
        .toString("utf8")
        .replace(/^\uFEFF/, "");
      const rows = [];
      let row = [],
        field = "",
        quoted = false;
      for (let index = 0; index < csv.length; index++) {
        const character = csv[index];
        if (character === '"') {
          if (quoted && csv[index + 1] === '"') {
            field += '"';
            index++;
          } else quoted = !quoted;
        } else if (character === "," && !quoted) {
          row.push(field);
          field = "";
        } else if (character === "\r" && csv[index + 1] === "\n" && !quoted) {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          index++;
        } else field += character;
      }
      row.push(field);
      rows.push(row);
      assert.equal(quoted, false);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].length, 9);
      assert.equal(rows[1].length, 9);
      assert.equal(rows[1][0], "'=SUM(1,1)");
      assert.equal(rows[1][5], 'React, "Quotes"\nNew line');
    },
  );
  await check(
    "deleting the last candidate in a position clears its stale filter",
    [record(0), record(1, { role: "Product Designer" })],
    async ({ page }) => {
      await start(page, 2);
      await page.getByRole("button", { name: /Candidates.*2/ }).click();
      await page
        .getByLabel("Filter by position")
        .selectOption("Frontend Developer");
      await page.locator("tbody tr").first().click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page
        .getByRole("button", { name: "Yes, delete", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Filter by position"]').value ===
          "",
      );
      assert.equal(await page.locator("tbody tr").count(), 1);
      assert.match(await page.locator("tbody").innerText(), /Product Designer/);
    },
  );
  if (failures.length) throw new Error(failures.join("\n"));
  console.log(
    "PASS: all 10 reliability scenarios; API requests were intercepted using the real handler and temporary in-memory records.",
  );
} finally {
  await browser.close();
}
