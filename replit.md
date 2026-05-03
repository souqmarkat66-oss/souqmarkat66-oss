# Souq Ads Network — شبكة سوق للإعلانات

## Overview

A comprehensive bilingual (Arabic/English) advertising and live streaming platform with AI-powered tools, an ad network like Meta/Google AdSense, and full admin panel.

## User Preferences

Preferred communication style: Arabic/bilingual, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query v5
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Internationalization**: Custom LanguageProvider (Arabic RTL / English LTR)
- **Real-time**: Socket.IO client for live streaming chat + WebRTC

### Backend Architecture
- **Runtime**: Node.js with Express + TypeScript
- **Real-time**: Socket.IO for WebRTC signaling + live chat
- **File Uploads**: Multer (direct file upload to /uploads directory)
- **AI**: OpenAI via Replit AI Integrations
- **Authentication**: Custom email/phone + password auth (`server/customAuth.ts`)
  - bcryptjs for password hashing
  - express-session for session storage (PostgreSQL via connect-pg-simple)
  - Routes: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/set-password`, `GET /api/auth/user`, `POST /api/auth/logout`
  - Fallback: Replit passport session for backward compatibility during migration
  - First-login flow: accounts without password_hash get prompted to set one

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema**: `shared/schema.ts`
- **Tables**:
  - `users`, `sessions` — Auth
  - `ads` — Classified ads with likes/comments/views + targetRegion
  - `channels` — Creator channels (verified, monetized, earningsEGP)
  - `live_streams` — Live streaming sessions (showAds, totalEarningsEGP)
  - `chat_messages` — Live stream chat
  - `likes` — Polymorphic likes (ads, streams, channels)
  - `comments` — Polymorphic comments (isVoice field)
  - `follows` — Channel subscriptions
  - `ad_campaigns` — Meta/AdSense-style ad campaigns (budgetEGP, cpmRateEGP, spentEGP, targetRegions[], targetCategories[], targetLanguages[], embedCode, clickTrackingCode)
  - `ad_impressions` — Track impressions/clicks
  - `revenue_transactions` — Earnings/spending tracking (amountEGP)
  - `reports` — Content moderation
  - `uploaded_files` — Direct file upload records
  - `platform_settings` — Key-value settings (ai_free_credits, ai_price_per_credit_egp, cpm_rate_egp, publisher_rev_share, min_withdrawal_egp)
  - `ai_usage` — Per-user AI credit tracking
  - `reels` — TikTok-style short videos (videoUrl, thumbnailUrl, likes, views, isVoiceComment)
  - `payment_requests` — Withdrawal requests (amountEGP, method, phoneNumber, status)

### Authentication
- **Method**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL

### AI Integrations
- **Provider**: OpenAI via Replit AI Integrations
- **Features**:
  - Ad copy generation (Arabic + English)
  - AI image generation
  - Video ad script generation with scenes
  - Article generation

## Key Features

### Live Streaming (WebRTC)
- Browser-based camera + audio streaming
- WebRTC P2P via Socket.IO signaling
- Real-time chat rooms per stream
- Like reactions in live stream
- Viewer count tracking
- Start/end stream controls with mute/video toggle

### Social Features  
- Like/unlike (ads, streams)
- Comments on ads and streams
- Follow/unfollow channels
- Share and report content

### Ad Network (Meta/AdSense-style)
- Create campaigns with targeting (language, category)
- Budget management with CPM pricing
- Revenue sharing with publishers (60% default)
- AdSense-like embed code for external sites
- Admin approval workflow for campaigns
- Full analytics (impressions, clicks, CTR, spend)

### Channel System
- Create and manage creator channels
- Channel verification and monetization (admin-controlled)
- Channel suspension system
- Subscriber counts with auto-update

### Admin Panel
- Platform statistics dashboard
- Report management (approve/dismiss)
- Campaign approval/rejection
- Channel verification, monetization, suspension

### File Upload System
- Direct file upload (images + videos up to 200MB)
- Stored locally in /uploads directory
- Served via /uploads static route

## API Routes

### Core
- `GET/POST /api/ads` — Ad listings
- `GET/POST /api/channels` — Channels
- `GET/POST /api/streams` — Live streams
- `POST /api/upload` — Direct file upload

### Social
- `POST /api/likes` — Toggle like
- `GET/POST /api/comments/:type/:id` — Comments
- `POST /api/channels/:id/follow` — Follow/unfollow

### Ad Network
- `GET/POST /api/campaigns` — Campaign management
- `GET /api/campaigns/embed.js` — AdSense-like embed script
- `POST /api/campaigns/:id/impression` — Record impression
- `POST /api/campaigns/:id/click` — Record click

### AI
- `POST /api/ai/generate-copy` — Ad copy generation
- `POST /api/ai/generate-article` — Article generation
- `POST /api/ai/generate-video-script` — Video script + scenes

### Admin
- `GET /api/admin/stats` — Platform statistics
- `GET/PUT /api/admin/reports` — Manage reports
- `GET/PUT /api/admin/campaigns` — Manage campaigns
- `GET/PUT /api/admin/channels` — Manage channels

## Frontend Pages
- `/` — Home with live streams, featured ads, top channels
- `/ads` — Browse all ads
- `/ads/:id` — Ad detail with likes/comments
- `/create` — Create ad with AI + direct upload
- `/channels` — Channel directory
- `/channels/:id` — Channel page with streams
- `/streams/:id` — Live stream viewer/broadcaster (WebRTC)
- `/stream/start` — Start new live stream
- `/campaigns` — Advertiser campaign management
- `/revenue` — Publisher revenue dashboard
- `/admin` — Admin panel (stats, reports, campaigns, channels)

## External Dependencies

### Database
- PostgreSQL via `DATABASE_URL`

### AI Services
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Authentication
- Replit OpenID Connect
- `SESSION_SECRET` — Required secret for express-session. Must be set via Replit Secrets (at least 32 random characters). Without it the server throws "secret option required for sessions" and auth will not work.
