import React, { useState } from 'react';
import { JobScraperModal } from '../components/JobScraperModal';
import { JobDescription } from '../types';

// Temporary test component to access the scraper modal
export function ScraperTestButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleJobCreated = (job: JobDescription) => {
    console.log('Job created from scraper:', job);
    setIsModalOpen(false);
    alert('Job scraped successfully! Check console for details.');
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: '#007bff',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🔍 Test Scraper
      </button>

      {isModalOpen && (
        <JobScraperModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onJobCreated={handleJobCreated}
        />
      )}
    </>
  );
}