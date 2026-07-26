import type {
  UserStudyProfile,
  StudyRecap,
  NotebookTopicIndex,
  IndexedTopic,
  StrokeMetrics,
} from '../../types/ai';
import type { Page } from '../../types/storage';
import type { Stroke } from '../../types/canvas';
import type { IDatabaseRepository } from '../../types/storage';
import { databaseService } from '../storage/database';

export class StudyAgentHarness {
  private db: IDatabaseRepository;

  constructor(dbRepository?: IDatabaseRepository) {
    this.db = dbRepository || databaseService;
  }

  public async getUserProfile(): Promise<UserStudyProfile> {
    return this.db.getStudyProfile();
  }

  public async updateUserProfile(profile: UserStudyProfile): Promise<UserStudyProfile> {
    return this.db.saveStudyProfile(profile);
  }

  public async indexNotebookTopics(
    notebookId: string,
    pages: Page[] = [],
    strokesInput?: Stroke[] | Record<string, Stroke[]>
  ): Promise<NotebookTopicIndex> {
    // Standardize strokes input into a flat list (copy array to prevent mutating caller-supplied array)
    let allStrokes: Stroke[] = [];
    if (Array.isArray(strokesInput)) {
      allStrokes = [...strokesInput];
    } else if (strokesInput && typeof strokesInput === 'object') {
      Object.values(strokesInput).forEach((list) => {
        if (Array.isArray(list)) {
          allStrokes.push(...list);
        }
      });
    }

    // If no pages passed, attempt to fetch from DB
    let activePages = pages ? [...pages] : [];
    if (activePages.length === 0 && notebookId) {
      try {
        activePages = await this.db.getPagesByNotebookId(notebookId);
      } catch (e) {
        activePages = [];
      }
    }

    // Ensure pages are sorted by pageIndex ascending
    activePages.sort((a, b) => a.pageIndex - b.pageIndex);

    // If no strokes passed and pages present, attempt to fetch strokes from DB per page
    if (allStrokes.length === 0 && activePages.length > 0) {
      try {
        for (const page of activePages) {
          const st = await this.db.getStrokesByPageId(page.id);
          allStrokes.push(...st);
        }
      } catch (e) {
        // Fallback
      }
    }

    // Calculate Stroke Metrics
    const metrics: StrokeMetrics = {
      totalStrokes: allStrokes.length,
      penStrokes: allStrokes.filter((s) => s.tool === 'pen').length,
      highlighterStrokes: allStrokes.filter((s) => s.tool === 'highlighter').length,
      eraserStrokes: allStrokes.filter((s) => s.tool === 'eraser').length,
      lassoStrokes: allStrokes.filter((s) => s.tool === 'lasso').length,
      templateDistribution: {},
    };

    activePages.forEach((p) => {
      metrics.templateDistribution[p.template] = (metrics.templateDistribution[p.template] || 0) + 1;
    });

    // Get User Profile for subject tag matching
    const profile = await this.getUserProfile();

    // Extract Topics and Key Concepts (store pageId -> pageIndex mapping to ensure aligned index order)
    const topicsMap: Map<string, { pages: Map<string, number>; count: number }> = new Map();

    const addTopic = (tag: string, pageId: string, pageIndex: number) => {
      const existing = topicsMap.get(tag) || { pages: new Map(), count: 0 };
      existing.pages.set(pageId, pageIndex);
      existing.count += 1;
      topicsMap.set(tag, existing);
    };

    activePages.forEach((page) => {
      // Template based topics
      if (page.template === 'cornell') {
        addTopic('Cornell Summary & Cues', page.id, page.pageIndex);
        addTopic('Structured Notes', page.id, page.pageIndex);
      } else if (page.template === 'lined') {
        addTopic('Lecture Notes', page.id, page.pageIndex);
      } else if (page.template === 'grid') {
        addTopic('Diagrams & Math', page.id, page.pageIndex);
      } else if (page.template === 'blank') {
        addTopic('Freeform Sketches', page.id, page.pageIndex);
      }
    });

    // Check strokes for highlighter emphasis
    if (metrics.highlighterStrokes > 0) {
      activePages.forEach((page) => {
        addTopic('Exam High-Yield Focus', page.id, page.pageIndex);
        addTopic('Key Terms & Definitions', page.id, page.pageIndex);
      });
    }

    // Incorporate user subject tags if available
    profile.subjectTags.forEach((tag, idx) => {
      if (activePages.length > 0) {
        const targetPage = activePages[idx % activePages.length];
        addTopic(tag, targetPage.id, targetPage.pageIndex);
      }
    });

    // Convert topicsMap to IndexedTopic array with aligned pageIds and pageIndexes
    const topics: IndexedTopic[] = Array.from(topicsMap.entries()).map(([tag, data]) => {
      const sortedPageEntries = Array.from(data.pages.entries()).sort((a, b) => a[1] - b[1]);
      const pageIds = sortedPageEntries.map(([id]) => id);
      const pageIndexes = sortedPageEntries.map(([, idx]) => idx);
      const relevanceScore = Math.min(1.0, 0.4 + data.count * 0.2 + (metrics.highlighterStrokes > 0 ? 0.15 : 0));
      return {
        tag,
        pageIds,
        pageIndexes,
        relevanceScore: Number(relevanceScore.toFixed(2)),
      };
    });

    // Extract Key Concepts list
    const keyConcepts: string[] = [];
    if (metrics.templateDistribution['cornell']) {
      keyConcepts.push('Cornell System: Systematic note-taking with dedicated cue and summary sections.');
    }
    if (metrics.highlighterStrokes > 0) {
      keyConcepts.push(`Highlighter Emphasis: ${metrics.highlighterStrokes} key passages flagged for priority review.`);
    }
    if (topics.some((t) => t.tag === 'Diagrams & Math')) {
      keyConcepts.push('Visual Schematics & Equations: Quantitative grid representations.');
    }
    if (profile.subjectTags.length > 0) {
      keyConcepts.push(`Subject Alignment: Correlated with ${profile.subjectTags.join(', ')}.`);
    }
    if (keyConcepts.length === 0) {
      keyConcepts.push('General Overview: Handwritten vector strokes captured for topic analysis.');
    }

    return {
      notebookId,
      topics,
      keyConcepts,
      metrics,
    };
  }

