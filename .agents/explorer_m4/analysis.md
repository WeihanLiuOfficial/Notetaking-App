# Milestone 4 Implementation Strategy Report: AI Study Agent Harness & Sidecar UI Panel

## Executive Summary

This report establishes the complete, step-by-step technical implementation strategy for **Milestone 4 (M4: AI Study Agent Harness & Sidecar UI Panel)** in the native iPadOS page-based digital notetaking application.

Milestone 4 introduces intelligent note analysis, topic extraction, automated study recap generation, local study profile persistence, and a collapsible iPadOS sidecar assistant UI drawer.

---

## 1. Subsystem Architectural Blueprint

```
+-----------------------------------------------------------------------------------+
|                                     App.tsx                                       |
|                                                                                   |
|  +--------------------+  +----------------------------+  +---------------------+  |
|  |  NotebookManager   |  |     CanvasWorkspace        |  |    SidecarPanel     |  |
|  | (Left Sidebar 240px|  | - PageNavigator            |  | (Right Drawer 320px)|  |
|  |  Notebook List,    |  | - ToolPalette              |  | - Profile Manager   |  |
|  |  Import/Export)    |  | - SkiaCanvas               |  | - Recap Generator   |  |
|  +---------+----------+  +-------------+--------------+  | - Topic Search/Nav  |  |
|            |                           |                 +----------+----------+  |
+------------|---------------------------|----------------------------|-------------+
             |                           |                            |
             v                           v                            v
  +---------------------------------------------------------------------------------+
  |                            StudyAgentHarness Service                            |
  |  - Profile State (UserStudyProfile)                                             |
  |  - Topic Indexer (indexNotebookTopics / extractTopics)                          |
  |  - Study Recap Generator (generateRecap for 'bullet'|'executive'|'flashcard')     |
  +---------------------------------------+-----------------------------------------+
                                          |
                                          v
  +---------------------------------------------------------------------------------+
  |                        Database Layer (database.ts)                            |
  |  - SQLite & In-Memory Repositories                                              |
  |  - Schema Tables: notebooks, pages, strokes, user_study_profile, study_recaps    |
  +---------------------------------------------------------------------------------+
```

---

## 2. Component 1: `StudyAgentHarness` Service & Local Database Persistence

### 2.1 Interface Enhancements (`src/types/ai.ts` & `src/types/storage.ts`)

`src/types/ai.ts` provides the core AI data interfaces:
```typescript
export interface UserStudyProfile {
  subjectTags: string[];
  studyHabits: string[];
  preferredSummaryFormat: 'bullet' | 'executive' | 'flashcard';
}

export interface ExtractedTopic {
  id: string;
  topic: string;
  keyConcepts: string[];
  relevanceScore: number; // 0.0 - 1.0
  pageIds: string[];
}

export interface StudyRecap {
  id?: string;
  notebookId: string;
  summaryText: string;
  keyConcepts: string[];
  actionItems: string[];
  generatedAt: number;
}
```

### 2.2 Storage Schema & Repository Updates (`src/services/storage/database.ts`)

Add persistent storage for study profiles and recaps:

1. **Database Schema (SQLite Tables)**:
   - `user_study_profile`:
     ```sql
     CREATE TABLE IF NOT EXISTS user_study_profile (
       id TEXT PRIMARY KEY NOT NULL,
       subject_tags_json TEXT NOT NULL,
       study_habits_json TEXT NOT NULL,
       preferred_summary_format TEXT NOT NULL,
       updated_at INTEGER NOT NULL
     );
     ```
   - `study_recaps`:
     ```sql
     CREATE TABLE IF NOT EXISTS study_recaps (
       id TEXT PRIMARY KEY NOT NULL,
       notebook_id TEXT NOT NULL,
       summary_text TEXT NOT NULL,
       key_concepts_json TEXT NOT NULL,
       action_items_json TEXT NOT NULL,
       generated_at INTEGER NOT NULL,
       FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE
     );
     CREATE INDEX IF NOT EXISTS idx_study_recaps_notebook ON study_recaps(notebook_id);
     ```

2. **Repository Contract Additions (`IDatabaseRepository`)**:
   ```typescript
   export interface IDatabaseRepository {
     // ... existing notebook, page, stroke methods ...
     getStudyProfile(): Promise<UserStudyProfile>;
     saveStudyProfile(profile: UserStudyProfile): Promise<UserStudyProfile>;
     saveStudyRecap(recap: StudyRecap): Promise<StudyRecap>;
     getLatestRecapByNotebookId(notebookId: string): Promise<StudyRecap | null>;
     getRecapsByNotebookId(notebookId: string): Promise<StudyRecap[]>;
   }
   ```

