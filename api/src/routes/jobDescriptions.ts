import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /api/job-descriptions - Get all job descriptions
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, archived, company, search } = req.query;
    
    const where: any = { userId: req.userId };
    
    // Filter by application status
    if (status) {
      where.applicationStatus = status;
    }
    
    // Filter by archived status
    if (archived !== undefined) {
      where.isArchived = archived === 'true';
    }
    
    // Filter by company
    if (company) {
      where.company = {
        contains: company as string,
        mode: 'insensitive'
      };
    }
    
    // Search across multiple fields
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { role: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } },
        { rawText: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    const jobDescriptions = await prisma.jobDescription.findMany({
      where,
      orderBy: [
        { lastActivityDate: 'desc' },
        { uploadDate: 'desc' }
      ],
      include: {
        linkedResumes: {
          include: {
            resume: {
              select: { id: true, name: true }
            }
          }
        },
        linkedCoverLetters: {
          include: {
            coverLetter: {
              select: { id: true, name: true }
            }
          }
        },
        duplicateOf: {
          select: { id: true, title: true, company: true }
        },
        duplicates: {
          select: { id: true, title: true, company: true }
        }
      }
    });
    
    // Transform to match expected format
    const transformedJobDescriptions = jobDescriptions.map(job => ({
      ...job,
      linkedResumes: job.linkedResumes.map(link => link.resume),
      linkedCoverLetters: job.linkedCoverLetters.map(link => link.coverLetter)
    }));
    
    res.json(transformedJobDescriptions);
  } catch (error) {
    console.error('Error fetching job descriptions:', error);
    res.status(500).json({ error: 'Failed to fetch job descriptions' });
  }
});

// GET /api/job-descriptions/:id - Get a specific job description
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const jobDescription = await prisma.jobDescription.findFirst({
      where: { id, userId: req.userId },
      include: {
        linkedResumes: {
          include: {
            resume: true
          }
        },
        linkedCoverLetters: {
          include: {
            coverLetter: true
          }
        },
        statusHistory: {
          orderBy: { date: 'desc' }
        },
        activityLog: {
          orderBy: { timestamp: 'desc' },
          take: 50 // Limit to recent activities
        },
        duplicateOf: true,
        duplicates: true
      }
    });
    
    if (!jobDescription) {
      return res.status(404).json({ error: 'Job description not found' });
    }
    
    // Transform to match expected format
    const transformedJob = {
      ...jobDescription,
      linkedResumes: jobDescription.linkedResumes.map(link => link.resume),
      linkedCoverLetters: jobDescription.linkedCoverLetters.map(link => link.coverLetter)
    };
    
    res.json(transformedJob);
    
    if (!jobDescription) {
      return res.status(404).json({ error: 'Job description not found' });
    }
    
    res.json(jobDescription);
  } catch (error) {
    console.error('Error fetching job description:', error);
    res.status(500).json({ error: 'Failed to fetch job description' });
  }
});

// POST /api/job-descriptions - Create a new job description
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      title,
      company,
      rawText,
      role,
      location,
      workArrangement,
      source1Type,
      source1Content,
      source2Type,
      source2Content,
      salaryMin,
      salaryMax,
      salaryRange,
      contactName,
      contactEmail,
      contactPhone,
      url,
      additionalContext,
      keywords = [],
      extractedInfo = {},
      applicationStatus = 'not_applied',
      priority = 'medium',
      impact = 'medium',
      source,
      contactPerson,
      notes
    } = req.body;

    // Validation
    if (!title || !company || !rawText) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, company, and rawText' 
      });
    }

    // Get next sequential ID (per user)
    const lastJob = await prisma.jobDescription.findFirst({
      where: { userId: req.userId },
      orderBy: { sequentialId: 'desc' },
      select: { sequentialId: true }
    });
    
    const sequentialId = (lastJob?.sequentialId || 0) + 1;

    const jobDescription = await prisma.jobDescription.create({
      data: {
        sequentialId,
        userId: req.userId,
        title,
        company,
        rawText,
        role,
        location,
        workArrangement,
        source1Type,
        source1Content,
        source2Type,
        source2Content,
        salaryMin,
        salaryMax,
        salaryRange,
        contactName,
        contactEmail,
        contactPhone,
        url,
        additionalContext,
        keywords,
        extractedInfo,
        applicationStatus,
        priority,
        impact,
        source,
        contactPerson,
        notes,
        lastActivityDate: new Date()
      }
    });

    // Create initial status history entry
    await prisma.statusHistory.create({
      data: {
        jobDescriptionId: jobDescription.id,
        status: applicationStatus,
        notes: 'Job description created'
      }
    });

    // Create activity log entry
    await prisma.activityLog.create({
      data: {
        jobDescriptionId: jobDescription.id,
        type: 'status_change',
        toValue: { status: applicationStatus },
        description: 'Job description created'
      }
    });
    
    res.status(201).json(jobDescription);
  } catch (error) {
    console.error('Error creating job description:', error);
    res.status(500).json({ error: 'Failed to create job description' });
  }
});

