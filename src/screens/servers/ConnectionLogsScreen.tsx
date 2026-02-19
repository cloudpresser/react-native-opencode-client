import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import * as Clipboard from 'expo-clipboard';
import { ConnectionLogEntry } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useServerStatusContext } from '../../context/ServerStatusContext';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConnectionLogs'>;

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString();
}

function getErrorTypeLabel(errorType?: string): string {
  switch (errorType) {
    case 'network': return 'Network';
    case 'auth': return 'Auth';
    case 'timeout': return 'Timeout';
    case 'server': return 'Server';
    default: return 'Unknown';
  }
}

function getErrorTypeColor(errorType: string | undefined, colors: any): string {
  switch (errorType) {
    case 'network': return colors.danger;
    case 'auth': return colors.warning;
    case 'timeout': return colors.warning;
    case 'server': return colors.danger;
    default: return colors.textMuted;
  }
}

function maskAuthHeader(value: string): string {
  if (value.startsWith('Basic ')) return 'Basic ***';
  if (value.startsWith('Bearer ')) return 'Bearer ***';
  return value;
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => {
      const displayValue = k.toLowerCase() === 'authorization' ? maskAuthHeader(v) : v;
      return `${k}: ${displayValue}`;
    })
    .join('\n');
}

async function copyToClipboard(text: string, label: string) {
  await Clipboard.setStringAsync(text);
  Alert.alert('Copied', `${label} copied to clipboard`);
}

function buildFullDump(item: ConnectionLogEntry): string {
  const lines: string[] = [];
  lines.push(`=== Connection Log ===`);
  lines.push(`Timestamp: ${formatTimestamp(item.timestamp)}`);
  lines.push(`Status: ${item.status === 'success' ? 'OK' : 'FAILED'}`);
  if (item.httpCode !== undefined) lines.push(`HTTP Status: ${item.httpCode}`);
  if (item.latencyMs !== undefined) lines.push(`Latency: ${item.latencyMs}ms`);
  if (item.errorType) lines.push(`Error Type: ${getErrorTypeLabel(item.errorType)}`);
  if (item.errorMessage) lines.push(`Error: ${item.errorMessage}`);
  lines.push('');
  if (item.requestMethod && item.requestUrl) {
    lines.push(`--- Request ---`);
    lines.push(`${item.requestMethod} ${item.requestUrl}`);
  }
  if (item.requestHeaders) {
    lines.push('');
    lines.push(`--- Request Headers ---`);
    lines.push(formatHeaders(item.requestHeaders));
  }
  if (item.responseHeaders) {
    lines.push('');
    lines.push(`--- Response Headers ---`);
    lines.push(formatHeaders(item.responseHeaders));
  }
  if (item.responseBody) {
    lines.push('');
    lines.push(`--- Response Body ---`);
    lines.push(item.responseBody);
  }
  return lines.join('\n');
}

// --- Sub-components ---

