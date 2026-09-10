import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectPublicChannel,
  projectPublicProfile,
  projectPublicStream,
} from "./public-projections";

test("public channel projection keeps follower-facing fields and drops accounting/payout fields", () => {
  const channel = projectPublicChannel({
    id: 12,
    user_id: "owner-1",
    name: "قناة عامة",
    subscriber_count: 42,
    earnings: 9999,
    earnings_egp: 1234,
    wallet_number: "01000000000",
    wallet_type: "vodafone",
    publisher_code: "private-publisher-code",
  });

  assert.deepEqual(channel, {
    id: 12,
    userId: "owner-1",
    name: "قناة عامة",
    description: undefined,
    avatarUrl: undefined,
    bannerUrl: undefined,
    language: undefined,
    category: undefined,
    subscriberCount: 42,
    viewsCount: undefined,
    isVerified: undefined,
    isMonetized: undefined,
    status: undefined,
    createdAt: undefined,
  });
  assert.equal("earnings" in (channel || {}), false);
  assert.equal("walletNumber" in (channel || {}), false);
  assert.equal("publisherCode" in (channel || {}), false);
});

test("public live projection does not carry broadcaster earnings or stream credentials", () => {
  const stream = projectPublicStream({
    id: 7,
    channel_id: 12,
    user_id: "owner-1",
    title: "على الهواء",
    viewer_count: 18,
    likes_count: 4,
    total_earnings_egp: 500,
    stream_key: "secret-stream-key",
    wallet_number: "01000000000",
    email: "owner@example.test",
  });

  assert.equal(stream?.id, 7);
  assert.equal(stream?.channelId, 12);
  assert.equal(stream?.viewerCount, 18);
  assert.equal("totalEarningsEGP" in (stream || {}), false);
  assert.equal("streamKey" in (stream || {}), false);
  assert.equal("walletNumber" in (stream || {}), false);
  assert.equal("email" in (stream || {}), false);
});

test("public profile projection keeps names/avatar/bio and removes personal and channel-private fields", () => {
  const profile = projectPublicProfile({
    user: {
      id: "user-1",
      first_name: "مستخدم",
      last_name: "عام",
      profile_image_url: "/avatar.png",
      bio: "نبذة عامة",
      email: "user@example.test",
      phone: "01000000000",
      referral_code: "PRIVATE",
      interests: "finance",
      birthday: "2000-01-01",
      city: "مدينة خاصة",
    },
    stats: { count: "2", views: "20", likes: "3", private_total: 90 },
    channel: {
      id: 8,
      user_id: "user-1",
      name: "قناة",
      subscriber_count: 20,
      earnings_egp: 999,
      wallet_number: "01000000000",
      publisher_code: "PRIVATE",
    },
  });

  assert.deepEqual(profile?.user, {
    id: "user-1",
    first_name: "مستخدم",
    last_name: "عام",
    profile_image_url: "/avatar.png",
    bio: "نبذة عامة",
  });
  assert.deepEqual(profile?.stats, { count: "2", views: "20", likes: "3" });
  assert.equal((profile?.channel as any)?.subscriber_count, 20);
  assert.equal("earnings_egp" in ((profile?.channel || {}) as object), false);
  assert.equal("wallet_number" in ((profile?.channel || {}) as object), false);
});
