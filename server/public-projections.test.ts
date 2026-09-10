import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicAdProjection,
  ownerChannelProjection,
  publicChannelProjection,
  publicLiveStreamProjection,
} from "./public-projections";

test("public channel projection excludes owner accounting and payout fields", () => {
  const projected = publicChannelProjection({
    id: 1,
    user_id: "owner-1",
    name: "قناة عامة",
    subscriber_count: 24,
    earnings: 500,
    earnings_egp: 100,
    wallet_number: "01000000000",
    wallet_type: "vodafone",
    publisher_code: "private-code",
  });

  assert.equal(projected?.id, 1);
  assert.equal(projected?.userId, "owner-1");
  assert.equal(projected?.subscriberCount, 24);
  assert.equal("earnings" in (projected || {}), false);
  assert.equal("earningsEGP" in (projected || {}), false);
  assert.equal("walletNumber" in (projected || {}), false);
  assert.equal("walletType" in (projected || {}), false);
  assert.equal("publisherCode" in (projected || {}), false);
});

test("owner projection returns the private channel fields only to an authorized route", () => {
  const projected = ownerChannelProjection({
    id: 1,
    userId: "owner-1",
    name: "قناة",
    earnings: 500,
    earningsEGP: 100,
    walletNumber: "01000000000",
    walletType: "vodafone",
    publisherCode: "private-code",
  });

  assert.equal(projected?.earningsEGP, 100);
  assert.equal(projected?.walletNumber, "01000000000");
  assert.equal(projected?.publisherCode, "private-code");
});

test("public stream projection excludes ledger and ingest credentials", () => {
  const projected = publicLiveStreamProjection({
    id: 2,
    channel_id: 1,
    user_id: "owner-1",
    title: "مباشر",
    viewer_count: 18,
    total_earnings_egp: 900,
    stream_key: "signed-publish-token",
  }, { coHostCount: 2, battleActive: true, battleMode: "1v1" });

  assert.equal(projected?.viewerCount, 18);
  assert.equal(projected?.coHostCount, 2);
  assert.equal(projected?.battleActive, true);
  assert.equal("totalEarningsEGP" in (projected || {}), false);
  assert.equal("streamKey" in (projected || {}), false);
});

test("public ad projection excludes campaign targeting details", () => {
  const projected = publicAdProjection({
    id: 3,
    title: "إعلان",
    media_url: "/ad.png",
    user_id: "owner-1",
    target_region: "القاهرة",
    target_lat: 30,
    target_lng: 31,
    target_radius_km: 5,
    target_interests: "finance",
    target_ages: "18-25",
    whatsapp_number: "01000000000",
  });

  assert.equal(projected?.targetRegion, "القاهرة");
  assert.equal(projected?.whatsappNumber, "01000000000");
  assert.equal("targetLat" in (projected || {}), false);
  assert.equal("targetLng" in (projected || {}), false);
  assert.equal("targetRadiusKm" in (projected || {}), false);
  assert.equal("targetInterests" in (projected || {}), false);
  assert.equal("targetAges" in (projected || {}), false);
});
