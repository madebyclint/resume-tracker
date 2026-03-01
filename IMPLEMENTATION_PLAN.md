# Resume Tracker: Implementation Plan (Updated March 2026)

> **Note**: The original plan targeted Supabase + Vercel. The actual implementation pivoted to **Railway + PostgreSQL + Prisma + Express**. This document reflects current reality.

## Current Status: Pre-MVP, Railway Migration In Progress

### What's Built
- ✅ React + TypeScript + Vite frontend
- ✅ Job descriptions page (main workflow) — largest and most complete feature
- ✅ Resume upload and management
- ✅ Cover letter upload and management
- ✅ Chrome extension for scraping job listings from the browser
- ✅ Express API backend (`api/`) with Prisma ORM
- ✅ Prisma schema for all entities (Resume, CoverLetter, JobDescription, ScraperCache)
- ✅ API routes for all CRUD entities (`/api/resumes`, `/api/cover-letters`, `/api/job-descriptions`)
- ✅ `storageApi.ts` — API-based storage class that replaces IndexedDB
- ✅ `DataMigrationTool.tsx` — UI tool for one-click IndexedDB → Railway migration
- ✅ `RAILWAY_MIGRATION_GUIDE.md` with full setup instructions
- ✅ `railway.toml` deployment config (see Critical Blockers below)
- ✅ Analytics dashboard (basic)
- ✅ Action reminder system
- ✅ CSV import
- ✅ AI service integration (OpenAI) for resume parsing

### Critical Blockers Before Any Deployment
- ❌ **No Dockerfile** — `railway.toml` specifies `builder = "DOCKERFILE"` but no Dockerfile exists in the repo
- ❌ **Prisma schema uses `sqlite`** — must be changed to `postgresql` for Railway; the guide says Railway/PostgreSQL but the schema still says `sqlite`
- ❌ **No auth layer** — the app has no login/user concept; all data is shared/unscoped
- ❌ **No `.env.example`** — new users have no reference for required environment variables
- ❌ **OpenAI key exposed in frontend** — `VITE_OPENAI_API_KEY` is a client-side env variable (visible in browser); must move to backend proxy
- ❌ **Frontend still mounts `DataMigrationTool` in App.tsx** — this should be hidden or removed for production users who never had IndexedDB data
- ❌ **`IMPLEMENTATION_PLAN.md` referenced Supabase** — now reconciled in this update

### What Is NOT Yet Wired Up
- The `storageApi.ts` exists but the frontend `AppStateContext` still reads/writes IndexedDB via `storage.ts`. The migration tool handles a one-time copy but the frontend isn't switched over to API-first storage by default.
- No user-scoped data — all jobs/resumes belong to nobody; multi-user would currently mix all data
- No test suite (unit or integration)

---

## Vision: Fast Ideas. Fast Prototypes. Thoughtful Production.

Building a resume tracker that scales from personal use to premium features, leveraging AI-assisted development velocity with engineering depth for production stability.

## Architecture Overview

### Tier 1: Free/Private (No Login Required)
- **Storage**: IndexedDB (client-side only)
- **Target Users**: Individual job seekers who want privacy
- **Features**: Core job tracking, resume management, basic analytics
- **Limitations**: 
  - Device-specific data (no cross-device sync)
  - Browser storage limits (~50-100MB)
  - No backup/recovery options

### Tier 2: Premium (Login Required)
- **Storage**: Cloud database (Supabase + PostgreSQL)
- **Target Users**: Power users, multi-device users, teams
- **Features**: Everything from Tier 1 + sync, backup, advanced analytics
- **Authentication**: Email/password + OAuth (Google/GitHub)

## Technical Stack (Simplest Path)

### Frontend (Current)
- ✅ React + TypeScript + Vite
- ✅ IndexedDB storage layer
- ✅ Chrome extension integration

### Backend (New)
- **Supabase**: Authentication + Database + Real-time + File storage
- **Vercel**: Hosting and deployment
- **Stripe**: Payment processing

### Why This Stack?
- **Speed**: Supabase auto-generates APIs from schema
- **Simplicity**: Built-in auth, real-time, and security
- **Cost**: Generous free tiers for both services
- **Scalability**: Can handle growth without major rewrites

## Implementation Timeline

### Phase 1: Storage Abstraction (Week 1-2)
**Goal**: Prepare codebase for dual storage modes

