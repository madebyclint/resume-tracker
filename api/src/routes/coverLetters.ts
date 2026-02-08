import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/cover-letters - Get all cover letters
router.get('/', async (req, res) => {
  try {
    const coverLetters = await prisma.coverLetter.findMany({
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
    const transformedCoverLetters = coverLetters.map(coverLetter => ({
      ...coverLetter,
      linkedJobDescriptions: coverLetter.linkedJobDescriptions.map(link => link.jobDescription)
    }));
    
    res.json(transformedCoverLetters);
  } catch (error) {
    console.error('Error fetching cover letters:', error);
    res.status(500).json({ error: 'Failed to fetch cover letters' });
  }
});

// GET /api/cover-letters/:id - Get a specific cover letter
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const coverLetter = await prisma.coverLetter.findUnique({
      where: { id },
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
    
    if (!coverLetter) {
      return res.status(404).json({ error: 'Cover letter not found' });
    }
    
    // Transform to match expected format
    const transformedCoverLetter = {
      ...coverLetter,
      linkedJobDescriptions: coverLetter.linkedJobDescriptions.map(link => link.jobDescription)
    };
    
    res.json(transformedCoverLetter);
  } catch (error) {
    console.error('Error fetching cover letter:', error);
    res.status(500).json({ error: 'Failed to fetch cover letter' });
  }
});

// POST /api/cover-letters - Create a new cover letter
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
      detectedRole,
      targetCompany,
      targetPosition
    } = req.body;

    // Validation
    if (!name || !fileName || !fileData) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, fileName, and fileData' 
      });
    }

    const coverLetter = await prisma.coverLetter.create({
      data: {
        name,
        fileName,
        fileSize: fileSize || 0,
        fileData,
        fileType,
        textContent,
        markdownContent,
        detectedCompany,
        detectedRole,
        targetCompany,
        targetPosition
      }
    });
    
    res.status(201).json(coverLetter);
  } catch (error) {
    console.error('Error creating cover letter:', error);
    res.status(500).json({ error: 'Failed to create cover letter' });
  }
});

// PUT /api/cover-letters/:id - Update a cover letter
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Remove id from update data to prevent conflicts
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const coverLetter = await prisma.coverLetter.update({
      where: { id },
      data: updateData,
      include: {
        linkedJobDescriptions: {
          select: { id: true, title: true, company: true }
        }
      }
    });
    
    res.json(coverLetter);
  } catch (error) {
    console.error('Error updating cover letter:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cover letter not found' });
    }
    res.status(500).json({ error: 'Failed to update cover letter' });
  }
});

// DELETE /api/cover-letters/:id - Delete a cover letter
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.coverLetter.delete({
      where: { id }
    });
    
    res.json({ message: 'Cover letter deleted successfully' });
  } catch (error) {
    console.error('Error deleting cover letter:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cover letter not found' });
    }
    res.status(500).json({ error: 'Failed to delete cover letter' });
  }
});

// POST /api/cover-letters/:id/link-job/:jobId - Link cover letter to job description
router.post('/:id/link-job/:jobId', async (req, res) => {
  try {
    const { id, jobId } = req.params;
    
    // Create link in junction table
    await prisma.jobCoverLetterLink.create({
      data: {
        coverLetterId: id,
        jobDescriptionId: jobId
      }
    });
    
    res.json({ message: 'Cover letter linked to job description successfully' });
  } catch (error) {
    console.error('Error linking cover letter to job:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cover letter is already linked to this job' });
    }
    res.status(500).json({ error: 'Failed to link cover letter to job description' });
  }
});

// DELETE /api/cover-letters/:id/unlink-job/:jobId - Unlink cover letter from job description
router.delete('/:id/unlink-job/:jobId', async (req, res) => {
  try {
    const { id, jobId } = req.params;
    
    // Delete link from junction table
    await prisma.jobCoverLetterLink.deleteMany({
      where: {
        coverLetterId: id,
        jobDescriptionId: jobId
      }
    });
    
    res.json({ message: 'Cover letter unlinked from job description successfully' });
  } catch (error) {
    console.error('Error unlinking cover letter from job:', error);
    res.status(500).json({ error: 'Failed to unlink cover letter from job description' });
  }
});

export default router;