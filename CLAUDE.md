# SiteSurge CMS

## Project Overview

SiteSurge (a.k.a. SiteSurge CMS) is a self-hosted, feature-based, block-based general-purpose CMS. Pages, posts, campaigns, forms, users, media, social connections, plus a custom header/footer editor and a global appearance system (swatches, fonts, block-style templates).

Monorepo with three workspaces: `frontend` (SolidJS), `backend` (Express/Node), `shared` (TypeScript types & utils).

**Stack:** SolidJS + Vite | Express + PostgreSQL + Redis | Stripe | Patreon OAuth | S3/Local storage

The repo directory and workspace identifiers (`rw-cms`, `@rw/shared`) are historical and will be renamed in a future cut. Treat them as opaque package names — the product is SiteSurge.

## Core Capabilities
- **Block-based editor** — drag-and-drop blocks (rich text, image, video, hero, carousel, post list, social feed, form, campaign, HTML, spacer)
- **Posts & pages** — drafts, publish, revisions, SSR body for SEO, RSS at `/feed.xml`, full-text search
- **Campaigns + donations** — Stripe Elements, recurring subscriptions, public-donor toggle
- **Forms / surveys / polls** — typed question library, submission inbox, CSV export
- **Users & roles** — email/password + Patreon OAuth, member tiers, gated content, user/IP bans
- **Media library** — sharp thumbnails, local FS or S3
- **Social connections** — pull-based sync (YouTube, Instagram, X, Facebook, TikTok, Patreon); embeddable in posts
- **Header & footer editors** — drag-and-drop rows + columns, fully styled
- **Appearance** — shared color swatches (`swatch:{id}` references), custom fonts (`@font-face` injection), reusable block-style templates
- **Backend SDK** — `cms.*` typed surface for routes / scripts / future plugins
- **First-run setup wizard** — `/setup` walks env, migrations, seed, admin creation
- **PWA + CDN-ready** — static frontend bundle, app shell

## Architecture

```
rw-cms/
├── frontend/     # SolidJS SPA (port 3000, proxies API to 3001)
├── backend/      # Express REST API (port 3001)
└── shared/       # @rw/shared - types and utility functions
```

### Monorepo Setup
- npm workspaces (`frontend`, `backend`, `shared`)
- `npm run dev` runs both frontend and backend via concurrently
- Node >= 20.0.0 required
- Shared package is `@rw/shared` (types + format/validation utils)

## Backend

### Architecture (SOLID Principles)
```
backend/src/
├── repositories/    # Data access layer (SQL queries, row mapping)
│   ├── base.repo.ts       # Shared pagination, findById, updateById, deleteById
│   ├── pages.repo.ts      # Pages & blocks queries
│   ├── posts.repo.ts      # Posts & content blocks queries
│   ├── campaigns.repo.ts  # Campaigns & donations queries
│   ├── users.repo.ts      # Users & bans queries
│   ├── forms.repo.ts      # Forms, questions, submissions queries
│   └── messages.repo.ts   # Contact messages queries
├── routes/          # HTTP layer (validation, auth, response formatting)
├── services/        # Business logic (auth, email, payment, social, audit)
├── middleware/       # Cross-cutting concerns (auth, csrf, content-access, error)
├── utils/           # Shared utilities
│   ├── mapRow.ts          # snake_case → camelCase mapping
│   ├── response.ts        # Standardized API response helpers
│   ├── sanitize.ts        # HTML sanitization (sanitize-html)
│   └── logger.ts          # Winston logger
└── db/              # Database schema, migrations, seed
```

### Entry Points
- `backend/src/index.ts` - main entry, connects DB/Redis, starts server
- `backend/src/app.ts` - Express app factory with middleware chain

### Database
- PostgreSQL with raw `pg` queries (no ORM)
- Schema: `backend/src/db/schema.sql` (idempotent, uses IF NOT EXISTS)
- Migrations: `backend/src/db/migrations/` (numbered SQL files)
- Seed: `backend/src/db/seed.ts` (admin user, sample data)
- Key tables: users, pages, blocks, posts, post_content_blocks, campaigns, donations, forms, form_questions, form_submissions, contact_messages, media, social_connections, social_posts, site_settings, subscription_plans, subscriptions, transactions, audit_log

### Authentication
- JWT access tokens (15min) + refresh tokens (7d)
- Tokens set in httpOnly cookies AND returned in response
- Patreon OAuth flow for member registration
- Email/password for admin accounts (bcrypt, 12 rounds)
- Middleware: `authenticate(required?)`, `requireRole(...roles)`, `requireAdmin`
- Sessions stored in `user_sessions` table

### Routes (all under `/api/v1/`)
| Prefix | File | Auth | Description |
|--------|------|------|-------------|
| /auth | auth.ts | varies | Login, OAuth, refresh, logout |
| /pages | pages.ts | public + admin | CMS pages with blocks |
| /posts | posts.ts | public + admin | Blog posts with content blocks |
| /campaigns | campaigns.ts | public + admin | Fundraising campaigns |
| /payments | payments.ts | varies | Stripe donations & subscriptions |
| /forms | forms.ts | public + admin | Form builder & submissions |
| /users | users.ts | admin | User management & banning |
| /messages | messages.ts | public + admin | Contact form messages |
| /media | media.ts | admin | File upload & management |
| /social | social.ts | public + admin | Social media feed sync |
| /settings | settings.ts | public + admin | Site configuration |
| /search | search.ts | public + admin | Full-text search |
| /health | health.ts | none | Health/readiness checks |

