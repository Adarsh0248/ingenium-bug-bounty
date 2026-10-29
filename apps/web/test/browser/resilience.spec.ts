import { test, expect } from "@playwright/test";
import {writeFile} from 'node:fs/promises';

async function enter(page: any) {
  await page.goto("/");
  await page.getByLabel("Team or staff code").fill("A".repeat(32));
  await page.getByRole("button", { name: "Enter arena", exact: true }).click();
  await page.getByRole("radio", { name: "Asha", exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("cpp");
  await page
    .getByRole("button", { name: "Confirm and enter", exact: true })
    .click();
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
}
async function open(page: any) {
  await page.locator("button.target").first().click();
  await page
    .getByRole("button", { name: "Open question", exact: true })
    .click();
  await page.getByRole("button", { name: "Plain text", exact: true }).click();
  const code = page.getByRole("textbox", {
    name: "Your private code",
    exact: true,
  });
  await expect(code).not.toHaveValue("");
  return code;
}
async function animationFrames(page:any){
  return page.evaluate(()=>new Promise<{fps:number;p95_frame_ms:number}>(resolve=>{
    const gaps:number[]=[];let first=0,last=0;
    const frame=(time:number)=>{if(!first)first=time;if(last)gaps.push(time-last);last=time;
      if(time-first<3000)requestAnimationFrame(frame);else{const sorted=gaps.slice().sort((a,b)=>a-b);resolve({fps:Math.round(gaps.length*1000/(time-first)),p95_frame_ms:Math.ceil(sorted[Math.floor(sorted.length*.95)]??0)});}};
    requestAnimationFrame(frame);
  }));
}

test("a loaded app in a throttled 720p browser can navigate, edit offline and reconnect without replaying submissions", async ({page,context},testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1280,height:720});
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const start=Date.now();
  let submissions=0;
  page.on('request',r=>{if(r.method()==='POST'&&/\/(submissions|runs)$/.test(r.url()))submissions++;});
  await enter(page);
  await open(page);
  await page.getByRole('button',{name:'Close workbench',exact:true}).click();
  await page.waitForTimeout(2000);
  const frames=await animationFrames(page);
  const districts:Record<string,Awaited<ReturnType<typeof animationFrames>>>={};
  if(process.env.INGENIUM_PREVIEW_ROUND!=='2')for(const name of ['Silicon Hive','Verdant Nexus','Zero-Day Core']){
    await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(2000);districts[name]=await animationFrames(page);
  }
  // Vite serves unbundled development modules; profile the loaded round, not that development download.
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:128000,uploadThroughput:32000});
  const entered=Date.now();
  const code=await open(page),opened=Date.now();
  await context.setOffline(true);
  await expect(page.locator('.save-status')).toHaveText('offline');
  const source=await code.inputValue()+'\n// retained during the slow-network rehearsal\n';
  await code.fill(source);
  await expect(page.getByRole('button',{name:'Submit fix',exact:true})).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByText('STATE VERIFIED',{exact:true})).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('saved');
  await expect(code).toHaveValue(source);
  expect(submissions).toBe(0);
  const report=JSON.stringify({round:Number(process.env.INGENIUM_PREVIEW_ROUND??1),loaded_app:true,cpu_throttle:4,viewport:'1280x720',network_latency_ms:150,download_bytes_per_second:128000,entry_ms:entered-start,question_ms:opened-entered,animation:frames,districts,offline_edits_retained:true,submissions_replayed:submissions,physical_old_laptop_verified:false,campus_network_verified:false});
  await writeFile(testInfo.outputPath('limited-device-profile.json'),report+'\n');
  await testInfo.attach('limited-device-profile.json',{body:report,contentType:'application/json'});
});

test("entry and Round 2 do not initialise an unused 3D renderer", async ({
  page,
}) => {
  const loaded: string[] = [];
  page.on("request", (r) => loaded.push(r.url()));
  await page.goto("/");
  await expect(page.getByLabel("Team or staff code")).toBeVisible();
  await expect(page.locator(".arena-canvas canvas")).toHaveCount(0);
  expect(loaded.some((url) => /\/src\/Arena\.tsx/.test(url))).toBe(false);
  await enter(page);
  await expect(page.locator(".arena-canvas canvas")).toHaveCount(0);
  if (process.env.INGENIUM_PREVIEW_ROUND === "2") {
    await expect(page.locator(".kernel-canvas")).toBeVisible();
    expect(loaded.some((url) => /\/src\/Arena\.tsx/.test(url))).toBe(false);
  }
});

