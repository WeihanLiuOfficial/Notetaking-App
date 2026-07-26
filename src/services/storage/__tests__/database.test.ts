import { DatabaseService, InMemoryStorageRepository } from '../database';
import { Stroke } from '../../../types/canvas';

describe('DatabaseService (Milestone 3 Offline Storage Engine)', () => {
  let dbService: DatabaseService;

  beforeEach(async () => {
    dbService = new DatabaseService();
    await dbService.initDatabase();
  });

  test('initDatabase initializes repository without error', async () => {
    const stats = await dbService.getStorageStats();
    expect(stats).toBeDefined();
    expect(typeof stats.notebookCount).toBe('number');
  });

  test('Notebook CRUD operations (create, get, update, delete)', async () => {
    // 1. Create Notebook
    const notebook = await dbService.createNotebook('Physics Notes');
    expect(notebook.id).toBeDefined();
    expect(notebook.title).toBe('Physics Notes');
    expect(notebook.createdAt).toBeGreaterThan(0);

    // Initial page 0 check
    const initialPages = await dbService.getPagesByNotebookId(notebook.id);
    expect(initialPages.length).toBe(1);
    expect(initialPages[0].pageIndex).toBe(0);
    expect(initialPages[0].template).toBe('lined');

    // 2. Get Notebooks
    const notebooks = await dbService.getNotebooks();
    expect(notebooks.some((n) => n.id === notebook.id)).toBe(true);

    // 3. Get Notebook By ID
    const found = await dbService.getNotebookById(notebook.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Physics Notes');

    // 4. Update Notebook
    const updated = await dbService.updateNotebook(notebook.id, { title: 'Advanced Physics' });
    expect(updated.title).toBe('Advanced Physics');

    // 5. Delete Notebook
    await dbService.deleteNotebook(notebook.id);
    const afterDelete = await dbService.getNotebookById(notebook.id);
    expect(afterDelete).toBeNull();

    const pagesAfterDelete = await dbService.getPagesByNotebookId(notebook.id);
    expect(pagesAfterDelete.length).toBe(0);
  });

  test('Page CRUD & Reordering (create, update template, reorder, delete gap-closure)', async () => {
    const nb = await dbService.createNotebook('Math Workbook');
    const page0 = (await dbService.getPagesByNotebookId(nb.id))[0];

    // Create page at index 1
    const page1 = await dbService.createPage(nb.id, 'grid');
    expect(page1.pageIndex).toBe(1);
    expect(page1.template).toBe('grid');

    // Insert page at index 1 (shifting page1 to index 2)
    const pageInserted = await dbService.createPage(nb.id, 'cornell', 1);
    expect(pageInserted.pageIndex).toBe(1);

    const pagesAfterInsert = await dbService.getPagesByNotebookId(nb.id);
    expect(pagesAfterInsert.length).toBe(3);
    expect(pagesAfterInsert.map((p) => p.id)).toEqual([page0.id, pageInserted.id, page1.id]);
    expect(pagesAfterInsert.map((p) => p.pageIndex)).toEqual([0, 1, 2]);

    // Update page template
    const updatedPage = await dbService.updatePageTemplate(page0.id, 'blank');
    expect(updatedPage.template).toBe('blank');

    // Reorder pages: [page1, page0, pageInserted]
    const reordered = await dbService.reorderPages(nb.id, [page1.id, page0.id, pageInserted.id]);
    expect(reordered.map((p) => p.id)).toEqual([page1.id, page0.id, pageInserted.id]);
    expect(reordered.map((p) => p.pageIndex)).toEqual([0, 1, 2]);

    // Delete middle page (page0 at index 1)
    await dbService.deletePage(page0.id);
    const pagesAfterDelete = await dbService.getPagesByNotebookId(nb.id);
    expect(pagesAfterDelete.length).toBe(2);
    expect(pagesAfterDelete.map((p) => p.id)).toEqual([page1.id, pageInserted.id]);
    expect(pagesAfterDelete.map((p) => p.pageIndex)).toEqual([0, 1]); // Gap closed
  });

  test('Stroke Vector Serialization & Deserialization fidelity', async () => {
    const nb = await dbService.createNotebook('Drawing Log');
    const page = (await dbService.getPagesByNotebookId(nb.id))[0];

    const sampleStrokes: Stroke[] = [
      {
        id: 'stroke-1',
        tool: 'pen',
        color: '#FF0000',
        size: 5,
        points: [
          { x: 10, y: 20, pressure: 0.5 },
          { x: 15, y: 25, pressure: 0.8 },
        ],
        skiaPathSvg: 'M 10 20 L 15 25',
        createdAt: 1000,
      },
      {
        id: 'stroke-2',
        tool: 'highlighter',
        color: '#FFFF00',
        size: 20,
        points: [
          { x: 100, y: 200, pressure: 1.0 },
          { x: 150, y: 200, pressure: 1.0 },
        ],
        skiaPathSvg: 'M 100 200 L 150 200',
        createdAt: 2000,
      },
    ];

    await dbService.saveStrokesForPage(page.id, sampleStrokes);
    const retrieved = await dbService.getStrokesByPageId(page.id);

    expect(retrieved.length).toBe(2);
    expect(retrieved[0].id).toBe('stroke-1');
    expect(retrieved[0].color).toBe('#FF0000');
    expect(retrieved[0].points.length).toBe(2);
    expect(retrieved[0].points[0].pressure).toBe(0.5);

    expect(retrieved[1].id).toBe('stroke-2');
    expect(retrieved[1].tool).toBe('highlighter');

    // Test delete strokes
    await dbService.deleteStrokesForPage(page.id);
    const cleared = await dbService.getStrokesByPageId(page.id);
    expect(cleared.length).toBe(0);
  });

  test('Notebook exportToJson and importFromJson roundtrip accuracy', async () => {
    const nb = await dbService.createNotebook('Export Test');
    const page = (await dbService.getPagesByNotebookId(nb.id))[0];

    await dbService.saveStrokesForPage(page.id, [
      {
        id: 'stroke-export-1',
        tool: 'pen',
        color: '#0000FF',
        size: 3,
        points: [{ x: 5, y: 5 }],
        createdAt: 12345,
      },
    ]);

    const jsonString = await dbService.exportNotebookToJson(nb.id);
    expect(typeof jsonString).toBe('string');
    expect(jsonString).toContain('"version": "1.0"');
    expect(jsonString).toContain('Export Test');

    const imported = await dbService.importNotebookFromJson(jsonString);
    expect(imported.id).toBeDefined();
    expect(imported.title).toContain('Export Test');

    const importedPages = await dbService.getPagesByNotebookId(imported.id);
    expect(importedPages.length).toBe(1);

    const importedStrokes = await dbService.getStrokesByPageId(importedPages[0].id);
    expect(importedStrokes.length).toBe(1);
    expect(importedStrokes[0].color).toBe('#0000FF');
  });

  test('exportPageAsSvg produces valid SVG markup containing stroke paths', async () => {
    const nb = await dbService.createNotebook('SVG Test');
    const page = (await dbService.getPagesByNotebookId(nb.id))[0];
    await dbService.updatePageTemplate(page.id, 'cornell');

    await dbService.saveStrokesForPage(page.id, [
      {
        id: 'svg-stroke-1',
        tool: 'pen',
        color: '#123456',
        size: 4,
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
        createdAt: 500,
      },
    ]);

    const svg = await dbService.exportPageAsSvg(page.id, 800, 1000);
    expect(svg).toContain('<?xml version="1.0"');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 800 1000"');
    expect(svg).toContain('stroke="#123456"');
    expect(svg).toContain('stroke-width="4"');
    expect(svg).toContain('</svg>');
  });

  test('getStorageStats calculates counts correctly', async () => {
    const repository = new InMemoryStorageRepository();
    await repository.initDatabase();

    let stats = await repository.getStorageStats();
    expect(stats.notebookCount).toBe(0);

    const nb = await repository.createNotebook('Stats NB');
    const page = (await repository.getPagesByNotebookId(nb.id))[0];
    await repository.saveStrokesForPage(page.id, [
      { id: 's1', tool: 'pen', color: '#000', size: 2, points: [], createdAt: 1 },
    ]);

    stats = await repository.getStorageStats();
    expect(stats.notebookCount).toBe(1);
    expect(stats.pageCount).toBe(1);
    expect(stats.strokeCount).toBe(1);
  });
});
