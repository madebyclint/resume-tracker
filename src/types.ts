export interface Resume {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  pdfData: string; // base64 encoded PDF
  textContent?: string; // extracted text for search
}

export interface AppState {
  resumes: Resume[];
}
