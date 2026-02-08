import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/resumes - Get all resumes
router.get('/', async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      orderBy: { uploadDate: 'desc' },
      include: {
        linkedJobDescriptions: {
          include: {
            jobDescription: {
              select: { id: true, title: true, company: true }
            }
          }
        }
      }
    });
    
    // Transform to match expected format
    const transformedResumes = resumes.map(resume => ({
      ...resume,
      linkedJobDescriptions: resume.linkedJobDescriptions.map(link => link.jobDescription)
    }));
    
    res.json(transformedResumes);
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// GET /api/resumes/:id - Get a specific resume
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        linkedJobDescriptions: {
          select: { id: true, title: true, company: true }
        }
      }
    });
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }
    
    res.json(resume);
  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({ error: 'Failed to fetch resume' });
  }
});

// POST /api/resumes - Create a new resume
router.post('/', async (req, res) => {
  try {
    const {
      name,
      fileName,
      fileSize,
      fileData,
      fileType = 'docx',
      textContent,
      markdownContent,
      detectedCompany,
      detectedRole
    } = req.body;

    // Validation
    if (!name || !fileName || !fileData) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, fileName, and fileData' 
      });
    }

    const resume = await prisma.resume.create({
      data: {
        name,
        fileName,
        fileSize: fileSize || 0,
        fileData,
        fileType,
        textContent,
        markdownContent,
        detectedCompany,
        detectedRole
      }
    });
    
    res.status(201).json(resume);
  } catch (error) {
    console.error('Error creating resume:', error);
    res.status(500).json({ error: 'Failed to create resume' });
  }
});

// PUT /api/resumes/:id - Update a resume
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove id from update data to prevent conflicts
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const resume = await prisma.resume.update({
      where: { id },
      data: updateData,
      include: {
        linkedJobDescriptions: {
          select: { id: true, title: true, company: true }
        }
      }
    });
    
    res.json(resume);
  } catch (error) {
    console.error('Error updating resume:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Resume not found' });
    }
    res.status(500).json({ error: 'Failed to update resume' });
  }
});

// DELETE /api/resumes/:id - Delete a resume
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.resume.delete({
      where: { id }
    });
    
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Resume not found' });
    }
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// POST /api/resumes/:id/link-job/:jobId - Link resume to job description
router.post('/:id/link-job/:jobId', async (req, res) => {
  try {
    const { id, jobId } = req.params;
    
    // Create link in junction table
    await prisma.jobResumeLink.create({
      data: {
        resumeId: id,
        jobDescriptionId: jobId
      }
    });
    
    res.json({ message: 'Resume linked to job description successfully' });
  } catch (error) {
    console.error('Error linking resume to job:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Resume is already linked to this job' });
    }
    res.status(500).json({ error: 'Failed to link resume to job description' });
  }
});

// DELETE /api/resumes/:id/unlink-job/:jobId - Unlink resume from job description
router.delete('/:id/unlink-job/:jobId', async (req, res) => {
  try {
    const { id, jobId } = req.params;
    
    // Delete link from junction table
    await prisma.jobResumeLink.deleteMany({
      where: {
        resumeId: id,
        jobDescriptionId: jobId
      }
    });
    
    res.json({ message: 'Resume unlinked from job description successfully' });
  } catch (error) {
    console.error('Error unlinking resume from job:', error);
    res.status(500).json({ error: 'Failed to unlink resume from job description' });
  }
});

export default router;