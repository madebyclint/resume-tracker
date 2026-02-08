import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/job-descriptions - Get all job descriptions
router.get('/', async (req, res) => {
  try {
    const { status, archived, company, search } = req.query;
    
    const where: any = {};
    
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobDescription = await prisma.jobDescription.findUnique({
      where: { id },
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
router.post('/', async (req, res) => {
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

    // Get next sequential ID
    const lastJob = await prisma.jobDescription.findFirst({
      orderBy: { sequentialId: 'desc' },
      select: { sequentialId: true }
    });
    
    const sequentialId = (lastJob?.sequentialId || 0) + 1;

    const jobDescription = await prisma.jobDescription.create({
      data: {
        sequentialId,
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
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.sequentialId;
    
    // Get current job description for comparison
    const currentJob = await prisma.jobDescription.findUnique({
      where: { id }
    });
    
    if (!currentJob) {
      return res.status(404).json({ error: 'Job description not found' });
    }

    // Update lastActivityDate
    updateData.lastActivityDate = new Date();
    
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

    // Log status changes
    if (updateData.applicationStatus && updateData.applicationStatus !== currentJob.applicationStatus) {
      await prisma.statusHistory.create({
        data: {
          jobDescriptionId: id,
          status: updateData.applicationStatus,
          interviewStage: updateData.interviewStage,
          offerStage: updateData.offerStage,
          notes: updateData.notes || `Status changed to ${updateData.applicationStatus}`
        }
      });

      await prisma.activityLog.create({
        data: {
          jobDescriptionId: id,
          type: 'status_change',
          fromValue: { status: currentJob.applicationStatus },
          toValue: { status: updateData.applicationStatus },
          description: `Status changed from ${currentJob.applicationStatus} to ${updateData.applicationStatus}`
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.jobDescription.delete({
      where: { id }
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
router.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    const jobDescription = await prisma.jobDescription.update({
      where: { id },
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
    
    res.json(jobDescription);
  } catch (error) {
    console.error('Error archiving job description:', error);
    res.status(500).json({ error: 'Failed to archive job description' });
  }
});

// POST /api/job-descriptions/:id/duplicate/:duplicateId - Mark as duplicate
router.post('/:id/duplicate/:duplicateId', async (req, res) => {
  try {
    const { id, duplicateId } = req.params;
    
    await prisma.jobDescription.update({
      where: { id },
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
router.get('/stats/summary', async (req, res) => {
  try {
    const [
      total,
      applied,
      interviewing,
      rejected,
      offered,
      archived
    ] = await Promise.all([
      prisma.jobDescription.count(),
      prisma.jobDescription.count({ where: { applicationStatus: 'applied' } }),
      prisma.jobDescription.count({ where: { applicationStatus: 'interviewing' } }),
      prisma.jobDescription.count({ where: { applicationStatus: 'rejected' } }),
      prisma.jobDescription.count({ where: { applicationStatus: 'offered' } }),
      prisma.jobDescription.count({ where: { isArchived: true } })
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