3. **In-Memory & SQLite Implementation**:
   - `InMemoryStorageRepository` stores `profile` state and `recapsMap: Map<string, StudyRecap[]>`.
   - `SQLiteStorageRepository` executes parameterized SQL queries against `user_study_profile` and `study_recaps`.
   - Default initial profile if none exists: `{ subjectTags: ['Math', 'Physics'], studyHabits: ['Daily Review', 'Active Recall'], preferredSummaryFormat: 'bullet' }`.

### 2.3 `StudyAgentHarness` Engine Implementation (`src/services/ai/StudyAgentHarness.ts`)

The harness manages profile state, topic extraction, and recap generation:

```typescript
export class StudyAgentHarness {
  private db: IDatabaseRepository;
  private profile: UserStudyProfile = {
    subjectTags: ['Mathematics', 'Computer Science'],
    studyHabits: ['Daily Review', 'Cornell Note-Taking'],
    preferredSummaryFormat: 'bullet',
  };

  constructor(dbRepository?: IDatabaseRepository) {
    this.db = dbRepository || databaseService;
  }

  public async initialize(): Promise<void> {
    try {
      const storedProfile = await this.db.getStudyProfile();
      if (storedProfile) {
        this.profile = storedProfile;
      }
    } catch {
      // Fallback to default in-memory profile
    }
  }

  public getProfile(): UserStudyProfile {
    return { ...this.profile };
  }

  public async updateProfile(updates: Partial<UserStudyProfile>): Promise<UserStudyProfile> {
    this.profile = {
      ...this.profile,
      ...updates,
    };
    await this.db.saveStudyProfile(this.profile);
    return this.getProfile();
  }

  public indexNotebookTopics(
    notebookTitle: string,
    pages: Page[],
    strokesByPage: Record<string, Stroke[]>
  ): ExtractedTopic[] {
    // Topic Indexer Algorithm
    const topics: ExtractedTopic[] = [];
    const totalStrokes = Object.values(strokesByPage).reduce((acc, s) => acc + s.length, 0);

    // 1. Extract from Notebook Title & Subject Tags
    const matchedSubject = this.profile.subjectTags.find((tag) =>
      notebookTitle.toLowerCase().includes(tag.toLowerCase())
    ) || 'General Study';

    // 2. Page & Template Parsing
    pages.forEach((page, idx) => {
      const pageStrokes = strokesByPage[page.id] || [];
      const highlighterStrokes = pageStrokes.filter((s) => s.tool === 'highlighter');
      const penStrokes = pageStrokes.filter((s) => s.tool === 'pen');

      const keyConcepts: string[] = [];
      if (highlighterStrokes.length > 0) {
        keyConcepts.push(`Highlighted Concept (Page ${idx + 1})`);
      }
      if (page.template === 'cornell') {
        keyConcepts.push(`Cornell Summary Section (Page ${idx + 1})`);
      }
      if (penStrokes.length > 10) {
        keyConcepts.push(`Detailed Notes & Derivations (Page ${idx + 1})`);
      }

      topics.push({
        id: `topic-page-${page.id}`,
        topic: `${matchedSubject} - Section ${idx + 1} (${page.template.toUpperCase()} Layout)`,
        keyConcepts: keyConcepts.length > 0 ? keyConcepts : [`Core Material (Page ${idx + 1})`],
        relevanceScore: Math.min(1.0, 0.5 + pageStrokes.length * 0.05),
        pageIds: [page.id],
      });
    });

    return topics;
  }

  public async generateRecap(
    notebookId: string,
    notebookTitle: string,
    pages: Page[],
    strokesByPage: Record<string, Stroke[]>
  ): Promise<StudyRecap> {
    const topics = this.indexNotebookTopics(notebookTitle, pages, strokesByPage);
    const format = this.profile.preferredSummaryFormat;
    const totalStrokes = Object.values(strokesByPage).reduce((acc, s) => acc + s.length, 0);

    let summaryText = '';
    let keyConcepts: string[] = [];
    let actionItems: string[] = [];

    // Aggregate key concepts across topics
    topics.forEach((t) => keyConcepts.push(...t.keyConcepts));
    if (keyConcepts.length === 0) {
      keyConcepts = ['Fundamental Concepts', 'Key Formulas', 'Summary Notes'];
    }

    if (format === 'bullet') {
      summaryText = `• Notebook Overview: "${notebookTitle}" containing ${pages.length} pages and ${totalStrokes} total vector strokes.\n` +
        `• Primary Subject Focus: ${this.profile.subjectTags.join(', ') || 'General'}.\n` +
        `• Structured Analysis: Notes utilize ${pages.map((p) => p.template).join(', ')} templates for active learning.\n` +
        `• Key Takeaway: Active review recommended based on user study habits (${this.profile.studyHabits.join(', ')}).`;

      actionItems = [
        `Review highlighted sections across ${pages.length} pages`,
        `Practice active recall for top ${keyConcepts.length} key concepts`,
        `Complete self-quiz on ${notebookTitle}`,
      ];
    } else if (format === 'executive') {
      summaryText = `EXECUTIVE SUMMARY: "${notebookTitle}"\n\n` +
        `Overview & Scope: Comprehensive study session spanning ${pages.length} pages. Note-taking structure incorporates ${pages.length > 0 ? pages[0].template : 'standard'} layout formats.\n\n` +
        `Critical Insights: Content density indicates ${totalStrokes} recorded vector operations. Primary subject alignment: ${this.profile.subjectTags.join(', ')}.\n\n` +
        `Strategic Recommendation: Align review schedule with study habits: ${this.profile.studyHabits.join(', ')}.`;

      actionItems = [
        `Schedule 15-minute executive review session`,
        `Synthesize multi-page diagrams and highlighted formulas`,
        `Update study habits log`,
      ];
    } else if (format === 'flashcard') {
      summaryText = `FLASHCARD STUDY SET: "${notebookTitle}"\n\n` +
        `Q1: What is the main subject of this notebook?\nA1: ${notebookTitle} (${this.profile.subjectTags.join(', ')}).\n\n` +
        `Q2: How many pages and key concepts are covered?\nA2: ${pages.length} pages covering ${keyConcepts.length} core concepts.\n\n` +
        `Q3: What template layouts were used for learning?\nA3: ${Array.from(new Set(pages.map((p) => p.template))).join(', ')}.`;

      actionItems = [
        `Card 1: Test recall on ${notebookTitle} main theorem`,
        `Card 2: Define all ${keyConcepts.length} key concepts from memory`,
        `Card 3: Solve practice problems on page 1`,
      ];
    }

    const recap: StudyRecap = {
      notebookId,
      summaryText,
      keyConcepts: Array.from(new Set(keyConcepts)),
      actionItems,
      generatedAt: Date.now(),
    };

    await this.db.saveStudyRecap(recap);
    return recap;
  }
}
```

