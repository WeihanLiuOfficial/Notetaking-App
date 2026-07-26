import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, Platform, Alert, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useCanvasState, ToolPalette, SkiaCanvas } from './src/components/Canvas';
import { NotebookManager, PageNavigator } from './src/components/Notebook';
import { SidecarPanel } from './src/components/Sidecar';
import { databaseService } from './src/services/storage/database';
import { Notebook, Page } from './src/types/storage';
import { TemplateType } from './src/types/canvas';

export default function App() {
  const isIPadOS = Platform.OS === 'ios' && Platform.isPad;
  const canvasState = useCanvasState('lined');

  const [isDbReady, setIsDbReady] = useState(false);
  const [isSidecarOpen, setIsSidecarOpen] = useState(true);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});

  const activePageIdRef = useRef<string | null>(null);
  activePageIdRef.current = activePageId;

  const strokesRef = useRef(canvasState.strokes);
  strokesRef.current = canvasState.strokes;

  const refreshNotebookList = useCallback(async (selectId?: string) => {
    const list = await databaseService.getNotebooks();
    setNotebooks(list);

    const counts: Record<string, number> = {};
    for (const nb of list) {
      const pgs = await databaseService.getPagesByNotebookId(nb.id);
      counts[nb.id] = pgs.length;
    }
    setPageCounts(counts);

    if (list.length > 0) {
      const targetId = selectId || activeNotebookId || list[0].id;
      const validTarget = list.find((nb) => nb.id === targetId) ? targetId : list[0].id;
      setActiveNotebookId(validTarget);
      return validTarget;
    }
    return null;
  }, [activeNotebookId]);

  // Initial Database Setup
  useEffect(() => {
    async function init() {
      await databaseService.initDatabase();
      setIsDbReady(true);

      let list = await databaseService.getNotebooks();
      if (list.length === 0) {
        await databaseService.createNotebook('My Notebook');
        list = await databaseService.getNotebooks();
      }
      setNotebooks(list);

      if (list.length > 0) {
        const initialNbId = list[0].id;
        setActiveNotebookId(initialNbId);

        const pgs = await databaseService.getPagesByNotebookId(initialNbId);
        setPages(pgs);
        if (pgs.length > 0) {
          setActivePageId(pgs[0].id);
          const initialStrokes = await databaseService.getStrokesByPageId(pgs[0].id);
          canvasState.loadStrokes(initialStrokes);
          canvasState.setCurrentTemplate(pgs[0].template);
        }
      }

      const counts: Record<string, number> = {};
      for (const nb of list) {
        const pgs = await databaseService.getPagesByNotebookId(nb.id);
        counts[nb.id] = pgs.length;
      }
      setPageCounts(counts);
    }
    init();
  }, []);

  // Helper to auto-save strokes for current page
  const saveCurrentPageStrokes = useCallback(async () => {
    if (activePageIdRef.current) {
      await databaseService.saveStrokesForPage(activePageIdRef.current, strokesRef.current);
    }
  }, []);

  // Switch Notebook
  const handleSelectNotebook = useCallback(async (notebookId: string) => {
    if (notebookId === activeNotebookId) return;
    await saveCurrentPageStrokes();

    setActiveNotebookId(notebookId);
    const pgs = await databaseService.getPagesByNotebookId(notebookId);
    setPages(pgs);

    if (pgs.length > 0) {
      const firstPage = pgs[0];
      setActivePageId(firstPage.id);
      const strokes = await databaseService.getStrokesByPageId(firstPage.id);
      canvasState.loadStrokes(strokes);
      canvasState.setCurrentTemplate(firstPage.template);
    } else {
      setActivePageId(null);
      canvasState.resetCanvasState('lined');
    }
  }, [activeNotebookId, saveCurrentPageStrokes, canvasState]);

  // Create Notebook
  const handleCreateNotebook = useCallback(async (title: string) => {
    await saveCurrentPageStrokes();
    const newNb = await databaseService.createNotebook(title);
    await refreshNotebookList(newNb.id);

    const pgs = await databaseService.getPagesByNotebookId(newNb.id);
    setPages(pgs);
    if (pgs.length > 0) {
      setActivePageId(pgs[0].id);
      const strokes = await databaseService.getStrokesByPageId(pgs[0].id);
      canvasState.loadStrokes(strokes);
      canvasState.setCurrentTemplate(pgs[0].template);
    }
  }, [saveCurrentPageStrokes, refreshNotebookList, canvasState]);

  // Rename Notebook
  const handleRenameNotebook = useCallback(async (id: string, newTitle: string) => {
    await databaseService.updateNotebook(id, { title: newTitle });
    await refreshNotebookList();
  }, [refreshNotebookList]);

  // Delete Notebook
  const handleDeleteNotebook = useCallback(async (id: string) => {
    await databaseService.deleteNotebook(id);
    const remaining = await databaseService.getNotebooks();
    if (remaining.length === 0) {
      const fresh = await databaseService.createNotebook('My Notebook');
      await refreshNotebookList(fresh.id);
      const pgs = await databaseService.getPagesByNotebookId(fresh.id);
      setPages(pgs);
      setActivePageId(pgs[0].id);
      canvasState.resetCanvasState(pgs[0].template);
    } else {
      const nextId = remaining[0].id;
      await refreshNotebookList(nextId);
      const pgs = await databaseService.getPagesByNotebookId(nextId);
      setPages(pgs);
      if (pgs.length > 0) {
        setActivePageId(pgs[0].id);
        const strokes = await databaseService.getStrokesByPageId(pgs[0].id);
        canvasState.loadStrokes(strokes);
        canvasState.setCurrentTemplate(pgs[0].template);
      }
    }
  }, [refreshNotebookList, canvasState]);

  // Export Notebook JSON
  const handleExportNotebook = useCallback(async (id: string) => {
    await saveCurrentPageStrokes();
    const jsonStr = await databaseService.exportNotebookToJson(id);
    Alert.alert('Export Successful', `Notebook JSON export ready (${jsonStr.length} characters).`);
  }, [saveCurrentPageStrokes]);

  // Import Notebook JSON
  const handleImportNotebook = useCallback(async () => {
    try {
      if (!activeNotebookId) return;
      await saveCurrentPageStrokes();
      const sampleExport = await databaseService.exportNotebookToJson(activeNotebookId);
      const imported = await databaseService.importNotebookFromJson(sampleExport);
      Alert.alert('Notebook Imported', `Successfully imported "${imported.title}".`);
      await refreshNotebookList(imported.id);
      const pgs = await databaseService.getPagesByNotebookId(imported.id);
      setPages(pgs);
      if (pgs.length > 0) {
        setActivePageId(pgs[0].id);
        const strokes = await databaseService.getStrokesByPageId(pgs[0].id);
        canvasState.loadStrokes(strokes);
        canvasState.setCurrentTemplate(pgs[0].template);
      }
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Unable to import notebook JSON.');
    }
  }, [activeNotebookId, saveCurrentPageStrokes, refreshNotebookList, canvasState]);

  // Switch Active Page
  const handleSwitchPage = useCallback(async (targetPageId: string) => {
    if (targetPageId === activePageId) return;
    await saveCurrentPageStrokes();

    setActivePageId(targetPageId);
    const targetPage = pages.find((p) => p.id === targetPageId);
    if (targetPage) {
      const strokes = await databaseService.getStrokesByPageId(targetPageId);
      canvasState.loadStrokes(strokes);
      canvasState.setCurrentTemplate(targetPage.template);
    }
  }, [activePageId, pages, saveCurrentPageStrokes, canvasState]);

  // Current Page Index calculation
  const currentPageIndex = pages.findIndex((p) => p.id === activePageId);
  const currentPage = currentPageIndex >= 0 ? pages[currentPageIndex] : null;

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      handleSwitchPage(pages[currentPageIndex - 1].id);
    }
  }, [currentPageIndex, pages, handleSwitchPage]);

  const handleNextPage = useCallback(() => {
    if (currentPageIndex >= 0 && currentPageIndex < pages.length - 1) {
      handleSwitchPage(pages[currentPageIndex + 1].id);
    }
  }, [currentPageIndex, pages, handleSwitchPage]);

  // Add Page
  const handleAddPage = useCallback(async () => {
    if (!activeNotebookId) return;
    await saveCurrentPageStrokes();

    const insertIndex = currentPageIndex >= 0 ? currentPageIndex + 1 : pages.length;
    const currentTemplate = currentPage ? currentPage.template : 'lined';
    const newPage = await databaseService.createPage(activeNotebookId, currentTemplate, insertIndex);

    const updatedPages = await databaseService.getPagesByNotebookId(activeNotebookId);
    setPages(updatedPages);
    setActivePageId(newPage.id);
    canvasState.resetCanvasState(newPage.template);
    await refreshNotebookList(activeNotebookId);
  }, [activeNotebookId, currentPageIndex, pages.length, currentPage, saveCurrentPageStrokes, canvasState, refreshNotebookList]);

  // Delete Page
  const handleDeletePage = useCallback(async () => {
    if (!activeNotebookId || !activePageId || pages.length <= 1) return;

    await databaseService.deletePage(activePageId);
    const updatedPages = await databaseService.getPagesByNotebookId(activeNotebookId);
    setPages(updatedPages);

    const nextIndex = Math.min(currentPageIndex, updatedPages.length - 1);
    const nextPage = updatedPages[nextIndex];
    setActivePageId(nextPage.id);

    const strokes = await databaseService.getStrokesByPageId(nextPage.id);
    canvasState.loadStrokes(strokes);
    canvasState.setCurrentTemplate(nextPage.template);
    await refreshNotebookList(activeNotebookId);
  }, [activeNotebookId, activePageId, pages.length, currentPageIndex, canvasState, refreshNotebookList]);

  // Select Template for current page
  const handleSelectTemplate = useCallback(async (template: TemplateType) => {
    if (!activePageId) return;
    const updatedPage = await databaseService.updatePageTemplate(activePageId, template);
    canvasState.setCurrentTemplate(template);
    setPages((prev) => prev.map((p) => (p.id === activePageId ? updatedPage : p)));
  }, [activePageId, canvasState]);

  // Reorder Pages
  const handleReorderPages = useCallback(async (pageIdsInOrder: string[]) => {
    if (!activeNotebookId) return;
    await saveCurrentPageStrokes();
    const updatedPages = await databaseService.reorderPages(activeNotebookId, pageIdsInOrder);
    setPages(updatedPages);
  }, [activeNotebookId, saveCurrentPageStrokes]);

  // Export SVG for current page
  const handleExportPageSvg = useCallback(async () => {
    if (!activePageId) return;
    await saveCurrentPageStrokes();
    const svgStr = await databaseService.exportPageAsSvg(activePageId);
    Alert.alert('SVG Export Ready', `Generated SVG vector file (${svgStr.length} bytes).`);
  }, [activePageId, saveCurrentPageStrokes]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header Bar */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Native iPadOS Notetaking App</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.aiButton, isSidecarOpen && styles.aiButtonActive]}
              onPress={() => setIsSidecarOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.aiButtonText, isSidecarOpen && styles.aiButtonTextActive]}>
                🤖 AI Assistant
              </Text>
            </TouchableOpacity>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {isIPadOS ? 'iPadOS Native Tablet Mode' : 'Tablet Mode Enabled'}
              </Text>
            </View>
          </View>
        </View>

        {/* Main Body */}
        <View style={styles.body}>
          {/* Left Navigation Sidebar */}
          <NotebookManager
            notebooks={notebooks}
            activeNotebookId={activeNotebookId}
            pageCounts={pageCounts}
            onSelectNotebook={handleSelectNotebook}
            onCreateNotebook={handleCreateNotebook}
            onRenameNotebook={handleRenameNotebook}
            onDeleteNotebook={handleDeleteNotebook}
            onExportNotebook={handleExportNotebook}
            onImportNotebook={handleImportNotebook}
          />

          {/* Center Workspace */}
          <View style={styles.canvasWorkspace}>
            {/* Top Page Navigator Bar */}
            <PageNavigator
              pages={pages}
              currentPage={currentPage}
              currentPageIndex={currentPageIndex >= 0 ? currentPageIndex : 0}
              totalPages={pages.length}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
              onSelectTemplate={handleSelectTemplate}
              onReorderPages={handleReorderPages}
              onExportPageSvg={handleExportPageSvg}
            />

            {/* Drawing Tool Palette */}
            <ToolPalette
              activeTool={canvasState.activeTool}
              activeColor={canvasState.activeColor}
              strokeWidth={canvasState.strokeWidth}
              currentTemplate={canvasState.currentTemplate}
              canUndo={canvasState.canUndo}
              canRedo={canvasState.canRedo}
              onSelectTool={canvasState.setActiveTool}
              onSelectColor={canvasState.setActiveColor}
              onSelectStrokeWidth={canvasState.setStrokeWidth}
              onSelectTemplate={handleSelectTemplate}
              onUndo={canvasState.undo}
              onRedo={canvasState.redo}
              onClear={canvasState.clearCanvas}
            />

            {/* Skia Drawing Canvas */}
            <SkiaCanvas canvasStateHook={canvasState} style={styles.skiaCanvas} />
          </View>

          {/* Right AI Sidecar Panel */}
          <SidecarPanel
            isOpen={isSidecarOpen}
            onClose={() => setIsSidecarOpen(false)}
            activeNotebookId={activeNotebookId}
            pages={pages}
            currentStrokes={canvasState.strokes}
            onNavigateToPage={handleSwitchPage}
            onSaveCurrentPageStrokes={saveCurrentPageStrokes}
          />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 54,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiButton: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CED4DA',
  },
  aiButtonActive: {
    backgroundColor: '#E7F5FF',
    borderColor: '#74C0FC',
  },
  aiButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  aiButtonTextActive: {
    color: '#1C7ED6',
  },
  badge: {
    backgroundColor: '#E7F5FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#74C0FC',
  },
  badgeText: {
    color: '#1C7ED6',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  canvasWorkspace: {
    flex: 1,
    flexDirection: 'column',
  },
  skiaCanvas: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sidecarPlaceholder: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343A40',
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: '#868E96',
  },
});
