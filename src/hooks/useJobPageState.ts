import { useState } from 'react';

export interface JobPageState {
  // Tab and UI state
  activeTab: 'job-descriptions' | 'analytics';
  setActiveTab: (tab: 'job-descriptions' | 'analytics') => void;
  
  showReminderSettings: boolean;
  setShowReminderSettings: (show: boolean) => void;
  
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  
  editingJobId: string | null;
  setEditingJobId: (id: string | null) => void;
  
  editingNotesId: string | null;
  setEditingNotesId: (id: string | null) => void;
  
  tempNotes: string;
  setTempNotes: (notes: string) => void;
  
  // Filter states
  showArchivedJobs: boolean;
  setShowArchivedJobs: (show: boolean) => void;
  
  hideRejectedJobs: boolean;
  setHideRejectedJobs: (hide: boolean) => void;
  
  showOnlyWaitingJobs: boolean;
  setShowOnlyWaitingJobs: (show: boolean) => void;
  
  showUnparsedFirst: boolean;
  setShowUnparsedFirst: (show: boolean) => void;
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  duplicateSearchQuery: string;
  setDuplicateSearchQuery: (query: string) => void;
  
  statusFilter: 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | '';
  setStatusFilter: (filter: 'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | '') => void;
  
  // Analytics states
  showExpandedStats: boolean;
  setShowExpandedStats: (show: boolean) => void;
  
  chartType: 'bar' | 'line';
  setChartType: (type: 'bar' | 'line') => void;
  
  // Cache states
  aiParseCache: Map<string, { data: any; hash: string; timestamp: number; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>;
  setAiParseCache: (cache: Map<string, { data: any; hash: string; timestamp: number; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>) => void;
  
  linkedDocumentsSearch: string;
  setLinkedDocumentsSearch: (search: string) => void;
}

export const useJobPageState = (): JobPageState => {
  const [activeTab, setActiveTab] = useState<'job-descriptions' | 'analytics'>('job-descriptions');
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [hideRejectedJobs, setHideRejectedJobs] = useState(true);
  const [showOnlyWaitingJobs, setShowOnlyWaitingJobs] = useState(false);
  const [showUnparsedFirst, setShowUnparsedFirst] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicateSearchQuery, setDuplicateSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'not_applied' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn' | ''>('');
  const [showExpandedStats, setShowExpandedStats] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');
  const [aiParseCache, setAiParseCache] = useState<Map<string, { data: any; hash: string; timestamp: number; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }>>(new Map());
  const [linkedDocumentsSearch, setLinkedDocumentsSearch] = useState('');

  return {
    activeTab,
    setActiveTab,
    showReminderSettings,
    setShowReminderSettings,
    selectedJobId,
    setSelectedJobId,
    editingJobId,
    setEditingJobId,
    editingNotesId,
    setEditingNotesId,
    tempNotes,
    setTempNotes,
    showArchivedJobs,
    setShowArchivedJobs,
    hideRejectedJobs,
    setHideRejectedJobs,
    showOnlyWaitingJobs,
    setShowOnlyWaitingJobs,
    showUnparsedFirst,
    setShowUnparsedFirst,
    searchQuery,
    setSearchQuery,
    duplicateSearchQuery,
    setDuplicateSearchQuery,
    statusFilter,
    setStatusFilter,
    showExpandedStats,
    setShowExpandedStats,
    chartType,
    setChartType,
    aiParseCache,
    setAiParseCache,
    linkedDocumentsSearch,
    setLinkedDocumentsSearch,
  };
};