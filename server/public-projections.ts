/**
 * Explicit allow-lists for unauthenticated channel/live discovery responses.
 * Database rows must never be spread into a public API response because they
 * contain accounting, payout, or ingest credential columns.
 */

export function publicChannelProjection(channel: any): Record<string, any> | null {
  if (!channel) return null;
  return {
    id: channel.id,
    userId: channel.userId ?? channel.user_id,
    name: channel.name,
    description: channel.description ?? null,
    avatarUrl: channel.avatarUrl ?? channel.avatar_url ?? null,
    bannerUrl: channel.bannerUrl ?? channel.banner_url ?? null,
    language: channel.language ?? null,
    category: channel.category ?? null,
    subscriberCount: channel.subscriberCount ?? channel.subscriber_count ?? 0,
    viewsCount: channel.viewsCount ?? channel.views_count ?? 0,
    isVerified: channel.isVerified ?? channel.is_verified ?? false,
    isMonetized: channel.isMonetized ?? channel.is_monetized ?? false,
    status: channel.status ?? null,
    createdAt: channel.createdAt ?? channel.created_at ?? null,
  };
}

export function ownerChannelProjection(channel: any): Record<string, any> | null {
  const publicChannel = publicChannelProjection(channel);
  if (!publicChannel) return null;
  return {
    ...publicChannel,
    earnings: channel.earnings ?? 0,
    earningsEGP: channel.earningsEGP ?? channel.earnings_egp ?? 0,
    walletNumber: channel.walletNumber ?? channel.wallet_number ?? null,
    walletType: channel.walletType ?? channel.wallet_type ?? null,
    publisherCode: channel.publisherCode ?? channel.publisher_code ?? null,
  };
}

export function publicLiveStreamProjection(
  stream: any,
  extras: Record<string, any> = {},
): Record<string, any> | null {
  if (!stream) return null;
  const publicRoomState = {
    ...(extras.coHostCount === undefined ? {} : { coHostCount: extras.coHostCount }),
    ...(extras.battleActive === undefined ? {} : { battleActive: extras.battleActive }),
    ...(extras.battleMode === undefined ? {} : { battleMode: extras.battleMode }),
  };
  return {
    id: stream.id,
    channelId: stream.channelId ?? stream.channel_id,
    userId: stream.userId ?? stream.user_id,
    title: stream.title,
    description: stream.description ?? null,
    thumbnailUrl: stream.thumbnailUrl ?? stream.thumbnail_url ?? null,
    category: stream.category ?? null,
    language: stream.language ?? null,
    // WebRTC versus RTMP is public transport metadata; the publish key is not.
    streamMode: stream.streamMode ?? stream.stream_mode ?? null,
    status: stream.status ?? null,
    viewerCount: stream.viewerCount ?? stream.viewer_count ?? 0,
    peakViewers: stream.peakViewers ?? stream.peak_viewers ?? 0,
    likesCount: stream.likesCount ?? stream.likes_count ?? 0,
    chatEnabled: stream.chatEnabled ?? stream.chat_enabled ?? true,
    showAds: stream.showAds ?? stream.show_ads ?? true,
    startedAt: stream.startedAt ?? stream.started_at ?? null,
    endedAt: stream.endedAt ?? stream.ended_at ?? null,
    recordingUrl: stream.recordingUrl ?? stream.recording_url ?? null,
    createdAt: stream.createdAt ?? stream.created_at ?? null,
    // Derived public room state is safe; totalEarningsEGP, streamKey, and RTMP
    // tokens intentionally have no representation in this projection.
    ...publicRoomState,
  };
}

export function publicAdProjection(ad: any): Record<string, any> | null {
  if (!ad) return null;
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description ?? null,
    mediaUrl: ad.mediaUrl ?? ad.media_url ?? null,
    mediaType: ad.mediaType ?? ad.media_type ?? null,
    language: ad.language ?? null,
    status: ad.status ?? null,
    userId: ad.userId ?? ad.user_id,
    likesCount: ad.likesCount ?? ad.likes_count ?? 0,
    commentsCount: ad.commentsCount ?? ad.comments_count ?? 0,
    viewsCount: ad.viewsCount ?? ad.views_count ?? 0,
    priceEGP: ad.priceEGP ?? ad.price_egp ?? null,
    // Customer-facing contact/offer fields are public ad content.
    targetRegion: ad.targetRegion ?? ad.target_region ?? null,
    whatsappNumber: ad.whatsappNumber ?? ad.whatsapp_number ?? null,
    paymentLink: ad.paymentLink ?? ad.payment_link ?? null,
    appStoreUrl: ad.appStoreUrl ?? ad.app_store_url ?? null,
    googlePlayUrl: ad.googlePlayUrl ?? ad.google_play_url ?? null,
    appGalleryUrl: ad.appGalleryUrl ?? ad.app_gallery_url ?? null,
    installmentMonths: ad.installmentMonths ?? ad.installment_months ?? null,
    installmentMonthlyEGP: ad.installmentMonthlyEGP ?? ad.installment_monthly_egp ?? null,
    couponCode: ad.couponCode ?? ad.coupon_code ?? null,
    couponDiscountType: ad.couponDiscountType ?? ad.coupon_discount_type ?? null,
    couponDiscountValue: ad.couponDiscountValue ?? ad.coupon_discount_value ?? null,
    isBoosted: ad.isBoosted ?? ad.is_boosted ?? false,
    isAdminPromo: ad.isAdminPromo ?? ad.is_admin_promo ?? false,
    createdAt: ad.createdAt ?? ad.created_at ?? null,
    expiresAt: ad.expiresAt ?? ad.expires_at ?? null,
  };
}
