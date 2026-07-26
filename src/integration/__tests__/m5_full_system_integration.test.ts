import { InMemoryStorageRepository, DatabaseService } from '../../services/storage/database';
import { StudyAgentHarness } from '../../services/ai/StudyAgentHarness';
import { isStrokeInsidePolygon, transformStroke } from '../../utils/geometry';
import type { Notebook, Page } from '../../types/storage';
import type { Stroke, TemplateType, Point } from '../../types/canvas';
import type { UserStudyProfile, StudyRecap } from '../../types/ai';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = [];

function registerTest(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Equals Failed'}: Expected ${expectedStr}, got ${actualStr}`);
  }
}

// Helper factory functions for strokes
function createPenStroke(points: Point[], color = '#212529', size = 4): Stroke {
  return {
    id: `stroke-pen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tool: 'pen',
    color,
    size,
    points,
    createdAt: Date.now(),
  };
}

function createHighlighterStroke(points: Point[], color = '#F59F00', size = 20): Stroke {
  return {
    id: `stroke-highlighter-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tool: 'highlighter',
    color,
    size,
    points,
    createdAt: Date.now(),
  };
}

function createEraserStroke(points: Point[], size = 12): Stroke {
  return {
    id: `stroke-eraser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tool: 'eraser',
    color: 'transparent',
    size,
    points,
    createdAt: Date.now(),
  };
}

// ============================================================================
// WORKFLOW 1: Notebook Lifecycle & Backup Roundtrip
// ============================================================================
registerTest('Workflow 1: Notebook Lifecycle & Backup Roundtrip', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const db = new DatabaseService(repo);

  // 1. Create notebook
  const nb1 = await db.createNotebook('Physics Notes');
  assert(nb1.id.length > 0, 'Notebook ID generated');
  assertEquals(nb1.title, 'Physics Notes', 'Notebook title matches');

  // Initial page auto-created
  const pages = await db.getPagesByNotebookId(nb1.id);
  assertEquals(pages.length, 1, 'Auto-created initial page');

  // Add stroke to page 1
  const penStroke = createPenStroke([{ x: 10, y: 10, pressure: 0.5 }, { x: 50, y: 50, pressure: 0.8 }], '#212529', 4);
  await db.saveStrokesForPage(pages[0].id, [penStroke]);

  // 2. Create second notebook
  const nb2 = await db.createNotebook('Math Notes');
  const allNotebooks = await db.getNotebooks();
  assertEquals(allNotebooks.length, 2, 'Two notebooks listed in storage');

  // 3. Rename notebook
  const updatedNb1 = await db.updateNotebook(nb1.id, { title: 'Advanced Physics' });
  assertEquals(updatedNb1.title, 'Advanced Physics', 'Notebook renamed');

  // 4. Backup JSON export
  const backupJson = await db.exportNotebookToJson(nb1.id);
  assert(backupJson.includes('Advanced Physics'), 'Backup JSON contains title');
  assert(backupJson.includes(penStroke.id), 'Backup JSON contains stroke ID');

  // 5. Backup JSON import into fresh repository
  const importedNb = await db.importNotebookFromJson(backupJson);
  assert(importedNb.id !== nb1.id, 'Imported notebook has new unique ID');
  assertEquals(importedNb.title, 'Advanced Physics (Imported)', 'Imported title matches');

  const importedPages = await db.getPagesByNotebookId(importedNb.id);
  assertEquals(importedPages.length, 1, 'Imported page count matches');

  const importedStrokes = await db.getStrokesByPageId(importedPages[0].id);
  assertEquals(importedStrokes.length, 1, 'Imported stroke count matches');
  assertEquals(importedStrokes[0].color, '#212529', 'Imported stroke color matches');

  // 6. Delete notebook cascade
  await db.deleteNotebook(nb1.id);
  const remainingNbs = await db.getNotebooks();
  assert(!remainingNbs.some((n) => n.id === nb1.id), 'Deleted notebook removed from list');
  const deletedPages = await db.getPagesByNotebookId(nb1.id);
  assertEquals(deletedPages.length, 0, 'Cascade deleted pages of notebook');
});

// ============================================================================
// WORKFLOW 2: Multi-Page Navigation, Template Switching & Reordering
// ============================================================================
registerTest('Workflow 2: Multi-Page Navigation & Template Switching', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const db = new DatabaseService(repo);

  const nb = await db.createNotebook('Multi-Page Lab Notebook');
  const initialPages = await db.getPagesByNotebookId(nb.id);
  const p0 = initialPages[0];

  // 1. Add pages at specific indices
  const p1 = await db.createPage(nb.id, 'cornell', 1);
  const p2 = await db.createPage(nb.id, 'grid', 2);
  const p3 = await db.createPage(nb.id, 'blank', 3);

  let pagesList = await db.getPagesByNotebookId(nb.id);
  assertEquals(pagesList.length, 4, '4 pages in notebook');

  // Verify page ordering indices
  assertEquals(pagesList.map((p) => p.pageIndex), [0, 1, 2, 3], 'Page indices contiguous [0, 1, 2, 3]');

  // 2. Switch template of page 0 from lined to cornell
  const updatedP0 = await db.updatePageTemplate(p0.id, 'cornell');
  assertEquals(updatedP0.template, 'cornell', 'Template updated in storage');

  // 3. Reorder pages: [p3, p1, p0, p2]
  const reordered = await db.reorderPages(nb.id, [p3.id, p1.id, p0.id, p2.id]);
  assertEquals(reordered.map((p) => p.id), [p3.id, p1.id, p0.id, p2.id], 'Pages reordered ID sequence');
  assertEquals(reordered.map((p) => p.pageIndex), [0, 1, 2, 3], 'Reordered pageIndices normalized');

  // 4. Delete page p1 and verify gap closure
  await db.deletePage(p1.id);
  const remainingAfterDelete = await db.getPagesByNotebookId(nb.id);
  assertEquals(remainingAfterDelete.length, 3, '3 pages remain after deletion');
  assertEquals(remainingAfterDelete.map((p) => p.pageIndex), [0, 1, 2], 'Indices gap-closed cleanly [0, 1, 2]');
});

// ============================================================================
// WORKFLOW 3: Vector Drawing Engine, Lasso Persistence & SVG Export
// ============================================================================
registerTest('Workflow 3: Vector Drawing Engine, Lasso Persistence & SVG Export', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const db = new DatabaseService(repo);

  const nb = await db.createNotebook('Vector Art Notebook');
  const pages = await db.getPagesByNotebookId(nb.id);
  const pageId = pages[0].id;

  // 1. Create pen, highlighter, and eraser strokes
  const stroke1 = createPenStroke(
    [{ x: 100, y: 100, pressure: 0.5 }, { x: 120, y: 120, pressure: 0.7 }],
    '#E03131',
    6
  );
  const stroke2 = createHighlighterStroke(
    [{ x: 150, y: 150, pressure: 1.0 }, { x: 200, y: 150, pressure: 1.0 }],
    '#F59F00',
    20
  );
  const stroke3 = createPenStroke(
    [{ x: 500, y: 500, pressure: 0.5 }, { x: 550, y: 550, pressure: 0.5 }],
    '#1971C2',
    4
  );

  await db.saveStrokesForPage(pageId, [stroke1, stroke2, stroke3]);
  const savedStrokes = await db.getStrokesByPageId(pageId);
  assertEquals(savedStrokes.length, 3, '3 vector strokes persisted to DB');

  // 2. Lasso Selection simulation around stroke1 & stroke2 polygon (bounding x: 80..220, y: 80..220)
  const lassoPolygon: Point[] = [
    { x: 80, y: 80 },
    { x: 220, y: 80 },
    { x: 220, y: 220 },
    { x: 80, y: 220 },
  ];

  const stroke1Inside = isStrokeInsidePolygon(stroke1, lassoPolygon);
  const stroke2Inside = isStrokeInsidePolygon(stroke2, lassoPolygon);
  const stroke3Inside = isStrokeInsidePolygon(stroke3, lassoPolygon);

  assert(stroke1Inside, 'Stroke 1 inside lasso bounding box');
  assert(stroke2Inside, 'Stroke 2 inside lasso bounding box');
  assert(!stroke3Inside, 'Stroke 3 outside lasso bounding box');

  // 3. Translate stroke1 by dx=+50, dy=+50 using transformStroke
  const movedStroke1 = transformStroke(stroke1, 50, 50);
  assertEquals(movedStroke1.points[0].x, 150, 'Translated point 0 x coordinate');
  assertEquals(movedStroke1.points[0].y, 150, 'Translated point 0 y coordinate');

  // Persist updated translated strokes
  await db.saveStrokesForPage(pageId, [movedStroke1, stroke2, stroke3]);

  // 4. Export Page SVG
  const svgOutput = await db.exportPageAsSvg(pageId);
  assert(svgOutput.includes('<svg'), 'SVG contains root <svg> tag');
  assert(svgOutput.includes('stroke="#E03131"'), 'SVG contains pen stroke color');
  assert(svgOutput.includes('stroke="#F59F00"'), 'SVG contains highlighter stroke color');
  assert(svgOutput.includes('opacity="0.4"'), 'SVG contains highlighter 0.4 opacity');
});

// ============================================================================
// WORKFLOW 4: AI Study Harness & Sidecar Integration
// ============================================================================
registerTest('Workflow 4: AI Study Harness & Sidecar Integration', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const db = new DatabaseService(repo);
  const harness = new StudyAgentHarness(db);

  // 1. Update user profile
  const userProfile: UserStudyProfile = {
    subjectTags: ['Computer Science', 'Linear Algebra'],
    studyHabits: ['Active Recall', 'Spaced Repetition'],
    preferredSummaryFormat: 'bullet',
  };
  await harness.updateUserProfile(userProfile);
  const retrievedProfile = await harness.getUserProfile();
  assertEquals(retrievedProfile.subjectTags, ['Computer Science', 'Linear Algebra'], 'Subject tags updated');

  // 2. Setup notebook with pages and strokes
  const nb = await db.createNotebook('Algorithms Course');
  const pages = await db.getPagesByNotebookId(nb.id);
  const p0 = pages[0];
  const p1 = await db.createPage(nb.id, 'cornell', 1);
  const updatedPages = await db.getPagesByNotebookId(nb.id);

  const strokesPage0: Stroke[] = [
    createHighlighterStroke([{ x: 10, y: 10, pressure: 1.0 }, { x: 50, y: 10, pressure: 1.0 }], '#F59F00', 16),
  ];
  await db.saveStrokesForPage(p0.id, strokesPage0);

  // 3. Topic Indexing
  const topicIndex = await harness.indexNotebookTopics(nb.id, updatedPages);
  assert(topicIndex.topics.length > 0, 'Indexed topics generated');
  assert(topicIndex.metrics.totalStrokes === 1, 'Metric total strokes counted accurately');
  assert(topicIndex.metrics.highlighterStrokes === 1, 'Metric highlighter strokes counted accurately');

  // Verify pageIds & pageIndexes alignment
  for (const topic of topicIndex.topics) {
    assertEquals(topic.pageIds.length, topic.pageIndexes.length, 'pageIds & pageIndexes length aligned');
  }

  // 4. Generate Study Recap (Bullet Format)
  const bulletRecap = await harness.generateRecap(nb.id);
  assert(bulletRecap.summaryText.includes('Notebook Overview:'), 'Bullet summary includes overview header');
  assert(bulletRecap.actionItems.length > 0, 'Action items generated');

  // 5. Generate Executive Format Recap
  await harness.updateUserProfile({ ...userProfile, preferredSummaryFormat: 'executive' });
  const execRecap = await harness.generateRecap(nb.id);
  assert(execRecap.summaryText.includes('[EXECUTIVE STUDY SUMMARY]'), 'Executive summary format matches');

  // 6. Generate Flashcard Format Recap
  await harness.updateUserProfile({ ...userProfile, preferredSummaryFormat: 'flashcard' });
  const flashRecap = await harness.generateRecap(nb.id);
  assert(flashRecap.summaryText.includes('[FLASHCARD 1]'), 'Flashcard summary format matches');

  // 7. Recap History Querying (DESC order)
  const history = await harness.getRecapHistory(nb.id);
  assertEquals(history.length, 3, '3 recaps stored in history');
  assert(history[0].generatedAt >= history[1].generatedAt, 'Recap history ordered DESC by timestamp');
});

// ============================================================================
// WORKFLOW 5: Cross-Module Data Integrity & Full System Integration
// ============================================================================
registerTest('Workflow 5: Cross-Module Data Integrity & System Integration', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const db = new DatabaseService(repo);
  const harness = new StudyAgentHarness(db);

  // 1. Create full notebook with 3 pages of varying templates
  const nb = await db.createNotebook('Comprehensive Integration Notebook');
  const p0 = (await db.getPagesByNotebookId(nb.id))[0];
  const p1 = await db.createPage(nb.id, 'cornell', 1);
  const p2 = await db.createPage(nb.id, 'grid', 2);

  // 2. Draw strokes on each page
  const strokeP0 = createPenStroke([{ x: 20, y: 20, pressure: 0.5 }, { x: 100, y: 100, pressure: 0.8 }], '#212529', 4);
  const strokeP1 = createHighlighterStroke([{ x: 30, y: 30, pressure: 1.0 }, { x: 200, y: 30, pressure: 1.0 }], '#F59F00', 20);
  const strokeP2 = createPenStroke([{ x: 40, y: 40, pressure: 0.6 }, { x: 150, y: 150, pressure: 0.6 }], '#1971C2', 5);

  await db.saveStrokesForPage(p0.id, [strokeP0]);
  await db.saveStrokesForPage(p1.id, [strokeP1]);
  await db.saveStrokesForPage(p2.id, [strokeP2]);

  // 3. Configure AI Study Profile & Generate Study Recap
  await harness.updateUserProfile({
    subjectTags: ['Integration Testing', 'Architecture'],
    studyHabits: ['Feynman Technique'],
    preferredSummaryFormat: 'bullet',
  });
  const generatedRecap = await harness.generateRecap(nb.id);
  assert(generatedRecap.summaryText.length > 0, 'AI study recap generated');

  // 4. Export complete notebook JSON backup
  const jsonBackup = await db.exportNotebookToJson(nb.id);
  assert(jsonBackup.length > 500, 'JSON backup string generated');

  // 5. Clear repository database tables completely
  const existingNbs = await db.getNotebooks();
  for (const n of existingNbs) {
    await db.deleteNotebook(n.id);
  }
  const emptyNbs = await db.getNotebooks();
  assertEquals(emptyNbs.length, 0, 'Database cleared completely');

  // 6. Import backup JSON into empty repository
  const restoredNb = await db.importNotebookFromJson(jsonBackup);
  assertEquals(restoredNb.title, 'Comprehensive Integration Notebook (Imported)', 'Restored title matches');

  const restoredPages = await db.getPagesByNotebookId(restoredNb.id);
  assertEquals(restoredPages.length, 3, 'All 3 pages restored');
  assertEquals(restoredPages[0].template, 'lined', 'Page 0 template restored');
  assertEquals(restoredPages[1].template, 'cornell', 'Page 1 template restored');
  assertEquals(restoredPages[2].template, 'grid', 'Page 2 template restored');

  const restoredStrokesP0 = await db.getStrokesByPageId(restoredPages[0].id);
  const restoredStrokesP1 = await db.getStrokesByPageId(restoredPages[1].id);
  const restoredStrokesP2 = await db.getStrokesByPageId(restoredPages[2].id);

  assertEquals(restoredStrokesP0.length, 1, 'Page 0 strokes restored');
  assertEquals(restoredStrokesP1.length, 1, 'Page 1 strokes restored');
  assertEquals(restoredStrokesP2.length, 1, 'Page 2 strokes restored');

  assertEquals(restoredStrokesP1[0].tool, 'highlighter', 'Page 1 stroke tool matches');
  assertEquals(restoredStrokesP1[0].color, '#F59F00', 'Page 1 stroke color matches');

  // 7. Verify AI study recap can be regenerated seamlessly on restored notebook
  const postRestoreTopicIndex = await harness.indexNotebookTopics(restoredNb.id, restoredPages);
  assertEquals(postRestoreTopicIndex.metrics.totalStrokes, 3, 'Post-restore topic index total strokes equals 3');
  assertEquals(postRestoreTopicIndex.metrics.highlighterStrokes, 1, 'Post-restore highlighter count equals 1');
});

// Main execution routine
export async function runAllIntegrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const t of tests) {
    const start = Date.now();
    try {
      await t.fn();
      const durationMs = Date.now() - start;
      results.push({ name: t.name, passed: true, durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - start;
      results.push({ name: t.name, passed: false, error: err?.message || String(err), durationMs });
    }
  }

  return results;
}
