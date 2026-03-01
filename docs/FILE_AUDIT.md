# File Audit — March 1, 2026

## Docs Folder Relevance

| File | Lines | Assessment |
|------|-------|------------|
| `docs/TODO.md` | 21 | **Keep** — active priorities list |
| `docs/architect.md` | 73 | **Questionable** — AI persona/role doc, only useful if used as a system prompt |
| `docs/MARKDOWN_PROMPT_VALIDATOR.md` | 66 | **Questionable** — tooling doc; unclear if still in use |
| `docs/implementor.md` | 101 | **Questionable** — AI persona doc |
| `docs/peerreviewer.md` | 127 | **Questionable** — AI persona doc |
| `docs/qa.md` | 185 | **Questionable** — AI persona doc |
| `docs/RAILWAY_MIGRATION_GUIDE.md` | 215 | **Keep** — still relevant for deployment |
| `docs/TEST_CASES.md` | 225 | **Review** — may have stale test cases vs current features |
| `docs/IMPLEMENTATION_PLAN.md` | 417 | **Likely stale** — probably has many completed items; could be archived or replaced by TODO.md |
| `docs/JOB_SCRAPER_TECHNICAL_SPECIFICATION.md` | 1223 | **Review** — large spec; may be partially outdated if scraper is already built |

> The 4 persona docs (`architect.md`, `implementor.md`, `peerreviewer.md`, `qa.md`) are AI workflow role prompts — worth keeping only if actively used as system prompts.

---

## Source Files Over 200 Lines (Optimization Candidates)

### Critical (1000+ lines)

| File | Lines | Notes |
|------|-------|-------|
| `src/pages/JobDescriptionsPage.tsx` | 4,065 | Biggest refactor target — monolithic page component |
| `src/pages/JobDescriptionsPage.css` | 3,742 | Should be split by feature/section |
| `src/storage.ts` | 1,375 | IndexedDB layer — could be split by domain (resumes, jobs, covers) |
| `src/utils/aiService.ts` | 1,229 | Split by feature (resume AI, JD AI, formatting AI) |
| `src/components/JobManagementTable.tsx` | 993 | Extract sub-components (row, filters, sorting) |
| `src/components/JobManagementTable.css` | 953 | Co-locate with sub-components when split |

### High (500–999 lines)

| File | Lines |
|------|-------|
| `src/components/ActionReminderPanel.css` | 773 |
| `src/utils/activityLogger.ts` | 654 |
| `src/pages/ResumeFormatterPage.tsx` | 601 |
| `src/utils/resumeFormatter.ts` | 531 |
| `src/components/ActionReminderPanel.tsx` | 486 |
| `src/components/JobPreviewModal.css` | 487 |
| `src/components/JobPreviewModal.tsx` | 444 |
| `src/utils/actionReminder.ts` | 429 |
| `src/components/ScraperUploadZone.tsx` | 429 |
| `src/components/FileUploadSection.tsx` | 424 |
| `src/utils/csvParser.ts` | 418 |
| `api/src/routes/jobDescriptions.ts` | 406 |

### Medium (200–400 lines)

| File | Lines |
|------|-------|
| `src/components/ScraperStatusIndicator.css` | 401 |
| `src/components/JobScraperModal.css` | 393 |
| `src/components/ResumeTable.tsx` | 381 |
| `src/components/JobEditModal.tsx` | 377 |
| `src/utils/scraperService.ts` | 363 |
| `src/components/CoverLetterTable.tsx` | 360 |
| `api/src/routes/migration.ts` | 355 |
| `extension/content-script.js` | 339 |
| `src/components/JobScraperModal.tsx` | 330 |
| `src/storageApi.ts` | 298 |
| `src/components/DataMigrationTool.tsx` | 279 |
| `src/components/ScraperStatusIndicator.tsx` | 261 |
| `src/components/StorageMonitor.tsx` | 261 |
| `src/utils/scraperValidation.ts` | 249 |
| `src/components/CSVImportModal.tsx` | 244 |
| `src/utils/imageExtractor.ts` | 227 |
| `src/pages/DashboardPage.tsx` | 226 |

---

## Top Refactor Priority

`src/pages/JobDescriptionsPage.tsx` at 4,065 lines is the biggest risk — should be broken into sub-components (job list, filter bar, detail panel, etc.). This also aligns with TODO items about splitting the JD section into its own primary landing page.
