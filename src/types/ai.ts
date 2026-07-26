export interface UserStudyProfile {
  subjectTags: string[];
  studyHabits: string[];
  preferredSummaryFormat: 'bullet' | 'executive' | 'flashcard';
}

export interface StudyRecap {
  id?: string;
  notebookId: string;
  summaryText: string;
  keyConcepts: string[];
  actionItems: string[];
  generatedAt: number;
}

export interface IndexedTopic {
  tag: string;
  pageIds: string[];
  pageIndexes: number[];
  relevanceScore: number;
}

export interface StrokeMetrics {
  totalStrokes: number;
  penStrokes: number;
  highlighterStrokes: number;
  eraserStrokes: number;
  lassoStrokes: number;
  templateDistribution: Record<string, number>;
}

export interface NotebookTopicIndex {
  notebookId: string;
  topics: IndexedTopic[];
  keyConcepts: string[];
  metrics: StrokeMetrics;
}