---

## 3. Component 2: Sidecar UI Drawer Panel (`src/components/Sidecar/SidecarPanel.tsx`)

### 3.1 iPadOS Collapsible Layout & Component Spec

The Sidecar drawer is rendered on the right side of `App.tsx` body layout.
- **Width**: `320px` when expanded, `0px` / hidden when collapsed.
- **Background**: `#FFFFFF` with subtle border `#E9ECEF` and shadow styling matching iPadOS Human Interface Guidelines.
- **Tabs / Sections**:
  1. **Recap Assistant Tab**: Trigger button, loading state, formatted recap card.
  2. **Topic Explorer Tab**: Search input, list of extracted topics, page jump buttons.
  3. **Profile Settings Tab**: Subject tag manager, format selector ('bullet', 'executive', 'flashcard'), study habits list.

### 3.2 Sidecar Implementation Plan (`src/components/Sidecar/SidecarPanel.tsx`)

```tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { UserStudyProfile, StudyRecap, ExtractedTopic } from '../../types/ai';
import { Page } from '../../types/storage';

export interface SidecarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserStudyProfile;
  onUpdateProfile: (updates: Partial<UserStudyProfile>) => Promise<void>;
  currentRecap: StudyRecap | null;
  onGenerateRecap: () => Promise<void>;
  topics: ExtractedTopic[];
  onSelectTopicPage: (pageId: string) => void;
  isGenerating: boolean;
}

export const SidecarPanel: React.FC<SidecarPanelProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateProfile,
  currentRecap,
  onGenerateRecap,
  topics,
  onSelectTopicPage,
  isGenerating,
}) => {
  const [activeTab, setActiveTab] = useState<'recap' | 'topics' | 'profile'>('recap');
  const [newTagInput, setNewTagInput] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  if (!isOpen) return null;

  const handleAddSubjectTag = async () => {
    const tag = newTagInput.trim();
    if (tag && !profile.subjectTags.includes(tag)) {
      const updated = [...profile.subjectTags, tag];
      await onUpdateProfile({ subjectTags: updated });
      setNewTagInput('');
    }
  };

  const handleRemoveSubjectTag = async (tagToRemove: string) => {
    const updated = profile.subjectTags.filter((t) => t !== tagToRemove);
    await onUpdateProfile({ subjectTags: updated });
  };

  const filteredTopics = topics.filter((t) =>
    t.topic.toLowerCase().includes(topicSearch.toLowerCase()) ||
    t.keyConcepts.some((c) => c.toLowerCase().includes(topicSearch.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      {/* Sidecar Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 AI Study Assistant</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'recap' && styles.tabActive]}
          onPress={() => setActiveTab('recap')}
        >
          <Text style={[styles.tabText, activeTab === 'recap' && styles.tabTextActive]}>Recap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'topics' && styles.tabActive]}
          onPress={() => setActiveTab('topics')}
        >
          <Text style={[styles.tabText, activeTab === 'topics' && styles.tabTextActive]}>Topics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
        {/* TAB 1: RECAP GENERATOR */}
        {activeTab === 'recap' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.generateButton, isGenerating && styles.disabledButton]}
              onPress={onGenerateRecap}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.generateButtonText}>✨ Generate Study Recap</Text>
              )}
            </TouchableOpacity>

            {currentRecap ? (
              <View style={styles.recapCard}>
                <Text style={styles.recapHeader}>Study Recap</Text>
                <Text style={styles.recapTimestamp}>
                  Generated {new Date(currentRecap.generatedAt).toLocaleTimeString()}
                </Text>

                <Text style={styles.subHeader}>Summary</Text>
                <Text style={styles.bodyText}>{currentRecap.summaryText}</Text>

                <Text style={styles.subHeader}>Key Concepts</Text>
                <View style={styles.chipContainer}>
                  {currentRecap.keyConcepts.map((concept, idx) => (
                    <View key={idx} style={styles.conceptChip}>
                      <Text style={styles.chipText}>{concept}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.subHeader}>Action Items</Text>
                {currentRecap.actionItems.map((item, idx) => (
                  <View key={idx} style={styles.actionItemRow}>
                    <Text style={styles.bulletSymbol}>•</Text>
                    <Text style={styles.actionItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Recap Generated Yet</Text>
                <Text style={styles.emptySub}>
                  Tap "Generate Study Recap" to analyze notebook contents using your study profile format ({profile.preferredSummaryFormat}).
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: TOPICS & INDEXING */}
        {activeTab === 'topics' && (
          <View style={styles.section}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search topics & concepts..."
              value={topicSearch}
              onChangeText={setTopicSearch}
            />

            {filteredTopics.length > 0 ? (
              filteredTopics.map((topicItem) => (
                <View key={topicItem.id} style={styles.topicCard}>
                  <Text style={styles.topicTitle}>{topicItem.topic}</Text>
                  <View style={styles.chipContainer}>
                    {topicItem.keyConcepts.map((c, i) => (
                      <View key={i} style={styles.topicChip}>
                        <Text style={styles.topicChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                  {topicItem.pageIds.length > 0 && (
                    <TouchableOpacity
                      style={styles.jumpButton}
                      onPress={() => onSelectTopicPage(topicItem.pageIds[0])}
                    >
                      <Text style={styles.jumpText}>Jump to Page →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptySub}>No topics found matching "{topicSearch}".</Text>
            )}
          </View>
        )}

        {/* TAB 3: USER STUDY PROFILE */}
        {activeTab === 'profile' && (
          <View style={styles.section}>
            <Text style={styles.subHeader}>Summary Format Preference</Text>
            <View style={styles.formatSegmentRow}>
              {(['bullet', 'executive', 'flashcard'] as const).map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={[
                    styles.segmentButton,
                    profile.preferredSummaryFormat === fmt && styles.segmentActive,
                  ]}
                  onPress={() => onUpdateProfile({ preferredSummaryFormat: fmt })}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      profile.preferredSummaryFormat === fmt && styles.segmentTextActive,
                    ]}
                  >
                    {fmt.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subHeader}>Subject Tags</Text>
            <View style={styles.chipContainer}>
              {profile.subjectTags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSubjectTag(tag)}>
                    <Text style={styles.removeChipText}> ✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.addTagRow}>
              <TextInput
                style={styles.addTagInput}
                placeholder="Add subject tag..."
                value={newTagInput}
                onChangeText={setNewTagInput}
                onSubmitEditing={handleAddSubjectTag}
              />
              <TouchableOpacity style={styles.addTagButton} onPress={handleAddSubjectTag}>
                <Text style={styles.addTagButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};
```

