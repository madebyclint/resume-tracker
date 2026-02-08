import { AppState, Resume, CoverLetter, JobDescription } from "./types";
import { ScraperCache, ScraperResult } from "./types/scraperTypes";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP API Storage Implementation
 * Replaces IndexedDB with Railway PostgreSQL via REST API
 */
class ApiStorage {
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          response.status,
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      console.error(`API request failed: ${url}`, error);
      throw new ApiError(0, `Network error: ${error.message}`);
    }
  }

  // Resume operations
  async saveResume(resume: Resume): Promise<void> {
    const { id, ...resumeData } = resume;
    
    try {
      // Try to update first
      await this.request(`/resumes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(resumeData)
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // If not found, create new
        await this.request('/resumes', {
          method: 'POST',
          body: JSON.stringify({ id, ...resumeData })
        });
      } else {
        throw error;
      }
    }
  }

  async getResume(id: string): Promise<Resume | null> {
    try {
      return await this.request<Resume>(`/resumes/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async loadResumes(): Promise<Resume[]> {
    return await this.request<Resume[]>('/resumes');
  }

  async deleteResume(id: string): Promise<void> {
    await this.request(`/resumes/${id}`, {
      method: 'DELETE'
    });
  }

  // Cover Letter operations
  async saveCoverLetter(coverLetter: CoverLetter): Promise<void> {
    const { id, ...coverLetterData } = coverLetter;
    
    try {
      await this.request(`/cover-letters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(coverLetterData)
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await this.request('/cover-letters', {
          method: 'POST',
          body: JSON.stringify({ id, ...coverLetterData })
        });
      } else {
        throw error;
      }
    }
  }

  async getCoverLetter(id: string): Promise<CoverLetter | null> {
    try {
      return await this.request<CoverLetter>(`/cover-letters/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async loadCoverLetters(): Promise<CoverLetter[]> {
    return await this.request<CoverLetter[]>('/cover-letters');
  }

  async deleteCoverLetter(id: string): Promise<void> {
    await this.request(`/cover-letters/${id}`, {
      method: 'DELETE'
    });
  }

  // Job Description operations
  async saveJobDescription(jobDescription: JobDescription): Promise<void> {
    const { id, ...jobData } = jobDescription;
    
    try {
      await this.request(`/job-descriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(jobData)
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await this.request('/job-descriptions', {
          method: 'POST',
          body: JSON.stringify({ id, ...jobData })
        });
      } else {
        throw error;
      }
    }
  }

  async getJobDescription(id: string): Promise<JobDescription | null> {
    try {
      return await this.request<JobDescription>(`/job-descriptions/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async loadJobDescriptions(): Promise<JobDescription[]> {
    return await this.request<JobDescription[]>('/job-descriptions');
  }

  async deleteJobDescription(id: string): Promise<void> {
    await this.request(`/job-descriptions/${id}`, {
      method: 'DELETE'
    });
  }

  async archiveJobDescription(id: string): Promise<void> {
    await this.request(`/job-descriptions/${id}/archive`, {
      method: 'POST'
    });
  }

  // Scraper cache operations
  async getScraperCache(inputHash: string): Promise<ScraperCache | null> {
    try {
      return await this.request<ScraperCache>(`/scraper-cache/${inputHash}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async setScraperCache(cache: ScraperCache): Promise<void> {
    await this.request('/scraper-cache', {
      method: 'POST',
      body: JSON.stringify(cache)
    });
  }

  async clearExpiredScraperCache(): Promise<void> {
    await this.request('/scraper-cache/cleanup/expired', {
      method: 'DELETE'
    });
  }

  // State management
  async loadState(): Promise<AppState> {
    try {
      const [resumes, coverLetters, jobDescriptions] = await Promise.all([
        this.loadResumes(),
        this.loadCoverLetters(),
        this.loadJobDescriptions()
      ]);

      return {
        resumes,
        coverLetters,
        jobDescriptions
      };
    } catch (error) {
      console.error('Failed to load state from API:', error);
      
      // Return empty state on error
      return {
        resumes: [],
        coverLetters: [],
        jobDescriptions: []
      };
    }
  }

  async saveState(state: AppState): Promise<void> {
    // In API mode, state is saved automatically when individual items are saved
    // This method is kept for compatibility but doesn't need to do anything
    console.log('State save called - items are saved automatically via API');
  }

  // Migration utilities
  async importFromIndexedDB(data: any): Promise<{ success: boolean; results?: any }> {
    return await this.request('/migration/import-from-indexeddb', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async exportToJson(): Promise<any> {
    return await this.request('/migration/export-to-json');
  }

  // Utility methods for testing
  async clearAllData(): Promise<void> {
    await this.request('/migration/clear-all-data', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' })
    });
  }

  async getStats(): Promise<any> {
    return await this.request('/job-descriptions/stats/summary');
  }

  // Linking operations
  async linkResumeToJob(resumeId: string, jobId: string): Promise<void> {
    await this.request(`/resumes/${resumeId}/link-job/${jobId}`, {
      method: 'POST'
    });
  }

  async unlinkResumeFromJob(resumeId: string, jobId: string): Promise<void> {
    await this.request(`/resumes/${resumeId}/unlink-job/${jobId}`, {
      method: 'DELETE'
    });
  }

  async linkCoverLetterToJob(coverLetterId: string, jobId: string): Promise<void> {
    await this.request(`/cover-letters/${coverLetterId}/link-job/${jobId}`, {
      method: 'POST'
    });
  }

  async unlinkCoverLetterFromJob(coverLetterId: string, jobId: string): Promise<void> {
    await this.request(`/cover-letters/${coverLetterId}/unlink-job/${jobId}`, {
      method: 'DELETE'
    });
  }
}

// Create and export the storage instance
export const storage = new ApiStorage();

// Export all the existing storage functions with API implementations
export const saveResume = (resume: Resume) => storage.saveResume(resume);
export const getResume = (id: string) => storage.getResume(id);
export const loadResumes = () => storage.loadResumes();
export const deleteResume = (id: string) => storage.deleteResume(id);

export const saveCoverLetter = (coverLetter: CoverLetter) => storage.saveCoverLetter(coverLetter);
export const getCoverLetter = (id: string) => storage.getCoverLetter(id);
export const loadCoverLetters = () => storage.loadCoverLetters();
export const deleteCoverLetter = (id: string) => storage.deleteCoverLetter(id);

export const saveJobDescription = (jobDescription: JobDescription) => storage.saveJobDescription(jobDescription);
export const getJobDescription = (id: string) => storage.getJobDescription(id);
export const loadJobDescriptions = () => storage.loadJobDescriptions();
export const deleteJobDescription = (id: string) => storage.deleteJobDescription(id);
export const archiveJobDescription = (id: string) => storage.archiveJobDescription(id);

export const getScraperCache = (inputHash: string) => storage.getScraperCache(inputHash);
export const setScraperCache = (cache: ScraperCache) => storage.setScraperCache(cache);
export const clearExpiredScraperCache = () => storage.clearExpiredScraperCache();

export const loadState = () => storage.loadState();
export const saveState = (state: AppState) => storage.saveState(state);

export default storage;