---
name: RTMP on Node-Media-Server v4
description: Non-obvious NMS v4 event, authentication, HLS, and reconnect constraints.
---

Node-Media-Server v4 must be treated as an RTMP ingest server, not as the old combined RTMP/transcoding/HTTP server. Generate HLS in a separately owned FFmpeg process and serve it from the application's existing HTTP server.

**Why:** The legacy `trans`/HTTP arrangement opens a competing web port and is incompatible with v4. NMS v4 also emits `prePublish` before authentication, emits `postPublish` before assigning the publisher, exposes the active publisher as `publisher`, and may parse buffered packets from a rejected duplicate unless that session's packet callback is disabled.

**How to apply:** Require signed publish credentials, reject duplicates before replacing stream ownership, serialize per-key status effects, and tie FFmpeg/timers/cleanup to a session generation. A stale disconnect must never kill, end, or delete HLS for a newer generation.

For RTMP-to-HLS integration tests, poll the HLS file on disk before fetching it. The development SPA fallback may return HTTP 200 for a missing playlist, so HTTP status alone is not proof that HLS exists.