---

## 4. Component 3: App.tsx Integration Strategy

In `App.tsx`:

1. **State Addition**:
   ```typescript
   const [isSidecarOpen, setIsSidecarOpen] = useState(true);
   const [studyProfile, setStudyProfile] = useState<UserStudyProfile>({
     subjectTags: ['Math', 'Physics'],
     studyHabits: ['Daily Review'],
     preferredSummaryFormat: 'bullet',
   });
   const [currentRecap, setCurrentRecap] = useState<StudyRecap | null>(null);
   const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
   const harnessRef = useRef<StudyAgentHarness | null>(null);
   ```

2. **Initialization Effect**:
   ```typescript
   useEffect(() => {
     async function initHarness() {
       const harness = new StudyAgentHarness(databaseService);
       await harness.initialize();
       harnessRef.current = harness;
       setStudyProfile(harness.getProfile());
     }
     initHarness();
   }, []);
   ```

3. **Header Toggle Button**:
   Add floating/header toggle button to header bar:
   ```tsx
   <TouchableOpacity
     style={styles.sidecarToggleBtn}
     onPress={() => setIsSidecarOpen((prev) => !prev)}
   >
     <Text style={styles.sidecarToggleText}>
       {isSidecarOpen ? 'Hide AI Sidecar 🤖' : 'Show AI Sidecar 🤖'}
     </Text>
   </TouchableOpacity>
   ```

