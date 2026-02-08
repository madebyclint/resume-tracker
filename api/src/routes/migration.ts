import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

// POST /api/migration/import-from-indexeddb - Import data from IndexedDB export
router.post('/import-from-indexeddb', async (req, res) => {
  try {
    const { resumes, coverLetters, jobDescriptions, scraperCache } = req.body;
    
    if (!resumes && !coverLetters && !jobDescriptions && !scraperCache) {
      return res.status(400).json({ 
        error: 'No data provided for import' 
      });
    }

    const results = {
      resumes: { imported: 0, errors: 0 },
      coverLetters: { imported: 0, errors: 0 },
      jobDescriptions: { imported: 0, errors: 0 },
      scraperCache: { imported: 0, errors: 0 }
    };

    // Import resumes
    if (resumes && Array.isArray(resumes)) {
      for (const resume of resumes) {
        try {
          await prisma.resume.create({
            data: {
              id: resume.id,
              name: resume.name,
              fileName: resume.fileName,
              fileSize: resume.fileSize || 0,
              uploadDate: new Date(resume.uploadDate),
              fileData: resume.fileData,
              fileType: resume.fileType || 'docx',
              textContent: resume.textContent,
              markdownContent: resume.markdownContent,
              detectedCompany: resume.detectedCompany,
              detectedRole: resume.detectedRole
            }
          });
          results.resumes.imported++;
        } catch (error) {
          console.error('Error importing resume:', error);
          results.resumes.errors++;
        }
      }
    }

    // Import cover letters
    if (coverLetters && Array.isArray(coverLetters)) {
      for (const coverLetter of coverLetters) {
        try {
          await prisma.coverLetter.create({
            data: {
              id: coverLetter.id,
              name: coverLetter.name,
              fileName: coverLetter.fileName,
              fileSize: coverLetter.fileSize || 0,
              uploadDate: new Date(coverLetter.uploadDate),
              fileData: coverLetter.fileData,
              fileType: coverLetter.fileType || 'docx',
              textContent: coverLetter.textContent,
              markdownContent: coverLetter.markdownContent,
              detectedCompany: coverLetter.detectedCompany,
              detectedRole: coverLetter.detectedRole,
              targetCompany: coverLetter.targetCompany,
              targetPosition: coverLetter.targetPosition
            }
          });
          results.coverLetters.imported++;
        } catch (error) {
          console.error('Error importing cover letter:', error);
          results.coverLetters.errors++;
        }
      }
    }

    // Import job descriptions
    if (jobDescriptions && Array.isArray(jobDescriptions)) {
      for (const job of jobDescriptions) {
        try {
          // Convert old structure to new structure
          const jobData = {
            id: job.id,
            sequentialId: job.sequentialId,
            title: job.title,
            company: job.company,
            role: job.role,
            location: job.location,
            workArrangement: job.workArrangement,
            source1Type: job.source1?.type,
            source1Content: job.source1?.content,
            source2Type: job.source2?.type,
            source2Content: job.source2?.content,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryRange: job.salaryRange,
            contactName: job.contact?.name,
            contactEmail: job.contact?.email,
            contactPhone: job.contact?.phone,
            url: job.url,
            rawText: job.rawText,
            additionalContext: job.additionalContext,
            extractedInfo: job.extractedInfo ? JSON.stringify(job.extractedInfo) : null,
            keywords: job.keywords ? job.keywords.join(',') : null,
            uploadDate: new Date(job.uploadDate),
            applicationStatus: job.applicationStatus || 'not_applied',
            interviewStage: job.interviewStage,
            offerStage: job.offerStage,
            isArchived: job.isArchived || false,
            duplicateOfId: job.duplicateOfId,
            applicationDate: job.applicationDate ? new Date(job.applicationDate) : null,
            submissionDate: job.submissionDate ? new Date(job.submissionDate) : null,
            lastActivityDate: job.lastActivityDate ? new Date(job.lastActivityDate) : new Date(job.uploadDate),
            source: job.source,
            contactPerson: job.contactPerson,
            secondaryContact: job.secondaryContact,
            priority: job.priority || 'medium',
            impact: job.impact || 'medium',
            waitingForResponse: job.waitingForResponse || false,
            followUpDate: job.followUpDate ? new Date(job.followUpDate) : null,
            interviewDates: job.interviewDates ? job.interviewDates.join(',') : null,
            salaryDiscussed: job.salaryDiscussed,
            notes: job.notes
          };

          const createdJob = await prisma.jobDescription.create({
            data: jobData
          });

          // Import status history if available
          if (job.statusHistory && Array.isArray(job.statusHistory)) {
            for (const history of job.statusHistory) {
              try {
                await prisma.statusHistory.create({
                  data: {
                    jobDescriptionId: createdJob.id,
                    status: history.status,
                    interviewStage: history.interviewStage,
                    offerStage: history.offerStage,
                    date: new Date(history.date),
                    notes: history.notes
                  }
                });
              } catch (historyError) {
                console.error('Error importing status history:', historyError);
              }
            }
          }

          // Import activity log if available
          if (job.activityLog && Array.isArray(job.activityLog)) {
            for (const activity of job.activityLog) {
              try {
                await prisma.activityLog.create({
                  data: {
                    jobDescriptionId: createdJob.id,
                    timestamp: new Date(activity.timestamp),
                    type: activity.type || 'field_updated',
                    fromValue: activity.fromValue ? JSON.stringify(activity.fromValue) : null,
                    toValue: activity.toValue ? JSON.stringify(activity.toValue) : null,
                    field: activity.field,
                    description: activity.description || `${activity.type} action`
                  }
                });
              } catch (activityError) {
                console.error('Error importing activity log:', activityError);
              }
            }
          }

          results.jobDescriptions.imported++;
        } catch (error) {
          console.error('Error importing job description:', error);
          results.jobDescriptions.errors++;
        }
      }
    }

    // Import scraper cache
    if (scraperCache && Array.isArray(scraperCache)) {
      for (const cache of scraperCache) {
        try {
          await prisma.scraperCache.create({
            data: {
              id: cache.id,
              inputHash: cache.inputHash,
              result: typeof cache.result === 'string' ? cache.result : JSON.stringify(cache.result),
              expiresAt: new Date(cache.expiresAt),
              createdAt: new Date(cache.createdAt)
            }
          });
          results.scraperCache.imported++;
        } catch (error) {
          console.error('Error importing scraper cache:', error);
          results.scraperCache.errors++;
        }
      }
    }

    // After importing job descriptions, handle linking
    if (jobDescriptions && Array.isArray(jobDescriptions)) {
      for (const job of jobDescriptions) {
        try {
          if (job.linkedResumeIds && job.linkedResumeIds.length > 0) {
            for (const resumeId of job.linkedResumeIds) {
              try {
                await prisma.jobResumeLink.create({
                  data: {
                    jobDescriptionId: job.id,
                    resumeId: resumeId
                  }
                });
              } catch (linkError) {
                // Ignore duplicate link errors
                if (linkError.code !== 'P2002') {
                  console.error('Error linking resume:', linkError);
                }
              }
            }
          }

          if (job.linkedCoverLetterIds && job.linkedCoverLetterIds.length > 0) {
            for (const coverLetterId of job.linkedCoverLetterIds) {
              try {
                await prisma.jobCoverLetterLink.create({
                  data: {
                    jobDescriptionId: job.id,
                    coverLetterId: coverLetterId
                  }
                });
              } catch (linkError) {
                // Ignore duplicate link errors
                if (linkError.code !== 'P2002') {
                  console.error('Error linking cover letter:', linkError);
                }
              }
            }
          }
        } catch (linkError) {
          console.error('Error linking documents:', linkError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Data import completed',
      results
    });

  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// GET /api/migration/export-to-json - Export all data to JSON format
router.get('/export-to-json', async (req, res) => {
  try {
    const [resumes, coverLetters, jobDescriptions, scraperCache] = await Promise.all([
      prisma.resume.findMany({
        include: {
          linkedJobDescriptions: {
            select: { jobDescriptionId: true }
          }
        }
      }),
      prisma.coverLetter.findMany({
        include: {
          linkedJobDescriptions: {
            select: { jobDescriptionId: true }
          }
        }
      }),
      prisma.jobDescription.findMany({
        include: {
          linkedResumes: {
            select: { resumeId: true }
          },
          linkedCoverLetters: {
            select: { coverLetterId: true }
          },
          statusHistory: true,
          activityLog: true,
          duplicateOf: true,
          duplicates: true
        }
      }),
      prisma.scraperCache.findMany()
    ]);

    // Transform data to match frontend format
    const transformedResumes = resumes.map(resume => ({
      ...resume,
      linkedJobDescriptions: resume.linkedJobDescriptions.map(link => link.jobDescriptionId)
    }));

    const transformedCoverLetters = coverLetters.map(coverLetter => ({
      ...coverLetter,
      linkedJobDescriptions: coverLetter.linkedJobDescriptions.map(link => link.jobDescriptionId)
    }));

    const transformedJobDescriptions = jobDescriptions.map(job => ({
      ...job,
      linkedResumeIds: job.linkedResumes.map(link => link.resumeId),
      linkedCoverLetterIds: job.linkedCoverLetters.map(link => link.coverLetterId),
      linkedResumes: undefined,
      linkedCoverLetters: undefined
    }));

    const exportData = {
      version: 5,
      timestamp: new Date().toISOString(),
      resumes: transformedResumes,
      coverLetters: transformedCoverLetters,
      jobDescriptions: transformedJobDescriptions,
      scraperCache
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="resume-tracker-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// DELETE /api/migration/clear-all-data - Clear all data (for testing)
router.delete('/clear-all-data', async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({ 
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" } to proceed.' 
      });
    }

    // Delete in correct order to handle foreign key constraints
    await prisma.activityLog.deleteMany();
    await prisma.statusHistory.deleteMany();
    await prisma.jobResumeLink.deleteMany();
    await prisma.jobCoverLetterLink.deleteMany();
    await prisma.scraperCache.deleteMany();
    await prisma.jobDescription.deleteMany();
    await prisma.coverLetter.deleteMany();
    await prisma.resume.deleteMany();

    res.json({ message: 'All data cleared successfully' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Failed to clear data' });
  }
});

export default router;