// PUT /api/job-descriptions/:id - Update a job description
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Get current job description for comparison
    const currentJob = await prisma.jobDescription.findFirst({
      where: { id, userId: req.userId }
    });

    if (!currentJob) {
      return res.status(404).json({ error: 'Job description not found' });
    }

    // Extract only known scalar fields — prevents sending relation arrays,
    // computed fields, or frontend-only fields to Prisma which would throw.
    const {
      title,
      company,
      role,
      location,
      workArrangement,
      source1Type,
      source1Content,
      source2Type,
      source2Content,
      salaryMin,
      salaryMax,
      salaryRange,
      contactName,
      contactEmail,
      contactPhone,
      url,
      rawText,
      additionalContext,
      keywords,
      uploadDate,
      extractedInfo,
      applicationStatus,
      interviewStage,
      offerStage,
      isArchived,
      duplicateOfId,
      applicationDate,
      submissionDate,
      source,
      contactPerson,
      secondaryContact,
      priority,
      impact,
      waitingForResponse,
      followUpDate,
      interviewDates,
      salaryDiscussed,
      notes,
      noteItems,
      startDate,
    } = body;

    // Build prisma-safe update payload
    const updateData: Record<string, any> = { lastActivityDate: new Date() };

    const scalarMap: Record<string, any> = {
      title, company, role, location, workArrangement,
      source1Type, source1Content, source2Type, source2Content,
      salaryMin, salaryMax, salaryRange,
      contactName, contactEmail, contactPhone,
      url, rawText, additionalContext,
      applicationStatus, interviewStage, offerStage,
      isArchived, duplicateOfId,
      source, contactPerson, secondaryContact,
      priority, impact, waitingForResponse,
      salaryDiscussed, notes,
    };

    for (const [key, value] of Object.entries(scalarMap)) {
      if (value !== undefined) updateData[key] = value;
    }

    // Serialize array/object fields to strings for storage
    if (keywords !== undefined) {
      updateData.keywords = Array.isArray(keywords) ? keywords.join(',') : (keywords ?? null);
    }
    if (extractedInfo !== undefined) {
      updateData.extractedInfo = typeof extractedInfo === 'string' ? extractedInfo : JSON.stringify(extractedInfo);
    }
    if (noteItems !== undefined) {
      updateData.noteItems = typeof noteItems === 'string' ? noteItems : JSON.stringify(noteItems);
    }
    if (interviewDates !== undefined) {
      updateData.interviewDates = Array.isArray(interviewDates) ? interviewDates.join(',') : (interviewDates ?? null);
    }

    // Convert date strings to Date objects
    if (uploadDate !== undefined) updateData.uploadDate = new Date(uploadDate);
    if (applicationDate !== undefined) updateData.applicationDate = applicationDate ? new Date(applicationDate) : null;
    if (submissionDate !== undefined) updateData.submissionDate = submissionDate ? new Date(submissionDate) : null;
    if (followUpDate !== undefined) updateData.followUpDate = followUpDate ? new Date(followUpDate) : null;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;

    const jobDescription = await prisma.jobDescription.update({
      where: { id },
      data: updateData,
      include: {
        linkedResumes: true,
        linkedCoverLetters: true,
        statusHistory: {
          orderBy: { date: 'desc' },
          take: 10
        }
      }
    });

    // Log status changes to dedicated tables
    if (applicationStatus && applicationStatus !== currentJob.applicationStatus) {
      await prisma.statusHistory.create({
        data: {
          jobDescriptionId: id,
          status: applicationStatus,
          interviewStage: interviewStage,
          offerStage: offerStage,
          notes: notes || `Status changed to ${applicationStatus}`
        }
      });

      await prisma.activityLog.create({
        data: {
          jobDescriptionId: id,
          type: 'status_change',
          fromValue: JSON.stringify({ status: currentJob.applicationStatus }),
          toValue: JSON.stringify({ status: applicationStatus }),
          description: `Status changed from ${currentJob.applicationStatus} to ${applicationStatus}`
        }
      });
    }

    res.json(jobDescription);
  } catch (error) {
    console.error('Error updating job description:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Job description not found' });
    }
    res.status(500).json({ error: 'Failed to update job description' });
  }
});

