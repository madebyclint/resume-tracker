import * as mammoth from 'mammoth';
import { Resume } from '../types';

export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
}

// Word document text extraction
async function extractTextFromWord(fileData: string): Promise<string> {
  try {
    console.log('=== WORD DOCUMENT EXTRACTION START ===');
    const base64Data = fileData.split(',')[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    // Convert Uint8Array to ArrayBuffer
    const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);

    const result = await mammoth.extractRawText({ arrayBuffer });
    console.log('✅ Word extraction successful:', result.value.length, 'characters');
    return result.value;
  } catch (error) {
    console.error('❌ Word extraction failed:', error);
    return '';
  }
}

// Alternative text extraction using manual text input fallback
async function extractTextViaManualInput(fileName: string): Promise<string> {
  return new Promise((resolve) => {
    const userText = prompt(`Document text extraction failed for "${fileName}".\n\nPlease copy and paste the text content:\n\n1. Open your document\n2. Select all text (Cmd+A)\n3. Copy (Cmd+C)\n4. Paste below:`);
    resolve(userText || '');
  });
}

export async function extractTextFromDocument(resume: Resume): Promise<string> {
  console.log('=== WORD DOCUMENT TEXT EXTRACTION START ===');

  // Word document extraction
  const wordText = await extractTextFromWord(resume.fileData);
  if (wordText && wordText.trim().length > 0) {
    return wordText.trim();
  }

  // Fallback to manual input if Word extraction fails
  console.log('Attempting manual text input fallback...');
  const manualText = await extractTextViaManualInput(resume.fileName);
  if (manualText && manualText.trim().length > 0) {
    console.log('✅ Manual text input successful:', manualText.length, 'characters');
    return manualText.trim();
  }

  console.error('❌ All text extraction methods failed');
  return '';
}