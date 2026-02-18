import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import CodeHighlighter from 'react-native-code-highlighter';
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { ChatMessageToolCall } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ToolCallDisplayProps {
  toolCall: ChatMessageToolCall;
}

const TOOL_ICONS: Record<string, string> = {
  read: 'R',
  write: 'W',
  edit: 'E',
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

function formatArgs(args: Record<string, any>): string {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function formatResult(result: string): string {
  // Truncate very long results for display
  if (result.length > 2000) {
    return result.slice(0, 2000) + '\n... (truncated)';
  }
  return result;
}

export default function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const statusColor = getStatusColor(toolCall.state, colors);
  const icon = getToolIcon(toolCall.toolName);
  const displayTitle = toolCall.title || toolCall.toolName;

  // Build a summary from args for common tools
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
      {/* Header - always visible */}
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
        {/* Tool icon */}
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

        {/* Title + summary */}
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

        {/* Status badge */}
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

        {/* Expand chevron */}
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

      {/* Expanded details */}
      {expanded && (
        <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
          {/* Args */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <View style={{ marginBottom: 6 }}>
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
                Arguments
              </Text>
              <CodeHighlighter
                hljsStyle={atomOneDarkReasonable}
                language="json"
                containerStyle={{
                  borderRadius: 6,
                  padding: 8,
                  maxHeight: 200,
                }}
                textStyle={{
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                {formatArgs(toolCall.args)}
              </CodeHighlighter>
            </View>
          )}

          {/* Result */}
          {toolCall.result && (
            <View>
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
                Result
              </Text>
              <ScrollView
                style={{
                  maxHeight: 300,
                    backgroundColor: colors.codeBackground,
                  borderRadius: 6,
                  padding: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.codeText,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                  selectable
                >
                  {formatResult(toolCall.result)}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
