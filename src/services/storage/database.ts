import type {
  Notebook,
  Page,
  NotebookExportData,
  StorageStats,
  IDatabaseRepository,
} from '../../types/storage.ts';
import type { UserStudyProfile, StudyRecap } from '../../types/ai.ts';
import type { Stroke, TemplateType, Point } from '../../types/canvas.ts';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function convertStrokesToSvg(
  strokes: Stroke[],
  template: TemplateType = 'lined',
  width: number = 800,
  height: number = 1000
): string {
  let backgroundElements = `<rect width="100%" height="100%" fill="#FFFFFF"/>`;

  if (template === 'lined') {
    let lines = '';
    for (let y = 60; y < height; y += 32) {
      lines += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#E9ECEF" stroke-width="1"/>`;
    }
    backgroundElements += lines;
  } else if (template === 'grid') {
    let grid = '';
    for (let x = 0; x < width; x += 24) {
      grid += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#E9ECEF" stroke-width="0.5"/>`;
    }
    for (let y = 0; y < height; y += 24) {
      grid += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#E9ECEF" stroke-width="0.5"/>`;
    }
    backgroundElements += grid;
  } else if (template === 'cornell') {
    backgroundElements += `
      <line x1="200" y1="0" x2="200" y2="${height - 150}" stroke="#CED4DA" stroke-width="2"/>
      <line x1="0" y1="${height - 150}" x2="${width}" y2="${height - 150}" stroke="#CED4DA" stroke-width="2"/>
    `;
    for (let y = 60; y < height - 150; y += 32) {
      backgroundElements += `<line x1="200" y1="${y}" x2="${width}" y2="${y}" stroke="#E9ECEF" stroke-width="1"/>`;
    }
  }

  const paths = strokes
    .map((stroke) => {
      let pathData = stroke.skiaPathSvg;
      if (!pathData && stroke.points && stroke.points.length > 0) {
        if (stroke.points.length === 1) {
          pathData = `M ${stroke.points[0].x} ${stroke.points[0].y} L ${stroke.points[0].x + 0.1} ${stroke.points[0].y + 0.1}`;
        } else {
          pathData = `M ${stroke.points[0].x} ${stroke.points[0].y}` +
            stroke.points.slice(1).map((p) => ` L ${p.x} ${p.y}`).join('');
        }
      }
      if (!pathData) return '';

      const opacity = stroke.tool === 'highlighter' ? 0.4 : 1.0;
      return `<path d="${pathData}" stroke="${stroke.color}" stroke-width="${stroke.size}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
    })
    .join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <g id="background">
    ${backgroundElements}
  </g>
  <g id="strokes">
    ${paths}
  </g>
</svg>`;
}

export class InMemoryStorageRepository implements IDatabaseRepository {
  private notebooks: Map<string, Notebook> = new Map();
  private pages: Map<string, Page> = new Map(); // pageId -> Page
  private strokes: Map<string, Stroke & { pageId: string; strokeIndex: number }> = new Map(); // strokeId -> Stroke Record
  private studyProfile: UserStudyProfile = {
    subjectTags: ['Mathematics', 'Physics', 'Computer Science'],
    studyHabits: ['Active Recall', 'Spaced Repetition', 'Cornell Method'],
    preferredSummaryFormat: 'bullet',
  };
  private studyRecaps: Map<string, StudyRecap & { id: string }> = new Map();

  async initDatabase(): Promise<void> {
    // In-memory setup
  }

  async createNotebook(title: string): Promise<Notebook> {
    const now = Date.now();
    const notebook: Notebook = {
      id: generateUUID(),
      title,
      createdAt: now,
      updatedAt: now,
    };
    this.notebooks.set(notebook.id, notebook);

    // Auto create initial Page 0
    await this.createPage(notebook.id, 'lined', 0);

    return notebook;
  }

  async getNotebooks(): Promise<Notebook[]> {
    return Array.from(this.notebooks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getNotebookById(id: string): Promise<Notebook | null> {
    return this.notebooks.get(id) || null;
  }

  async updateNotebook(id: string, updates: Partial<Pick<Notebook, 'title'>>): Promise<Notebook> {
    const notebook = this.notebooks.get(id);
    if (!notebook) throw new Error(`Notebook with id ${id} not found`);

    if (updates.title !== undefined) {
      notebook.title = updates.title;
    }
    notebook.updatedAt = Date.now();
    this.notebooks.set(id, notebook);
    return notebook;
  }

  async deleteNotebook(id: string): Promise<void> {
    if (!this.notebooks.has(id)) return;

    // Delete pages and strokes for this notebook (Cascade)
    const pagesForNotebook = Array.from(this.pages.values()).filter((p) => p.notebookId === id);
    for (const page of pagesForNotebook) {
      await this.deletePageInternal(page.id);
    }
    this.notebooks.delete(id);
  }

  private async deletePageInternal(pageId: string): Promise<void> {
    // Delete strokes for page
    for (const [strokeId, strokeRecord] of Array.from(this.strokes.entries())) {
      if (strokeRecord.pageId === pageId) {
        this.strokes.delete(strokeId);
      }
    }
    this.pages.delete(pageId);
  }

  async createPage(notebookId: string, template: TemplateType = 'lined', targetIndex?: number): Promise<Page> {
    const existingPages = (await this.getPagesByNotebookId(notebookId)).sort((a, b) => a.pageIndex - b.pageIndex);
    const now = Date.now();

    let insertionIndex = existingPages.length;
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= existingPages.length) {
      insertionIndex = targetIndex;
      // Shift pages at or after targetIndex
      for (const page of existingPages) {
        if (page.pageIndex >= insertionIndex) {
          page.pageIndex += 1;
          page.updatedAt = now;
          this.pages.set(page.id, page);
        }
      }
    }

    const newPage: Page = {
      id: generateUUID(),
      notebookId,
      pageIndex: insertionIndex,
      template,
      createdAt: now,
      updatedAt: now,
    };

    this.pages.set(newPage.id, newPage);

    // Update notebook updatedAt
    const nb = this.notebooks.get(notebookId);
    if (nb) {
      nb.updatedAt = now;
      this.notebooks.set(notebookId, nb);
    }

    return newPage;
  }

  async getPagesByNotebookId(notebookId: string): Promise<Page[]> {
    return Array.from(this.pages.values())
      .filter((p) => p.notebookId === notebookId)
      .sort((a, b) => a.pageIndex - b.pageIndex);
  }

  async getPageById(id: string): Promise<Page | null> {
    return this.pages.get(id) || null;
  }

  async updatePageTemplate(pageId: string, template: TemplateType): Promise<Page> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page with id ${pageId} not found`);

    const now = Date.now();
    page.template = template;
    page.updatedAt = now;
    this.pages.set(pageId, page);

    const nb = this.notebooks.get(page.notebookId);
    if (nb) {
      nb.updatedAt = now;
      this.notebooks.set(nb.id, nb);
    }

    return page;
  }

  async reorderPages(notebookId: string, pageIdsInOrder: string[]): Promise<Page[]> {
    const now = Date.now();
    pageIdsInOrder.forEach((pageId, index) => {
      const page = this.pages.get(pageId);
      if (page && page.notebookId === notebookId) {
        page.pageIndex = index;
        page.updatedAt = now;
        this.pages.set(pageId, page);
      }
    });

    const nb = this.notebooks.get(notebookId);
    if (nb) {
      nb.updatedAt = now;
      this.notebooks.set(notebookId, nb);
    }

    return this.getPagesByNotebookId(notebookId);
  }

  async deletePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page) return;

    const notebookId = page.notebookId;
    await this.deletePageInternal(pageId);

    // Re-index remaining pages to close gap
    const remainingPages = (await this.getPagesByNotebookId(notebookId)).sort((a, b) => a.pageIndex - b.pageIndex);
    const now = Date.now();
    remainingPages.forEach((p, idx) => {
      p.pageIndex = idx;
      p.updatedAt = now;
      this.pages.set(p.id, p);
    });

    const nb = this.notebooks.get(notebookId);
    if (nb) {
      nb.updatedAt = now;
      this.notebooks.set(notebookId, nb);
    }
  }

  async saveStrokesForPage(pageId: string, strokes: Stroke[]): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page with id ${pageId} not found`);

    // Remove existing strokes for this page
    await this.deleteStrokesForPage(pageId);

    // Insert new strokes
    const now = Date.now();
    strokes.forEach((stroke, idx) => {
      this.strokes.set(stroke.id, {
        ...stroke,
        pageId,
        strokeIndex: idx,
      });
    });

    page.updatedAt = now;
    this.pages.set(pageId, page);

    const nb = this.notebooks.get(page.notebookId);
    if (nb) {
      nb.updatedAt = now;
      this.notebooks.set(nb.id, nb);
    }
  }

  async getStrokesByPageId(pageId: string): Promise<Stroke[]> {
    return Array.from(this.strokes.values())
      .filter((s) => s.pageId === pageId)
      .sort((a, b) => a.strokeIndex - b.strokeIndex)
      .map(({ pageId: _p, strokeIndex: _i, ...stroke }) => stroke);
  }

  async deleteStrokesForPage(pageId: string): Promise<void> {
    for (const [strokeId, strokeRecord] of Array.from(this.strokes.entries())) {
      if (strokeRecord.pageId === pageId) {
        this.strokes.delete(strokeId);
      }
    }
  }

  async exportNotebookToJson(notebookId: string): Promise<string> {
    const notebook = await this.getNotebookById(notebookId);
    if (!notebook) throw new Error(`Notebook with id ${notebookId} not found`);

    const pages = await this.getPagesByNotebookId(notebookId);
    const strokesByPage: Record<string, Stroke[]> = {};

    for (const page of pages) {
      strokesByPage[page.id] = await this.getStrokesByPageId(page.id);
    }

    const exportData: NotebookExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      notebook,
      pages,
      strokesByPage,
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importNotebookFromJson(jsonContent: string): Promise<Notebook> {
    const data: NotebookExportData = JSON.parse(jsonContent);
    if (!data.version || !data.notebook || !Array.isArray(data.pages)) {
      throw new Error('Invalid notebook JSON export payload format');
    }

    const now = Date.now();
    let newNotebookId = data.notebook.id;
    if (this.notebooks.has(newNotebookId)) {
      newNotebookId = generateUUID();
    }

    const importedNotebook: Notebook = {
      id: newNotebookId,
      title: `${data.notebook.title} (Imported)`,
      createdAt: now,
      updatedAt: now,
    };
    this.notebooks.set(importedNotebook.id, importedNotebook);

    const pageIdMap: Record<string, string> = {};

    for (const oldPage of data.pages) {
      const newPageId = generateUUID();
      pageIdMap[oldPage.id] = newPageId;

      const page: Page = {
        id: newPageId,
        notebookId: importedNotebook.id,
        pageIndex: oldPage.pageIndex,
        template: oldPage.template,
        createdAt: now,
        updatedAt: now,
      };
      this.pages.set(page.id, page);

      const oldStrokes = (data.strokesByPage && data.strokesByPage[oldPage.id]) || [];
      const newStrokes: Stroke[] = oldStrokes.map((s) => ({
        ...s,
        id: generateUUID(),
      }));
      await this.saveStrokesForPage(page.id, newStrokes);
    }

    return importedNotebook;
  }

  async exportPageAsSvg(pageId: string, width: number = 800, height: number = 1000): Promise<string> {
    const page = await this.getPageById(pageId);
    if (!page) throw new Error(`Page with id ${pageId} not found`);

    const strokes = await this.getStrokesByPageId(pageId);
    return convertStrokesToSvg(strokes, page.template, width, height);
  }

  async getStorageStats(): Promise<StorageStats> {
    return {
      notebookCount: this.notebooks.size,
      pageCount: this.pages.size,
      strokeCount: this.strokes.size,
    };
  }

  async getStudyProfile(): Promise<UserStudyProfile> {
    return { ...this.studyProfile };
  }

  async saveStudyProfile(profile: UserStudyProfile): Promise<UserStudyProfile> {
    this.studyProfile = {
      subjectTags: [...profile.subjectTags],
      studyHabits: [...profile.studyHabits],
      preferredSummaryFormat: profile.preferredSummaryFormat,
    };
    return { ...this.studyProfile };
  }

  async saveStudyRecap(recap: StudyRecap): Promise<StudyRecap> {
    const recapId = recap.id || generateUUID();
    const savedRecap: StudyRecap & { id: string } = {
      ...recap,
      id: recapId,
      generatedAt: recap.generatedAt || Date.now(),
    };
    this.studyRecaps.set(recapId, savedRecap);
    return savedRecap;
  }

  async getLatestRecapByNotebookId(notebookId: string): Promise<StudyRecap | null> {
    const recaps = await this.getRecapsByNotebookId(notebookId);
    return recaps.length > 0 ? recaps[0] : null;
  }

  async getRecapsByNotebookId(notebookId: string): Promise<StudyRecap[]> {
    return Array.from(this.studyRecaps.values())
      .filter((r) => r.notebookId === notebookId)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  }
}

export class SQLiteStorageRepository implements IDatabaseRepository {
  private db: any = null;

  async initDatabase(): Promise<void> {
    const SQLite = require('expo-sqlite');
    if (!SQLite || (typeof SQLite.openDatabaseAsync !== 'function' && typeof SQLite.openDatabaseSync !== 'function')) {
      throw new Error('expo-sqlite native module openDatabase function not found');
    }

    if (typeof SQLite.openDatabaseAsync === 'function') {
      this.db = await SQLite.openDatabaseAsync('notetaking_app.db');
    } else {
      this.db = SQLite.openDatabaseSync('notetaking_app.db');
    }

    if (this.db.execAsync) {
      await this.db.execAsync(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS notebooks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY NOT NULL,
          notebook_id TEXT NOT NULL,
          page_index INTEGER NOT NULL,
          template TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS strokes (
          id TEXT PRIMARY KEY NOT NULL,
          page_id TEXT NOT NULL,
          stroke_index INTEGER NOT NULL,
          tool TEXT NOT NULL,
          color TEXT NOT NULL,
          size REAL NOT NULL,
          points_json TEXT NOT NULL,
          skia_path_svg TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pages_notebook_id ON pages(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_pages_notebook_order ON pages(notebook_id, page_index);
        CREATE INDEX IF NOT EXISTS idx_strokes_page_id ON strokes(page_id);
        CREATE INDEX IF NOT EXISTS idx_strokes_page_order ON strokes(page_id, stroke_index);
        CREATE TABLE IF NOT EXISTS user_study_profile (
          id TEXT PRIMARY KEY NOT NULL,
          subject_tags_json TEXT NOT NULL,
          study_habits_json TEXT NOT NULL,
          preferred_summary_format TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS study_recaps (
          id TEXT PRIMARY KEY NOT NULL,
          notebook_id TEXT NOT NULL,
          summary_text TEXT NOT NULL,
          key_concepts_json TEXT NOT NULL,
          action_items_json TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_study_recaps_notebook_id ON study_recaps(notebook_id);
        CREATE INDEX IF NOT EXISTS idx_study_recaps_generated_at ON study_recaps(notebook_id, generated_at);
      `);
    } else if (this.db.transaction) {
      await new Promise<void>((resolve, reject) => {
        this.db.transaction((tx: any) => {
          tx.executeSql('PRAGMA foreign_keys = ON;');
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS notebooks (
              id TEXT PRIMARY KEY NOT NULL,
              title TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );`
          );
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS pages (
              id TEXT PRIMARY KEY NOT NULL,
              notebook_id TEXT NOT NULL,
              page_index INTEGER NOT NULL,
              template TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
            );`
          );
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS strokes (
              id TEXT PRIMARY KEY NOT NULL,
              page_id TEXT NOT NULL,
              stroke_index INTEGER NOT NULL,
              tool TEXT NOT NULL,
              color TEXT NOT NULL,
              size REAL NOT NULL,
              points_json TEXT NOT NULL,
              skia_path_svg TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE
            );`
          );
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_pages_notebook_id ON pages(notebook_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_pages_notebook_order ON pages(notebook_id, page_index);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_strokes_page_id ON strokes(page_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_strokes_page_order ON strokes(page_id, stroke_index);');
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS user_study_profile (
              id TEXT PRIMARY KEY NOT NULL,
              subject_tags_json TEXT NOT NULL,
              study_habits_json TEXT NOT NULL,
              preferred_summary_format TEXT NOT NULL
            );`
          );
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS study_recaps (
              id TEXT PRIMARY KEY NOT NULL,
              notebook_id TEXT NOT NULL,
              summary_text TEXT NOT NULL,
              key_concepts_json TEXT NOT NULL,
              action_items_json TEXT NOT NULL,
              generated_at INTEGER NOT NULL,
              FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
            );`
          );
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_study_recaps_notebook_id ON study_recaps(notebook_id);');
          tx.executeSql('CREATE INDEX IF NOT EXISTS idx_study_recaps_generated_at ON study_recaps(notebook_id, generated_at);');
        }, reject, resolve);
      });
    }
  }

  async createNotebook(title: string): Promise<Notebook> {
    const now = Date.now();
    const id = generateUUID();
    await this.runQuery(
      'INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, title, now, now]
    );

    const notebook: Notebook = { id, title, createdAt: now, updatedAt: now };
    await this.createPage(id, 'lined', 0);
    return notebook;
  }

  async getNotebooks(): Promise<Notebook[]> {
    const rows = await this.getAllQuery(
      'SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM notebooks ORDER BY updated_at DESC'
    );
    return rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }));
  }

  async getNotebookById(id: string): Promise<Notebook | null> {
    const rows = await this.getAllQuery(
      'SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM notebooks WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      title: r.title,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    };
  }

  async updateNotebook(id: string, updates: Partial<Pick<Notebook, 'title'>>): Promise<Notebook> {
    const now = Date.now();
    if (updates.title !== undefined) {
      await this.runQuery('UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?', [
        updates.title,
        now,
        id,
      ]);
    } else {
      await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, id]);
    }
    const updated = await this.getNotebookById(id);
    if (!updated) throw new Error(`Notebook with id ${id} not found`);
    return updated;
  }

  async deleteNotebook(id: string): Promise<void> {
    await this.runQuery('DELETE FROM notebooks WHERE id = ?', [id]);
  }

  async createPage(notebookId: string, template: TemplateType = 'lined', targetIndex?: number): Promise<Page> {
    const existingPages = await this.getPagesByNotebookId(notebookId);
    const now = Date.now();

    let insertionIndex = existingPages.length;
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= existingPages.length) {
      insertionIndex = targetIndex;
      await this.runQuery(
        'UPDATE pages SET page_index = page_index + 1, updated_at = ? WHERE notebook_id = ? AND page_index >= ?',
        [now, notebookId, insertionIndex]
      );
    }

    const id = generateUUID();
    await this.runQuery(
      'INSERT INTO pages (id, notebook_id, page_index, template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, notebookId, insertionIndex, template, now, now]
    );

    await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, notebookId]);

    return {
      id,
      notebookId,
      pageIndex: insertionIndex,
      template,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getPagesByNotebookId(notebookId: string): Promise<Page[]> {
    const rows = await this.getAllQuery(
      'SELECT id, notebook_id as notebookId, page_index as pageIndex, template, created_at as createdAt, updated_at as updatedAt FROM pages WHERE notebook_id = ? ORDER BY page_index ASC',
      [notebookId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      notebookId: r.notebookId,
      pageIndex: Number(r.pageIndex),
      template: r.template as TemplateType,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }));
  }

  async getPageById(id: string): Promise<Page | null> {
    const rows = await this.getAllQuery(
      'SELECT id, notebook_id as notebookId, page_index as pageIndex, template, created_at as createdAt, updated_at as updatedAt FROM pages WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      notebookId: r.notebookId,
      pageIndex: Number(r.pageIndex),
      template: r.template as TemplateType,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    };
  }

  async updatePageTemplate(pageId: string, template: TemplateType): Promise<Page> {
    const now = Date.now();
    await this.runQuery('UPDATE pages SET template = ?, updated_at = ? WHERE id = ?', [
      template,
      now,
      pageId,
    ]);
    const page = await this.getPageById(pageId);
    if (!page) throw new Error(`Page with id ${pageId} not found`);

    await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, page.notebookId]);
    return page;
  }

  async reorderPages(notebookId: string, pageIdsInOrder: string[]): Promise<Page[]> {
    const now = Date.now();
    for (let i = 0; i < pageIdsInOrder.length; i++) {
      await this.runQuery('UPDATE pages SET page_index = ?, updated_at = ? WHERE id = ?', [
        i,
        now,
        pageIdsInOrder[i],
      ]);
    }
    await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, notebookId]);
    return this.getPagesByNotebookId(notebookId);
  }

  async deletePage(pageId: string): Promise<void> {
    const page = await this.getPageById(pageId);
    if (!page) return;

    await this.runQuery('DELETE FROM pages WHERE id = ?', [pageId]);

    // Re-index remaining pages
    const remainingPages = await this.getPagesByNotebookId(page.notebookId);
    const now = Date.now();
    for (let i = 0; i < remainingPages.length; i++) {
      await this.runQuery('UPDATE pages SET page_index = ?, updated_at = ? WHERE id = ?', [
        i,
        now,
        remainingPages[i].id,
      ]);
    }
    await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, page.notebookId]);
  }

  async saveStrokesForPage(pageId: string, strokes: Stroke[]): Promise<void> {
    const now = Date.now();
    await this.runQuery('DELETE FROM strokes WHERE page_id = ?', [pageId]);

    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      await this.runQuery(
        `INSERT INTO strokes (id, page_id, stroke_index, tool, color, size, points_json, skia_path_svg, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          pageId,
          i,
          s.tool,
          s.color,
          s.size,
          JSON.stringify(s.points),
          s.skiaPathSvg || null,
          s.createdAt || now,
        ]
      );
    }

    await this.runQuery('UPDATE pages SET updated_at = ? WHERE id = ?', [now, pageId]);
    const page = await this.getPageById(pageId);
    if (page) {
      await this.runQuery('UPDATE notebooks SET updated_at = ? WHERE id = ?', [now, page.notebookId]);
    }
  }

  async getStrokesByPageId(pageId: string): Promise<Stroke[]> {
    const rows = await this.getAllQuery(
      `SELECT id, tool, color, size, points_json as pointsJson, skia_path_svg as skiaPathSvg, created_at as createdAt
       FROM strokes WHERE page_id = ? ORDER BY stroke_index ASC`,
      [pageId]
    );

    return rows.map((r: any) => ({
      id: r.id,
      tool: r.tool,
      color: r.color,
      size: Number(r.size),
      points: JSON.parse(r.pointsJson || '[]'),
      skiaPathSvg: r.skiaPathSvg || undefined,
      createdAt: Number(r.createdAt),
    }));
  }

  async deleteStrokesForPage(pageId: string): Promise<void> {
    await this.runQuery('DELETE FROM strokes WHERE page_id = ?', [pageId]);
  }

  async exportNotebookToJson(notebookId: string): Promise<string> {
    const notebook = await this.getNotebookById(notebookId);
    if (!notebook) throw new Error(`Notebook with id ${notebookId} not found`);

    const pages = await this.getPagesByNotebookId(notebookId);
    const strokesByPage: Record<string, Stroke[]> = {};

    for (const page of pages) {
      strokesByPage[page.id] = await this.getStrokesByPageId(page.id);
    }

    const exportData: NotebookExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      notebook,
      pages,
      strokesByPage,
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importNotebookFromJson(jsonContent: string): Promise<Notebook> {
    const data: NotebookExportData = JSON.parse(jsonContent);
    if (!data.version || !data.notebook || !Array.isArray(data.pages)) {
      throw new Error('Invalid notebook JSON export payload format');
    }

    const now = Date.now();
    let newNotebookId = data.notebook.id;
    const existing = await this.getNotebookById(newNotebookId);
    if (existing) {
      newNotebookId = generateUUID();
    }

    const title = `${data.notebook.title} (Imported)`;
    await this.runQuery(
      'INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [newNotebookId, title, now, now]
    );

    const importedNotebook: Notebook = {
      id: newNotebookId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    for (const oldPage of data.pages) {
      const newPageId = generateUUID();
      await this.runQuery(
        'INSERT INTO pages (id, notebook_id, page_index, template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newPageId, newNotebookId, oldPage.pageIndex, oldPage.template, now, now]
      );

      const oldStrokes = (data.strokesByPage && data.strokesByPage[oldPage.id]) || [];
      const newStrokes: Stroke[] = oldStrokes.map((s) => ({
        ...s,
        id: generateUUID(),
      }));
      await this.saveStrokesForPage(newPageId, newStrokes);
    }

    return importedNotebook;
  }

  async exportPageAsSvg(pageId: string, width: number = 800, height: number = 1000): Promise<string> {
    const page = await this.getPageById(pageId);
    if (!page) throw new Error(`Page with id ${pageId} not found`);

    const strokes = await this.getStrokesByPageId(pageId);
    return convertStrokesToSvg(strokes, page.template, width, height);
  }

  async getStorageStats(): Promise<StorageStats> {
    const nbRows = await this.getAllQuery('SELECT COUNT(*) as count FROM notebooks');
    const pgRows = await this.getAllQuery('SELECT COUNT(*) as count FROM pages');
    const stRows = await this.getAllQuery('SELECT COUNT(*) as count FROM strokes');

    return {
      notebookCount: Number(nbRows[0]?.count || 0),
      pageCount: Number(pgRows[0]?.count || 0),
      strokeCount: Number(stRows[0]?.count || 0),
    };
  }

  async getStudyProfile(): Promise<UserStudyProfile> {
    const rows = await this.getAllQuery(
      'SELECT subject_tags_json as subjectTagsJson, study_habits_json as studyHabitsJson, preferred_summary_format as preferredSummaryFormat FROM user_study_profile WHERE id = ?',
      ['default']
    );
    if (!rows || rows.length === 0) {
      return {
        subjectTags: ['Mathematics', 'Physics', 'Computer Science'],
        studyHabits: ['Active Recall', 'Spaced Repetition', 'Cornell Method'],
        preferredSummaryFormat: 'bullet',
      };
    }
    const r = rows[0];
    return {
      subjectTags: JSON.parse(r.subjectTagsJson || '[]'),
      studyHabits: JSON.parse(r.studyHabitsJson || '[]'),
      preferredSummaryFormat: r.preferredSummaryFormat as any,
    };
  }

  async saveStudyProfile(profile: UserStudyProfile): Promise<UserStudyProfile> {
    await this.runQuery(
      `INSERT OR REPLACE INTO user_study_profile (id, subject_tags_json, study_habits_json, preferred_summary_format) VALUES (?, ?, ?, ?)`,
      ['default', JSON.stringify(profile.subjectTags), JSON.stringify(profile.studyHabits), profile.preferredSummaryFormat]
    );
    return this.getStudyProfile();
  }

  async saveStudyRecap(recap: StudyRecap): Promise<StudyRecap> {
    const id = recap.id || generateUUID();
    const generatedAt = recap.generatedAt || Date.now();
    await this.runQuery(
      `INSERT INTO study_recaps (id, notebook_id, summary_text, key_concepts_json, action_items_json, generated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        recap.notebookId,
        recap.summaryText,
        JSON.stringify(recap.keyConcepts),
        JSON.stringify(recap.actionItems),
        generatedAt,
      ]
    );
    return { ...recap, id, generatedAt };
  }

  async getLatestRecapByNotebookId(notebookId: string): Promise<StudyRecap | null> {
    const rows = await this.getAllQuery(
      `SELECT id, notebook_id as notebookId, summary_text as summaryText, key_concepts_json as keyConceptsJson, action_items_json as actionItemsJson, generated_at as generatedAt FROM study_recaps WHERE notebook_id = ? ORDER BY generated_at DESC LIMIT 1`,
      [notebookId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      notebookId: r.notebookId,
      summaryText: r.summaryText,
      keyConcepts: JSON.parse(r.keyConceptsJson || '[]'),
      actionItems: JSON.parse(r.actionItemsJson || '[]'),
      generatedAt: Number(r.generatedAt),
    };
  }

  async getRecapsByNotebookId(notebookId: string): Promise<StudyRecap[]> {
    const rows = await this.getAllQuery(
      `SELECT id, notebook_id as notebookId, summary_text as summaryText, key_concepts_json as keyConceptsJson, action_items_json as actionItemsJson, generated_at as generatedAt FROM study_recaps WHERE notebook_id = ? ORDER BY generated_at DESC`,
      [notebookId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      notebookId: r.notebookId,
      summaryText: r.summaryText,
      keyConcepts: JSON.parse(r.keyConceptsJson || '[]'),
      actionItems: JSON.parse(r.actionItemsJson || '[]'),
      generatedAt: Number(r.generatedAt),
    }));
  }

  private async runQuery(sql: string, params: any[] = []): Promise<any> {
    if (this.db.runAsync) {
      return await this.db.runAsync(sql, params);
    }
    return new Promise((resolve, reject) => {
      this.db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, result: any) => resolve(result),
          (_: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });
  }

  private async getAllQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (this.db.getAllAsync) {
      return await this.db.getAllAsync(sql, params);
    }
    return new Promise((resolve, reject) => {
      this.db.transaction((tx: any) => {
        tx.executeSql(
          sql,
          params,
          (_: any, { rows }: any) => {
            const items = [];
            for (let i = 0; i < rows.length; i++) {
              items.push(rows.item(i));
            }
            resolve(items);
          },
          (_: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });
  }
}

export class DatabaseService implements IDatabaseRepository {
  private repo: IDatabaseRepository;

  constructor(repo?: IDatabaseRepository) {
    this.repo = repo || new InMemoryStorageRepository();
  }

  async initDatabase(): Promise<void> {
    try {
      const sqliteRepo = new SQLiteStorageRepository();
      await sqliteRepo.initDatabase();
      this.repo = sqliteRepo;
    } catch (e) {
      const inMemRepo = new InMemoryStorageRepository();
      await inMemRepo.initDatabase();
      this.repo = inMemRepo;
    }
  }

  async createNotebook(title: string): Promise<Notebook> {
    return this.repo.createNotebook(title);
  }

  async getNotebooks(): Promise<Notebook[]> {
    return this.repo.getNotebooks();
  }

  async getNotebookById(id: string): Promise<Notebook | null> {
    return this.repo.getNotebookById(id);
  }

  async updateNotebook(id: string, updates: Partial<Pick<Notebook, 'title'>>): Promise<Notebook> {
    return this.repo.updateNotebook(id, updates);
  }

  async deleteNotebook(id: string): Promise<void> {
    return this.repo.deleteNotebook(id);
  }

  async createPage(notebookId: string, template?: TemplateType, targetIndex?: number): Promise<Page> {
    return this.repo.createPage(notebookId, template, targetIndex);
  }

  async getPagesByNotebookId(notebookId: string): Promise<Page[]> {
    return this.repo.getPagesByNotebookId(notebookId);
  }

  async getPageById(id: string): Promise<Page | null> {
    return this.repo.getPageById(id);
  }

  async updatePageTemplate(pageId: string, template: TemplateType): Promise<Page> {
    return this.repo.updatePageTemplate(pageId, template);
  }

  async reorderPages(notebookId: string, pageIdsInOrder: string[]): Promise<Page[]> {
    return this.repo.reorderPages(notebookId, pageIdsInOrder);
  }

  async deletePage(pageId: string): Promise<void> {
    return this.repo.deletePage(pageId);
  }

  async saveStrokesForPage(pageId: string, strokes: Stroke[]): Promise<void> {
    return this.repo.saveStrokesForPage(pageId, strokes);
  }

  async getStrokesByPageId(pageId: string): Promise<Stroke[]> {
    return this.repo.getStrokesByPageId(pageId);
  }

  async deleteStrokesForPage(pageId: string): Promise<void> {
    return this.repo.deleteStrokesForPage(pageId);
  }

  async exportNotebookToJson(notebookId: string): Promise<string> {
    return this.repo.exportNotebookToJson(notebookId);
  }

  async importNotebookFromJson(jsonContent: string): Promise<Notebook> {
    return this.repo.importNotebookFromJson(jsonContent);
  }

  async exportPageAsSvg(pageId: string, width?: number, height?: number): Promise<string> {
    return this.repo.exportPageAsSvg(pageId, width, height);
  }

  async getStorageStats(): Promise<StorageStats> {
    return this.repo.getStorageStats();
  }

  async getStudyProfile(): Promise<UserStudyProfile> {
    return this.repo.getStudyProfile();
  }

  async saveStudyProfile(profile: UserStudyProfile): Promise<UserStudyProfile> {
    return this.repo.saveStudyProfile(profile);
  }

  async saveStudyRecap(recap: StudyRecap): Promise<StudyRecap> {
    return this.repo.saveStudyRecap(recap);
  }

  async getLatestRecapByNotebookId(notebookId: string): Promise<StudyRecap | null> {
    return this.repo.getLatestRecapByNotebookId(notebookId);
  }

  async getRecapsByNotebookId(notebookId: string): Promise<StudyRecap[]> {
    return this.repo.getRecapsByNotebookId(notebookId);
  }
}

export const databaseService = new DatabaseService();
