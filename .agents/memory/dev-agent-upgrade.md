---
name: Admin dev-agent architecture
description: How the internal admin AI developer agent works after the multimodal upgrade
---
- Live module is `server/aiAgentRoutes.ts` (camelCase); a duplicate hyphenated module once existed and was the one registered — always confirm which module `routes.ts` imports before editing agent routes.
- Writes are approval-only: no `/write-file` route; file changes only via `/execute` after the admin approves the plan in the UI. Keep it that way.
- Chat supports `model` ("openai" gpt-4o / "gemini"), `webSearch` (Gemini google_search grounding via REST, key = GEMINI_API_KEY || GOOGLE_API_KEY), base64 `attachments` (video/webSearch auto-route to Gemini; images work on both).
- Voice: `/api/admin/ai-agent/transcribe` (base64 → speechToText); replies spoken via existing `/api/ai/tts` + use-tts hook.
- Body parsing: 25mb express.json ONLY for paths starting `/api/admin/ai-agent`; everything else default 100kb. **Why:** attachments need size, but a global 25mb limit is a DoS surface.
- Routed admin UI page is `client/src/pages/AiAgent.tsx`; `AdminAiAgent.tsx` is unrouted/buggy leftover.
- Support assistant (`GlobalAssistant` + `/api/ai/chat`) has battle/gift/recharge knowledge in both the local QA map and the server system prompt — update both when platform features change.