test("brief connection loss preserves opened questions, samples, owned hints and edits, then saves after verified reconnection", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  let saves = 0,
    actions = 0;
  page.on("request", (r) => {
    if (r.method() !== "POST") return;
    if (/\/draft$/.test(r.url())) saves++;
    if (/\/(runs|submissions|hints)$/.test(r.url())) actions++;
  });
  await enter(page);
  const code = await open(page);
  const original = await code.inputValue();
  const saved = original + "\n// saved before the connection drop\n";
  await code.fill(saved);
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("saved");
  const statement = await page.locator(".statement").innerText();
  await page.getByRole("button", { name: "Sample 1", exact: true }).click();
  const sample = await page.locator(".sample pre").first().innerText();
  await page.getByRole("button", { name: "hints 0/3", exact: true }).click();
  await page
    .getByRole("button", { name: "Purchase hint", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm purchase", exact: true })
    .click();
  const hint = page.locator(".hint p").first();
  await expect(hint).toBeVisible();
  const hintText = await hint.innerText();
  const writes = { saves, actions };
  await context.setOffline(true);
  await expect(page.locator(".save-status")).toHaveText("offline");
  const local = saved + "// also typed while offline\n";
  await code.fill(local);
  await expect(
    page.getByRole("button", { name: "Submit fix", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Purchase hint", exact: true }).first(),
  ).toBeDisabled();
  await page.waitForTimeout(2500);
  expect({ saves, actions }).toEqual(writes);
  await page
    .getByRole("button", { name: "Close workbench", exact: true })
    .click();
  const reopened = await open(page);
  await expect(reopened).toHaveValue(local);
  expect(await page.locator(".statement").innerText()).toBe(statement);
  await page.getByRole("button", { name: "Sample 1", exact: true }).click();
  await expect(page.locator(".sample pre").first()).toHaveText(sample);
  await page.getByRole("button", { name: "hints 1/3", exact: true }).click();
  await expect(page.locator(".hint p").first()).toHaveText(hintText);
  await page.screenshot({
    path: `test-results/offline-round${process.env.INGENIUM_PREVIEW_ROUND ?? "1"}.png`,
  });
  await context.setOffline(false);
  await expect(page.getByText("STATE VERIFIED", { exact: true })).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("saved");
  await expect(reopened).toHaveValue(local);
  expect(actions).toBe(writes.actions);
  expect(saves).toBe(writes.saves + 1);
});

test("reconnection rechecks revocation and clears the private workspace", async ({
  page,
  context,
}) => {
  await enter(page);
  const code = await open(page);
  await context.setOffline(true);
  await expect(page.locator(".save-status")).toHaveText("offline");
  await code.fill("// private offline source\n");
  await page.request.post("/api/v1/_fixture", { data: { action: "revoke" } });
  await context.setOffline(false);
  await expect(
    page.getByRole("heading", { name: "Session unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".statement")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Your private code", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify([
        Object.values(localStorage),
        Object.values(sessionStorage),
      ]),
    ),
  ).not.toContain("private offline source");
});

test("a slow editor download leaves a usable text editor and never steals the typing focus", async ({
  page,
}) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/src/CodeEditor.tsx", async (route) => {
    await blocked;
    await route.continue();
  });
  try {
    await enter(page);
    await page.locator("button.target").first().click();
    await page
      .getByRole("button", { name: "Open question", exact: true })
      .click();
    const code = page.getByRole("textbox", {
      name: "Your private code",
      exact: true,
    });
    await expect(code).not.toHaveValue("");
    await code.fill("// typed before the enhanced editor downloaded\n");
    release();
    await expect(
      page.getByRole("button", { name: "Code editor", exact: true }),
    ).toBeVisible();
    await expect(code).toHaveValue(
      "// typed before the enhanced editor downloaded\n",
    );
    await expect(code).toBeFocused();
  } finally {
    release();
  }
});
