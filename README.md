# Resume Tracker

Local-first React + TypeScript app that lets you curate resume content chunks, analyze a job description, assemble a tailored resume, and track the resulting application metrics, all without a backend.

## Features
- **Resume Upload & Management** – Upload multiple PDF resume files, view them, and manage your resume library with full-text search capabilities.
- **Dashboard** – View application metrics, manage uploaded resumes with search functionality, and track your resume collection.
- **Local persistence** – App state is stored in IndexedDB with automatic migration from localStorage for better performance and storage capacity.

## Tech Stack
- Vite + React 18 + TypeScript
- Plain CSS for styling (no framework dependency)
- IndexedDB for local data persistence
- PDF.js for PDF text extraction and viewing

## Prerequisites
- Node.js 18+
- npm (comes with Node)

## Getting Started
```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build production assets
npm run build

# Preview the production build locally
npm run preview
```

## Project Structure
```
src/
  App.tsx              # Layout + routing shell
  pages/               # Dashboard for resume management
  state/               # AppState context provider
  storage.ts           # IndexedDB storage with localStorage migration
  types.ts             # Domain models shared across the app
```

## Data & Persistence
- State is managed via `AppStateContext` and persisted to IndexedDB on every change.
- Automatic migration from localStorage to IndexedDB for users upgrading from earlier versions.
- `src/storage.ts` exposes `loadState`/`saveState`/`getEmptyState` and individual resume operations for direct database access.

## Current Features
- Upload multiple PDF resume files with drag-and-drop support
- Automatic text extraction from PDFs for search functionality
- Full-text search across all uploaded resumes
- View PDFs in browser and manage your resume library
- Efficient IndexedDB storage for large files
- Automatic migration from localStorage for existing users

## Next Steps
- Add export/import functionality for data backup and portability
- Implement resume comparison and analysis features
- Add tagging and categorization for better organization
- Enhance PDF viewer with annotation capabilities
