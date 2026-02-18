import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import CodeHighlighter from 'react-native-code-highlighter';
import { atomOneDarkReasonable } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useThemeColors } from '../../hooks/useThemeColors';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export default function MarkdownRenderer({ content, isUser }: MarkdownRendererProps) {
  const colors = useThemeColors();

  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: isUser ? colors.onPrimary : colors.text,
          fontSize: 15,
          lineHeight: 22,
        },
        heading1: {
          color: isUser ? colors.onPrimary : colors.text,
          fontSize: 22,
          fontWeight: '700' as const,
          marginTop: 12,
          marginBottom: 6,
        },
        heading2: {
          color: isUser ? colors.onPrimary : colors.text,
          fontSize: 19,
          fontWeight: '700' as const,
          marginTop: 10,
          marginBottom: 4,
        },
        heading3: {
          color: isUser ? colors.onPrimary : colors.text,
          fontSize: 17,
          fontWeight: '600' as const,
          marginTop: 8,
          marginBottom: 4,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 8,
        },
        strong: {
          fontWeight: '700' as const,
        },
        em: {
          fontStyle: 'italic' as const,
        },
        link: {
          color: isUser ? colors.link : colors.primary,
          textDecorationLine: 'underline' as const,
        },
        blockquote: {
          backgroundColor: isUser ? `${colors.onPrimary}1A` : colors.surfaceElevated,
          borderLeftColor: isUser ? `${colors.onPrimary}66` : colors.border,
          borderLeftWidth: 3,
          paddingLeft: 10,
          paddingVertical: 4,
          marginVertical: 6,
        },
        code_inline: {
          backgroundColor: isUser ? `${colors.onPrimary}26` : colors.surfaceElevated,
          color: isUser ? colors.onPrimary : colors.text,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: 3,
        },
        // We override the fence/code_block via rules, but keep a fallback style
        code_block: {
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
        },
        fence: {
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
        },
        list_item: {
          marginBottom: 4,
        },
        bullet_list: {
          marginBottom: 8,
        },
        ordered_list: {
          marginBottom: 8,
        },
        bullet_list_icon: {
          color: isUser ? colors.onPrimary : colors.textMuted,
          marginRight: 6,
        },
        ordered_list_icon: {
          color: isUser ? colors.onPrimary : colors.textMuted,
          marginRight: 6,
        },
        hr: {
          backgroundColor: isUser ? `${colors.onPrimary}33` : colors.border,
          height: 1,
          marginVertical: 10,
        },
        table: {
          borderColor: isUser ? `${colors.onPrimary}33` : colors.border,
        },
        thead: {
          backgroundColor: isUser ? `${colors.onPrimary}1A` : colors.surfaceElevated,
        },
        th: {
          color: isUser ? colors.onPrimary : colors.text,
          fontWeight: '600' as const,
          padding: 6,
        },
        td: {
          color: isUser ? colors.onPrimary : colors.text,
          padding: 6,
        },
        tr: {
          borderBottomColor: isUser ? `${colors.onPrimary}1A` : colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      }),
    [isUser, colors],
  );

  const rules = useMemo(
    () => ({
      fence: (node: any, _children: any, _parent: any, styles: any) => {
        const language = node.sourceInfo || '';
        const code = node.content || '';
        return (
          <CodeHighlighter
            key={node.key}
            hljsStyle={atomOneDarkReasonable}
            language={language}
            containerStyle={{
              borderRadius: 8,
              marginVertical: 6,
              padding: 12,
            }}
            textStyle={{
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {code.replace(/\n$/, '')}
          </CodeHighlighter>
        );
      },
      code_block: (node: any, _children: any, _parent: any, styles: any) => {
        const code = node.content || '';
        return (
          <CodeHighlighter
            key={node.key}
            hljsStyle={atomOneDarkReasonable}
            language=""
            containerStyle={{
              borderRadius: 8,
              marginVertical: 6,
              padding: 12,
            }}
            textStyle={{
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              fontSize: 13,
              lineHeight: 19,
            }}
          >
            {code.replace(/\n$/, '')}
          </CodeHighlighter>
        );
      },
    }),
    [],
  );

  return (
    <Markdown style={markdownStyles} rules={rules}>
      {content}
    </Markdown>
  );
}
