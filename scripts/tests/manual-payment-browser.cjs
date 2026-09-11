// UI-only fixtures complement the real HTTP/Postgres integration suite.
// Start an isolated Chromium with --remote-debugging-port=9223 first.
const WebSocket = require("ws");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once("open", resolve));
  let sequence = 0;
  const waiting = new Map();
  const submissions = [];
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  ws.on("message", async bytes => {
    const event = JSON.parse(bytes);
    if (event.id) {
      const promise = waiting.get(event.id);
      waiting.delete(event.id);
      if (event.error) promise?.reject(new Error(event.error.message));
      else promise?.resolve(event.result);
      return;
    }
    if (event.method !== "Fetch.requestPaused") return;
    const { requestId, request } = event.params;
    const url = new URL(request.url);
    let body = [];
    if (url.pathname === "/api/auth/user") body = { id: "browser-fixture", firstName: "اختبار", isAdmin: false };
    if (url.pathname === "/api/settings") body = {};
    if (url.pathname === "/api/pricing") body = {
      aiPricePerCreditEgp: "5", aiPriceContent: "5", aiPriceImage: "10",
      aiPriceVideo: "25", boostPriceEgp: "250", renewalPrice30d: "60",
      campaignMinBudgetEgp: "100", firePriceEgp: "100", walletMinWithdrawalEgp: "100",
    };
    if (url.pathname === "/api/ads/mine") body = [{ id: 101, userId: "browser-fixture", title: "إعلان اختبار" }];
    if (url.pathname === "/api/revenue") body = { balanceEGP: 500, withdrawableBalanceEGP: 300, minWithdrawalEGP: 100 };
    if (url.pathname === "/api/coins/wallet") body = { balance: 40 };
    if (url.pathname === "/api/ai/usage") body = { purchasedCredits: 12 };
    if (url.pathname === "/api/coins/packages") body = [{ id: 1, name: "باقة اختبار", coins: 100, bonusCoins: 0, priceEgp: 10 }];
    if (request.method !== "GET") {
      submissions.push({ path: url.pathname, data: JSON.parse(request.postData || "{}") });
      body = { id: 1, status: "pending" };
    }
    await send("Fetch.fulfillRequest", {
      requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(JSON.stringify(body)).toString("base64"),
    });
  });
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const click = async id => {
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="${id}"]')`), true, `missing ${id}`);
    await evaluate(`document.querySelector('[data-testid="${id}"]').click()`);
    await pause(150);
  };
  const fill = async (id, value) => {
    await evaluate(`(() => {const e=document.querySelector('[data-testid="${id}"]');if(!e)throw Error('missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await pause(120);
  };
  const pointerClick = async selector => {
    const point = await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('missing ${selector}');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    await pause(250);
  };
  try {
    await send("Page.enable");
    await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
    await send("Network.setBypassServiceWorker", { bypass: true });
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const origin = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
    await send("Page.navigate", { url: origin + "/payments" });
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`!!document.querySelector('[data-testid="btn-new-payment"]')`)) break;
      await pause(500);
    }
    await click("btn-new-payment");
    await click("btn-service-ai_credits");
    await fill("input-ai-credits-quantity", "10");
    await fill("input-payment-ref", "fixture-ai-1001");
    if (await evaluate(`!!document.querySelector('[data-testid="input-phone"]')`)) await fill("input-phone", "01000000000");
    assert.equal(await evaluate(`document.querySelector('[data-testid="btn-submit-payment"]').disabled`), false);
    const image = await send("Page.captureScreenshot", { format: "png" });
    await fs.writeFile("/tmp/manual-payment-mobile.png", Buffer.from(image.data, "base64"));
    await click("btn-submit-payment");
    assert.equal(submissions.at(-1).path, "/api/payments");
    assert.equal(submissions.at(-1).data.aiCreditsQuantity, 10);
    assert.ok(!submissions.at(-1).data.screenshotUrl);
    assert.equal(submissions.at(-1).data.amountEGP, undefined);
    await click("btn-new-payment");
    await click("btn-service-coin_package");
    await pointerClick('[data-testid="select-manual-coin-package"]');
    await pointerClick('[role="option"]');
    await fill("input-payment-ref", "fixture-coins-1001");
    assert.match(await evaluate(`document.querySelector('[data-testid="server-priced-notice"]').textContent`), /10|١٠/);
    assert.equal(await evaluate(`document.querySelector('[data-testid="btn-submit-payment"]').disabled`), false);
    await click("btn-submit-payment");
    assert.equal(submissions.at(-1).data.coinPackageId, 1);
    assert.equal(submissions.at(-1).data.amountEGP, undefined);
    assert.ok(!submissions.at(-1).data.screenshotUrl);
    await click("btn-new-payment");
    await click("btn-service-ad_boost");
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="select-ad-id"],[data-testid="input-ad-id"]')`), true);
    assert.equal(await evaluate(`document.querySelector('[data-testid="btn-submit-payment"]').disabled`), true);
    await click("btn-type-withdrawal");
    await fill("input-amount", "100");
    await fill("input-payout-name", "مستلم اختبار");
    await fill("input-payout-destination", "01000000000");
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="input-payment-ref"]')`), false);
    assert.equal(await evaluate(`document.querySelector('[data-testid="btn-submit-payment"]').disabled`), false);
    await click("btn-submit-payment");
    assert.equal(submissions.at(-1).data.type, "withdrawal");
    assert.equal(submissions.at(-1).data.amountEGP, 100);
    console.log("PASS mobile UI: AI reference-only payload, camel-cased coin-package price/quote/submission, boost ad selector, withdrawal without incoming receipt");
  } finally {
    await send("Page.close").catch(() => {});
    ws.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });