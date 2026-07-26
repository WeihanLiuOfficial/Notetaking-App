import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import type { UserStudyProfile, StudyRecap, NotebookTopicIndex } from '../../types/ai';
import type { Page } from '../../types/storage';
import type { Stroke } from '../../types/canvas';
import { StudyAgentHarness } from '../../services/ai/StudyAgentHarness';
import { databaseService } from '../../services/storage/database';

export interface SidecarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeNotebookId: string | null;
  pages: Page[];
  currentStrokes: Stroke[];
  harness?: StudyAgentHarness;
  onNavigateToPage?: (pageId: string) => void;
  onSaveCurrentPageStrokes?: () => Promise<void>;
}

type TabType = 'recap' | 'topics' | 'profile';

export const SidecarPanel: React.FC<SidecarPanelProps> = ({
  isOpen,
  onClose,
  activeNotebookId,
  pages,
  currentStrokes,
  harness,
  onNavigateToPage,
  onSaveCurrentPageStrokes,
}) => {
  const agentHarness = React.useMemo(
    () => harness || new StudyAgentHarness(databaseService),
    [harness]
  );

  const [activeTab, setActiveTab] = useState<TabType>('recap');
  const [profile, setProfile] = useState<UserStudyProfile>({
    subjectTags: ['Mathematics', 'Physics', 'Computer Science'],
    studyHabits: ['Active Recall', 'Spaced Repetition', 'Cornell Method'],
    preferredSummaryFormat: 'bullet',
  });

  const [recap, setRecap] = useState<StudyRecap | null>(null);
  const [topicIndex, setTopicIndex] = useState<NotebookTopicIndex | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New subject tag & study habit input states
  const [newTagInput, setNewTagInput] = useState('');
  const [newHabitInput, setNewHabitInput] = useState('');

  // Load Profile and Latest Recap on Mount / Notebook Change
  const loadData = useCallback(async () => {
    try {
      const userProf = await agentHarness.getUserProfile();
      setProfile(userProf);

      if (activeNotebookId) {
        const latestRecap = await agentHarness.getLatestRecap(activeNotebookId);
        setRecap(latestRecap);

        const indexData = await agentHarness.indexNotebookTopics(
          activeNotebookId,
          pages,
          currentStrokes
        );
        setTopicIndex(indexData);
      }
    } catch (err) {
      console.warn('SidecarPanel loadData error:', err);
    }
  }, [agentHarness, activeNotebookId, pages, currentStrokes]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Generate Recap Handler
  const handleGenerateRecap = async () => {
    if (!activeNotebookId) return;
    setIsGenerating(true);
    try {
      if (onSaveCurrentPageStrokes) {
        await onSaveCurrentPageStrokes();
      }
      const generated = await agentHarness.generateRecap(activeNotebookId, pages, currentStrokes);
      setRecap(generated);

      const indexData = await agentHarness.indexNotebookTopics(
        activeNotebookId,
        pages,
        currentStrokes
      );
      setTopicIndex(indexData);
    } catch (err) {
      console.error('Failed to generate recap:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Format Switch Handler
  const handleFormatChange = async (format: 'bullet' | 'executive' | 'flashcard') => {
    const updatedProf: UserStudyProfile = { ...profile, preferredSummaryFormat: format };
    setProfile(updatedProf);
    await agentHarness.updateUserProfile(updatedProf);

    if (activeNotebookId) {
      setIsGenerating(true);
      try {
        if (onSaveCurrentPageStrokes) {
          await onSaveCurrentPageStrokes();
        }
        const regenerated = await agentHarness.generateRecap(activeNotebookId, pages, currentStrokes);
        setRecap(regenerated);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  // Add Subject Tag
  const handleAddTag = async () => {
    const tag = newTagInput.trim();
    if (!tag || profile.subjectTags.includes(tag)) return;
    const updatedTags = [...profile.subjectTags, tag];
    const updatedProf = { ...profile, subjectTags: updatedTags };
    setProfile(updatedProf);
    setNewTagInput('');
    await agentHarness.updateUserProfile(updatedProf);
  };

  // Delete Subject Tag
  const handleDeleteTag = async (tagToDelete: string) => {
    const updatedTags = profile.subjectTags.filter((t) => t !== tagToDelete);
    const updatedProf = { ...profile, subjectTags: updatedTags };
    setProfile(updatedProf);
    await agentHarness.updateUserProfile(updatedProf);
  };

  // Add Study Habit
  const handleAddHabit = async () => {
    const habit = newHabitInput.trim();
    if (!habit || profile.studyHabits.includes(habit)) return;
    const updatedHabits = [...profile.studyHabits, habit];
    const updatedProf = { ...profile, studyHabits: updatedHabits };
    setProfile(updatedProf);
    setNewHabitInput('');
    await agentHarness.updateUserProfile(updatedProf);
  };

  // Delete Study Habit
  const handleDeleteHabit = async (habitToDelete: string) => {
    const updatedHabits = profile.studyHabits.filter((h) => h !== habitToDelete);
    const updatedProf = { ...profile, studyHabits: updatedHabits };
    setProfile(updatedProf);
    await agentHarness.updateUserProfile(updatedProf);
  };

  if (!isOpen) return null;

  // Filtered topics for Topic Index Tab
  const filteredTopics = (topicIndex?.topics || []).filter((t) =>
    t.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>🤖 AI Study Assistant</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Tab Bar Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'recap' && styles.tabButtonActive]}
          onPress={() => setActiveTab('recap')}
        >
          <Text style={[styles.tabText, activeTab === 'recap' && styles.tabTextActive]}>Recap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'topics' && styles.tabButtonActive]}
          onPress={() => setActiveTab('topics')}
        >
          <Text style={[styles.tabText, activeTab === 'topics' && styles.tabTextActive]}>Topics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.tabButtonActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content Container */}
      <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentInner}>
        {/* ========================================================= */}
        {/* TAB 1: RECAP ASSISTANT TAB */}
        {/* ========================================================= */}
        {activeTab === 'recap' && (
          <View style={styles.tabContent}>
            {/* Generate Recap Primary CTA */}
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGenerateRecap}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.generateButtonText}>✨ Generate Study Recap</Text>
              )}
            </TouchableOpacity>

            {/* Summary Format Switcher */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Summary Format</Text>
              <View style={styles.formatRow}>
                {(['bullet', 'executive', 'flashcard'] as const).map((fmt) => (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.formatOption,
                      profile.preferredSummaryFormat === fmt && styles.formatOptionActive,
                    ]}
                    onPress={() => handleFormatChange(fmt)}
                  >
                    <Text
                      style={[
                        styles.formatOptionText,
                        profile.preferredSummaryFormat === fmt && styles.formatOptionTextActive,
                      ]}
                    >
                      {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Recap Card */}
            {recap ? (
              <View style={styles.recapCard}>
                <View style={styles.recapHeader}>
                  <Text style={styles.recapTitle}>Notebook Study Briefing</Text>
                  <Text style={styles.recapTimestamp}>
                    {new Date(recap.generatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* Summary Text Body */}
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryText}>{recap.summaryText}</Text>
                </View>

                {/* Key Concepts List */}
                {recap.keyConcepts && recap.keyConcepts.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={styles.listTitle}>💡 Key Concepts</Text>
                    {recap.keyConcepts.map((concept, idx) => (
                      <View key={idx} style={styles.conceptChip}>
                        <Text style={styles.chipBullet}>•</Text>
                        <Text style={styles.chipText}>{concept}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Items List */}
                {recap.actionItems && recap.actionItems.length > 0 && (
                  <View style={styles.listSection}>
                    <Text style={styles.listTitle}>📌 Action Items</Text>
                    {recap.actionItems.map((item, idx) => (
                      <View key={idx} style={styles.actionChip}>
                        <Text style={styles.actionCheckbox}>[ ]</Text>
                        <Text style={styles.actionText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Recap Generated Yet</Text>
                <Text style={styles.emptySub}>
                  Click "Generate Study Recap" above to extract key concepts, topics, and action items from your notebook strokes.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TOPIC INDEX TAB */}
        {/* ========================================================= */}
        {activeTab === 'topics' && (
          <View style={styles.tabContent}>
            {/* Search Filter Input */}
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search topics & tags..."
                placeholderTextColor="#ADB5BD"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Stroke & Layout Metrics Card */}
            {topicIndex?.metrics && (
              <View style={styles.metricsCard}>
                <Text style={styles.sectionHeader}>Notebook Metrics</Text>
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{topicIndex.metrics.totalStrokes}</Text>
                    <Text style={styles.metricLabel}>Strokes</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{topicIndex.metrics.penStrokes}</Text>
                    <Text style={styles.metricLabel}>Pens</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{topicIndex.metrics.highlighterStrokes}</Text>
                    <Text style={styles.metricLabel}>Highlights</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Topics List */}
            <Text style={styles.sectionHeader}>Indexed Topics ({filteredTopics.length})</Text>
            {filteredTopics.length > 0 ? (
              filteredTopics.map((topic, idx) => (
                <View key={idx} style={styles.topicCard}>
                  <View style={styles.topicHeader}>
                    <Text style={styles.topicTag}>#{topic.tag}</Text>
                    <Text style={styles.relevanceBadge}>
                      {(topic.relevanceScore * 100).toFixed(0)}% Match
                    </Text>
                  </View>
                  <View style={styles.pageBadgeRow}>
                    <Text style={styles.pagesLabel}>Pages:</Text>
                    {topic.pageIndexes.map((pgIdx, pIdx) => {
                      const targetPageId = topic.pageIds[pIdx] || pages[pgIdx]?.id;
                      return (
                        <TouchableOpacity
                          key={pIdx}
                          style={styles.pageChip}
                          onPress={() => targetPageId && onNavigateToPage && onNavigateToPage(targetPageId)}
                        >
                          <Text style={styles.pageChipText}>Page {pgIdx + 1}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptySub}>No topics found matching "{searchQuery}"</Text>
              </View>
            )}
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: STUDY PROFILE TAB */}
        {/* ========================================================= */}
        {activeTab === 'profile' && (
          <View style={styles.tabContent}>
            {/* Preferred Summary Format Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Preferred Summary Format</Text>
              {(['bullet', 'executive', 'flashcard'] as const).map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  style={styles.radioRow}
                  onPress={() => handleFormatChange(fmt)}
                >
                  <View style={styles.radioCircle}>
                    {profile.preferredSummaryFormat === fmt && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioText}>
                    {fmt === 'bullet'
                      ? 'Bullet Points (Concise bulleted lists)'
                      : fmt === 'executive'
                      ? 'Executive Summary (Structured brief)'
                      : 'Flashcard Format (Q&A Recall deck)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject Tags Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Subject Tags</Text>
              <View style={styles.chipWrap}>
                {profile.subjectTags.map((tag, idx) => (
                  <View key={idx} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{tag}</Text>
                    <TouchableOpacity onPress={() => handleDeleteTag(tag)}>
                      <Text style={styles.chipDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addInputRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Add new subject tag..."
                  placeholderTextColor="#ADB5BD"
                  value={newTagInput}
                  onChangeText={setNewTagInput}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddTag}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Study Habits Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>Study Habits</Text>
              <View style={styles.chipWrap}>
                {profile.studyHabits.map((habit, idx) => (
                  <View key={idx} style={styles.habitChip}>
                    <Text style={styles.habitChipText}>⚡ {habit}</Text>
                    <TouchableOpacity onPress={() => handleDeleteHabit(habit)}>
                      <Text style={styles.chipDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addInputRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Add study habit..."
                  placeholderTextColor="#ADB5BD"
                  value={newHabitInput}
                  onChangeText={setNewHabitInput}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddHabit}>
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'column',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    height: 48,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#868E96',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  tabTextActive: {
    color: '#1C7ED6',
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    padding: 12,
  },
  tabContent: {
    gap: 12,
  },
  generateButton: {
    backgroundColor: '#228BE6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#343A40',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 6,
  },
  formatOption: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CED4DA',
  },
  formatOptionActive: {
    backgroundColor: '#E7F5FF',
    borderColor: '#339AF0',
  },
  formatOptionText: {
    fontSize: 11,
    color: '#495057',
    fontWeight: '500',
  },
  formatOptionTextActive: {
    color: '#1C7ED6',
    fontWeight: '700',
  },
  recapCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    gap: 10,
  },
  recapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recapTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C7ED6',
  },
  recapTimestamp: {
    fontSize: 10,
    color: '#868E96',
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  summaryText: {
    fontSize: 12,
    color: '#343A40',
    lineHeight: 18,
  },
  listSection: {
    gap: 4,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 2,
  },
  conceptChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  chipBullet: {
    color: '#228BE6',
    fontWeight: '700',
  },
  chipText: {
    fontSize: 11,
    color: '#495057',
    flex: 1,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF9DB',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  actionCheckbox: {
    fontSize: 11,
    color: '#F59F00',
    fontWeight: '700',
  },
  actionText: {
    fontSize: 11,
    color: '#495057',
    flex: 1,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11,
    color: '#868E96',
    textAlign: 'center',
    lineHeight: 16,
  },
  searchBox: {
    marginBottom: 4,
  },
  searchInput: {
    backgroundColor: '#F1F3F5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#212529',
  },
  metricsCard: {
    backgroundColor: '#E7F5FF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#74C0FC',
    gap: 6,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C7ED6',
  },
  metricLabel: {
    fontSize: 10,
    color: '#495057',
  },
  topicCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    gap: 6,
    marginBottom: 6,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topicTag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#228BE6',
  },
  relevanceBadge: {
    fontSize: 10,
    backgroundColor: '#D0EBFF',
    color: '#1971C2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    fontWeight: '600',
  },
  pageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  pagesLabel: {
    fontSize: 11,
    color: '#868E96',
  },
  pageChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pageChipText: {
    fontSize: 10,
    color: '#495057',
    fontWeight: '600',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#228BE6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#228BE6',
  },
  radioText: {
    fontSize: 11,
    color: '#495057',
    flex: 1,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E7F5FF',
    borderWidth: 1,
    borderColor: '#A5D8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagChipText: {
    fontSize: 11,
    color: '#1C7ED6',
    fontWeight: '600',
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3D9FA',
    borderWidth: 1,
    borderColor: '#EEBEF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  habitChipText: {
    fontSize: 11,
    color: '#9C36B5',
    fontWeight: '600',
  },
  chipDelete: {
    fontSize: 11,
    color: '#868E96',
    fontWeight: '700',
    marginLeft: 2,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
  },
  addButton: {
    backgroundColor: '#228BE6',
    borderRadius: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