#### Tasks:
- [ ] Create `StorageAdapter` interface
- [ ] Refactor current IndexedDB code into `IndexedDBAdapter`
- [ ] Create `StorageContext` for dependency injection
- [ ] Add tier detection logic
- [ ] Update all components to use abstracted storage

#### Files to Modify:
- `src/storage.ts` → Split into adapters
- `src/types.ts` → Add storage adapter types
- `src/state/AppStateContext.tsx` → Add storage switching logic
- All components using direct storage calls

### Phase 2: Cloud Infrastructure (Week 3)
**Goal**: Set up Supabase backend and authentication

#### Tasks:
- [ ] Set up Supabase project
- [ ] Design database schema (jobs, resumes, users, analytics)
- [ ] Implement Row Level Security policies
- [ ] Create `SupabaseAdapter` class
- [ ] Add authentication UI components
- [ ] Implement login/logout flows

#### New Files:
- `src/adapters/IndexedDBAdapter.ts`
- `src/adapters/SupabaseAdapter.ts`
- `src/components/AuthModal.tsx`
- `src/utils/supabase.ts`
- Database migrations in Supabase

### Phase 3: Data Sync & Migration (Week 4)
**Goal**: Seamless transition between storage tiers

#### Tasks:
- [ ] Build data migration tool (IndexedDB → Supabase)
- [ ] Implement real-time sync for premium users
- [ ] Add offline/online detection
- [ ] Create backup/restore functionality
- [ ] Handle sync conflicts gracefully

#### Features:
- One-click migration when upgrading to premium
- Automatic sync across devices for logged-in users
- Offline-first approach with sync when online

### Phase 4: Pricing & Payments (Week 5-6)
**Goal**: Monetization and subscription management

#### Tasks:
- [ ] Set up Stripe integration
- [ ] Create pricing page
- [ ] Implement subscription management
- [ ] Add usage tracking and limits
- [ ] Build customer dashboard
- [ ] Handle payment webhooks

#### New Components:
- `src/components/PricingPage.tsx`
- `src/components/SubscriptionManager.tsx`
- `src/utils/stripe.ts`
- Stripe webhook handlers

### Phase 5: Polish & Production (Week 7-8)
**Goal**: Production-ready launch

#### Tasks:
- [ ] Error handling and loading states
- [ ] Performance optimization
- [ ] Security audit
- [ ] Privacy policy and terms of service
- [ ] Customer support system
- [ ] Analytics and monitoring
- [ ] Final testing and bug fixes

## Pricing Strategy

### Free Tier
- **Price**: $0/month
- **Limits**: 
  - Up to 50 job applications
  - Local storage only
  - Basic analytics
- **Target**: Individual job seekers, students

### Premium Tier
- **Price**: $12/month or $120/year (2 months free)
- **Features**:
  - Unlimited job applications
  - Cross-device sync
  - Advanced analytics & insights
  - Data export (CSV/PDF)
  - Priority support
  - AI-powered suggestions
- **Target**: Active job seekers, professionals

### Future: Teams Tier
- **Price**: $25/user/month
- **Features**:
  - Team collaboration
  - Admin dashboard
  - Custom integrations
  - White-label options
- **Target**: Recruiters, career services

## Production Readiness Checklist

### Security & Compliance
- [ ] HTTPS everywhere
- [ ] Data encryption at rest and in transit
- [ ] GDPR compliance (data export/deletion)
- [ ] Privacy policy and terms of service
- [ ] User consent management

### Performance & Reliability
- [ ] Error boundaries and graceful degradation
- [ ] Performance monitoring (Sentry/LogRocket)
- [ ] Uptime monitoring
- [ ] Database backups and disaster recovery
- [ ] CDN for static assets

### User Experience
- [ ] Mobile responsive design
- [ ] Accessibility compliance (WCAG)
- [ ] Loading states and skeleton screens
- [ ] Offline functionality indicators
- [ ] User onboarding flow

### Business Operations
- [ ] Customer support system (Intercom/Zendesk)
- [ ] Analytics and user tracking
- [ ] Email notifications and marketing
- [ ] Refund and cancellation policies
- [ ] Revenue tracking and reporting

## Key Technical Decisions

### Storage Abstraction Pattern
```typescript
interface StorageAdapter {
  // CRUD operations
  saveJob(job: Job): Promise<void>
  getJobs(filters?: JobFilters): Promise<Job[]>
  deleteJob(id: string): Promise<void>
  
  // Sync capabilities
  sync?(): Promise<void>
  isOnline?(): boolean
}

// Usage in components
const { storageAdapter } = useAppState()
await storageAdapter.saveJob(newJob)
```

