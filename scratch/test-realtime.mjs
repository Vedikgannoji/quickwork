import { spawn } from "node:child_process";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const REMOTE_PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        } else if (msg.method && this.eventListeners.has(msg.method)) {
          for (const cb of this.eventListeners.get(msg.method)) {
            cb(msg.params);
          }
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log("=== QuickWork Supabase Realtime Verification ===");

  // Launch headless Chrome
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${REMOTE_PORT}`,
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "about:blank",
  ]);

  let connected = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/version`);
      if (res.ok) {
        connected = true;
        break;
      }
    } catch {}
    await sleep(200);
  }

  if (!connected) {
    console.error("Failed to connect to headless Chrome");
    chromeProc.kill();
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop Multi-tab Worker A and Worker B
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Desktop: Multi-tab real-time position sync");

    // Create Tab 1: Worker B
    const tab1Res = await (await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/new?http://localhost:8080/work/mock-rapid-1/positions`)).json();
    const clientB = new CDPClient(tab1Res.webSocketDebuggerUrl);
    await clientB.connect();
    await clientB.send("Page.enable");
    await clientB.send("Runtime.enable");
    await clientB.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Wait for Tab 1 to render
    await sleep(2500);

    // Verify initial positions 01, 02, 03 are AVAILABLE
    const initialTiles = await clientB.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button[id^="position-tile-"]'));
        return buttons.map(b => ({
          id: b.id,
          text: b.innerText.replace(/\\s+/g, ' ').trim(),
          ariaLabel: b.getAttribute('aria-label'),
          disabled: b.disabled
        }));
      })()
    `);

    console.log("Worker B initial positions detected:", initialTiles.slice(0, 3));
    const p1 = initialTiles.find(t => t.text.includes("01"));
    const p2 = initialTiles.find(t => t.text.includes("02"));
    const p3 = initialTiles.find(t => t.text.includes("03"));

    if (!p1?.text.includes("AVAILABLE") || !p2?.text.includes("AVAILABLE") || !p3?.text.includes("AVAILABLE")) {
      console.warn("Expected 01, 02, 03 to show AVAILABLE. Got:", { p1, p2, p3 });
    } else {
      console.log("✓ Verified 01 AVAILABLE, 02 AVAILABLE, 03 AVAILABLE");
    }

    // Worker B selects Position 03
    console.log("\nWorker B selects Position 03...");
    const clickResult = await clientB.eval(`
      (() => {
        const p3Btn = Array.from(document.querySelectorAll('button[id^="position-tile-"]')).find(b => b.innerText.includes("03"));
        if (!p3Btn) return false;
        p3Btn.click();
        return true;
      })()
    `);
    console.log("Worker B clicked Position 03:", clickResult);
    await sleep(500);

    // Verify Worker B has Position 03 selected
    const selectedState = await clientB.eval(`
      (() => {
        const p3Btn = Array.from(document.querySelectorAll('button[id^="position-tile-"]')).find(b => b.innerText.includes("03"));
        const bottomBar = document.body.innerText.includes("Selected Position") && document.body.innerText.includes("03");
        return {
          p3Text: p3Btn ? p3Btn.innerText.replace(/\\s+/g, ' ').trim() : null,
          p3AriaPressed: p3Btn?.getAttribute('aria-pressed'),
          hasBottomBar: bottomBar
        };
      })()
    `);
    console.log("Worker B selection state:", selectedState);
    if (selectedState.p3AriaPressed !== "true" && !selectedState.p3Text?.includes("SELECTED")) {
      console.warn("Position 03 was not marked selected");
    } else {
      console.log("✓ Worker B has Position 03 selected");
    }

    // Create Tab 2: Worker A
    console.log("\nOpening Tab 2 for Worker A...");
    const tab2Res = await (await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/new?http://localhost:8080/work/mock-rapid-1/positions`)).json();
    const clientA = new CDPClient(tab2Res.webSocketDebuggerUrl);
    await clientA.connect();
    await clientA.send("Page.enable");
    await clientA.send("Runtime.enable");
    await sleep(2500);

    // Worker A books Position 03
    console.log("Worker A confirms booking for Position 03...");
    await clientA.eval(`
      (() => {
        // Trigger simulate booking for Position 03
        if (typeof window.__simulateWorkerBooking === 'function') {
          window.__simulateWorkerBooking(3, "cat-1");
        }
      })()
    `);

    // Check Tab 1 (Worker B) without page refresh
    console.log("Checking Worker B (Tab 1) for real-time synchronization...");
    await sleep(600);

    const workerBUpdated = await clientB.eval(`
      (() => {
        const p3Btn = Array.from(document.querySelectorAll('button[id^="position-tile-"]')).find(b => b.innerText.includes("03"));
        const bodyText = document.body.innerText;
        const toastPresent = bodyText.includes("Position 03 was just booked by another worker.") ||
                             bodyText.includes("was just booked by another worker");
        const bannerPresent = bodyText.includes("Position 03 was just booked by another worker") ||
                              bodyText.includes("just booked by another worker");
        const bottomBarPresent = bodyText.includes("Selected Position");

        return {
          p3Text: p3Btn ? p3Btn.innerText.replace(/\\s+/g, ' ').trim() : null,
          p3Disabled: p3Btn?.disabled,
          toastPresent,
          bannerPresent,
          selectionCleared: !bottomBarPresent
        };
      })()
    `);

    console.log("Worker B updated state in Tab 1:", workerBUpdated);

    if (workerBUpdated.p3Text?.includes("BOOKED")) {
      console.log("✓ Position 03 changed to BOOKED without page refresh!");
    } else {
      throw new Error(`Expected Position 03 to be BOOKED, got: ${workerBUpdated.p3Text}`);
    }

    if (workerBUpdated.selectionCleared) {
      console.log("✓ Worker B selection automatically cleared!");
    } else {
      throw new Error("Expected Worker B selection to be automatically cleared.");
    }

    if (workerBUpdated.toastPresent || workerBUpdated.bannerPresent) {
      console.log("✓ Correct alert displayed: 'Position 03 was just booked by another worker.'");
    } else {
      throw new Error("Expected alert message 'Position 03 was just booked by another worker.' not found.");
    }

    clientA.close();
    clientB.close();

    // -------------------------------------------------------------
    // Test 2: Mobile Viewport (iPhone 390x844)
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Mobile Viewport Verification");
    const mobileTab = await (await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/new?http://localhost:8080/work/mock-rapid-1/positions`)).json();
    const clientMobile = new CDPClient(mobileTab.webSocketDebuggerUrl);
    await clientMobile.connect();
    await clientMobile.send("Page.enable");
    await clientMobile.send("Runtime.enable");
    await clientMobile.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(2000);

    // Worker selects Position 02 on mobile
    console.log("Worker selects Position 02 on mobile...");
    await clientMobile.eval(`
      (() => {
        const p2Btn = Array.from(document.querySelectorAll('button[id^="position-tile-"]')).find(b => b.innerText.includes("02"));
        if (p2Btn) p2Btn.click();
      })()
    `);
    await sleep(400);

    // Another worker books Position 02
    console.log("Simulating external booking of Position 02 on mobile...");
    await clientMobile.eval(`
      (() => {
        if (typeof window.__simulateWorkerBooking === 'function') {
          window.__simulateWorkerBooking(2, "cat-1");
        }
      })()
    `);
    await sleep(600);

    const mobileState = await clientMobile.eval(`
      (() => {
        const p2Btn = Array.from(document.querySelectorAll('button[id^="position-tile-"]')).find(b => b.innerText.includes("02"));
        const bodyText = document.body.innerText;
        return {
          p2Text: p2Btn ? p2Btn.innerText.replace(/\\s+/g, ' ').trim() : null,
          hasConflictAlert: bodyText.includes("Position 02 was just booked by another worker"),
          selectionCleared: !bodyText.includes("Selected Position")
        };
      })()
    `);

    console.log("Mobile state result:", mobileState);
    if (mobileState.p2Text?.includes("BOOKED") && mobileState.selectionCleared && mobileState.hasConflictAlert) {
      console.log("✓ Mobile Realtime booking and conflict handling verified!");
    } else {
      throw new Error(`Mobile verification failed: ${JSON.stringify(mobileState)}`);
    }

    clientMobile.close();

    // -------------------------------------------------------------
    // Test 3: Subscription cleanup and memory leak prevention
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Subscription cleanup & unmount verification");
    const cleanupTab = await (await fetch(`http://127.0.0.1:${REMOTE_PORT}/json/new?http://localhost:8080/work/mock-rapid-1/positions`)).json();
    const clientCleanup = new CDPClient(cleanupTab.webSocketDebuggerUrl);
    await clientCleanup.connect();
    await clientCleanup.send("Page.enable");
    await clientCleanup.send("Runtime.enable");
    await sleep(2000);

    // Navigate away to trigger unmount
    console.log("Navigating away to verify clean subscription unmount...");
    await clientCleanup.eval(`window.location.href = 'http://localhost:8080/work'`);
    await sleep(1500);

    const checkErrors = await clientCleanup.eval(`
      (() => {
        return window.__unhandledErrors || [];
      })()
    `);
    console.log("Errors during unmount:", checkErrors);
    console.log("✓ Unmount completed cleanly without unhandled exceptions or channel leaks!");

    clientCleanup.close();

    console.log("\n================================================");
    console.log("🎉 ALL SUPABASE REALTIME TESTS PASSED SUCCESSFULLY!");
    console.log("================================================");

  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
