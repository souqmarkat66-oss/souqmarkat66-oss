// UI-only fixtures: no real payment, upload, socket event, or provider request.
// Start isolated Chromium with --remote-debugging-port=9223.
const WebSocket = require("ws");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once("open", resolve));
  let seq = 0, balance = 500, coins = 40, failPurchase = true, adminMode = false;
  const waiting = new Map(), submissions = [], requestErrors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.on("message", async bytes => {
    const event = JSON.parse(bytes);
    if (event.id) {
      const p = waiting.get(event.id);
      waiting.delete(event.id);
      if (event.error) p?.reject(new Error(event.error.message));
      else p?.resolve(event.result);
      return;
    }
    if (event.method !== "Fetch.requestPaused") return;
    try {
      const { requestId, request } = event.params;
      const path = new URL(request.url).pathname;
      let body = [], status = 200;
      if (path === "/api/auth/user") body = { id: "browser-fixture", firstName: "اختبار", isAdmin: adminMode };
      if (path === "/api/settings") body = {};
      if (path === "/api/revenue") body = { balanceEGP: balance };
      if (path === "/api/coins/wallet") body = { balance: coins };
      if (path === "/api/coins/packages") body = [{ id: 1, name: "باقة اختبار", coins: 100, bonusCoins: 0, priceEgp: 10 }];
      if (path === "/api/streams/991") body = { id: 991, userId: "host-fixture", channelId: 1, channelName: "بث الاختبار", title: "بث الاختبار", status: "live", streamMode: "rtmp" };
      if (path.endsWith("/hls-status")) body = { live: true, isLive: true, status: "live" };
      if (path === "/api/admin/stats" || path === "/api/admin/wallet-stats") body = {};
      if (path === "/api/admin/wallet-topups") body = [{ id: 71, userId: "legacy-fixture", orderNumber: "LEGACY-71", amountEgp: "50.00", paymentMethod: "vodafone_cash", paymentReference: "OLD-REF-71", paymentScreenshotUrl: "/uploads/legacy-receipt.png", status: "pending", firstName: "قديم", createdAt: "2026-09-01T12:00:00Z" }];
      if (path === "/api/admin/payments") body = [{ id: 72, userId: "modern-fixture", type: "top_up", serviceType: "wallet_recharge", amountEGP: "100.00", method: "instapay", paymentRef: "NEW-REF-72", screenshotUrl: "/uploads/new-receipt.png", status: "pending", createdAt: "2026-09-01T12:00:00Z" }];
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        const data = path === "/api/upload" ? null : JSON.parse(request.postData || "{}");
        submissions.push({ path, data, headers: request.headers });
        if (path === "/api/upload") body = { url: "/uploads/browser-receipt.png" };
        else if (path === "/api/coins/purchase-with-wallet") {
          if (failPurchase) { status = 503; body = { message: "تعذر التأكيد، أعد المحاولة" }; }
          else { balance = 490; coins = 140; body = { coins: 100, coinBalance: coins }; }
        } else body = { id: 90, status: "pending" };
      }
      await send("Fetch.fulfillRequest", {
        requestId, responseCode: status,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      });
    } catch (error) { requestErrors.push(error); }
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const exists = id => evaluate(`!!document.querySelector('[data-testid="${id}"]')`);
  const click = async id => {
    assert.equal(await exists(id), true, `missing ${id}`);
    await evaluate(`document.querySelector('[data-testid="${id}"]').click()`);
    await pause(250);
  };
  const origin = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
  const navigate = async () => {
    await send("Page.navigate", { url: origin + "/streams/991" });
    for (let i = 0; i < 60; i++) {
      if (await exists("btn-recharge-coins-bottom")) return;
      await pause(500);
    }
    throw new Error("Live page did not render");
  };
  try {
    await send("Page.enable");
    await send("Network.enable");
    await send("Network.setBypassServiceWorker", { bypass: true });
    await send("Network.setBlockedURLs", { urls: ["*socket.io*", "*google-analytics*"] });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate();
    await click("btn-gift-panel-bottom");
    assert.match(await evaluate("document.body.innerText"), /60%/);
    assert.match(await evaluate("document.body.innerText"), /40%/);
    await click("btn-gift-recharge");
    await click("btn-buy-package-1");
    assert.equal(await evaluate(`document.querySelector('[data-testid="btn-live-purchase-from-wallet"]').disabled`), false);
    const image = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("/tmp/live-gift-recharge-mobile.png", Buffer.from(image.data, "base64"));
    await click("btn-live-purchase-from-wallet");
    const first = submissions.find(x => x.path === "/api/coins/purchase-with-wallet");
    assert.deepEqual(first.data, { packageId: 1 });
    const key = Object.entries(first.headers).find(([k]) => k.toLowerCase() === "idempotency-key")?.[1];
    assert.ok(key);
    assert.equal(await exists("btn-live-purchase-from-wallet"), true, "failed purchase must retain selected package");
    failPurchase = false;
    await click("btn-live-purchase-from-wallet");
    const retry = submissions.filter(x => x.path === first.path).at(-1);
    assert.equal(Object.entries(retry.headers).find(([k]) => k.toLowerCase() === "idempotency-key")?.[1], key);
    assert.match(await evaluate("document.body.innerText"), /تم شراء|جاهزة|استخدامها/);
    await navigate();
    await click("btn-recharge-coins-bottom");
    await click("btn-buy-package-1");
    await click("btn-paymethod-bank");
    await evaluate(`(()=>{const e=document.querySelector('input[placeholder*="مرجع"],input[data-testid="input-pay-ref"]');if(!e)throw Error('missing reference');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'receipt-browser-1001');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await evaluate(`(()=>{const e=document.querySelector('[data-testid="input-pay-screenshot"]');if(!e)throw Error('missing receipt upload');const d=new DataTransfer();d.items.add(new File(['fixture'],'receipt.png',{type:'image/png'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause(500);
    await click("btn-submit-purchase");
    const manual = submissions.filter(x => x.path === "/api/payments").at(-1);
    assert.ok(manual);
    assert.equal(manual.data.method, "souq");
    assert.equal(manual.data.coinPackageId, 1);
    assert.equal(manual.data.screenshotUrl, "/uploads/browser-receipt.png");
    assert.equal(manual.data.amountEGP, undefined);
    assert.match(await evaluate("document.body.innerText"), /مراجعة|الموافقة/);
    adminMode = true;
    await send("Page.navigate", { url: origin + "/admin" });
    for (let i = 0; i < 60; i++) {
      if (await exists("nav-walletcharges")) break;
      await pause(500);
    }
    await click("nav-walletcharges");
    for (let i = 0; i < 30; i++) {
      if (await exists("button-approve-payment-72") && await exists("btn-approve-wallet-71")) break;
      await pause(250);
    }
    assert.equal(await exists("img-wallet-receipt-71"), true, "legacy camelCase receipt is visible");
    assert.equal(await exists("screenshot-payment-72"), true, "new receipt is visible in same section");
    assert.match(await evaluate(`document.querySelector('[data-testid="text-wallet-order-71"]').textContent`), /LEGACY-71/);
    await click("btn-approve-wallet-71");
    assert.equal(submissions.find(x => x.path === "/api/admin/wallet-topups/71")?.data.action, "approve");
    assert.equal(await evaluate(`document.querySelector('[data-testid="button-approve-payment-72"]').disabled`), true);
    await evaluate(`document.querySelector('[data-testid="transfer-verification-72"] input').click()`);
    await pause(150);
    await click("button-approve-payment-72");
    assert.equal(submissions.find(x => x.path === "/api/admin/payments/72")?.data.status, "approved");
    assert.equal(requestErrors.length, 0);
    console.log("PASS live mobile: 60/40, wallet purchase/retry, manual receipt, old/new admin receipt visibility and approval routing.");
  } finally {
    await send("Page.close").catch(() => {});
    ws.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });