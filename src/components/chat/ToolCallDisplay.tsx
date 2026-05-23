import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { ChatMessageToolCall } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ToolCallDisplayProps {
  toolCall: ChatMessageToolCall;
}

const TOOL_ICONS: Record<string, string> = {
  read: 'R',
  write: 'W',
  edit: 'E',
  apply_patch: 'P',
  bash: '$',
  glob: 'G',
  grep: '?',
  task: 'T',
  webfetch: 'U',
  websearch: 'S',
};

function getToolIcon(toolName: string): string {
  const lower = toolName.toLowerCase();
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return toolName.charAt(0).toUpperCase();
}

function getStatusColor(state: string, colors: ReturnType<typeof useThemeColors>): string {
  switch (state) {
    case 'result':
      return colors.success;
    case 'call':
    case 'partial-call':
      return colors.primary;
    default:
      return colors.textMuted;
  }
}

function getStatusLabel(state: string): string {
  switch (state) {
    case 'result':
      return 'Done';
    case 'call':
      return 'Running';
    case 'partial-call':
      return 'Pending';
    default:
      return state;
  }
}

function formatResult(result: string): string {
  if (result.length > 4000) {
    return result.slice(0, 4000) + '\n... (truncated)';
  }
  return result;
}

function renderDiffLine(line: string, index: number, colors: ReturnType<typeof useThemeColors>) {
  let backgroundColor = 'transparent';
  let color: string = colors.codeText;
  let fontWeight: '400' | '700' = '400';

  if (line.startsWith('+')) {
    backgroundColor = `${colors.success}22`;
    color = colors.success;
  } else if (line.startsWith('-')) {
    backgroundColor = `${colors.danger}22`;
    color = colors.danger;
  } else if (line.startsWith('@@')) {
    backgroundColor = `${colors.info}22`;
    color = colors.info;
    fontWeight = '700';
  } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
    color = colors.textSubtle;
  }

  return (
    <Text
      key={`${index}-${line}`}
      selectable
      style={{
        backgroundColor,
        color,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 11,
        lineHeight: 16,
        fontWeight,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      {line}
    </Text>
  );
}

function getDiffText(toolCall: ChatMessageToolCall): string | null {
  const metadata = toolCall.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const files = Array.isArray(metadata.files) ? metadata.files : null;
  if (files && files.length > 0) {
    const patches = files
      .map((file) => (typeof file?.patch === 'string' ? file.patch : ''))
      .filter(Boolean);
    if (patches.length > 0) {
      return patches.join('\n');
    }
  }

  const filediff = metadata.filediff;
  if (filediff && typeof filediff === 'object' && typeof filediff.patch === 'string' && filediff.patch.trim()) {
    return filediff.patch;
  }

  if (typeof metadata.diff === 'string' && metadata.diff.trim()) {
    return metadata.diff;
  }

  return null;
}

function looksLikeUnifiedDiff(value: string): boolean {
  return value.includes('@@') || value.includes('diff --git') || (value.includes('---') && value.includes('+++'));
}

function isEditLikeTool(toolName: string): boolean {
  const lower = toolName.toLowerCase();
  return lower.includes('edit') || lower.includes('write') || lower.includes('patch');
}

function CodeBlock({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View
      style={{
        width: '100%',
        alignSelf: 'stretch',
        backgroundColor: colors.codeBackground,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function TodoList({ todos, colors }: { todos: Array<{ content: string; status: string; priority: string }>; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ gap: 6 }}>
      {todos.map((todo, index) => {
        const statusColor =
          todo.status === 'completed'
            ? colors.success
            : todo.status === 'in_progress'
              ? colors.primary
              : todo.status === 'cancelled'
                ? colors.textSubtle
                : colors.warning;

        return (
          <View
            key={`${todo.content}-${index}`}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderMuted,
              borderRadius: 6,
              paddingHorizontal: 10,
              paddingVertical: 8,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{todo.content}</Text>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                {todo.status.replace('_', ' ')}
              </Text>
            </View>
            <Text style={{ color: colors.textSubtle, fontSize: 10, textTransform: 'uppercase' }}>
              Priority: {todo.priority}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const statusColor = getStatusColor(toolCall.state, colors);
  const icon = getToolIcon(toolCall.toolName);
  const displayTitle = toolCall.title || toolCall.toolName;

  const diffText = useMemo(() => getDiffText(toolCall), [toolCall]);
  const resultText = toolCall.result ? formatResult(toolCall.result) : null;
  const showDiff = !!diffText && isEditLikeTool(toolCall.toolName) && looksLikeUnifiedDiff(diffText);
  const todoItems = useMemo(() => {
    const todos = toolCall.metadata?.todos;
    return Array.isArray(todos) ? todos : null;
  }, [toolCall.metadata]);
  const showResultSection = !todoItems?.length && (showDiff || resultText);

  let argsSummary = '';
  if (toolCall.args) {
    if (toolCall.args.filePath) argsSummary = toolCall.args.filePath;
    else if (toolCall.args.command) argsSummary = toolCall.args.command;
    else if (toolCall.args.pattern) argsSummary = toolCall.args.pattern;
    else if (toolCall.args.query) argsSummary = toolCall.args.query;
    else if (toolCall.args.url) argsSummary = toolCall.args.url;
  }

  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: statusColor,
        backgroundColor: colors.surfaceElevated,
        borderRadius: 8,
        marginVertical: 4,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            backgroundColor: statusColor + '22',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
          }}
        >
          <Text
            style={{
              color: statusColor,
              fontSize: 12,
              fontWeight: '700',
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            }}
          >
            {icon}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.text,
              fontSize: 13,
              fontWeight: '600',
            }}
          >
            {displayTitle}
          </Text>
          {argsSummary ? (
            <Text
              numberOfLines={1}
              style={{
                color: colors.textMuted,
                fontSize: 11,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                marginTop: 1,
              }}
            >
              {argsSummary}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: statusColor + '22',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: statusColor, fontSize: 10, fontWeight: '600' }}>
            {getStatusLabel(toolCall.state)}
          </Text>
        </View>

        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginLeft: 6,
          }}
        >
          {expanded ? '▾' : '▸'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 10 }}>
          {todoItems && todoItems.length > 0 && (
            <View style={{ width: '100%', alignSelf: 'stretch' }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                Todos
              </Text>
              <TodoList todos={todoItems} colors={colors} />
            </View>
          )}

          {showResultSection && (
            <View style={{ width: '100%', alignSelf: 'stretch' }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 10,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {showDiff ? 'Diff' : 'Result'}
              </Text>
              <CodeBlock colors={colors}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
                  <ScrollView horizontal nestedScrollEnabled contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ minWidth: '100%' }}>
                      {showDiff && diffText
                        ? diffText.split('\n').map((line, index) => renderDiffLine(line, index, colors))
                        : (
                          <Text
                            selectable
                            style={{
                              color: colors.codeText,
                              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                              fontSize: 11,
                              lineHeight: 16,
                              padding: 8,
                            }}
                          >
                            {resultText}
                          </Text>
                        )}
                    </View>
                  </ScrollView>
                </ScrollView>
              </CodeBlock>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