### Tier Detection Logic
```typescript
enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium'
}

function determineUserTier(user: User | null): UserTier {
  return user?.subscription?.active ? UserTier.PREMIUM : UserTier.FREE
}
```

### Progressive Enhancement
- Start with free tier (IndexedDB)
- Gracefully upgrade to premium (Supabase)
- Maintain feature parity where possible
- Clear value proposition for upgrade

## Success Metrics

### Technical Metrics
- **Performance**: < 2s initial load time
- **Reliability**: 99.9% uptime
- **Storage**: Handle 10,000+ job applications per user

### Business Metrics
- **Conversion**: 10% free-to-premium conversion rate
- **Retention**: 80% monthly retention for premium users
- **Growth**: 100 new users per week at launch

## Risk Mitigation

### Technical Risks
- **Data Loss**: Comprehensive backup strategy
- **Performance**: Lazy loading and pagination
- **Security**: Regular security audits

### Business Risks
- **Competition**: Focus on unique value proposition (AI integration, simplicity)
- **Pricing**: A/B testing different price points
- **Market Fit**: User feedback loops and rapid iteration

## Revised Next Steps (Railway-First, March 2026)

### Immediate (Unblock Deployment)
1. **Fix Prisma schema** — change `provider = "sqlite"` → `provider = "postgresql"` in `api/prisma/schema.prisma`
2. **Create Dockerfile** — needed for Railway to build and deploy the API service
3. **Create `.env.example`** files (root + api/) so new users know what variables are required
4. **Move OpenAI calls to backend** — proxy AI calls through the Express API to hide the key

### Short Term (Wire Up the Switch)
5. **Switch `AppStateContext` to use `storageApi.ts`** by default when `VITE_API_URL` is set, falling back to IndexedDB when offline/dev
6. **Add user scoping** — at minimum, a per-session or per-device token until full auth is added; required before any multi-user deployment
7. **Remove/hide `DataMigrationTool`** from the production UI (or gate it behind a dev flag)
8. **Lint, type-check, fix build errors** — `npm run type-check` should pass clean before deploying

### MVP Multi-User Readiness (see section below)

---

## File Size Audit (> 200 lines) — March 2026

> No changes made. Audit only. These are candidates for refactoring before production.

| Lines | File | Notes |
|------:|------|-------|
| 3,713 | `src/pages/JobDescriptionsPage.tsx` | **Critical** — must be split into sub-components |
| 1,353 | `src/storage.ts` | Legacy IndexedDB layer — deprecate once Railway is primary |
| 1,229 | `src/utils/aiService.ts` | Too large — split by domain (resume, job, scraper) |
| 993 | `src/components/JobManagementTable.tsx` | Split out row, filters, actions |
| 624 | `src/utils/activityLogger.ts` | Could be trimmed |
| 601 | `src/pages/ResumeFormatterPage.tsx` | Split into formatter + upload sub-pages |
| 531 | `src/utils/resumeFormatter.ts` | Split parsing from formatting logic |
| 487 | `src/components/ActionReminderPanel.tsx` | Split panel from reminder logic |
| 485 | `src/components/JobPreviewModal.tsx` | Split preview panels |
| 444 | `src/utils/actionReminder.ts` | Consolidate with activityLogger or split actions |
| 429 | `src/components/ScraperUploadZone.tsx` | Split scraper states |
| 424 | `src/components/FileUploadSection.tsx` | Extract per-document-type upload logic |
| 418 | `src/utils/csvParser.ts` | Acceptable; add unit tests |
| 393 | `api/src/routes/jobDescriptions.ts` | Split into job CRUD + stats + scraper sub-routes |
| 377 | `src/components/ResumeTable.tsx` | Split table from modal triggers |
| 363 | `src/utils/scraperService.ts` | Acceptable; add unit tests |
| 360 | `src/components/CoverLetterTable.tsx` | Mirrors ResumeTable — consider shared table primitive |
| 355 | `api/src/routes/migration.ts` | Acceptable; deprecate after migration is complete |
| 342 | `extension/content-script.js` | Acceptable for extension; consider TypeScript port |
| 339 | `src/components/JobEditModal.tsx` | Split form sections |
| 328 | `src/components/JobScraperModal.tsx` | Split scraper steps |
| 279 | `src/storageApi.ts` | Acceptable |
| 267 | `src/components/DataMigrationTool.tsx` | Remove from prod UI |
| 261 | `src/components/ScraperStatusIndicator.tsx` | Acceptable |
| 261 | `src/components/StorageMonitor.tsx` | Debug tool — remove from prod |
| 254 | `extension/popup.js` | Acceptable |
| 249 | `src/utils/scraperValidation.ts` | Acceptable |
| 244 | `src/components/CSVImportModal.tsx` | Acceptable |
| 227 | `src/utils/imageExtractor.ts` | Acceptable |
| 212 | `src/pages/DashboardPage.tsx` | Minor refactor |
| 209 | `src/utils/pdfExtractor.ts` | Acceptable |
| 209 | `src/utils/extensionService.ts` | Acceptable |
| 208 | `api/src/routes/coverLetters.ts` | Acceptable |
| 205 | `src/utils/documentMatcher.ts` | Acceptable |

