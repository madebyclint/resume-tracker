import { useState } from 'react';

// Job Description Form Data interface
export interface JobDescriptionFormData {
  title: string;
  company: string;
  sequentialId: string;
  url: string;
  rawText: string;
  role: string;
  location: string;
  workArrangement: 'hybrid' | 'remote' | 'office' | '';
  impact: 'low' | 'medium' | 'high' | '';
  salaryMin: string;
  salaryMax: string;
  source1Type: 'url' | 'text';
  source1Content: string;
  source2Type: 'url' | 'text';
  source2Content: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  applicationDate: string;
  applicationStatus: string;
  notes: string;
  additionalContext: string;
  waitingForResponse: boolean;
  isArchived: boolean;
}

// Initialize empty form data
export const createEmptyFormData = (): JobDescriptionFormData => ({
  title: '',
  company: '',
  sequentialId: '',
  url: '',
  rawText: '',
  role: '',
  location: '',
  workArrangement: '',
  impact: '',
  salaryMin: '',
  salaryMax: '',
  source1Type: 'url',
  source1Content: '',
  source2Type: 'url',
  source2Content: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  applicationDate: '',
  applicationStatus: 'not_applied',
  notes: '',
  additionalContext: '',
  waitingForResponse: false,
  isArchived: false,
});

// Hook for managing form data
export const useJobFormData = (initialData?: Partial<JobDescriptionFormData>) => {
  const [formData, setFormData] = useState<JobDescriptionFormData>(() => ({
    ...createEmptyFormData(),
    ...initialData
  }));

  const updateFormData = (updates: Partial<JobDescriptionFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const resetFormData = (newData?: Partial<JobDescriptionFormData>) => {
    setFormData({
      ...createEmptyFormData(),
      ...newData
    });
  };

  const convertToJobDescription = (formData: JobDescriptionFormData): Partial<JobDescription> => {
    return convertFormDataToJobDescription(formData);
  };

  return {
    formData,
    setFormData,
    updateFormData,
    resetFormData,
    createEmptyFormData,
    convertToJobDescription
  };
};