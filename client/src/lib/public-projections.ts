/**
 * Public live/channel projections.
 *
 * These are deliberately allow-lists rather than object spreads.  Public
 * endpoints historically returned database rows, which include accounting,
 * payout, and account-contact columns.  The server must apply the same
 * projection before serialising a response; keeping this client-side
 * projection as a second boundary prevents a future public screen from
 * accidentally rendering a newly-added private column.
 */

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstValue(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) return source[key];
  }
  return undefined;
}

export interface PublicChannel {
  id: number;
  userId?: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  language?: string | null;
  category?: string | null;
  subscriberCount?: number | null;
  viewsCount?: number | null;
  isVerified?: boolean | null;
  isMonetized?: boolean | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

/**
 * Account id is an identity used by public profile/follow links, not a
 * balance or payout field.  It remains here for public content lookups; the
 * owner-only route is still the only place that should return publisherCode,
 * wallet fields, or earnings.
 */
export function projectPublicChannel(value: unknown): PublicChannel | null {
  const source = recordOf(value);
  if (!source) return null;
  const id = Number(firstValue(source, "id"));
  if (!Number.isFinite(id)) return null;

  const name = firstValue(source, "name");
  return {
    id,
    userId: firstValue(source, "userId", "user_id") as string | undefined,
    name: typeof name === "string" ? name : "قناة",
    description: firstValue(source, "description") as string | null | undefined,
    avatarUrl: firstValue(source, "avatarUrl", "avatar_url") as string | null | undefined,
    bannerUrl: firstValue(source, "bannerUrl", "banner_url") as string | null | undefined,
    language: firstValue(source, "language") as string | null | undefined,
    category: firstValue(source, "category") as string | null | undefined,
    subscriberCount: firstValue(source, "subscriberCount", "subscriber_count") as number | null | undefined,
    viewsCount: firstValue(source, "viewsCount", "views_count") as number | null | undefined,
    isVerified: firstValue(source, "isVerified", "is_verified") as boolean | null | undefined,
    isMonetized: firstValue(source, "isMonetized", "is_monetized") as boolean | null | undefined,
    status: firstValue(source, "status") as string | null | undefined,
    createdAt: firstValue(source, "createdAt", "created_at") as string | Date | null | undefined,
  };
}

export function projectPublicChannels(value: unknown): PublicChannel[] {
  return Array.isArray(value)
    ? value.map(projectPublicChannel).filter((channel): channel is PublicChannel => !!channel)
    : [];
}

export interface PublicLiveStream {
  id: number;
  channelId?: number;
  userId?: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  category?: string | null;
  language?: string | null;
  streamMode?: "webrtc" | "rtmp" | null;
  status?: string | null;
  viewerCount?: number | null;
  peakViewers?: number | null;
  likesCount?: number | null;
  chatEnabled?: boolean | null;
  showAds?: boolean | null;
  startedAt?: unknown;
  endedAt?: unknown;
  recordingUrl?: string | null;
  createdAt?: unknown;
  // Derived public display values used by live battle/lobby UI.
  channelName?: string | null;
  subscriberCount?: number | null;
  coHostCount?: number | null;
  battleActive?: boolean;
  battleMode?: "1v1" | "2v2" | null;
}

export function projectPublicStream(value: unknown): PublicLiveStream | null {
  const source = recordOf(value);
  if (!source) return null;
  const id = Number(firstValue(source, "id"));
  if (!Number.isFinite(id)) return null;

  const title = firstValue(source, "title");
  const mode = firstValue(source, "battleMode", "battle_mode");
  return {
    id,
    channelId: Number(firstValue(source, "channelId", "channel_id")) || undefined,
    userId: firstValue(source, "userId", "user_id") as string | undefined,
    title: typeof title === "string" ? title : "بث مباشر",
    description: firstValue(source, "description") as string | null | undefined,
    thumbnailUrl: firstValue(source, "thumbnailUrl", "thumbnail_url") as string | null | undefined,
    category: firstValue(source, "category") as string | null | undefined,
    language: firstValue(source, "language") as string | null | undefined,
    streamMode: firstValue(source, "streamMode", "stream_mode") as "webrtc" | "rtmp" | null | undefined,
    status: firstValue(source, "status") as string | null | undefined,
    viewerCount: firstValue(source, "viewerCount", "viewer_count") as number | null | undefined,
    peakViewers: firstValue(source, "peakViewers", "peak_viewers") as number | null | undefined,
    likesCount: firstValue(source, "likesCount", "likes_count") as number | null | undefined,
    chatEnabled: firstValue(source, "chatEnabled", "chat_enabled") as boolean | null | undefined,
    showAds: firstValue(source, "showAds", "show_ads") as boolean | null | undefined,
    startedAt: firstValue(source, "startedAt", "started_at"),
    endedAt: firstValue(source, "endedAt", "ended_at"),
    recordingUrl: firstValue(source, "recordingUrl", "recording_url") as string | null | undefined,
    createdAt: firstValue(source, "createdAt", "created_at"),
    channelName: firstValue(source, "channelName", "channel_name") as string | null | undefined,
    subscriberCount: firstValue(source, "subscriberCount", "subscriber_count") as number | null | undefined,
    coHostCount: firstValue(source, "coHostCount", "cohost_count") as number | null | undefined,
    battleActive: firstValue(source, "battleActive", "battle_active") as boolean | undefined,
    battleMode: mode === "1v1" || mode === "2v2" ? mode : null,
  };
}

export function projectPublicStreams(value: unknown): PublicLiveStream[] {
  return Array.isArray(value)
    ? value.map(projectPublicStream).filter((stream): stream is PublicLiveStream => !!stream)
    : [];
}

/**
 * The profile API uses snake_case while channel/live APIs use camelCase.
 * This function intentionally keeps only public name/avatar/bio and public
 * ad counters.  Location, contact, referral, targeting, and account fields
 * are not public profile data.
 */
export function projectPublicProfile(value: unknown): Record<string, unknown> | null {
  const source = recordOf(value);
  const profileUser = recordOf(source?.user);
  if (!source || !profileUser) return null;

  const publicUser: Record<string, unknown> = {};
  for (const key of ["id", "first_name", "last_name", "profile_image_url", "bio"]) {
    if (profileUser[key] !== undefined) publicUser[key] = profileUser[key];
  }

  const statsSource = recordOf(source.stats);
  const stats = statsSource
    ? {
        count: statsSource.count,
        views: statsSource.views,
        likes: statsSource.likes,
      }
    : source.stats;

  const publicChannel = projectPublicChannel(source.channel);
  const channel = publicChannel
    ? {
        id: publicChannel.id,
        user_id: publicChannel.userId,
        name: publicChannel.name,
        description: publicChannel.description,
        avatar_url: publicChannel.avatarUrl,
        banner_url: publicChannel.bannerUrl,
        language: publicChannel.language,
        category: publicChannel.category,
        subscriber_count: publicChannel.subscriberCount,
        views_count: publicChannel.viewsCount,
        is_verified: publicChannel.isVerified,
        is_monetized: publicChannel.isMonetized,
        status: publicChannel.status,
        created_at: publicChannel.createdAt,
      }
    : source.channel;

  return { user: publicUser, stats, channel };
}