### Services
- **auth** - JWT generation, Patreon OAuth, session management
- **cache** - Redis wrapper with typed get/set and per-entity invalidation helpers
- **email** - Nodemailer SMTP (welcome emails, donation receipts)
- **payment/** - Stripe provider (payment intents, customers, subscriptions)
- **social** - YouTube, Twitter, Facebook, Instagram, TikTok API fetchers
- **storage/** - Local filesystem or S3 (factory pattern), thumbnail generation with sharp

### Config
- `backend/src/config/index.ts` - Zod-validated env vars
- All external service credentials optional (graceful degradation)
- See `.env.example` or README for full variable list

### Key Patterns
- Snake_case in DB, camelCase in API responses (manual mapping in routes)
- Redis caching on public endpoints with pattern-based invalidation
- Multer for file uploads, sharp for image thumbnails, nanoid for filenames
- Custom error classes (AppError, NotFoundError, ValidationError, etc.)
- PostgreSQL triggers for: updated_at, campaign totals, form submission counts, search vectors

## Frontend

### Framework
- SolidJS with `@solidjs/router` and `@solidjs/meta`
- Vite build with solid plugin, SCSS, PWA (workbox)
- Code-split with `lazy()` on all page components

### State Management
- `stores/auth.tsx` - AuthProvider context (user, login, logout, refresh)
- `createSignal` for component state
- `createResource` for async data fetching

### API Client
- `services/api.ts` - ApiService class with get/post/put/patch/delete/upload
- Utility functions: fetchPage, fetchPost, fetchPosts, fetchNavigation, fetchSettings, fetchCampaigns, fetchForm, submitForm, submitContactMessage, fetchSocialPosts, search

### Public Pages
| Route | Component | Description |
|-------|-----------|-------------|
| / | Home | Hero + social feed + campaigns |
| /login | Login | Patreon OAuth + email login |
| /join | Join | Registration |
| /posts | Posts | Blog listing with filters |
| /posts/:slug | Post | Single post view |
| /donate | Donate | Campaign listing |
| /donate/:slug | Campaign | Single campaign + donation form |
| /subscribe | Subscribe | Subscription plans (Stripe) |
| /contact | Contact | Contact form |
| /forms/:slug | Form | Dynamic form rendering |
| /search | Search | Full-text search |
| /:slug | DynamicPage | CMS pages with BlockRenderer |

### Admin Pages (under /admin)
Dashboard, Pages, PageEditor, Posts, PostEditor, Campaigns, CampaignEditor, Forms, FormEditor, Users, Messages, MessageView, Media, Connections, ConnectionEditor, Settings

### Key Components
- **BlockRenderer** - Renders page blocks (hero, rich_text, image, video, post, form, campaign, html)
- **ContentBlock** - Admin block editor wrapper with drag/drop
- **Block types**: TextBlock, ImageBlock, VideoBlock, DocumentBlock, SocialMediaBlock, UrlLinkBlock
- **MediaPickerModal** - Reusable media selection dialog
- **DonationForm** - Stripe Elements integration
- **VideoPlayer** - Plyr-based video player

### Styling
- SCSS with `variables.scss` (colors, typography, spacing, breakpoints, mixins)
- `global.scss` (reset, utilities, rich-text rendering)
- Component-scoped `.scss` files
- Primary color: #e63946, Secondary: #1d3557

## Shared Package (@rw/shared)

### Types (shared/src/types/)
- `api.ts` - ApiResponse, ApiError, ApiMeta, PaginationParams, SearchParams
- `campaign.ts` - Campaign, Donation, DonationIntent, CampaignStats, DonationSummary
- `content.ts` - Page, Block, BlockSettings, Post, SocialPost, Media, NavigationItem, SiteSettings
- `form.ts` - Form, FormQuestion, FormSubmission, FormAnswer, FormResults, QuestionResult
- `message.ts` - ContactMessage, ContactMessageInput, MessageFilters
- `user.ts` - User, UserBan, UserSession, PatreonMembership, LoginCredentials, AuthResponse

### Utils (shared/src/utils/)
- `format.ts` - formatCurrency, formatNumber, formatDate, formatDateTime, formatRelativeTime, formatFileSize, formatPercentage, pluralize
- `validation.ts` - isValidEmail, isValidSlug, isValidPassword, generateSlug, sanitizeHtml, truncate

## Development Commands

```bash
npm run dev              # Start frontend + backend concurrently
npm run dev:frontend     # Frontend only (port 3000)
npm run dev:backend      # Backend only (port 3001)
npm run build            # Build all workspaces
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed initial data
```

## External Services
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Stripe** - Payments (donations + subscriptions)
- **Patreon** - OAuth + membership integration
- **AWS S3** - Optional file storage (falls back to local)
- **SMTP** - Email notifications (optional)
- **Social APIs** - YouTube, Twitter, Instagram, Facebook, TikTok (all optional)

## Important Notes
- No ORM - all SQL is hand-written in route files
- DB field mapping (snake_case → camelCase) done manually in route handlers
- Auth tokens stored in both cookies and response body for flexibility
- Public endpoints are cached in Redis, admin mutations invalidate relevant caches
- File uploads go through multer → sharp (thumbnails) → storage provider
- Social media sync is pull-based (admin triggers sync, posts stored locally)