  public async generateRecap(
    notebookId: string,
    pages: Page[] = [],
    strokesInput?: Stroke[] | Record<string, Stroke[]>
  ): Promise<StudyRecap> {
    const profile = await this.getUserProfile();
    const topicIndex = await this.indexNotebookTopics(notebookId, pages, strokesInput);
    const { topics, keyConcepts, metrics } = topicIndex;

    let activePages = pages ? [...pages] : [];
    if (activePages.length === 0 && notebookId) {
      try {
        activePages = await this.db.getPagesByNotebookId(notebookId);
      } catch (e) {
        activePages = [];
      }
    }

    const totalPages = activePages.length > 0 ? activePages.length : 1;
    const format = profile.preferredSummaryFormat || 'bullet';

    let summaryText = '';
    const actionItems: string[] = [];

    if (format === 'bullet') {
      summaryText = [
        `• Notebook Overview: Analyzed ${totalPages} pages containing ${metrics.totalStrokes} total handwritten vector strokes.`,
        `• Active Tools: ${metrics.penStrokes} pen strokes, ${metrics.highlighterStrokes} highlighter highlights.`,
        `• Primary Layout Templates: ${Object.entries(metrics.templateDistribution)
          .map(([tpl, count]) => `${tpl} (${count})`)
          .join(', ') || 'lined (1)'}.`,
        `• Identified Topics: ${topics.map((t) => t.tag).slice(0, 4).join(', ') || 'General Notes'}.`,
        `• Key Takeaway: ${keyConcepts[0] || 'Structured notes ready for active recall review.'}`,
      ].join('\n');

      actionItems.push(`Review ${metrics.highlighterStrokes} highlighted sections across pages.`);
      actionItems.push(`Complete self-quiz on ${topics[0]?.tag || 'core topics'}.`);
      actionItems.push(`Schedule spaced repetition session in 48 hours.`);
    } else if (format === 'executive') {
      summaryText = [
        `[EXECUTIVE STUDY SUMMARY]`,
        ``,
        `EXECUTIVE BRIEF: Notebook ${notebookId.slice(0, 8)} contains ${totalPages} page(s) with ${metrics.totalStrokes} vector stroke entries.`,
        `ANALYSIS & INSIGHTS: Primary layout utilizes ${Object.keys(metrics.templateDistribution).join('/') || 'lined'} paper. ` +
          `Highlighter intensity is at ${metrics.highlighterStrokes} markers, indicating key focus areas.`,
        `TOPIC SYNOPSIS: Subject coverage includes ${topics.map((t) => t.tag).join('; ') || 'General Study'}.`,
        `RECOMMENDATION: Executive recommendation is to focus active study efforts on high-relevance topics and convert summary cues into flashcard sets.`,
      ].join('\n');

      actionItems.push(`Execute priority review of executive key concepts.`);
      actionItems.push(`Validate top-relevance topic tags against upcoming syllabus milestones.`);
      actionItems.push(`Synthesize multi-page notes into an executive study briefing.`);
    } else if (format === 'flashcard') {
      summaryText = [
        `[FLASHCARD 1]`,
        `Front: What is the main subject focus of this notebook?`,
        `Back: ${topics.map((t) => t.tag).slice(0, 3).join(', ') || 'General Study Notes'}.`,
        ``,
        `[FLASHCARD 2]`,
        `Front: What are the key concepts recorded?`,
        `Back: ${keyConcepts.slice(0, 2).join(' | ')}.`,
        ``,
        `[FLASHCARD 3]`,
        `Front: What stroke metrics and study habits apply?`,
        `Back: ${metrics.totalStrokes} total strokes (${metrics.highlighterStrokes} highlighted). Habits: ${profile.studyHabits.join(', ')}.`,
      ].join('\n');

      actionItems.push(`Flashcard Deck: Practice Flashcard 1 (Subject Topics).`);
      actionItems.push(`Flashcard Deck: Master Flashcard 2 (Key Concepts).`);
      actionItems.push(`Flashcard Deck: Test speed-recall on Flashcard 3 (Metrics & Habits).`);
    }

    const recap: StudyRecap = {
      notebookId,
      summaryText,
      keyConcepts,
      actionItems,
      generatedAt: Date.now(),
    };

    // Save to database
    const savedRecap = await this.db.saveStudyRecap(recap);
    return savedRecap;
  }

  public async getLatestRecap(notebookId: string): Promise<StudyRecap | null> {
    return this.db.getLatestRecapByNotebookId(notebookId);
  }

  public async getRecapHistory(notebookId: string): Promise<StudyRecap[]> {
    return this.db.getRecapsByNotebookId(notebookId);
  }
}
