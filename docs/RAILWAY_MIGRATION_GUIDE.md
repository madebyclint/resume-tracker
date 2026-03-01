# Resume Tracker - Railway Migration Guide

This guide will help you migrate your Resume Tracker from browser IndexedDB storage to a Railway PostgreSQL database.

## 🚀 Quick Setup

### 1. Set Up Railway Database

1. **Create Railway Account**: Go to [Railway.app](https://railway.app) and sign up
2. **Create New Project**: Click "New Project"
3. **Add PostgreSQL**: Click "Add PostgreSQL" 
4. **Get Database URL**: Copy the `DATABASE_URL` from the Variables tab

### 2. Set Up Backend API

```bash
# Navigate to API directory
cd api

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your DATABASE_URL
# DATABASE_URL=postgresql://username:password@host:port/database
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Apply database schema
npm run db:push

# Start the development server
npm run dev
```

### 4. Update Frontend Environment

```bash
# In the root directory, create .env.development
echo "VITE_API_URL=http://localhost:3001/api" > .env.development
```

### 5. Start Frontend with Migration Tool

```bash
# Install frontend dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

## 📋 Migration Process

When you refresh your browser, you'll see a "Railway Migration Tool" panel in the top-left corner.

### Option 1: One-Click Migration
1. Click **"Test Railway Connection"** to verify your API is working
2. Click **"Full Migration (Export + Import)"** - this will:
   - Export all data from IndexedDB
   - Import it to Railway database
   - Show migration results

### Option 2: Step-by-Step Migration
1. **Test Railway Connection** - Verify API connectivity
2. **Export from IndexedDB** - Extract your current data
3. **Import to Railway** - Transfer data to PostgreSQL
4. **Delete IndexedDB** - Clean up old storage (only after successful import)
5. **Refresh Page** - Start using Railway storage

## 🔧 Development Commands

### Backend (API)
```bash
cd api

# Development
npm run dev                 # Start dev server with hot reload
npm run build              # Build for production
npm run start              # Start production server

# Database
npm run db:generate        # Generate Prisma client
npm run db:push           # Push schema to database
npm run db:migrate        # Create and apply migrations
npm run db:reset          # Reset database (WARNING: deletes all data)
```

### Frontend
```bash
# Development
npm run dev               # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Type checking
npm run type-check       # Check TypeScript types
```

## 🚀 Railway Deployment

### 1. Deploy Backend to Railway

```bash
# In the API directory
cd api

# Deploy to Railway (install Railway CLI first)
npm install -g @railway/cli
railway login
railway link
railway up
```

### 2. Deploy Frontend to Railway

```bash
# In the root directory  
railway up
```

### 3. Set Environment Variables in Railway

In your Railway dashboard, add these environment variables:

**Backend Service:**
- `DATABASE_URL` - Your PostgreSQL connection string (auto-generated)
- `NODE_ENV` - `production`
- `PORT` - `3001`
- `ALLOWED_ORIGINS` - Your frontend URL

**Frontend Service:**
- `VITE_API_URL` - Your backend service URL + `/api`

## 📊 API Endpoints

### Resumes
- `GET /api/resumes` - Get all resumes
- `POST /api/resumes` - Create new resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume

### Cover Letters
- `GET /api/cover-letters` - Get all cover letters  
- `POST /api/cover-letters` - Create new cover letter
- `PUT /api/cover-letters/:id` - Update cover letter
- `DELETE /api/cover-letters/:id` - Delete cover letter

### Job Descriptions
- `GET /api/job-descriptions` - Get all job descriptions
- `POST /api/job-descriptions` - Create new job description
- `PUT /api/job-descriptions/:id` - Update job description
- `DELETE /api/job-descriptions/:id` - Delete job description
- `GET /api/job-descriptions/stats/summary` - Get statistics

### Migration
- `POST /api/migration/import-from-indexeddb` - Import IndexedDB data
- `GET /api/migration/export-to-json` - Export all data as JSON

## 🔍 Troubleshooting

### Migration Issues
- **"Railway database connection failed"**: Check your `DATABASE_URL` and ensure the API server is running
- **"IndexedDB version conflict"**: Use the Database Debugger to export data first
- **"Import errors"**: Check browser console for detailed error messages

### API Issues
- **Port conflicts**: Change `PORT` in API `.env` file if 3001 is in use
- **CORS errors**: Add your frontend URL to `ALLOWED_ORIGINS` in API environment
- **Database connection**: Verify `DATABASE_URL` format and credentials

### Frontend Issues
- **API not found**: Check `VITE_API_URL` in `.env.development`
- **Build errors**: Run `npm run type-check` to find TypeScript issues

## 📁 Project Structure

```
resume-tracker/
├── api/                    # Backend API
│   ├── src/               # Source code
│   │   ├── routes/        # API endpoints
│   │   └── server.ts      # Express server
│   ├── prisma/            # Database schema
│   └── package.json
├── src/                   # Frontend source
│   ├── components/        # React components
│   ├── utils/            # Utilities
│   ├── storageApi.ts     # New API-based storage
│   └── storage.ts        # Old IndexedDB storage
└── package.json          # Frontend dependencies
```

## 🎯 Benefits of Railway Migration

- ✅ **Persistent Data**: Your data survives browser resets and device changes
- ✅ **Multi-Device Access**: Access from any device with login
- ✅ **Backup & Recovery**: Automatic database backups
- ✅ **Scalability**: Handle larger datasets efficiently
- ✅ **Collaboration**: Share data across team members (future feature)

## 🆘 Need Help?

1. Check the migration tool status messages for specific errors
2. Look at browser developer console for detailed error logs
3. Verify API server is running on `http://localhost:3001`
4. Test database connection using the "Test Railway Connection" button

The migration tool provides real-time status updates and will guide you through any issues!