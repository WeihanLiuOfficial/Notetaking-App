import type { TemplateType, Stroke } from './canvas.ts';
import type { UserStudyProfile, StudyRecap } from './ai.ts';

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  notebookId: string;
  pageIndex: number;
  template: TemplateType;
  createdAt: number;
  updatedAt: number;
}

export interface NotebookExportData {
  version: '1.0';
  exportedAt: number;
  notebook: Notebook;
  pages: Page[];
  strokesByPage: Record<string, Stroke[]>;
}

export interface StorageStats {
  notebookCount: number;
  pageCount: number;
  strokeCount: number;
  totalSizeBytes?: number;
}

export interface IDatabaseRepository {
  initDatabase(): Promise<void>;

  // Notebook CRUD
  createNotebook(title: string): Promise<Notebook>;
  getNotebooks(): Promise<Notebook[]>;
  getNotebookById(id: string): Promise<Notebook | null>;
  updateNotebook(id: string, updates: Partial<Pick<Notebook, 'title'>>): Promise<Notebook>;
  deleteNotebook(id: string): Promise<void>;

  // Page CRUD & Reordering
  createPage(notebookId: string, template?: TemplateType, targetIndex?: number): Promise<Page>;
  getPagesByNotebookId(notebookId: string): Promise<Page[]>;
  getPageById(id: string): Promise<Page | null>;
  updatePageTemplate(pageId: string, template: TemplateType): Promise<Page>;
  reorderPages(notebookId: string, pageIdsInOrder: string[]): Promise<Page[]>;
  deletePage(pageId: string): Promise<void>;

  // Stroke Persistence
  saveStrokesForPage(pageId: string, strokes: Stroke[]): Promise<void>;
  getStrokesByPageId(pageId: string): Promise<Stroke[]>;
  deleteStrokesForPage(pageId: string): Promise<void>;

  // Backup & Export
  exportNotebookToJson(notebookId: string): Promise<string>;
  importNotebookFromJson(jsonContent: string): Promise<Notebook>;
  exportPageAsSvg(pageId: string, width?: number, height?: number): Promise<string>;

  // Study Profile & Recaps
  getStudyProfile(): Promise<UserStudyProfile>;
  saveStudyProfile(profile: UserStudyProfile): Promise<UserStudyProfile>;
  saveStudyRecap(recap: StudyRecap): Promise<StudyRecap>;
  getLatestRecapByNotebookId(notebookId: string): Promise<StudyRecap | null>;
  getRecapsByNotebookId(notebookId: string): Promise<StudyRecap[]>;

  // Stats
  getStorageStats(): Promise<StorageStats>;
}