function CopyableRow({ label, value, mono, colors }: {
  label: string;
  value: string;
  mono?: boolean;
  colors: any;
}) {
  return (
    <TouchableOpacity
      onLongPress={() => copyToClipboard(value, label)}
      activeOpacity={0.7}
      style={[styles.copyableRow, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: colors.text },
          mono && styles.mono,
        ]}
        selectable
        numberOfLines={3}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function ExpandableSection({ title, content, colors }: {
  title: string;
  content: string;
  colors: any;
}) {
  const [open, setOpen] = useState(false);

  if (!content) return null;

  return (
    <View style={[styles.expandableSection, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={styles.expandableHeader}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{open ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[styles.codeBlock, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={() => copyToClipboard(content, title)}
            style={[styles.copyBtnSmall, { borderColor: colors.border }]}
          >
            <Text style={[styles.copyBtnText, { color: colors.primary }]}>Copy</Text>
          </TouchableOpacity>
          <ScrollView horizontal>
            <Text style={[styles.codeText, { color: colors.text }]} selectable>
              {content}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// --- Main Screen ---

export default function ConnectionLogsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { serverId, serverName } = route.params as { serverId: string; serverName: string };
  const { registerLogCallback } = useServerStatusContext();
  const colors = useThemeColors();
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = registerLogCallback(serverId, (entry) => {
        setLogs((prev) => [entry, ...prev].slice(0, 100));
      });
      return unsubscribe;
    }, [serverId, registerLogCallback])
  );

  const renderLogEntry = ({ item }: { item: ConnectionLogEntry }) => {
    const isSuccess = item.status === 'success';
    const isExpanded = expandedId === item.id;
    const statusColor = isSuccess ? colors.success : colors.danger;
    const errorColor = item.errorType ? getErrorTypeColor(item.errorType, colors) : undefined;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Header row: status, http code, latency, time, expand */}
        <TouchableOpacity
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.7}
          style={styles.cardHeader}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {isSuccess ? 'OK' : 'FAIL'}
            </Text>
            {item.httpCode !== undefined && (
              <View style={[styles.httpBadge, { backgroundColor: statusColor + '18' }]}>
                <Text style={[styles.httpBadgeText, { color: statusColor }]}>
                  {item.httpCode}
                </Text>
              </View>
            )}
            {item.errorType && (
              <View style={[styles.errorBadge, { backgroundColor: (errorColor || colors.warning) + '18' }]}>
                <Text style={[styles.errorBadgeText, { color: errorColor || colors.warning }]}>
                  {getErrorTypeLabel(item.errorType)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {item.latencyMs !== undefined && (
              <Text style={[styles.latencyText, { color: colors.textMuted }]}>
                {item.latencyMs}ms
              </Text>
            )}
            <Text style={[styles.timeText, { color: colors.textSubtle }]}>
              {formatRelativeTime(item.timestamp)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginLeft: 4 }}>
              {isExpanded ? '\u25B2' : '\u25BC'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* URL line - always visible */}
        {item.requestUrl && (
          <TouchableOpacity
            onLongPress={() => copyToClipboard(
              `${item.requestMethod || 'GET'} ${item.requestUrl}`,
              'Request URL'
            )}
            activeOpacity={0.8}
          >
            <Text style={[styles.urlLine, { color: colors.text }]} numberOfLines={1} selectable>
              <Text style={[styles.methodText, { color: colors.primary }]}>
                {item.requestMethod || 'GET'}{' '}
              </Text>
              {item.requestUrl}
            </Text>
          </TouchableOpacity>
        )}

        {/* Error message - always visible when present */}
        {item.errorMessage && (
          <Text
            style={[styles.errorMessage, { color: colors.danger }]}
            numberOfLines={2}
            selectable
          >
            {item.errorMessage}
          </Text>
        )}

        {/* Expanded detail panel */}
        {isExpanded && (
          <View style={[styles.detailPanel, { borderTopColor: colors.border }]}>
            {/* Copy Full Log button */}
            <TouchableOpacity
              onPress={() => copyToClipboard(buildFullDump(item), 'Full log')}
              style={[styles.copyFullBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.copyFullBtnText, { color: colors.primary }]}>
                Copy Full Log
              </Text>
            </TouchableOpacity>

            <CopyableRow
              label="Timestamp"
              value={formatTimestamp(item.timestamp)}
              colors={colors}
            />
            {item.httpCode !== undefined && (
              <CopyableRow
                label="HTTP Status"
                value={`${item.httpCode}`}
                colors={colors}
              />
            )}
            {item.latencyMs !== undefined && (
              <CopyableRow
                label="Latency"
                value={`${item.latencyMs}ms`}
                colors={colors}
              />
            )}
            {item.requestUrl && (
              <CopyableRow
                label="URL"
                value={item.requestUrl}
                mono
                colors={colors}
              />
            )}
            {item.errorType && (
              <CopyableRow
                label="Error Type"
                value={getErrorTypeLabel(item.errorType)}
                colors={colors}
              />
            )}
            {item.errorMessage && (
              <CopyableRow
                label="Error"
                value={item.errorMessage}
                mono
                colors={colors}
              />
            )}

            {item.requestHeaders && Object.keys(item.requestHeaders).length > 0 && (
              <ExpandableSection
                title="Request Headers"
                content={formatHeaders(item.requestHeaders)}
                colors={colors}
              />
            )}
            {item.responseHeaders && Object.keys(item.responseHeaders).length > 0 && (
              <ExpandableSection
                title="Response Headers"
                content={formatHeaders(item.responseHeaders)}
                colors={colors}
              />
            )}
            {item.responseBody ? (
              <ExpandableSection
                title="Response Body"
                content={item.responseBody}
                colors={colors}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="connection-logs-screen">
      <View className="flex-row items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-3"
          testID="back-button"
        >
          <Text className="text-primary text-lg">{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text flex-1">
          {serverName} Logs
        </Text>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLogEntry}
        keyExtractor={(item: ConnectionLogEntry) => item.id}
        contentContainerStyle={styles.listContent}
        testID="logs-list"
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="empty-logs">
            <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
              No connection logs yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSubtle }]}>
              Logs will appear as health checks run.{'\n'}
              Tap a log entry to see full details.{'\n'}
              Long-press any field to copy it.
            </Text>
          </View>
        }
      />
    </StyledSafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 12,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  httpBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  httpBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  errorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  latencyText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  timeText: {
    fontSize: 11,
  },
  urlLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  methodText: {
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  detailPanel: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  copyFullBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  copyFullBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  copyableRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 13,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  expandableSection: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeBlock: {
    marginTop: 6,
    borderRadius: 6,
    padding: 10,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  copyBtnSmall: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
