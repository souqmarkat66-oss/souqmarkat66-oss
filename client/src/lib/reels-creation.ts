/**
 * User-facing errors for the authenticated reel creation endpoints.
 *
 * The API can include additional diagnostic fields (for example, credit
 * counters or balances).  Only the server's message is safe and useful to
 * show in this flow, so callers should pass the parsed message here rather
 * than rendering a whole error response.
 */
export function formatReelCreationError(status: number, message: unknown): string {
  if (message === "subscription_required") {
    return "يلزم تفعيل اشتراك المنصة لإنشاء هذا المحتوى.";
  }
  if (message === "insufficient_credits") {
    return "رصيد الذكاء الاصطناعي غير كافٍ لإتمام هذه العملية.";
  }
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return status
    ? `تعذّر إتمام العملية (رمز الخطأ ${status}). حاول مرة أخرى.`
    : "تعذّر إتمام العملية. حاول مرة أخرى.";
}

export function buildImagesToVideoRequest(
  imageUrls: string[],
  audioUrl?: string,
): { imageUrls: string[]; duration: number; quality: "hd"; format: "vertical"; audioUrl?: string } {
  const request: {
    imageUrls: string[];
    duration: number;
    quality: "hd";
    format: "vertical";
    audioUrl?: string;
  } = {
    imageUrls,
    duration: 3,
    quality: "hd",
    format: "vertical",
  };
  const ownedAudioUrl = audioUrl?.trim();
  if (ownedAudioUrl) request.audioUrl = ownedAudioUrl;
  return request;
}