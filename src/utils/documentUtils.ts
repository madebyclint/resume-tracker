import * as mammoth from 'mammoth';
import { Resume } from '../types';

// Convert HTML to Markdown (basic conversion)
function htmlToMarkdown(html: string): string {
  let markdown = html;
  
  // Convert headings
  markdown = markdown.replace(/<h([1-6])>/g, (match, level) => '#'.repeat(parseInt(level)) + ' ');
  markdown = markdown.replace(/<\/h[1-6]>/g, '\n\n');
  
  // Convert paragraph breaks
  markdown = markdown.replace(/<\/p>/g, '\n\n');
  markdown = markdown.replace(/<p[^>]*>/g, '');
  
  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<ol[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ol>/gi, '\n');
  markdown = markdown.replace(/<li[^>]*>/gi, '- ');
  markdown = markdown.replace(/<\/li>/gi, '\n');
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // Clean up excessive whitespace and normalize line breaks
  markdown = markdown.replace(/\n\s*\n\s*\n/g, '\n\n');
  markdown = markdown.replace(/^\s+|\s+$/g, '');
  
  return markdown;
}

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

// Word document to markdown extraction
async function extractMarkdownFromWord(fileData: string): Promise<string> {
  try {
    console.log('=== WORD DOCUMENT TO MARKDOWN EXTRACTION START ===');
    const base64Data = fileData.split(',')[1];
    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    // Convert Uint8Array to ArrayBuffer
    const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);

    // Extract HTML first, then convert to markdown
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const markdown = htmlToMarkdown(result.value);
    
    console.log('✅ Word to markdown extraction successful:', markdown.length, 'characters');
    return markdown;
  } catch (error) {
    console.error('❌ Word to markdown extraction failed:', error);
    return '';
  }
}

// Extract both text and markdown from a document
export async function extractDocumentContent(resume: Resume): Promise<{ text: string; markdown: string }> {
  console.log('=== EXTRACTING BOTH TEXT AND MARKDOWN ===');

  const [text, markdown] = await Promise.all([
    extractTextFromWord(resume.fileData),
    extractMarkdownFromWord(resume.fileData)
  ]);

  return { 
    text: text.trim(), 
    markdown: markdown.trim() 
  };
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