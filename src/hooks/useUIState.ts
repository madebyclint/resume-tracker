import { useState } from 'react';

// Hook for managing UI state
export const useUIState = () => {
  // Tab and view state
  const [activeTab, setActiveTab] = useState<'job-descriptions' | 'analytics'>('job-descriptions');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [hideRejectedJobs, setHideRejectedJobs] = useState(false);
  const [showOnlyWaitingJobs, setShowOnlyWaitingJobs] = useState(false);
  const [showUnparsedFirst, setShowUnparsedFirst] = useState(false);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Edit state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  return {
    // Tab and view state
    activeTab,
    setActiveTab,
    selectedJobId,
    setSelectedJobId,

    // Filter state
    statusFilter,
    setStatusFilter,
    showArchivedJobs,
    setShowArchivedJobs,
    hideRejectedJobs,
    setHideRejectedJobs,
    showOnlyWaitingJobs,
    setShowOnlyWaitingJobs,
    showUnparsedFirst,
    setShowUnparsedFirst,

    // Processing states
    isProcessing,
    setIsProcessing,
    isReparsing,
    setIsReparsing,
    isExporting,
    setIsExporting,
    isImporting,
    setIsImporting,

    // Edit state
    editingJobId,
    setEditingJobId,
    editingNotesId,
    setEditingNotesId,
    tempNotes,
    setTempNotes,
  };
};