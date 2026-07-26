import { StudyAgentHarness } from '../StudyAgentHarness.ts';
import { InMemoryStorageRepository } from '../../storage/database.ts';
import type { Page } from '../../../types/storage.ts';
import type { Stroke } from '../../../types/canvas.ts';
import type { UserStudyProfile } from '../../../types/ai.ts';

// Lightweight Jest-compatible test runner for AI Study Harness Service

let currentBeforeEach: (() => Promise<void> | void) | null = null;
const testsToRun: Array<{
  suite: string;
  name: string;
  fn: () => Promise<void> | void;
  beforeEach: (() => Promise<void> | void) | null;
}> = [];
let currentSuite = 'Global';

function describe(suiteName: string, fn: () => void) {
  currentSuite = suiteName;
  fn();
}

function beforeEach(fn: () => Promise<void> | void) {
  currentBeforeEach = fn;
}

function test(testName: string, fn: () => Promise<void> | void) {
  testsToRun.push({
    suite: currentSuite,
    name: testName,
    fn,
    beforeEach: currentBeforeEach,
  });
}

function expect(actual: any) {
  return {
    toBeDefined: () => {
      if (actual === undefined) throw new Error(`Expected value to be defined, but got undefined`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, but got ${JSON.stringify(actual)}`);
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
    toBeGreaterThanOrEqual: (expected: number) => {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    get not() {
      return {
        toBeNull: () => {
          if (actual === null) throw new Error(`Expected value not to be null`);
        },
      };
    },
  };
}

// -------------------------------------------------------------
// Test Suite Definition
// -------------------------------------------------------------

describe('StudyAgentHarness (Milestone 4 AI Harness & Profiling Engine)', () => {
  let repo: InMemoryStorageRepository;
  let harness: StudyAgentHarness;

  beforeEach(async () => {
    repo = new InMemoryStorageRepository();
    await repo.initDatabase();
    harness = new StudyAgentHarness(repo);
  });

  test('getUserProfile returns default profile and updateUserProfile persists updates', async () => {
    const initialProfile = await harness.getUserProfile();
    expect(initialProfile).toBeDefined();
    expect(Array.isArray(initialProfile.subjectTags)).toBe(true);
    expect(initialProfile.preferredSummaryFormat).toBe('bullet');

    const updatedProf: UserStudyProfile = {
      subjectTags: ['Quantum Mechanics', 'Linear Algebra'],
      studyHabits: ['Pomodoro 25/5', 'Feynman Technique'],
      preferredSummaryFormat: 'executive',
    };

    const saved = await harness.updateUserProfile(updatedProf);
    expect(saved.subjectTags).toEqual(['Quantum Mechanics', 'Linear Algebra']);
    expect(saved.preferredSummaryFormat).toBe('executive');

    // Retrieve again to verify persistence in DB repository
    const retrieved = await harness.getUserProfile();
    expect(retrieved.subjectTags).toEqual(['Quantum Mechanics', 'Linear Algebra']);
    expect(retrieved.preferredSummaryFormat).toBe('executive');
  });

  test('indexNotebookTopics extracts topics, key concepts, and stroke metrics correctly', async () => {
    const pages: Page[] = [
      { id: 'page-1', notebookId: 'nb-101', pageIndex: 0, template: 'cornell', createdAt: 100, updatedAt: 100 },
      { id: 'page-2', notebookId: 'nb-101', pageIndex: 1, template: 'grid', createdAt: 200, updatedAt: 200 },
    ];

    const strokes: Stroke[] = [
      { id: 's1', tool: 'pen', color: '#000', size: 3, points: [{ x: 10, y: 10 }], createdAt: 100 },
      { id: 's2', tool: 'pen', color: '#000', size: 3, points: [{ x: 20, y: 20 }], createdAt: 110 },
      { id: 's3', tool: 'highlighter', color: '#FF0', size: 15, points: [{ x: 50, y: 50 }], createdAt: 120 },
    ];

    const topicIndex = await harness.indexNotebookTopics('nb-101', pages, strokes);
    expect(topicIndex.notebookId).toBe('nb-101');
    expect(topicIndex.metrics.totalStrokes).toBe(3);
    expect(topicIndex.metrics.penStrokes).toBe(2);
    expect(topicIndex.metrics.highlighterStrokes).toBe(1);
    expect(topicIndex.metrics.templateDistribution['cornell']).toBe(1);
    expect(topicIndex.metrics.templateDistribution['grid']).toBe(1);

    // Topics extracted from templates and highlighter
    const tags = topicIndex.topics.map((t) => t.tag);
    expect(tags).toContain('Cornell Summary & Cues');
    expect(tags).toContain('Diagrams & Math');
    expect(tags).toContain('Exam High-Yield Focus');

    // Relevance scores
    expect(topicIndex.topics[0].relevanceScore).toBeGreaterThan(0);
    expect(topicIndex.keyConcepts.length).toBeGreaterThan(0);
  });

  test('generateRecap produces bullet format summary and persists to DB', async () => {
    await harness.updateUserProfile({
      subjectTags: ['Physics'],
      studyHabits: ['Active Recall'],
      preferredSummaryFormat: 'bullet',
    });

    const pages: Page[] = [
      { id: 'p1', notebookId: 'nb-bullet', pageIndex: 0, template: 'lined', createdAt: 100, updatedAt: 100 },
    ];
    const strokes: Stroke[] = [
      { id: 's1', tool: 'pen', color: '#000', size: 2, points: [{ x: 0, y: 0 }], createdAt: 100 },
    ];

    const recap = await harness.generateRecap('nb-bullet', pages, strokes);
    expect(recap.notebookId).toBe('nb-bullet');
    expect(recap.summaryText).toContain('• Notebook Overview:');
    expect(recap.summaryText).toContain('• Primary Layout Templates:');
    expect(recap.keyConcepts.length).toBeGreaterThan(0);
    expect(recap.actionItems.length).toBeGreaterThan(0);

    // Verify DB retrieval
    const latest = await harness.getLatestRecap('nb-bullet');
    expect(latest).not.toBeNull();
    expect(latest?.summaryText).toBe(recap.summaryText);
  });

  test('generateRecap produces executive format summary', async () => {
    await harness.updateUserProfile({
      subjectTags: ['Economics'],
      studyHabits: ['Executive Briefing'],
      preferredSummaryFormat: 'executive',
    });

    const pages: Page[] = [
      { id: 'p1', notebookId: 'nb-exec', pageIndex: 0, template: 'cornell', createdAt: 100, updatedAt: 100 },
    ];

    const recap = await harness.generateRecap('nb-exec', pages, []);
    expect(recap.summaryText).toContain('[EXECUTIVE STUDY SUMMARY]');
    expect(recap.summaryText).toContain('EXECUTIVE BRIEF:');
    expect(recap.summaryText).toContain('RECOMMENDATION:');
    expect(recap.actionItems[0]).toContain('Execute priority review');
  });

  test('generateRecap produces flashcard format summary', async () => {
    await harness.updateUserProfile({
      subjectTags: ['Biology'],
      studyHabits: ['Flashcards'],
      preferredSummaryFormat: 'flashcard',
    });

    const pages: Page[] = [
      { id: 'p1', notebookId: 'nb-flash', pageIndex: 0, template: 'lined', createdAt: 100, updatedAt: 100 },
    ];

    const recap = await harness.generateRecap('nb-flash', pages, []);
    expect(recap.summaryText).toContain('[FLASHCARD 1]');
    expect(recap.summaryText).toContain('Front:');
    expect(recap.summaryText).toContain('Back:');
    expect(recap.actionItems[0]).toContain('Flashcard Deck:');
  });

  test('Recap Database Retrieval gets latest and recap history in chronological DESC order', async () => {
    const notebookId = 'nb-history';
    const pages: Page[] = [
      { id: 'p1', notebookId, pageIndex: 0, template: 'lined', createdAt: 100, updatedAt: 100 },
    ];

    // Generate recap 1
    const r1 = await harness.generateRecap(notebookId, pages, []);
    await new Promise((r) => setTimeout(r, 15)); // Ensure distinct timestamp

    // Generate recap 2
    const r2 = await harness.generateRecap(notebookId, pages, []);

    const history = await harness.getRecapHistory(notebookId);
    expect(history.length).toBe(2);
    expect(history[0].generatedAt).toBeGreaterThanOrEqual(history[1].generatedAt);

    const latest = await harness.getLatestRecap(notebookId);
    expect(latest?.generatedAt).toBe(r2.generatedAt);
  });
});

// Execution Engine
async function main() {
  console.log(`\n======================================================`);
  console.log(` Running M4 AI Study Harness Unit Tests (${testsToRun.length} tests)`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const t of testsToRun) {
    try {
      if (t.beforeEach) {
        await t.beforeEach();
      }
      await t.fn();
      console.log(`  ✓ [PASS] ${t.suite} > ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${t.suite} > ${t.name}`);
      console.error(`     Error: ${err?.message || err}\n`);
      failed++;
    }
  }

  const duration = Date.now() - startTime;
  console.log(`\n------------------------------------------------------`);
  console.log(` Summary: ${passed} passed, ${failed} failed | Time: ${duration}ms`);
  console.log(`------------------------------------------------------\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
