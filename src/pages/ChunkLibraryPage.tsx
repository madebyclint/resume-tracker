import { useState, useEffect } from 'react';
import { Chunk, Resume, CoverLetter, ChunkType, Document, isResume, isCoverLetter } from '../types';
import { getAllChunks, getChunksBySourceDoc, updateChunk, deleteChunk, deleteAllChunks, exportChunksAsJSON, exportAllDataAsJSON, migrateChunkTypesAndTags } from '../storage';
import { getChunkTypeLabel } from '../utils/aiService';

interface ChunkLibraryPageProps {
  resumes: Resume[];
  coverLetters: CoverLetter[];
}

type SortField = 'type' | 'sourceDoc' | 'order' | 'createdAt' | 'textLength' | 'parsedBy';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export default function ChunkLibraryPage({ resumes, coverLetters }: ChunkLibraryPageProps) {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [filteredChunks, setFilteredChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('all');
  const [selectedChunkType, setSelectedChunkType] = useState<ChunkType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChunk, setEditingChunk] = useState<Chunk | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'sourceDoc', direction: 'asc' });

  // Combine all documents for filtering
  const allDocuments: Document[] = [...resumes, ...coverLetters];

  // Chunk type options for filtering
  const chunkTypeOptions: (ChunkType | 'all')[] = [
    'all',
    // Resume chunk types
    'cv_header',
    'cv_summary',
    'cv_skills',
    'cv_experience_section',
    'cv_experience_bullet',
    'cv_mission_fit',
    // Cover letter chunk types
    'cl_intro',
    'cl_body',
    'cl_closing',
    'cl_company_research',
    'cl_skill_demonstration',
    'cl_achievement_claim',
    'cl_motivation_statement',
    'cl_experience_mapping'
  ];

  // Load all chunks on component mount
  useEffect(() => {
    loadAllChunks();
  }, []);

  // Filter chunks when filters or sort config change
  useEffect(() => {
    applyFilters();
  }, [chunks, selectedDocumentId, selectedChunkType, searchTerm, sortConfig]);

  const loadAllChunks = async () => {
    setLoading(true);
    try {
      const allChunks = await getAllChunks();
      setChunks(allChunks);
    } catch (error) {
      console.error('Failed to load chunks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...chunks];

    // Filter by document
    if (selectedDocumentId !== 'all') {
      filtered = filtered.filter(chunk => chunk.sourceDocId === selectedDocumentId);
    }

    // Filter by chunk type
    if (selectedChunkType !== 'all') {
      filtered = filtered.filter(chunk => chunk.type === selectedChunkType);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(chunk =>
        chunk.text.toLowerCase().includes(term) ||
        chunk.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.field) {
        case 'type':
          return direction * a.type.localeCompare(b.type);

        case 'sourceDoc':
          const aDocName = getDocumentNameById(a.sourceDocId);
          const bDocName = getDocumentNameById(b.sourceDocId);
          const docCompare = aDocName.localeCompare(bDocName);
          // If same document, sort by order
          return docCompare !== 0 ? direction * docCompare : a.order - b.order;

        case 'order':
          return direction * (a.order - b.order);

        case 'createdAt':
          return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        case 'textLength':
          return direction * (a.text.length - b.text.length);

        case 'parsedBy':
          return direction * a.parsedBy.localeCompare(b.parsedBy);

        default:
          return 0;
      }
    });

    setFilteredChunks(filtered);
  };

  const handleEditChunk = (chunk: Chunk) => {
    setEditingChunk({ ...chunk });
  };

  const handleSaveEdit = async () => {
    if (!editingChunk) return;

    try {
      await updateChunk(editingChunk);

      // Update local state
      setChunks(prev => prev.map(chunk =>
        chunk.id === editingChunk.id ? editingChunk : chunk
      ));

      setEditingChunk(null);
    } catch (error) {
      console.error('Failed to update chunk:', error);
      alert('Failed to update chunk. Please try again.');
    }
  };

  const handleDeleteChunk = async (chunkId: string) => {
    if (!confirm('Are you sure you want to delete this chunk?')) return;

    try {
      await deleteChunk(chunkId);
      setChunks(prev => prev.filter(chunk => chunk.id !== chunkId));
    } catch (error) {
      console.error('Failed to delete chunk:', error);
      alert('Failed to delete chunk. Please try again.');
    }
  };

  const handleDeleteAllChunks = async () => {
    if (!confirm('Are you sure you want to delete ALL chunks? This action cannot be undone.')) return;

    if (!confirm('This will permanently delete all parsed chunks from all documents. Are you absolutely sure?')) return;

    try {
      await deleteAllChunks();
      setChunks([]);
      alert('All chunks have been deleted successfully.');

      // Navigate back to dashboard if no chunks remain
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chunksDeleted'));
      }
    } catch (error) {
      console.error('Failed to delete all chunks:', error);
      alert('Failed to delete all chunks. Please try again.');
    }
  };

  const handleExportChunks = async () => {
    try {
      const jsonData = await exportChunksAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chunks-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert(`✅ Successfully exported ${chunks.length} chunks to JSON file!`);
    } catch (error) {
      console.error('Failed to export chunks:', error);
      alert('Failed to export chunks. Please try again.');
    }
  };

  const handleExportAllData = async () => {
    try {
      const jsonData = await exportAllDataAsJSON();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `full-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      alert(`✅ Successfully exported full backup (${resumes.length} resumes, ${chunks.length} chunks) to JSON file!`);
    } catch (error) {
      console.error('Failed to export all data:', error);
      alert('Failed to export all data. Please try again.');
    }
  };

  const handleMigrateChunks = async () => {
    if (!confirm('This will update all existing chunks to use the new chunk type system (cv_ for resumes, cl_ for cover letters) and add proper tag prefixes. Continue?')) {
      return;
    }

    try {
      const result = await migrateChunkTypesAndTags();
      alert(`✅ Migration complete! Updated ${result.updated} out of ${result.total} chunks.`);

      // Reload chunks to see the changes
      loadAllChunks();
    } catch (error) {
      console.error('Failed to migrate chunks:', error);
      alert('Failed to migrate chunks. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingChunk(null);
  };

  const getDocumentNameById = (id: string): string => {
    const document = allDocuments.find(d => d.id === id);
    if (document) {
      const prefix = isResume(document) ? 'Resume: ' : 'Cover Letter: ';
      return `${prefix}${document.name}`;
    }
    return 'Unknown Document';
  };

  if (loading) {
    return (
      <div className="page-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading chunks...</p>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Chunk Library</h2>
          {chunks.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleExportChunks}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
                title="Export all chunks as JSON backup file"
              >
                📥 Export Chunks
              </button>
              <button
                onClick={handleExportAllData}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
                title="Export all data (resumes + chunks) as JSON backup file"
              >
                📦 Export All Data
              </button>
              <button
                onClick={handleMigrateChunks}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
                title="Update existing chunks to new type system (cv_/cl_ prefixes)"
              >
                🔄 Migrate Chunks
              </button>
              <button
                onClick={handleDeleteAllChunks}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                Delete All Chunks
              </button>
            </div>
          )}
        </div>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Manage and organize your parsed resume chunks. Total: {chunks.length} chunks
        </p>

        {/* Debug: Show actual chunk types in database */}
        {(() => {
          const uniqueTypes = [...new Set(chunks.map(chunk => chunk.type))];
          const expectedTypes = chunkTypeOptions.slice(1); // excluding 'all'
          const unexpectedTypes = uniqueTypes.filter(type => !expectedTypes.includes(type as ChunkType));

          if (unexpectedTypes.length > 0) {
            return (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px'
              }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#92400e' }}>
                  ⚠️ Legacy chunk types detected
                </p>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                  Found unexpected chunk types: {unexpectedTypes.join(', ')}
                </p>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#92400e' }}>
                  These need to be migrated to work with the type filter.
                </p>
                <button
                  onClick={handleMigrateChunks}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  Migrate Chunk Types
                </button>
              </div>
            );
          }
          return null;
        })()}

        {/* Filters and Sorting */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Document Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Document:
            </label>
            <select
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value="all">All Documents</option>
              {resumes.map(resume => (
                <option key={resume.id} value={resume.id}>
                  Resume: {resume.name}
                </option>
              ))}
              {coverLetters.map(coverLetter => (
                <option key={coverLetter.id} value={coverLetter.id}>
                  Cover Letter: {coverLetter.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chunk Type Filter */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Type:
            </label>
            <select
              value={selectedChunkType}
              onChange={(e) => setSelectedChunkType(e.target.value as ChunkType | 'all')}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              {chunkTypeOptions.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : getChunkTypeLabel(type as ChunkType)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Sort By:
            </label>
            <select
              value={sortConfig.field}
              onChange={(e) => setSortConfig(prev => ({ ...prev, field: e.target.value as SortField }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value="sourceDoc">Document</option>
              <option value="type">Type</option>
              <option value="order">Order</option>
              <option value="createdAt">Date Created</option>
              <option value="textLength">Text Length</option>
              <option value="parsedBy">Parse Method</option>
            </select>
          </div>

          {/* Sort Direction */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Direction:
            </label>
            <select
              value={sortConfig.direction}
              onChange={(e) => setSortConfig(prev => ({ ...prev, direction: e.target.value as SortDirection }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            >
              <option value="asc">Ascending ↑</option>
              <option value="desc">Descending ↓</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
              Search:
            </label>
            <input
              type="text"
              placeholder="Search text or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        {/* Results Summary */}
        <div style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div>
            Showing {filteredChunks.length} of {chunks.length} chunks
            {selectedDocumentId !== 'all' && ` from ${getDocumentNameById(selectedDocumentId)}`}
            {selectedChunkType !== 'all' && ` of type ${getChunkTypeLabel(selectedChunkType as ChunkType)}`}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Sorted by {sortConfig.field === 'sourceDoc' ? 'Document' :
              sortConfig.field === 'textLength' ? 'Text Length' :
                sortConfig.field === 'createdAt' ? 'Date Created' :
                  sortConfig.field === 'parsedBy' ? 'Parse Method' :
                    sortConfig.field.charAt(0).toUpperCase() + sortConfig.field.slice(1)}
            ({sortConfig.direction === 'asc' ? '↑' : '↓'})
          </div>
        </div>
      </div>

      {/* Chunks List */}
      {filteredChunks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p>No chunks found.</p>
          {chunks.length === 0 ? (
            <p>Upload some resumes and parse them into chunks to get started.</p>
          ) : (
            <p>Try adjusting your filters to see more chunks.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredChunks.map(chunk => (
            <div
              key={chunk.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white'
              }}
            >
              {/* Chunk Header */}
              <div style={{
                padding: '1rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f9fafb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: '#374151',
                    backgroundColor: '#e5e7eb',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px'
                  }}>
                    {getChunkTypeLabel(chunk.type)}
                  </span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: chunk.parsedBy === 'ai' ? '#8b5cf6' : '#22c55e',
                    backgroundColor: chunk.parsedBy === 'ai' ? '#f3f4f6' : '#f0fdf4',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    border: `1px solid ${chunk.parsedBy === 'ai' ? '#8b5cf6' : '#22c55e'}`
                  }}>
                    {chunk.parsedBy === 'ai' ? 'AI Parse' : chunk.parsedBy === 'rules' ? 'Quick Parse' : 'Manual'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {getDocumentNameById(chunk.sourceDocId)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    Order: {chunk.order}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {chunk.text.length} chars
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {new Date(chunk.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEditChunk(chunk)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteChunk(chunk.id)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Chunk Content */}
              <div style={{ padding: '1rem' }}>
                <div style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  color: '#374151',
                  marginBottom: '0.75rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {chunk.text}
                </div>

                {/* Tags */}
                {chunk.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {chunk.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.125rem 0.375rem',
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '12px'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingChunk && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Edit Chunk</h3>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Type:
                </label>
                <select
                  value={editingChunk.type}
                  onChange={(e) => setEditingChunk(prev => prev ? { ...prev, type: e.target.value as ChunkType } : null)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                >
                  {chunkTypeOptions.slice(1).map(type => (
                    <option key={type} value={type}>
                      {getChunkTypeLabel(type as ChunkType)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Text:
                </label>
                <textarea
                  value={editingChunk.text}
                  onChange={(e) => setEditingChunk(prev => prev ? { ...prev, text: e.target.value } : null)}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                  Tags (comma-separated):
                </label>
                <input
                  type="text"
                  value={editingChunk.tags.join(', ')}
                  onChange={(e) => setEditingChunk(prev => prev ? {
                    ...prev,
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                  } : null)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}