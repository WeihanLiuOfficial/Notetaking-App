import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Page } from '../../types/storage';
import { TemplateType } from '../../types/canvas';

export interface PageNavigatorProps {
  pages: Page[];
  currentPage: Page | null;
  currentPageIndex: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onSelectTemplate: (template: TemplateType) => void;
  onReorderPages: (pageIdsInOrder: string[]) => void;
  onExportPageSvg: () => void;
}

const TEMPLATES: { label: string; value: TemplateType }[] = [
  { label: 'Lined', value: 'lined' },
  { label: 'Grid', value: 'grid' },
  { label: 'Cornell', value: 'cornell' },
  { label: 'Blank', value: 'blank' },
];

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  currentPage,
  currentPageIndex,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddPage,
  onDeletePage,
  onSelectTemplate,
  onReorderPages,
  onExportPageSvg,
}) => {
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [reorderedPageList, setReorderedPageList] = useState<Page[]>([]);

  const handleOpenReorderModal = () => {
    setReorderedPageList([...pages]);
    setIsReorderModalOpen(true);
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= reorderedPageList.length) return;
    const updated = [...reorderedPageList];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setReorderedPageList(updated);
  };

  const handleConfirmReorder = () => {
    const ids = reorderedPageList.map((p) => p.id);
    onReorderPages(ids);
    setIsReorderModalOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (totalPages <= 1) {
      Alert.alert('Cannot Delete', 'A notebook must have at least one page.');
      return;
    }
    Alert.alert(
      'Delete Page',
      `Are you sure you want to delete Page ${currentPageIndex + 1}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDeletePage,
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Page Navigation & Counter */}
      <View style={styles.navGroup}>
        <TouchableOpacity
          style={[styles.chevronButton, currentPageIndex === 0 && styles.buttonDisabled]}
          onPress={onPrevPage}
          disabled={currentPageIndex === 0}
        >
          <Text style={styles.chevronText}>◀</Text>
        </TouchableOpacity>

        <Text style={styles.counterText}>
          Page {totalPages > 0 ? currentPageIndex + 1 : 0} of {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.chevronButton, currentPageIndex >= totalPages - 1 && styles.buttonDisabled]}
          onPress={onNextPage}
          disabled={currentPageIndex >= totalPages - 1}
        >
          <Text style={styles.chevronText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Action Controls */}
      <View style={styles.actionGroup}>
        <TouchableOpacity style={styles.actionButton} onPress={onAddPage} activeOpacity={0.7}>
          <Text style={styles.actionButtonText}>+ Page</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, totalPages <= 1 && styles.buttonDisabled]}
          onPress={handleDeleteConfirm}
          disabled={totalPages <= 1}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>🗑 Delete</Text>
        </TouchableOpacity>

        {/* Template Selector Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setIsTemplatePickerOpen(!isTemplatePickerOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>
            📄 {currentPage ? currentPage.template.toUpperCase() : 'TEMPLATE'} ▾
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleOpenReorderModal}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>≡ Reorder</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.exportButton]}
          onPress={onExportPageSvg}
          activeOpacity={0.7}
        >
          <Text style={styles.exportButtonText}>SVG Export</Text>
        </TouchableOpacity>
      </View>

      {/* Template Dropdown Modal */}
      <Modal
        visible={isTemplatePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTemplatePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setIsTemplatePickerOpen(false)}
        >
          <View style={styles.dropdownContainer}>
            <Text style={styles.dropdownHeader}>Select Paper Template</Text>
            {TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.value}
                style={[
                  styles.dropdownItem,
                  currentPage?.template === tmpl.value && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  onSelectTemplate(tmpl.value);
                  setIsTemplatePickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    currentPage?.template === tmpl.value && styles.dropdownItemTextActive,
                  ]}
                >
                  {tmpl.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reorder Modal */}
      <Modal
        visible={isReorderModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReorderModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reorderContainer}>
            <View style={styles.reorderHeader}>
              <Text style={styles.reorderTitle}>Reorder Pages & Thumbnails</Text>
              <TouchableOpacity onPress={() => setIsReorderModalOpen(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={reorderedPageList}
              keyExtractor={(item) => item.id}
              style={styles.reorderList}
              renderItem={({ item, index }) => (
                <View style={styles.reorderItem}>
                  <View style={styles.thumbnailBadge}>
                    <Text style={styles.thumbnailText}>{item.template}</Text>
                  </View>
                  <Text style={styles.reorderItemLabel}>
                    Page {index + 1}
                  </Text>
                  <View style={styles.reorderControls}>
                    <TouchableOpacity
                      style={[styles.arrowButton, index === 0 && styles.buttonDisabled]}
                      onPress={() => handleMovePage(index, index - 1)}
                      disabled={index === 0}
                    >
                      <Text style={styles.arrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.arrowButton,
                        index === reorderedPageList.length - 1 && styles.buttonDisabled,
                      ]}
                      onPress={() => handleMovePage(index, index + 1)}
                      disabled={index === reorderedPageList.length - 1}
                    >
                      <Text style={styles.arrowText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />

            <View style={styles.reorderFooter}>
              <TouchableOpacity
                style={styles.cancelReorderButton}
                onPress={() => setIsReorderModalOpen(false)}
              >
                <Text style={styles.cancelReorderText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveReorderButton}
                onPress={handleConfirmReorder}
              >
                <Text style={styles.saveReorderText}>Save Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronButton: {
    backgroundColor: '#F1F3F5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chevronText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '700',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212529',
    minWidth: 90,
    textAlign: 'center',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CED4DA',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#343A40',
  },
  deleteButton: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFC9C9',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E03131',
  },
  exportButton: {
    backgroundColor: '#E6FCF5',
    borderColor: '#63E6BE',
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#099268',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 100,
  },
  dropdownContainer: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#868E96',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dropdownItemActive: {
    backgroundColor: '#E7F5FF',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#495057',
  },
  dropdownItemTextActive: {
    color: '#1C7ED6',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderContainer: {
    width: 380,
    maxHeight: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  reorderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
    paddingBottom: 8,
  },
  reorderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
  },
  closeText: {
    fontSize: 18,
    color: '#868E96',
    fontWeight: '600',
  },
  reorderList: {
    marginVertical: 8,
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  thumbnailBadge: {
    backgroundColor: '#E7F5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  thumbnailText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C7ED6',
    textTransform: 'uppercase',
  },
  reorderItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#343A40',
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 6,
  },
  arrowButton: {
    backgroundColor: '#E9ECEF',
    width: 28,
    height: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 10,
    color: '#495057',
  },
  reorderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
    paddingTop: 10,
  },
  cancelReorderButton: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelReorderText: {
    color: '#495057',
    fontWeight: '600',
  },
  saveReorderButton: {
    backgroundColor: '#228BE6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveReorderText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
