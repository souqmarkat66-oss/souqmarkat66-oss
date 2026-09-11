import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildImagesToVideoRequest, formatReelCreationError } from "./reels-creation";

const reelsSource = readFileSync(new URL("../pages/Reels.tsx", import.meta.url), "utf8");

test("image-to-video requests omit optional audio when no owned upload is selected", () => {
  assert.deepEqual(buildImagesToVideoRequest(["/uploads/image.png"], "  "), {
    imageUrls: ["/uploads/image.png"],
    duration: 3,
    quality: "hd",
    format: "vertical",
  });
});

test("image-to-video requests include the selected uploaded audio", () => {
  assert.equal(
    buildImagesToVideoRequest(["/uploads/image.png"], " /uploads/audio.mp3 ").audioUrl,
    "/uploads/audio.mp3",
  );
});

test("creation errors preserve server messages without exposing response metadata", () => {
  assert.equal(
    formatReelCreationError(402, "insufficient_credits"),
    "رصيد الذكاء الاصطناعي غير كافٍ لإتمام هذه العملية.",
  );
  assert.equal(
    formatReelCreationError(402, "subscription_required"),
    "يلزم تفعيل اشتراك المنصة لإنشاء هذا المحتوى.",
  );
  assert.equal(formatReelCreationError(400, "الصور يجب أن تكون مرفوعة من حسابك"), "الصور يجب أن تكون مرفوعة من حسابك");
  assert.doesNotMatch(formatReelCreationError(402, undefined), /balance|الرصيد المتاح/);
});

test("reel creation uses owned uploads and authenticated AI endpoints", () => {
  assert.doesNotMatch(reelsSource, /input-video-url|input-image-url|input-audio-url/);
  assert.match(reelsSource, /fetch\("\/api\/ai\/generate-image",[\s\S]*credentials: "include"/);
  assert.match(reelsSource, /fetch\('\/api\/ai\/images-to-video',[\s\S]*credentials: 'include'/);
  assert.match(reelsSource, /fetch\('\/api\/reels',[\s\S]*credentials: 'include'/);
});