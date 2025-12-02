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

### 1. Environment Setup
Copy the example environment file and configure your OpenAI API key:
```bash
cp .env.example .env
```

Edit `.env` and replace `your_openai_api_key_here` with your actual OpenAI API key:
```env
VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
VITE_OPENAI_API_URL=https://api.openai.com/v1/chat/completions
VITE_OPENAI_MODEL=gpt-3.5-turbo
```

**Get your OpenAI API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it to your `.env` file

### 2. Install and Run
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
- **📄 Document Management**: Upload multiple Word (.docx) resume files with automatic text extraction
- **🔍 Full-text Search**: Search across all uploaded resumes and extracted text content
- **🤖 Hybrid Parsing System**: 
  - **Quick Parse**: Fast rule-based parsing (no AI required)
  - **AI Parse**: Advanced semantic parsing using OpenAI GPT
- **✏️ Chunk Review & Editing**: Review, edit, and approve generated chunks before saving
- **🧩 Chunk Library**: Dedicated interface to manage, filter, and organize all parsed chunks
- **🏷️ Smart Tagging**: Automatic tag extraction for skills, technologies, and competencies
- **💾 Local Storage**: Efficient IndexedDB storage for large files and chunk data
- **🔄 Data Migration**: Automatic migration from localStorage for existing users

## Parsing Methods

### **🚀 Quick Parse (Rule-Based)**
- **Fast**: No API calls, instant results
- **Reliable**: Works offline, no external dependencies
- **Good for**: Basic document structure, contact info, skills lists, experience bullets
- **Identifies**: Section headers, bullet points, date ranges, job titles, skills

### **🤖 AI Parse (OpenAI)**
- **Smart**: Context-aware semantic understanding
- **Flexible**: Handles complex layouts and varied formats  
- **Good for**: Nuanced content classification, quality assessment, semantic grouping
- **Requires**: OpenAI API key configuration

## Analytics Features
- **📊 Application Funnel**: Visual progression through application stages
- **📈 Conversion Rates**: Success metrics at each stage (applied → interview → hired)
- **🔄 Journey Analysis**: Tracks comprehensive application history including status corrections
- **⚠️ Status Change Detection**: Automatically detects and flags rapid status changes that may indicate user corrections or data entry mistakes
- **📋 Activity Summary**: Complete audit trail of all status changes and activities

### Status Change Intelligence
The app automatically detects when jobs have had rapid status changes (within 1 hour), which often indicates:
- Accidental status updates that were quickly corrected
- Data entry mistakes during bulk updates
- Testing or exploring the interface

Jobs with detected corrections are marked with a ⚠️ icon and provide detailed information about what changes occurred. The analytics system accounts for these corrections to provide more accurate conversion rates and funnel analysis.

## Next Steps: Phase 2
- **📋 Job Description Analysis**: Parse and analyze job postings
- **🎯 Chunk Matching**: Match relevant chunks to JD requirements  
- **📝 Resume Generation**: Assemble tailored resumes from selected chunks
- **📤 Export/Import**: Data backup and portability features
