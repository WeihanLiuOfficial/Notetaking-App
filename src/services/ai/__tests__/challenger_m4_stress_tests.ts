import { StudyAgentHarness } from '../StudyAgentHarness';
import { InMemoryStorageRepository, DatabaseService } from '../../storage/database';
import type { Page } from '../../../types/storage';
import type { Stroke } from '../../../types/canvas';
import type { UserStudyProfile, StudyRecap } from '../../../types/ai';

// Lightweight runner for Challenger M4 Stress Tests

const testsToRun: Array<{
  name: string;
  fn: () => Promise<void> | void;
}> = [];

function test(name: string, fn: () => Promise<void> | void) {
  testsToRun.push({ name, fn });
}

function expect(actual: any) {
  return {
    toBeDefined: () => {
      if (actual === undefined) throw new Error(`Expected value to be defined, but got undefined`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, but got ${JSON.stringify(actual)}`);
    },
    toNotBeNull: () => {
      if (actual === null || actual === undefined) throw new Error(`Expected non-null value, but got ${JSON.stringify(actual)}`);
    },
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: any) => {
      const actualJson = JSON.stringify(actual);
      const expectedJson = JSON.stringify(expected);
      if (actualJson !== expectedJson) throw new Error(`Expected ${expectedJson}, but got ${actualJson}`);
    },
    toContain: (expected: string) => {
      if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected string to contain ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
      } else if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
        }
      } else {
        throw new Error(`Expected string or array, but got ${typeof actual}`);
      }
    },
    toBeGreaterThan: (expected: number) => {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected: number) => {
      if (typeof actual !== 'number' || actual > expected) {
        throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
      }
    },
    toBeGreaterThanOrEqual: (expected: number) => {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
  };
}

// =============================================================
// TEST SUITE: Challenger M4 Stress & Adversarial Assertions
// =============================================================

test('Profile Update with Empty Arrays (subjectTags: [], studyHabits: [])', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  const emptyProfile: UserStudyProfile = {
    subjectTags: [],
    studyHabits: [],
    preferredSummaryFormat: 'bullet',
  };

  const updated = await harness.updateUserProfile(emptyProfile);
  expect(updated.subjectTags).toEqual([]);
  expect(updated.studyHabits).toEqual([]);

  const retrieved = await harness.getUserProfile();
  expect(retrieved.subjectTags).toEqual([]);
  expect(retrieved.studyHabits).toEqual([]);
});

test('Topic Indexing with Empty Page Lists & Empty DB Fallback', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  const topicIndex = await harness.indexNotebookTopics('nb-empty', [], []);
  expect(topicIndex.notebookId).toBe('nb-empty');
  expect(topicIndex.topics).toEqual([]);
  expect(topicIndex.metrics.totalStrokes).toBe(0);
  expect(topicIndex.keyConcepts.length).toBeGreaterThan(0);
});

test('Topic Indexing with Empty Page List input but Pages present in DB (Auto Fetch)', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  const nb = await repo.createNotebook('DB Notebook');

  const topicIndex = await harness.indexNotebookTopics(nb.id, [], []);
  expect(topicIndex.metrics.templateDistribution['lined']).toBe(1);
  expect(topicIndex.topics.some((t) => t.tag === 'Lecture Notes')).toBe(true);
});

test('Topic Indexing with Large Page Lists (150 pages) and Subject Tag Round-Robin', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  await harness.updateUserProfile({
    subjectTags: ['TagA', 'TagB', 'TagC'],
    studyHabits: ['Habit1'],
    preferredSummaryFormat: 'bullet',
  });

  const largePages: Page[] = [];
  for (let i = 0; i < 150; i++) {
    largePages.push({
      id: `p-${i}`,
      notebookId: 'nb-large',
      pageIndex: i,
      template: i % 4 === 0 ? 'cornell' : i % 4 === 1 ? 'lined' : i % 4 === 2 ? 'grid' : 'blank',
      createdAt: 1000 + i,
      updatedAt: 1000 + i,
    });
  }

  const startTime = Date.now();
  const topicIndex = await harness.indexNotebookTopics('nb-large', largePages, []);
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThanOrEqual(1000);
  expect(topicIndex.metrics.templateDistribution['cornell']).toBe(38);
  expect(topicIndex.metrics.templateDistribution['lined']).toBe(38);
  expect(topicIndex.metrics.templateDistribution['grid']).toBe(37);
  expect(topicIndex.metrics.templateDistribution['blank']).toBe(37);

  for (const topic of topicIndex.topics) {
    expect(topic.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(topic.relevanceScore).toBeLessThanOrEqual(1.0);
  }
});

test('Recap Generation for All 3 Formats with Custom User Profile', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  const customProfile: UserStudyProfile = {
    subjectTags: ['Astrophysics', 'Thermodynamics'],
    studyHabits: ['Feynman Technique'],
    preferredSummaryFormat: 'bullet',
  };
  await harness.updateUserProfile(customProfile);

  const pages: Page[] = [
    { id: 'p1', notebookId: 'nb-fmt', pageIndex: 0, template: 'cornell', createdAt: 100, updatedAt: 100 },
  ];
  const strokes: Stroke[] = [
    { id: 's1', tool: 'highlighter', color: '#FFFF00', size: 10, points: [{ x: 5, y: 5 }], createdAt: 100 },
  ];

  // 1. Bullet format
  const recapBullet = await harness.generateRecap('nb-fmt', pages, strokes);
  expect(recapBullet.summaryText).toContain('• Notebook Overview:');
  expect(recapBullet.summaryText).toContain('• Active Tools: 0 pen strokes, 1 highlighter highlights.');

  // 2. Executive format
  await harness.updateUserProfile({ ...customProfile, preferredSummaryFormat: 'executive' });
  const recapExec = await harness.generateRecap('nb-fmt', pages, strokes);
  expect(recapExec.summaryText).toContain('[EXECUTIVE STUDY SUMMARY]');
  expect(recapExec.summaryText).toContain('EXECUTIVE BRIEF: Notebook nb-fmt contains 1 page(s)');

  // 3. Flashcard format
  await harness.updateUserProfile({ ...customProfile, preferredSummaryFormat: 'flashcard' });
  const recapFlash = await harness.generateRecap('nb-fmt', pages, strokes);
  expect(recapFlash.summaryText).toContain('[FLASHCARD 1]');
  expect(recapFlash.summaryText).toContain('[FLASHCARD 2]');
  expect(recapFlash.summaryText).toContain('[FLASHCARD 3]');
});

test('Database Query Ordering & Isolation for Recaps (DESC generatedAt)', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();

  const recap1: StudyRecap = {
    notebookId: 'nb-order',
    summaryText: 'First Recap',
    keyConcepts: ['C1'],
    actionItems: ['A1'],
    generatedAt: 1000,
  };

  const recap2: StudyRecap = {
    notebookId: 'nb-order',
    summaryText: 'Second Recap',
    keyConcepts: ['C2'],
    actionItems: ['A2'],
    generatedAt: 3000,
  };

  const recap3: StudyRecap = {
    notebookId: 'nb-order',
    summaryText: 'Third Recap',
    keyConcepts: ['C3'],
    actionItems: ['A3'],
    generatedAt: 2000,
  };

  await repo.saveStudyRecap(recap1);
  await repo.saveStudyRecap(recap2);
  await repo.saveStudyRecap(recap3);

  const history = await repo.getRecapsByNotebookId('nb-order');
  expect(history.length).toBe(3);
  expect(history[0].generatedAt).toBe(3000);
  expect(history[1].generatedAt).toBe(2000);
  expect(history[2].generatedAt).toBe(1000);
  expect(history[0].summaryText).toBe('Second Recap');

  const latest = await repo.getLatestRecapByNotebookId('nb-order');
  expect(latest).toNotBeNull();
  expect(latest?.generatedAt).toBe(3000);

  const otherHistory = await repo.getRecapsByNotebookId('nb-other');
  expect(otherHistory.length).toBe(0);
});

// =============================================================
// EMPIRICAL BUG CONFIRMATION SUITE
// =============================================================

test('Bug #1 Verification: Page ID and Page Index Alignment in IndexedTopic', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();
  const harness = new StudyAgentHarness(repo);

  // Pass pages out of index order (Page index 1 processed before Page index 0)
  const pages: Page[] = [
    { id: 'page-id-second', notebookId: 'nb-align', pageIndex: 1, template: 'lined', createdAt: 200, updatedAt: 200 },
    { id: 'page-id-first', notebookId: 'nb-align', pageIndex: 0, template: 'lined', createdAt: 100, updatedAt: 100 },
  ];

  const topicIndex = await harness.indexNotebookTopics('nb-align', pages, []);
  const lectureTopic = topicIndex.topics.find((t) => t.tag === 'Lecture Notes');
  expect(lectureTopic).toBeDefined();

  if (lectureTopic) {
    const firstPageIdInArray = lectureTopic.pageIds[0]; // 'page-id-first'
    const firstPageIndexInArray = lectureTopic.pageIndexes[0]; // 0

    const actualPageOfFirstId = pages.find((p) => p.id === firstPageIdInArray);
    
    // Assert that pageIds[0] and pageIndexes[0] match and are aligned
    expect(actualPageOfFirstId?.pageIndex).toBe(0);
    expect(firstPageIndexInArray).toBe(0);
  }
});

test('Bug #2 Verification: generateRecap totalPages is accurate when pages=[] is passed', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();

  const nb = await repo.createNotebook('MultiPage NB'); // auto-creates 1 page
  await repo.createPage(nb.id, 'cornell');
  await repo.createPage(nb.id, 'grid');
  // Total 3 pages in DB

  const harness = new StudyAgentHarness(repo);

  // Pass pages = []
  const recap = await harness.generateRecap(nb.id, [], []);

  // indexNotebookTopics loaded 3 pages from DB, totalPages computed in generateRecap is 3
  expect(recap.summaryText).toContain('Analyzed 3 pages');
});

test('Bug #3 Verification: indexNotebookTopics does not mutate caller passed empty strokes array', async () => {
  const repo = new InMemoryStorageRepository();
  await repo.initDatabase();

  const nb = await repo.createNotebook('Stroke Mutate NB');
  const pages = await repo.getPagesByNotebookId(nb.id);
  
  // Save 2 strokes into DB for page 0
  await repo.saveStrokesForPage(pages[0].id, [
    { id: 'st1', tool: 'pen', color: '#000', size: 2, points: [{ x: 0, y: 0 }], createdAt: 100 },
    { id: 'st2', tool: 'pen', color: '#000', size: 2, points: [{ x: 10, y: 10 }], createdAt: 110 },
  ]);

  const harness = new StudyAgentHarness(repo);
  const callerStrokesArray: Stroke[] = [];

  // Pass callerStrokesArray (length 0)
  await harness.indexNotebookTopics(nb.id, pages, callerStrokesArray);

  // Caller array was NOT mutated! Length remains 0
  expect(callerStrokesArray.length).toBe(0);
});

// Main execution function
async function run() {
  console.log(`\n======================================================`);
  console.log(` Running Challenger M4 Stress & Adversarial Test Suite`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  for (const t of testsToRun) {
    try {
      await t.fn();
      console.log(`  ✓ [PASS] ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${t.name}`);
      console.error(`     Error: ${err?.message || err}\n`);
      failed++;
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(` Summary: ${passed} passed, ${failed} failed`);
  console.log(`------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
