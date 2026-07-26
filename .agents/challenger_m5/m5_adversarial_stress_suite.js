const fs = require('fs');
const path = require('path');
const ts = require('E:/Program Files/PyCharm 2025.2.1.1/plugins/javascript-plugin/jsLanguageServicesImpl/external/typescript.js');

// Register TS transpile extension
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const res = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  });
  module._compile(res.outputText, filename);
};

// Mock Skia for headless environment
class MockSkPath {
  constructor() {
    this.commands = [];
  }
  moveTo(x, y) { this.commands.push({ cmd: 'moveTo', x, y }); }
  lineTo(x, y) { this.commands.push({ cmd: 'lineTo', x, y }); }
  quadTo(x1, y1, x2, y2) { this.commands.push({ cmd: 'quadTo', x1, y1, x2, y2 }); }
  close() { this.commands.push({ cmd: 'close' }); }
  toSVGString() { return 'MOCK_SVG_PATH'; }
}

const mockSkia = {
  Path: {
    Make: () => new MockSkPath(),
    MakeFromSVGString: (svg) => new MockSkPath(),
  },
};

const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request === '@shopify/react-native-skia') {
    return 'mock-skia';
  }
  return originalResolve.apply(this, arguments);
};

require.cache['mock-skia'] = {
  id: 'mock-skia',
  filename: 'mock-skia',
  loaded: true,
  exports: { Skia: mockSkia },
};

// Imports from project
const { DatabaseService, InMemoryStorageRepository } = require('../../src/services/storage/database.ts');
const { StudyAgentHarness } = require('../../src/services/ai/StudyAgentHarness.ts');
const {
  isPointInPolygon,
  isStrokeInsidePolygon,
  isPointNearStroke,
  transformStroke,
} = require('../../src/utils/geometry.ts');
const {
  normalizePressure,
  calculateDynamicStrokeWidth,
  filterPalmTouch,
} = require('../../src/utils/pressure.ts');
const { createSkiaPathFromPoints } = require('../../src/utils/skia.ts');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
    failures.push({ name: testName, details });
  }
}

