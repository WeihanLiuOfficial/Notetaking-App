import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ToolType, TemplateType } from '../../types/canvas';

export interface ToolPaletteProps {
  activeTool: ToolType;
  activeColor: string;
  strokeWidth: number;
  currentTemplate: TemplateType;
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onSelectStrokeWidth: (width: number) => void;
  onSelectTemplate: (template: TemplateType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const COLOR_SWATCHES = [
  { label: 'Black', hex: '#000000' },
  { label: 'Blue', hex: '#1C7ED6' },
  { label: 'Red', hex: '#E03131' },
  { label: 'Green', hex: '#2F9E44' },
  { label: 'Orange', hex: '#F59F00' },
  { label: 'Purple', hex: '#7048E8' },
  { label: 'Dark Grey', hex: '#343A40' },
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Med', value: 4 },
  { label: 'Bold', value: 8 },
  { label: 'X-Bold', value: 12 },
];

const TEMPLATES: { label: string; value: TemplateType }[] = [
  { label: 'Blank', value: 'blank' },
  { label: 'Lined', value: 'lined' },
  { label: 'Grid', value: 'grid' },
  { label: 'Cornell', value: 'cornell' },
];

export const ToolPalette: React.FC<ToolPaletteProps> = ({
  activeTool,
  activeColor,
  strokeWidth,
  currentTemplate,
  canUndo,
  canRedo,
  onSelectTool,
  onSelectColor,
  onSelectStrokeWidth,
  onSelectTemplate,
  onUndo,
  onRedo,
  onClear,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Tools Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tool</Text>
          <View style={styles.buttonGroup}>
            {(['pen', 'highlighter', 'eraser', 'lasso'] as ToolType[]).map((tool) => (
              <TouchableOpacity
                key={tool}
                style={[
                  styles.toolButton,
                  activeTool === tool && styles.toolButtonActive,
                ]}
                onPress={() => onSelectTool(tool)}
              >
                <Text
                  style={[
                    styles.toolButtonText,
                    activeTool === tool && styles.toolButtonTextActive,
                  ]}
                >
                  {tool.charAt(0).toUpperCase() + tool.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Colors Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Color</Text>
          <View style={styles.buttonGroup}>
            {COLOR_SWATCHES.map((swatch) => (
              <TouchableOpacity
                key={swatch.hex}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: swatch.hex },
                  activeColor === swatch.hex && styles.colorSwatchActive,
                ]}
                onPress={() => onSelectColor(swatch.hex)}
              />
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Stroke Width Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Size</Text>
          <View style={styles.buttonGroup}>
            {STROKE_WIDTHS.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.sizeButton,
                  strokeWidth === item.value && styles.sizeButtonActive,
                ]}
                onPress={() => onSelectStrokeWidth(item.value)}
              >
                <Text
                  style={[
                    styles.sizeButtonText,
                    strokeWidth === item.value && styles.sizeButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Paper Template Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Paper</Text>
          <View style={styles.buttonGroup}>
            {TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.value}
                style={[
                  styles.sizeButton,
                  currentTemplate === tmpl.value && styles.sizeButtonActive,
                ]}
                onPress={() => onSelectTemplate(tmpl.value)}
              >
                <Text
                  style={[
                    styles.sizeButtonText,
                    currentTemplate === tmpl.value && styles.sizeButtonTextActive,
                  ]}
                >
                  {tmpl.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* History / Clear Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Actions</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.actionButton, !canUndo && styles.actionButtonDisabled]}
              onPress={onUndo}
              disabled={!canUndo}
            >
              <Text style={[styles.actionButtonText, !canUndo && styles.actionButtonTextDisabled]}>
                Undo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, !canRedo && styles.actionButtonDisabled]}
              onPress={onRedo}
              disabled={!canRedo}
            >
              <Text style={[styles.actionButtonText, !canRedo && styles.actionButtonTextDisabled]}>
                Redo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.clearButton]}
              onPress={onClear}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#868E96',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
  },
  toolButtonActive: {
    backgroundColor: '#1C7ED6',
  },
  toolButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  toolButtonTextActive: {
    color: '#FFFFFF',
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#1C7ED6',
    transform: [{ scale: 1.15 }],
  },
  sizeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F3F5',
  },
  sizeButtonActive: {
    backgroundColor: '#343A40',
  },
  sizeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#495057',
  },
  sizeButtonTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#E9ECEF',
    marginHorizontal: 4,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E7F5FF',
  },
  actionButtonDisabled: {
    backgroundColor: '#F8F9FA',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1C7ED6',
  },
  actionButtonTextDisabled: {
    color: '#ADB5BD',
  },
  clearButton: {
    backgroundColor: '#FFF5F5',
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E03131',
  },
});
