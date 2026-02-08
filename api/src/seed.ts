import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Read the backup file
    const backupPath = path.join(__dirname, '../../samples/resume-tracker-backup-2026-02-08.json');
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found at:', backupPath);
      console.log('Please make sure the backup file exists in the samples directory');
      process.exit(1);
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    console.log('📁 Backup file loaded successfully');
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.activityLog.deleteMany();
    await prisma.statusHistory.deleteMany();
    await prisma.jobResumeLink.deleteMany();
    await prisma.jobCoverLetterLink.deleteMany();
    await prisma.scraperCache.deleteMany();
    await prisma.jobDescription.deleteMany();
    await prisma.coverLetter.deleteMany();
    await prisma.resume.deleteMany();
    
    const results = {
      resumes: { imported: 0, errors: 0 },
      coverLetters: { imported: 0, errors: 0 },
      jobDescriptions: { imported: 0, errors: 0 },
      scraperCache: { imported: 0, errors: 0 }
    };

    // Import resumes
    if (backupData.resumes && Array.isArray(backupData.resumes)) {
      console.log(`📄 Importing ${backupData.resumes.length} resumes...`);
      for (const resume of backupData.resumes) {
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
    if (backupData.coverLetters && Array.isArray(backupData.coverLetters)) {
      console.log(`📝 Importing ${backupData.coverLetters.length} cover letters...`);
      for (const coverLetter of backupData.coverLetters) {
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
    if (backupData.jobDescriptions && Array.isArray(backupData.jobDescriptions)) {
      console.log(`💼 Importing ${backupData.jobDescriptions.length} job descriptions...`);
      for (const job of backupData.jobDescriptions) {
        try {
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

          const createdJob = await prisma.jobDescription.create({ data: jobData });

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
    if (backupData.scraperCache && Array.isArray(backupData.scraperCache)) {
      console.log(`🗄️ Importing ${backupData.scraperCache.length} cache entries...`);
      for (const cache of backupData.scraperCache) {
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

    // Handle linking after all data is imported
    if (backupData.jobDescriptions && Array.isArray(backupData.jobDescriptions)) {
      console.log('🔗 Creating links between jobs and documents...');
      for (const job of backupData.jobDescriptions) {
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
                if (linkError.code !== 'P2002') {
                  console.error('Error linking cover letter:', linkError);
                }
              }
            }
          }
        } catch (linkError) {
          console.error('Error creating links:', linkError);
        }
      }
    }

    console.log('\n🎉 Database seeding completed!');
    console.log('📊 Results:');
    console.log(`   📄 Resumes: ${results.resumes.imported} imported, ${results.resumes.errors} errors`);
    console.log(`   📝 Cover Letters: ${results.coverLetters.imported} imported, ${results.coverLetters.errors} errors`);
    console.log(`   💼 Job Descriptions: ${results.jobDescriptions.imported} imported, ${results.jobDescriptions.errors} errors`);
    console.log(`   🗄️ Cache: ${results.scraperCache.imported} imported, ${results.scraperCache.errors} errors`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();