4. **Sidecar Generator Handler**:
   ```typescript
   const handleGenerateRecap = useCallback(async () => {
     if (!activeNotebookId || !harnessRef.current) return;
     setIsGeneratingRecap(true);
     try {
       const currentNb = notebooks.find((n) => n.id === activeNotebookId);
       const title = currentNb ? currentNb.title : 'Notebook';
       const strokesByPage: Record<string, Stroke[]> = {};
       for (const p of pages) {
         strokesByPage[p.id] = await databaseService.getStrokesByPageId(p.id);
       }
       const recap = await harnessRef.current.generateRecap(
         activeNotebookId,
         title,
         pages,
         strokesByPage
       );
       setCurrentRecap(recap);
     } finally {
       setIsGeneratingRecap(false);
     }
   }, [activeNotebookId, notebooks, pages]);
   ```

---

## 5. Component 4: Unit Testing & Verification Plan

Create unit test suite `src/services/ai/__tests__/StudyAgentHarness.test.ts` and test runner `src/services/ai/__tests__/run_tests.ts`.

### Test Coverage Targets:

1. **UserStudyProfile Management**:
   - `getProfile()` returns default initial profile.
   - `updateProfile()` mutates and persists subject tags, study habits, and preferred summary format.

2. **Topic Indexer Algorithm (`indexNotebookTopics`)**:
   - Correctly handles empty notebooks and notebooks with multi-page strokes.
   - Assigns subject tags based on title matching.
   - Recognizes Cornell layout sections and highlighter tools for key concepts.

3. **Study Recap Generator (`generateRecap`)**:
   - Generates `'bullet'` summary format with bullet points and action items.
   - Generates `'executive'` summary format with executive overview title and strategic recommendations.
   - Generates `'flashcard'` format with Q&A cards.

4. **Storage Persistence Integration**:
   - Verifies `saveStudyProfile` and `getStudyProfile` with `InMemoryStorageRepository`.
   - Verifies `saveStudyRecap` and `getLatestRecapByNotebookId`.

---

## 6. Component 5: Technical Recap Requirements (`agent_memory/m4_ai_harness_recap.md`)

Upon completing implementation of Milestone 4, the implementer agent must generate `agent_memory/m4_ai_harness_recap.md` adhering strictly to `RULE[e:\Projects\Notetaking App\.agents\AGENTS.md]`:

- **Procedure**: Detailed step-by-step description of how `StudyAgentHarness`, `database.ts` updates, `SidecarPanel`, `App.tsx` integration, and unit tests were created.
- **Goal**: Objectives behind AI study profiling, topic indexing, recap formatting ('bullet', 'executive', 'flashcard'), and iPadOS sidecar integration.
- **Details**: Full file list, component prop parameters, database table schemas (`user_study_profile`, `study_recaps`), and test results summary.

---

## 7. Next Actions & Execution Plan

1. Implement storage methods and SQLite tables in `src/services/storage/database.ts`.
2. Enhance `src/services/ai/StudyAgentHarness.ts` with profile persistence, topic indexing, and recap generator.
3. Build `src/components/Sidecar/SidecarPanel.tsx` and export from `src/components/Sidecar/index.ts`.
4. Integrate Sidecar toggle and harness handlers into `App.tsx`.
5. Create unit test suite `src/services/ai/__tests__/StudyAgentHarness.test.ts` and `run_tests.ts`.
6. Write technical recap `agent_memory/m4_ai_harness_recap.md`.