**Summary**: The top 3 priorities for clean-up before production are `JobDescriptionsPage.tsx` (3,713 lines), `storage.ts` (1,353 lines — legacy), and `aiService.ts` (1,229 lines).

---

## MVP Readiness for Other Users

This section defines the minimum work required to hand this off to users who are not the original developer.

### 1. Infrastructure

| Task | Status | Notes |
|------|--------|-------|
| Railway PostgreSQL database provisioned | ⬜ Not done | Create Railway project + PostgreSQL plugin |
| Prisma schema updated to `postgresql` | ⬜ Not done | One-line change in `schema.prisma` |
| Dockerfile created for API service | ⬜ Not done | Required for Railway deployment |
| Frontend deployed (Railway or Vercel) | ⬜ Not done | Point `VITE_API_URL` to the deployed API |
| HTTPS on all endpoints | ⬜ Not done | Railway handles this automatically on deploy |
| Environment variables documented | ⬜ Not done | Create `.env.example` in root and `api/` |

### 2. Security

| Task | Status | Notes |
|------|--------|-------|
| OpenAI key moved to backend | ⬜ Not done | Currently exposed as `VITE_OPENAI_API_KEY` |
| User scoping / auth | ⬜ Not done | Without this, all users share the same data |
| Input sanitization on API | ⬜ Partial | Rate limiting and helmet are in place |
| CORS locked to production domain | ⬜ Not done | Currently allows `localhost:5173` |

### 3. User Experience for New Users

| Task | Status | Notes |
|------|--------|-------|
| Onboarding / empty state screen | ⬜ Not done | New users see a blank table |
| Remove debug UI (StorageMonitor, DatabaseDebugger, DataMigrationTool) | ⬜ Not done | Should be dev-only |
| Error boundaries on all pages | ⬜ Not done | Unhandled errors crash the app |
| Loading states for all async operations | ⬜ Partial | Some are missing |

### 4. Extension Packaging

| Task | Status | Notes |
|------|--------|-------|
| Extension icons (see ICONS_README.md) | ⬜ Not done | Manifest references icons that may not exist |
| Extension published to Chrome Web Store | ⬜ Not done | Currently local install only |
| Extension `API_URL` points to production | ⬜ Not done | Hardcoded to `localhost` in background.js |

### 5. Minimal Auth Strategy (Simplest Path for MVP)

The simplest auth approach that unblocks multi-user without full OAuth:
1. Add a `userId` field to all Prisma models
2. Use a simple email + magic link via [Resend](https://resend.com) or a JWT with a short-lived token
3. Store the token in `localStorage` and pass it as `Authorization: Bearer <token>` on all API calls
4. Add middleware in Express to extract and verify the token, injecting `userId` into all queries

This avoids a full OAuth implementation while making data per-user private.

### 6. Environment Variables Required

**Frontend (`.env` or Railway frontend service)**
```
VITE_API_URL=https://your-api.railway.app/api
VITE_OPENAI_API_KEY=  # Move to backend — do NOT set this in prod frontend
```

**Backend (`api/.env` or Railway backend service)**
```
DATABASE_URL=postgresql://...   # Auto-set by Railway PostgreSQL plugin
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend.railway.app
OPENAI_API_KEY=sk-...           # Move AI calls here
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10mb
```

---

*This plan embodies the principle of "Fast ideas. Fast prototypes. Thoughtful production." — leveraging AI-assisted development for rapid iteration while applying engineering discipline for production stability.*