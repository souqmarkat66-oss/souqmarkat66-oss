---
name: PK battle start & split-screen flow
description: How challenge invites auto-start battles and how each device renders the split screen
---
- Challenge invite accept flow: server keeps `pendingAutoBattles` (streamId → invited userId, 3-min expiry); when that exact authenticated user is admitted as cohost and emits `cohost-broadcaster`, server waits ~2.5s (WebRTC settle) then calls the shared `startRoomBattle()` helper — same strict roster validation as manual `battle-start`. Never bypass that validation; wallet accounting depends on it.
- **Why:** invited players used to land as plain cohosts and the battle never started; users expect accept → battle automatically.
- Split-screen rendering: broadcaster uses local + cohost peer streams; guest cohost uses broadcaster feed + own camera. For RTMP/HLS viewers-turned-guests there is no `srcObject` — use `video.captureStream()` from the playing element to feed the split pane. Plain viewers still see only the main feed + score bar (media forwarding to viewers not implemented; user cancelled that task — don't re-propose).
- Gift pill visibility must not require the WebRTC `streaming` flag alone — also allow `stream.status === "live"` (HLS viewers), or the button disappears and gifting "doesn't work".