// DELETE /api/job-descriptions/:id - Delete a job description
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    await prisma.jobDescription.deleteMany({
      where: { id, userId: req.userId }
    });
    
    res.json({ message: 'Job description deleted successfully' });
  } catch (error) {
    console.error('Error deleting job description:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Job description not found' });
    }
    res.status(500).json({ error: 'Failed to delete job description' });
  }
});

// POST /api/job-descriptions/:id/archive - Archive a job description
router.post('/:id/archive', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    await prisma.jobDescription.updateMany({
      where: { id, userId: req.userId },
      data: {
        isArchived: true,
        lastActivityDate: new Date()
      }
    });

    await prisma.activityLog.create({
      data: {
        jobDescriptionId: id,
        type: 'status_change',
        toValue: { archived: true },
        description: 'Job description archived'
      }
    });
    
    res.json({ message: 'Job description archived successfully' });
  } catch (error) {
    console.error('Error archiving job description:', error);
    res.status(500).json({ error: 'Failed to archive job description' });
  }
});

// POST /api/job-descriptions/:id/duplicate/:duplicateId - Mark as duplicate
router.post('/:id/duplicate/:duplicateId', async (req: AuthRequest, res) => {
  try {
    const { id, duplicateId } = req.params;
    
    await prisma.jobDescription.updateMany({
      where: { id, userId: req.userId },
      data: {
        duplicateOfId: duplicateId,
        applicationStatus: 'duplicate',
        lastActivityDate: new Date()
      }
    });
    
    res.json({ message: 'Job description marked as duplicate' });
  } catch (error) {
    console.error('Error marking job as duplicate:', error);
    res.status(500).json({ error: 'Failed to mark job as duplicate' });
  }
});

// GET /api/job-descriptions/stats/summary - Get summary statistics
router.get('/stats/summary', async (req: AuthRequest, res) => {
  try {
    const uid = req.userId;
    const [
      total,
      applied,
      interviewing,
      rejected,
      offered,
      archived
    ] = await Promise.all([
      prisma.jobDescription.count({ where: { userId: uid } }),
      prisma.jobDescription.count({ where: { userId: uid, applicationStatus: 'applied' } }),
      prisma.jobDescription.count({ where: { userId: uid, applicationStatus: 'interviewing' } }),
      prisma.jobDescription.count({ where: { userId: uid, applicationStatus: 'rejected' } }),
      prisma.jobDescription.count({ where: { userId: uid, applicationStatus: 'offered' } }),
      prisma.jobDescription.count({ where: { userId: uid, isArchived: true } })
    ]);
    
    res.json({
      total,
      applied,
      interviewing,
      rejected,
      offered,
      archived,
      pending: total - applied - interviewing - rejected - offered - archived
    });
  } catch (error) {
    console.error('Error getting job stats:', error);
    res.status(500).json({ error: 'Failed to get job statistics' });
  }
});

export default router;