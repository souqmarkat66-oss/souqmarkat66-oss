// UI fixtures only; server/reels regression tests exercise real encoding separately.
const WebSocket = require("ws");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const target = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", {method:"PUT"})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => ws.once("open", resolve));
  let id = 0, failConversion = true, uploadUrl = "/uploads/reels-fixture.mp4";
  const pending = new Map(), requests = [];
  function send(method, params={}) { return new Promise((resolve,reject)=>{
    pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  }); }
  ws.on("message", async raw => {
    const event = JSON.parse(raw);
    if(event.id) {
      const promise=pending.get(event.id);pending.delete(event.id);
      return event.error ? promise?.reject(Error(event.error.message)) : promise?.resolve(event.result);
    }
    if(event.method!=="Fetch.requestPaused")return;
    const {requestId,request}=event.params, path=new URL(request.url).pathname;
    let body=[],status=200;
    if(path==="/api/auth/user")body={id:"reels-browser-fixture",firstName:"اختبار",createdAt:new Date().toISOString()};
    if(path==="/api/settings")body={};
    if(request.method==="POST"){
      const data=path==="/api/upload"?{}:JSON.parse(request.postData||"{}");
      requests.push({path,data});
      if(path==="/api/upload")body={url:uploadUrl};
      else if(path==="/api/ai/generate-image")body={url:"/uploads/reels-generated.png"};
      else if(path==="/api/ai/images-to-video"){
        if(failConversion){status=502;body={message:"فشل إنشاء الفيديو. حاول مرة أخرى."};}
        else body={url:"/uploads/reels-converted.mp4"};
      } else body={id:1,...data};
    }
    await send("Fetch.fulfillRequest",{requestId,responseCode:status,responseHeaders:[{name:"Content-Type",value:"application/json"}],body:Buffer.from(JSON.stringify(body)).toString("base64")});
  });
  async function evaluate(expression){
    const result=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
    return result.result.value;
  }
  const click=async testId=>{assert.equal(await evaluate(`!!document.querySelector('[data-testid="${testId}"]')`),true,testId);await evaluate(`document.querySelector('[data-testid="${testId}"]').click()`);await pause(250);};
  const fill=async(testId,value)=>{await evaluate(`(()=>{const e=document.querySelector('[data-testid="${testId}"]');Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause(100);};
  try {
    await send("Page.enable");await send("Fetch.enable",{patterns:[{urlPattern:"*/api/*"}]});
    await send("Network.setBypassServiceWorker",{bypass:true});
    await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await send("Page.navigate",{url:`https://${process.env.REPLIT_DEV_DOMAIN}/reels`});
    for(let i=0;i<60;i++){if(await evaluate(`!!document.querySelector('[data-testid="btn-create-reel-centered"]')`))break;await pause(500);}
    await click("btn-create-reel-centered");
    await fill("input-reel-title","فيديو عادي");
    await evaluate(`(()=>{const e=document.querySelector('input[type=file][accept^="video"]');const dt=new DataTransfer();dt.items.add(new File(['fixture'],'fixture.mp4',{type:'video/mp4'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause(400);
    await click("btn-publish-reel");
    assert.equal(requests.at(-1).path,"/api/reels");
    assert.equal(requests.at(-1).data.videoUrl,"/uploads/reels-fixture.mp4");
    await click("btn-create-reel-centered");
    await fill("input-reel-title","ريل من صورة");
    await click("tab-image");
    uploadUrl="/uploads/reels-fixture.png";
    await evaluate(`(()=>{const e=document.querySelector('input[type=file][accept^="image"]');const dt=new DataTransfer();dt.items.add(new File(['fixture'],'fixture.png',{type:'image/png'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause(400);
    assert.equal(requests.at(-1).path,"/api/upload");
    await fill("input-reel-ai-image-prompt","صورة لحديقة");
    await click("btn-generate-reel-ai-image");
    assert.equal(requests.at(-1).path,"/api/ai/generate-image");
    await click("btn-convert-to-video");
    assert.deepEqual(requests.at(-1).data.imageUrls,["/uploads/reels-fixture.png","/uploads/reels-generated.png"]);
    assert.equal(await evaluate(`document.querySelector('[data-testid="input-reel-title"]').value`),"ريل من صورة");
    assert.equal(await evaluate(`!!document.querySelector('[data-testid="btn-remove-img-0"]')`),true);
    failConversion=false;
    await click("btn-convert-to-video");
    assert.equal(await evaluate(`!!document.querySelector('video[src="/uploads/reels-converted.mp4"]')`),true);
    await fs.writeFile("/tmp/reels-create-mobile.png",Buffer.from((await send("Page.captureScreenshot",{format:"png"})).data,"base64"));
    await click("btn-publish-reel");
    assert.equal(requests.at(-1).data.videoUrl,"/uploads/reels-converted.mp4");
    console.log("PASS Reels mobile: ordinary upload/publish, generated image, conversion failure preserves inputs, retry/preview/publish");
  } finally {await send("Page.close").catch(()=>{});ws.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});