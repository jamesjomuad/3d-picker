import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatBoardChange,
  formatJsonIssue,
  getLocationFromIndex,
} from '@/utils/board-json';

const LINE_HEIGHT = 20;
const FONT_SIZE = 13;
const GUTTER_WIDTH = 36;
const CHAR_WIDTH = 7.8;
const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;

function buildHighlightedText(text, theme) {
  const segments = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN_PATTERN.lastIndex = 0;

  let match = TOKEN_PATTERN.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      segments.push(
        <Text key={key++} style={{ color: theme.text }}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    if (match[1]) {
      segments.push(
        <Text key={key++} style={{ color: match[2] ? theme.primary : theme.text }}>
          {match[1]}
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      segments.push(
        <Text key={key++} style={{ color: theme.destructive }}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      segments.push(
        <Text key={key++} style={{ color: theme.match }}>
          {match[4]}
        </Text>
      );
    } else if (match[5]) {
      segments.push(
        <Text key={key++} style={{ color: theme.textSecondary }}>
          {match[5]}
        </Text>
      );
    }

    lastIndex = TOKEN_PATTERN.lastIndex;
    match = TOKEN_PATTERN.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push(
      <Text key={key++} style={{ color: theme.text }}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return segments;
}

const JsonEditor = forwardRef(function JsonEditor(
  { value, onChangeText, width },
  ref
) {
  const theme = useTheme();
  const inputRef = useRef(null);
  const [cursor, setCursor] = useState(0);

  const lines = useMemo(() => value.split('\n'), [value]);
  const activeLine = useMemo(
    () => getLocationFromIndex(value, cursor).line,
    [value, cursor]
  );
  const highlighted = useMemo(() => buildHighlightedText(value, theme), [value, theme]);
  const maxLineLength = useMemo(
    () => lines.reduce((longest, line) => Math.max(longest, line.length), 1),
    [lines]
  );

  const visibleWidth = Math.max((width ?? 320) - GUTTER_WIDTH - Spacing.two, 220);
  const codeWidth = Math.max(
    visibleWidth,
    Math.ceil(maxLineLength * CHAR_WIDTH + Spacing.four)
  );
  const contentHeight = lines.length * LINE_HEIGHT + Spacing.four;

  useImperativeHandle(ref, () => ({
    focusAt(location) {
      inputRef.current?.focus();
      if (location?.index != null) {
        inputRef.current?.setSelection(location.index, location.index);
      }
    },
  }));

  return (
    <View
      style={[
        styles.editor,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
        },
      ]}>
      <View style={[styles.gutter, { borderRightColor: theme.border }]}>
        {lines.map((_, index) => (
          <View
            key={index}
            style={[
              styles.gutterRow,
              index + 1 === activeLine && { backgroundColor: theme.backgroundSelected },
            ]}>
            <Text
              style={[
                styles.lineNumber,
                { color: index + 1 === activeLine ? theme.text : theme.textSecondary },
              ]}>
              {index + 1}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.codeScroll}>
        <View style={{ width: codeWidth, height: contentHeight }}>
          <Text
            style={[
              styles.code,
              {
                width: codeWidth,
                height: contentHeight,
                color: theme.text,
              },
            ]}>
            {highlighted}
          </Text>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onSelectionChange={(event) => setCursor(event.nativeEvent.selection.start)}
            accessibilityLabel="JSON board data"
            accessibilityHint="Edit the board as JSON. Preview or apply changes when done."
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            multiline
            scrollEnabled={false}
            blurOnSubmit={false}
            textAlignVertical="top"
            selectionColor={theme.primary}
            selectionHandleColor={theme.primary}
            tintColor={theme.primary}
            style={[
              styles.input,
              {
                width: codeWidth,
                height: contentHeight,
                color: 'transparent',
              },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
});

export function BoardJsonEditor({
  value,
  onChangeText,
  width,
  errors,
  preview,
  applying,
  onPreview,
  onApply,
  onCancel,
  showActions = true,
}) {
  const theme = useTheme();
  const editorRef = useRef(null);
  const issues = errors ?? [];
  const changes = preview?.changes ?? [];

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">JSON Editor</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.helper}>
        Edit the working board. Preview checks changes without applying them.
      </ThemedText>

      {issues.length > 0 && (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.errorSummary,
            {
              borderColor: theme.destructive,
              backgroundColor: theme.backgroundElement,
            },
          ]}>
          <Text selectable style={[styles.errorTitle, { color: theme.destructive }]}>
            Fix these JSON issues
          </Text>
          {issues.slice(0, 6).map((issue, index) => (
            <Pressable
              key={`${issue.location?.index ?? 'issue'}-${index}`}
              onPress={() => editorRef.current?.focusAt(issue.location)}
              accessibilityRole="button"
              accessibilityLabel={`${formatJsonIssue(issue)}. Go to issue.`}
              style={({ pressed }) => [
                styles.errorRow,
                pressed && styles.pressed,
              ]}>
              <Text selectable style={[styles.errorText, { color: theme.text }]}>
                {formatJsonIssue(issue)}
              </Text>
            </Pressable>
          ))}
          {issues.length > 6 && (
            <Text style={[styles.errorMore, { color: theme.textSecondary }]}>
              + {issues.length - 6} more issue{issues.length - 6 === 1 ? '' : 's'}
            </Text>
          )}
        </View>
      )}

      <JsonEditor ref={editorRef} value={value} onChangeText={onChangeText} width={width} />

      {preview && (
        <View
          style={[
            styles.preview,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          ]}>
          <ThemedText type="smallBold">Preview</ThemedText>
          {preview.changed ? (
            <>
              {changes.slice(0, 8).map((change, index) => (
                <Text key={index} selectable style={[styles.previewText, { color: theme.text }]}>
                  {formatBoardChange(change)}
                </Text>
              ))}
              {changes.length > 8 && (
                <Text style={[styles.previewText, { color: theme.textSecondary }]}>
                  + {changes.length - 8} more change{changes.length - 8 === 1 ? '' : 's'}
                </Text>
              )}
            </>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.previewText}>
              Valid JSON. No changes from the current board.
            </ThemedText>
          )}
        </View>
      )}

      {showActions && (
        <View style={styles.actions}>
          <Button variant="outline" onPress={onCancel} disabled={applying} style={styles.action}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onPress={onPreview}
            disabled={applying || !value.trim()}
            style={styles.action}>
            Preview Changes
          </Button>
          <Button
            onPress={onApply}
            disabled={!preview || applying}
            loading={applying}
            style={styles.action}>
            Apply Changes
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  editor: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  gutter: {
    width: GUTTER_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  gutterRow: {
    height: LINE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Spacing.one,
  },
  lineNumber: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: LINE_HEIGHT,
    fontVariant: ['tabular-nums'],
  },
  codeScroll: {
    flex: 1,
  },
  code: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontFamily: Fonts.mono,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontFamily: Fonts.mono,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
  errorSummary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  errorMore: {
    fontSize: 13,
    lineHeight: 18,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  action: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
