import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Notebook } from '../../types/storage';

export interface NotebookManagerProps {
  notebooks: Notebook[];
  activeNotebookId: string | null;
  pageCounts?: Record<string, number>;
  onSelectNotebook: (id: string) => void;
  onCreateNotebook: (title: string) => void;
  onRenameNotebook: (id: string, newTitle: string) => void;
  onDeleteNotebook: (id: string) => void;
  onExportNotebook: (id: string) => void;
  onImportNotebook: () => void;
}

export const NotebookManager: React.FC<NotebookManagerProps> = ({
  notebooks,
  activeNotebookId,
  pageCounts = {},
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  onExportNotebook,
  onImportNotebook,
}) => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');

  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleCreateSubmit = () => {
    const title = newNotebookTitle.trim() || 'Untitled Notebook';
    onCreateNotebook(title);
    setNewNotebookTitle('');
    setIsCreateModalOpen(false);
  };

  const handleStartRename = (notebook: Notebook) => {
    setEditingNotebookId(notebook.id);
    setEditingTitle(notebook.title);
  };

  const handleRenameSubmit = (id: string) => {
    const title = editingTitle.trim() || 'Untitled Notebook';
    onRenameNotebook(id, title);
    setEditingNotebookId(null);
    setEditingTitle('');
  };

  const handleDeleteConfirm = (notebook: Notebook) => {
    Alert.alert(
      'Delete Notebook',
      `Are you sure you want to delete "${notebook.title}"? All pages and drawings will be permanently lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteNotebook(notebook.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Sidebar Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notebooks</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Notebook List */}
      <FlatList
        data={notebooks}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isActive = item.id === activeNotebookId;
          const isEditing = item.id === editingNotebookId;
          const pageCount = pageCounts[item.id] ?? 1;

          return (
            <TouchableOpacity
              style={[styles.itemContainer, isActive && styles.itemActive]}
              onPress={() => onSelectNotebook(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.itemHeader}>
                {isEditing ? (
                  <TextInput
                    style={styles.renameInput}
                    value={editingTitle}
                    onChangeText={setEditingTitle}
                    onBlur={() => handleRenameSubmit(item.id)}
                    onSubmitEditing={() => handleRenameSubmit(item.id)}
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.itemTitle, isActive && styles.itemTitleActive]} numberOfLines={1}>
                    {item.title}
                  </Text>
                )}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pageCount} pgs</Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleStartRename(item)}
                >
                  <Text style={styles.actionText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onExportNotebook(item.id)}
                >
                  <Text style={styles.actionText}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteAction]}
                  onPress={() => handleDeleteConfirm(item)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Import Button */}
      <TouchableOpacity
        style={styles.importButton}
        onPress={onImportNotebook}
        activeOpacity={0.7}
      >
        <Text style={styles.importButtonText}>📥 Import Notebook JSON</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Create New Notebook</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Notebook Title"
              value={newNotebookTitle}
              onChangeText={setNewNotebookTitle}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitModalButton]}
                onPress={handleCreateSubmit}
              >
                <Text style={styles.submitModalText}>Create</Text>
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
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#212529',
  },
  newButton: {
    backgroundColor: '#228BE6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
  },
  itemContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  itemActive: {
    backgroundColor: '#E7F5FF',
    borderColor: '#74C0FC',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#343A40',
    flex: 1,
    marginRight: 6,
  },
  itemTitleActive: {
    color: '#1C7ED6',
  },
  renameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1C7ED6',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#339AF0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
  },
  badge: {
    backgroundColor: '#CED4DA',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#495057',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionText: {
    fontSize: 11,
    color: '#495057',
  },
  deleteAction: {},
  deleteText: {
    fontSize: 11,
    color: '#FA5252',
  },
  importButton: {
    marginTop: 12,
    backgroundColor: '#F1F3F5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  importButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelModalButton: {
    backgroundColor: '#F1F3F5',
  },
  cancelModalText: {
    color: '#495057',
    fontWeight: '600',
  },
  submitModalButton: {
    backgroundColor: '#228BE6',
  },
  submitModalText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
