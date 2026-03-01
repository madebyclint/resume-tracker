# Resume Tracker — Copilot Instructions

## Project Overview
Full-stack job application tracker. Users manage resumes, cover letters, and job descriptions (JDs), track application status through a CRM-like workflow, and use AI to tailor resumes. Includes a Chrome extension for scraping job listings.

## Architecture

### Frontend (`/src`)
- **React 18 + TypeScript**, bundled with Vite (`npm run dev` → `http://localhost:5173`)
- **Plain CSS** — no Tailwind or CSS framework; co-located `.css` files next to components
- **State**: `src/state/AppStateContext.tsx` — single context provider for all app state
- **Storage**: Dual-mode — IndexedDB locally (`src/storage.ts`) or PostgreSQL via API (`src/storageApi.ts`)
- **Pages**: `src/pages/` — `DashboardPage`, `JobDescriptionsPage`, `ResumeFormatterPage`
- **Components**: `src/components/` — feature components, each with co-located `.css` if needed
- **Utils**: `src/utils/` — AI service, PDF/docx extraction, CSV parsing, scraper logic, etc.
- **Types**: `src/types.ts` — all shared domain models (`Resume`, `CoverLetter`, `JobDescription`, etc.)

### Backend API (`/api`)
- **Express + TypeScript**, runs on port 3001 (`npm run dev --prefix api`)
- **Prisma ORM** with **PostgreSQL** (see `api/prisma/schema.prisma`)
- Routes: `resumes`, `coverLetters`, `jobDescriptions`, `scraperCache`, `migration`
- Entry point: `api/src/server.ts`
- Rate limiting, CORS (whitelist via `ALLOWED_ORIGINS` env var), Helmet security headers

### Chrome Extension (`/extension`)
- Manifest V3, background service worker + content script + popup
- Scrapes job listings from pages and sends data to the frontend via `extensionService.ts`

### Run Both Together
```bash
npm run dev:all
```

## Key Domain Models (src/types.ts)
- **Resume** — uploaded `.docx` files, base64-encoded, with extracted text/markdown
- **CoverLetter** — same shape as Resume plus `targetCompany`/`targetPosition`
- **JobDescription** — rich model: extracted info, CRM status fields (`applicationStatus`, `interviewStage`, `offerStage`), salary, contact, source URLs, sequential ID for ordering
- **AppAction** — time-sensitive follow-up actions tied to a job (e.g., "follow up", "reply to offer")

## Current Development Priorities (from TODO.md)
- JD section should be the primary landing page (not Dashboard)
- Remove resume/cover letter generation — keep only chunking/parsing
- Split Resume Formatter into its own section (not inside JD flow)
- Add job search within the JD list
- Add JD page scraping from URL
- Build end-to-end apply workflow (from lookup → submission)
- Fix line numbers in JD list to scroll with content
- Sort by sequential job ID

## Conventions
- All domain types in `src/types.ts` — add fields there first, then update Prisma schema
- Components use co-located CSS files (e.g., `JobEditModal.tsx` + `JobEditModal.css`)
- API routes follow REST conventions; use Prisma for all DB access
- Storage abstraction: `storage.ts` (IndexedDB) and `storageApi.ts` (API) share the same interface — keep them in sync when adding fields
- No UI framework — write plain CSS; match existing styles
- Use `cuid()` for IDs in Prisma models

## Environment Variables
- Frontend: `VITE_OPENAI_API_KEY`, `VITE_OPENAI_API_URL`, `VITE_OPENAI_MODEL`
- Backend: `DATABASE_URL`, `PORT`, `ALLOWED_ORIGINS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `MAX_FILE_SIZE`
- Deployment: Railway (see `railway.toml` and `RAILWAY_MIGRATION_GUIDE.md`)