async function runM5AdversarialStressSuite() {
  console.log('\n======================================================');
  console.log(' STARTING M5 ADVERSARIAL STRESS & EDGE-CASE SUITE');
  console.log('======================================================\n');

  // -------------------------------------------------------------
  // 1. Notebook Lifecycle & JSON Backup Edge Cases
  // -------------------------------------------------------------
  console.log('--- Domain 1: Notebook Lifecycle & Backup Resilience ---');
  try {
    const db = new DatabaseService();
    await db.initDatabase();

    // 1.1 Rapid creation and deletion of 50 notebooks
    const createdIds = [];
    for (let i = 0; i < 50; i++) {
      const nb = await db.createNotebook(`Stress Notebook #${i}`);
      createdIds.push(nb.id);
    }
    let stats = await db.getStorageStats();
    assert(stats.notebookCount === 50, 'Lifecycle: 50 notebooks created successfully');
    assert(stats.pageCount === 50, 'Lifecycle: 50 default pages created (1 per notebook)');

    // Delete odd index notebooks (25 total)
    for (let i = 1; i < 50; i += 2) {
      await db.deleteNotebook(createdIds[i]);
    }
    stats = await db.getStorageStats();
    assert(stats.notebookCount === 25, 'Lifecycle: 25 remaining notebooks after deleting 25');
    assert(stats.pageCount === 25, 'Lifecycle: 25 remaining pages (no orphan pages)');

    // 1.2 Import corrupted JSON handling
    let importCorruptedFailed = false;
    try {
      await db.importNotebookFromJson('{"invalid": "json structure"}');
    } catch (e) {
      importCorruptedFailed = true;
      assert(e.message.includes('Invalid notebook JSON export payload format'), 'Lifecycle: Rejects invalid JSON format with error');
    }
    assert(importCorruptedFailed, 'Lifecycle: Invalid JSON import safely throws error');

    // 1.3 Import malformed JSON string (syntax error)
    let malformedSyntaxHandled = false;
    try {
      await db.importNotebookFromJson('{ bad json: ');
    } catch (e) {
      malformedSyntaxHandled = true;
    }
    assert(malformedSyntaxHandled, 'Lifecycle: Malformed JSON syntax error caught safely');

  } catch (err) {
    assert(false, 'Lifecycle Stress Suite execution', err.message);
  }

  // -------------------------------------------------------------
  // 2. Page Reordering & Delete Gap Closure Edge Cases
  // -------------------------------------------------------------
  console.log('\n--- Domain 2: Page Reordering & Gap Closure ---');
  try {
    const db = new DatabaseService();
    await db.initDatabase();

    const nb = await db.createNotebook('Page Reorder Stress');
    
    // Create 10 additional pages (total 11)
    const pageIds = [];
    const firstPage = (await db.getPagesByNotebookId(nb.id))[0];
    pageIds.push(firstPage.id);

    for (let i = 1; i < 11; i++) {
      const p = await db.createPage(nb.id, i % 2 === 0 ? 'grid' : 'cornell');
      pageIds.push(p.id);
    }

    let pages = await db.getPagesByNotebookId(nb.id);
    assert(pages.length === 11, 'Page Reorder: 11 pages created');
    assert(pages.every((p, idx) => p.pageIndex === idx), 'Page Reorder: Contiguous initial indexes 0..10');

    // Reverse order
    const reversedIds = [...pageIds].reverse();
    const reordered = await db.reorderPages(nb.id, reversedIds);
    assert(
      reordered.map((p) => p.id).join(',') === reversedIds.join(','),
      'Page Reorder: Exact reversal of page order applied'
    );
    assert(
      reordered.every((p, idx) => p.pageIndex === idx),
      'Page Reorder: Reordered page indexes remain strictly 0..10 contiguous'
    );

    // Delete middle page (index 5)
    const pageToDelete = reordered[5];
    await db.deletePage(pageToDelete.id);

    const pagesAfterDelete = await db.getPagesByNotebookId(nb.id);
    assert(pagesAfterDelete.length === 10, 'Page Reorder: 10 pages remaining after deleting middle page');
    assert(
      pagesAfterDelete.every((p, idx) => p.pageIndex === idx),
      'Page Reorder: Index gap closed automatically, pages remain strictly 0..9 contiguous'
    );

  } catch (err) {
    assert(false, 'Page Reorder Stress Suite execution', err.message);
  }

  // -------------------------------------------------------------
  // 3. Stroke Lasso Transformation & Geometry Edge Cases
  // -------------------------------------------------------------
  console.log('\n--- Domain 3: Stroke Lasso Transformation & Geometry Edge Cases ---');
  try {
    // 3.1 Zero delta transformation
    const s1 = {
      id: 'st_1', tool: 'pen', color: '#00F', size: 5, createdAt: 100,
      skiaPathSvg: 'M 10 10 L 20 20',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
    };

    const s1_transformed = transformStroke(s1, 0, 0);
    assert(s1_transformed.points[0].x === 10 && s1_transformed.points[0].y === 10, 'Lasso: Zero delta transform leaves coords intact');
    assert(s1_transformed.skiaPathSvg === undefined, 'Lasso: skiaPathSvg cache invalidated to undefined even for (0,0)');
    assert(s1.skiaPathSvg === 'M 10 10 L 20 20', 'Lasso: Original stroke remains untouched (immutability)');

    // 3.2 Large floating point deltas
    const s2_transformed = transformStroke(s1, 10000.75, -5000.25);
    assert(s2_transformed.points[0].x === 10010.75 && s2_transformed.points[0].y === -4990.25, 'Lasso: Large precision float offset accurate');

    // 3.3 Polygon lasso hit test threshold (exactly 50% vs < 50%)
    const polySquare = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

    // 4 points stroke: 2 inside, 2 outside (50%)
    const s_half = {
      id: 's_half', tool: 'pen', color: '#000', size: 2, createdAt: 1,
      points: [{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 150, y: 50 }, { x: 200, y: 50 }]
    };
    assert(isStrokeInsidePolygon(s_half, polySquare) === true, 'Lasso: 50% points inside poly returns true (>= 0.5)');

    // 3 points stroke: 1 inside, 2 outside (33.3%)
    const s_third = {
      id: 's_third', tool: 'pen', color: '#000', size: 2, createdAt: 1,
      points: [{ x: 10, y: 10 }, { x: 150, y: 50 }, { x: 200, y: 50 }]
    };
    assert(isStrokeInsidePolygon(s_third, polySquare) === false, 'Lasso: 33.3% points inside poly returns false (< 0.5)');

    // 3.4 Degenerate polygon (points < 3) or null
    assert(isStrokeInsidePolygon(s_half, [{ x: 0, y: 0 }, { x: 10, y: 10 }]) === false, 'Lasso: Degenerate polygon (< 3 vertices) returns false');
    assert(isStrokeInsidePolygon(s_half, null) === false, 'Lasso: Null polygon safely returns false without crash');

  } catch (err) {
    assert(false, 'Lasso Geometry Stress Suite execution', err.message);
  }

  // -------------------------------------------------------------
  // 4. Paper Template Persistence & SVG Export Edge Cases
  // -------------------------------------------------------------
  console.log('\n--- Domain 4: Paper Template Persistence & SVG Export ---');
  try {
    const db = new DatabaseService();
    await db.initDatabase();

    const nb = await db.createNotebook('SVG & Template Test');
    const page = (await db.getPagesByNotebookId(nb.id))[0];

    const templates = ['lined', 'grid', 'cornell', 'blank'];
    for (const tpl of templates) {
      await db.updatePageTemplate(page.id, tpl);
      const updated = await db.getPageById(page.id);
      assert(updated.template === tpl, `Template Persistence: Template updated to '${tpl}'`);

      const svg = await db.exportPageAsSvg(page.id);
      assert(svg.includes('<?xml version="1.0"'), `SVG Export: Valid XML header for template '${tpl}'`);
      assert(svg.includes('<svg'), `SVG Export: Valid root SVG tag for template '${tpl}'`);
    }

  } catch (err) {
    assert(false, 'Template & SVG Stress Suite execution', err.message);
  }

  // -------------------------------------------------------------
  // 5. AI Study Recap Generation & Topic Indexing Under High Load
  // -------------------------------------------------------------
  console.log('\n--- Domain 5: AI Study Recap Generation & High Load Performance ---');
  try {
    const db = new DatabaseService();
    await db.initDatabase();
    const harness = new StudyAgentHarness(db);

    // Create 100 pages with 1000 total strokes
    const pages = [];
    const strokes = [];

    for (let i = 0; i < 100; i++) {
      pages.push({
        id: `p_${i}`,
        notebookId: 'nb_heavy',
        pageIndex: i,
        template: i % 3 === 0 ? 'cornell' : i % 3 === 1 ? 'grid' : 'lined',
        createdAt: 1000 + i,
        updatedAt: 1000 + i,
      });

      for (let s = 0; s < 10; s++) {
        strokes.push({
          id: `s_${i}_${s}`,
          tool: s % 4 === 0 ? 'pen' : s % 4 === 1 ? 'highlighter' : s % 4 === 2 ? 'eraser' : 'lasso',
          color: '#000000',
          size: 4,
          points: [{ x: 10 * s, y: 10 * s }, { x: 20 * s, y: 20 * s }],
          createdAt: 1000 + i + s,
        });
      }
    }

    const tStart = Date.now();
    const topicIndex = await harness.indexNotebookTopics('nb_heavy', pages, strokes);
    const durationTopic = Date.now() - tStart;

    assert(durationTopic < 500, `AI High Load: 100 pages / 1000 strokes topic indexing completed in ${durationTopic}ms (< 500ms target)`);
    assert(topicIndex.metrics.totalStrokes === 1000, 'AI High Load: Correct totalStrokes 1000 calculated');
    assert(topicIndex.metrics.penStrokes === 300, 'AI High Load: Correct penStrokes 300 calculated (3 per page * 100 pages)');
    assert(topicIndex.metrics.highlighterStrokes === 300, 'AI High Load: Correct highlighterStrokes 300 calculated (3 per page * 100 pages)');

    const tRecapStart = Date.now();
    const recap = await harness.generateRecap('nb_heavy', pages, strokes);
    const durationRecap = Date.now() - tRecapStart;

    assert(durationRecap < 500, `AI High Load: Recap generation completed in ${durationRecap}ms (< 500ms target)`);
    assert(recap.summaryText.length > 50, 'AI High Load: Generated valid non-empty summary text');

  } catch (err) {
    assert(false, 'AI High Load Stress Suite execution', err.message);
  }

  // Summary
  console.log('\n======================================================');
  console.log(` M5 ADVERSARIAL STRESS SUMMARY`);
  console.log(` Total Assertions: ${totalTests}`);
  console.log(` Passed: ${passedTests}`);
  console.log(` Failed: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runM5AdversarialStressSuite().catch((err) => {
  console.error('Fatal stress suite runner error:', err);
  process.exit(1);
});
