---
name: Admin dev-agent architecture
description: How the internal admin AI developer agent works after the multimodal upgrade
---
- Live module is `server/aiAgentRoutes.ts` (camelCase); a duplicate hyphenated module once existed and was the one registered — always confirm which module `routes.ts` imports before editing agent routes.
- Writes are approval-only: no `/write-file` route; file changes only via `/execute` after the admin approves the plan in the UI. Keep it that way.
- Chat supports `model` ("auto" | "openai" | "gemini" | "deepseek"), `webSearch` (Gemini google_search grounding via REST), base64 `attachments`. "auto" routes by keyword intent (ui/code/general) using an admin-configurable routing map (setting `ai_agent_routing`); webSearch/video always force Gemini; DeepSeek has no image support.
- Custom provider API keys: stored in platform_settings under `ai_agent_key_<provider>` encrypted AES-256-GCM with a key derived from SESSION_SECRET (`enc:v1:` prefix, plaintext fallback for legacy). **Why:** avoid plaintext credentials in DB dumps. If SESSION_SECRET changes, stored keys become unreadable and must be re-entered. Routing updates always POST the full routing object to avoid lost-update races.
- Voice: `/api/admin/ai-agent/transcribe` (base64 → speechToText); replies spoken via existing `/api/ai/tts` + use-tts hook.
- Body parsing: 25mb express.json ONLY for paths starting `/api/admin/ai-agent`; everything else default 100kb. **Why:** attachments need size, but a global 25mb limit is a DoS surface.
- Routed admin UI page is `client/src/pages/AiAgent.tsx`; `AdminAiAgent.tsx` is unrouted/buggy leftover.
- Support assistant (`GlobalAssistant` + `/api/ai/chat`) has battle/gift/recharge knowledge in both the local QA map and the server system prompt — update both when platform features change.
