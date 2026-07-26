import { DatabaseService, InMemoryStorageRepository } from '../../src/services/storage/database.ts';
import type { Stroke } from '../../src/types/canvas.ts';

async function runChallengerHarness() {
  console.log('======================================================');
  console.log('   CHALLENGER EMPIRICAL HARNESS: M3 Storage Layer    ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const db = new DatabaseService();
  await db.initDatabase();

  // Test 1: Special Characters & Unicode in Notebook Titles
  try {
    const titleWithSpecialChars = 'Physics 101: ⚛️ Math & <XML> "Quotes" & \n Newlines';
    const nb = await db.createNotebook(titleWithSpecialChars);
    const retrieved = await db.getNotebookById(nb.id);
    assert(retrieved?.title === titleWithSpecialChars, 'Special characters & unicode handling in notebook title');
    await db.deleteNotebook(nb.id);
  } catch (err: any) {
    assert(false, 'Special characters & unicode handling in notebook title', err.message);
  }

  // Test 2: Page Insertion at Boundaries & Reordering Gap Closure
  try {
    const nb = await db.createNotebook('Multi-page Stress Test');
    // Default page index 0 created
    const page0 = (await db.getPagesByNotebookId(nb.id))[0];
    
    // Add page at index 0 (pushing page0 to 1)
    const pageFront = await db.createPage(nb.id, 'grid', 0);
    let pages = await db.getPagesByNotebookId(nb.id);
    assert(pages.length === 2 && pages[0].id === pageFront.id && pages[1].id === page0.id, 'Page insert at index 0');

    // Add page at index 1 (between front and page0)
    const pageMid = await db.createPage(nb.id, 'cornell', 1);
    pages = await db.getPagesByNotebookId(nb.id);
    assert(pages.length === 3 && pages.map(p => p.id).join(',') === `${pageFront.id},${pageMid.id},${page0.id}`, 'Page insert at middle index 1');

    // Add 2 more pages at end
    const page3 = await db.createPage(nb.id, 'blank');
    const page4 = await db.createPage(nb.id, 'lined');
    pages = await db.getPagesByNotebookId(nb.id);
    assert(pages.length === 5 && pages.map(p => p.pageIndex).join(',') === '0,1,2,3,4', 'Multi-page sequential indices 0..4');

    // Delete middle page pageMid (index 1)
    await db.deletePage(pageMid.id);
    pages = await db.getPagesByNotebookId(nb.id);
    assert(pages.length === 4 && pages.map(p => p.pageIndex).join(',') === '0,1,2,3', 'Delete middle page gap-closure');

    // Reorder pages in reverse
    const revOrder = [pages[3].id, pages[2].id, pages[1].id, pages[0].id];
    const reordered = await db.reorderPages(nb.id, revOrder);
    assert(reordered.map(p => p.id).join(',') === revOrder.join(',') && reordered.map(p => p.pageIndex).join(',') === '0,1,2,3', 'Transactional reorder in reverse order');

    await db.deleteNotebook(nb.id);
  } catch (err: any) {
    assert(false, 'Page insertion, gap closure, and reordering stress test', err.message);
  }

  // Test 3: High Precision Float & Large Array Serialization/Deserialization
  try {
    const nb = await db.createNotebook('Fidelity Test');
    const page = (await db.getPagesByNotebookId(nb.id))[0];

    const largePointCount = 5000;
    const points = [];
    for (let i = 0; i < largePointCount; i++) {
      points.push({
        x: 100.123456789 + i * 0.5,
        y: 200.987654321 - i * 0.25,
        pressure: 0.123456789,
      });
    }

    const strokePrecision: Stroke = {
      id: 'stroke-precision',
      tool: 'pen',
      color: '#123456',
      size: 2.5,
      points,
      createdAt: Date.now(),
    };

    const strokeDot: Stroke = {
      id: 'stroke-dot',
      tool: 'highlighter',
      color: '#FF00FF',
      size: 15,
      points: [{ x: 50, y: 50, pressure: 1.0 }],
      createdAt: Date.now(),
    };

    const strokeEmpty: Stroke = {
      id: 'stroke-empty',
      tool: 'eraser',
      color: '#FFFFFF',
      size: 30,
      points: [],
      createdAt: Date.now(),
    };

    await db.saveStrokesForPage(page.id, [strokePrecision, strokeDot, strokeEmpty]);
    const loadedStrokes = await db.getStrokesByPageId(page.id);

    assert(loadedStrokes.length === 3, 'Save and retrieve 3 diverse strokes (large, single-point, empty)');
    assert(loadedStrokes[0].points.length === largePointCount, '5,000 points vector stroke point count preserved');
    assert(Math.abs(loadedStrokes[0].points[0].x - 100.123456789) < 0.000001, 'High precision float X coordinate fidelity');
    assert(Math.abs(loadedStrokes[0].points[0].y - 200.987654321) < 0.000001, 'High precision float Y coordinate fidelity');
    assert(Math.abs(loadedStrokes[0].points[0].pressure! - 0.123456789) < 0.000001, 'High precision float pressure fidelity');
    assert(loadedStrokes[1].points.length === 1, 'Single-point dot stroke preserved');
    assert(loadedStrokes[2].points.length === 0, 'Empty points array stroke preserved');

    await db.deleteNotebook(nb.id);
  } catch (err: any) {
    assert(false, 'Stroke vector serialization fidelity stress test', err.message);
  }

  // Test 4: SVG Export Markup Validation (All 4 Paper Templates & Opacities & Single Dot Fallback)
  try {
    const nb = await db.createNotebook('SVG Verification');
    const page = (await db.getPagesByNotebookId(nb.id))[0];

    const strokes: Stroke[] = [
      {
        id: 'stroke-pen',
        tool: 'pen',
        color: '#000000',
        size: 3,
        points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
      },
      {
        id: 'stroke-highlighter',
        tool: 'highlighter',
        color: '#FFFF00',
        size: 25,
        points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      },
      {
        id: 'stroke-single-dot',
        tool: 'pen',
        color: '#FF0000',
        size: 5,
        points: [{ x: 300, y: 300 }], // Test single dot fallback path format: M 300 300 L 300.1 300.1
      },
    ];

    await db.saveStrokesForPage(page.id, strokes);

    // Test 'lined'
    await db.updatePageTemplate(page.id, 'lined');
    const svgLined = await db.exportPageAsSvg(page.id, 800, 1000);
    assert(svgLined.includes('stroke="#E9ECEF"') && svgLined.includes('stroke-width="1"'), 'SVG export: lined template lines present');

    // Test 'grid'
    await db.updatePageTemplate(page.id, 'grid');
    const svgGrid = await db.exportPageAsSvg(page.id, 800, 1000);
    assert(svgGrid.includes('stroke-width="0.5"'), 'SVG export: grid template lines present');

    // Test 'cornell'
    await db.updatePageTemplate(page.id, 'cornell');
    const svgCornell = await db.exportPageAsSvg(page.id, 800, 1000);
    assert(svgCornell.includes('x1="200"') && svgCornell.includes('stroke="#CED4DA"'), 'SVG export: cornell template dividers present');

    // Test 'blank'
    await db.updatePageTemplate(page.id, 'blank');
    const svgBlank = await db.exportPageAsSvg(page.id, 800, 1000);
    assert(svgBlank.includes('<rect width="100%" height="100%" fill="#FFFFFF"/>'), 'SVG export: blank template background rect present');

    // Verify stroke paths & opacity in SVG output
    assert(svgBlank.includes('opacity="1"'), 'SVG export: pen stroke opacity 1.0');
    assert(svgBlank.includes('opacity="0.4"'), 'SVG export: highlighter stroke opacity 0.4');
    assert(svgBlank.includes('d="M 300 300 L 300.1 300.1"'), 'SVG export: single point dot stroke fallback path formatting');

    await db.deleteNotebook(nb.id);
  } catch (err: any) {
    assert(false, 'SVG export markup stress test', err.message);
  }

  // Test 5: JSON Export & Import Roundtrip Fidelity with Multiple Pages & Custom Properties
  try {
    const nb = await db.createNotebook('Backup Master');
    const page0 = (await db.getPagesByNotebookId(nb.id))[0];
    const page1 = await db.createPage(nb.id, 'grid');

    await db.saveStrokesForPage(page0.id, [{
      id: 'p0-s1',
      tool: 'pen',
      color: '#111111',
      size: 2,
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      createdAt: 100,
    }]);

    await db.saveStrokesForPage(page1.id, [{
      id: 'p1-s1',
      tool: 'highlighter',
      color: '#00FF00',
      size: 20,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      createdAt: 200,
    }]);

    const jsonExport = await db.exportNotebookToJson(nb.id);
    const parsedObj = JSON.parse(jsonExport);

    assert(parsedObj.version === '1.0', 'Export JSON version is 1.0');
    assert(parsedObj.pages.length === 2, 'Export JSON contains 2 pages');
    assert(parsedObj.strokesByPage[page0.id].length === 1, 'Export JSON contains page 0 strokes');
    assert(parsedObj.strokesByPage[page1.id].length === 1, 'Export JSON contains page 1 strokes');

    const imported = await db.importNotebookFromJson(jsonExport);
    assert(imported.title === 'Backup Master (Imported)', 'Imported notebook title appended with (Imported)');

    const importedPages = await db.getPagesByNotebookId(imported.id);
    assert(importedPages.length === 2, 'Imported notebook restored 2 pages');

    const p0Strokes = await db.getStrokesByPageId(importedPages[0].id);
    const p1Strokes = await db.getStrokesByPageId(importedPages[1].id);

    assert(p0Strokes[0].color === '#111111' && p0Strokes[0].id !== 'p0-s1', 'Imported page 0 strokes restored with new unique ID');
    assert(p1Strokes[0].color === '#00FF00' && p1Strokes[0].id !== 'p1-s1', 'Imported page 1 strokes restored with new unique ID');

    await db.deleteNotebook(nb.id);
    await db.deleteNotebook(imported.id);
  } catch (err: any) {
    assert(false, 'JSON Backup export/import roundtrip stress test', err.message);
  }

  // Test 6: Storage Stats Accuracy
  try {
    const nb1 = await db.createNotebook('Stats 1');
    const nb2 = await db.createNotebook('Stats 2');
    const p1 = (await db.getPagesByNotebookId(nb1.id))[0];
    const p2 = (await db.getPagesByNotebookId(nb2.id))[0];

    await db.saveStrokesForPage(p1.id, [
      { id: 'st1', tool: 'pen', color: '#000', size: 1, points: [] },
      { id: 'st2', tool: 'pen', color: '#000', size: 1, points: [] },
    ]);
    await db.saveStrokesForPage(p2.id, [
      { id: 'st3', tool: 'pen', color: '#000', size: 1, points: [] },
    ]);

    const stats = await db.getStorageStats();
    assert(stats.notebookCount >= 2, 'StorageStats notebookCount correctly counted');
    assert(stats.pageCount >= 2, 'StorageStats pageCount correctly counted');
    assert(stats.strokeCount >= 3, 'StorageStats strokeCount correctly counted');

    await db.deleteNotebook(nb1.id);
    await db.deleteNotebook(nb2.id);
  } catch (err: any) {
    assert(false, 'Storage stats accuracy test', err.message);
  }

  console.log('\n------------------------------------------------------');
  console.log(` Challenger Harness Summary: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runChallengerHarness();
