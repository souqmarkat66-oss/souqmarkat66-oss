# Smart Ads Platform

## Overview

A bilingual (Arabic/English) smart advertising platform that allows users to create, browse, and manage advertisements with AI-powered content generation. The platform supports RTL/LTR layouts, image/video ads, and integrates with OpenAI for generating ad copy and images.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Internationalization**: Custom LanguageProvider supporting Arabic (RTL) and English (LTR)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **Build Tool**: Custom build script using esbuild for server, Vite for client
- **API Design**: REST endpoints under `/api/*` with Zod validation

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` with models in `shared/models/`
- **Tables**: users, sessions (for auth), ads, conversations, messages
- **Migrations**: Drizzle Kit with `db:push` command

### Authentication
- **Method**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL via connect-pg-simple
- **Protected Routes**: Middleware-based with `isAuthenticated` function

### AI Integrations
- **Provider**: OpenAI via Replit AI Integrations
- **Features**: 
  - Ad copy generation (text)
  - Image generation (`gpt-image-1` model)
  - Chat/conversation support
  - Voice chat with audio streaming (PCM16)

### Key Design Patterns
- **Shared Types**: Schema and route definitions shared between client/server via `@shared/*` alias
- **Storage Abstraction**: Interface-based storage classes for database operations
- **Component Library**: shadcn/ui with custom theming for Arabic-inspired color palette

## External Dependencies

### Database
- PostgreSQL (required, connection via `DATABASE_URL` environment variable)

### AI Services
- OpenAI API via Replit AI Integrations
  - `AI_INTEGRATIONS_OPENAI_API_KEY` - API key
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` - Base URL for Replit proxy

### Authentication
- Replit OpenID Connect
  - `ISSUER_URL` - OIDC issuer (defaults to https://replit.com/oidc)
  - `REPL_ID` - Replit environment ID
  - `SESSION_SECRET` - Session encryption secret

### Frontend Libraries
- Google Fonts (Cairo font for Arabic support)
- Radix UI primitives (via shadcn/ui)
- Lucide React icons