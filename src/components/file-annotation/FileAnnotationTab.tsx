import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { FileAnnotation, Server, Session, ChatMessage } from '../../types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

interface FileAnnotationTabProps {
  session: Session;
  server: Server;
}

export default function FileAnnotationTab({ session, server }: FileAnnotationTabProps) {
  const colors = useThemeColors();
  const { fileAnnotations, addFileAnnotation, removeFileAnnotation, clearFileAnnotations, addMessage } = useStore();
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileAnnotation | null>(null);
  const [newAnnotation, setNewAnnotation] = useState({
    lineStart: '',
    lineEnd: '',
    note: '',
  });
  const [service] = useState(() => new OpenCodeService(server));
  const [showFilePicker, setShowFilePicker] = useState(false);

  const sessionAnnotations = fileAnnotations[session.id] || [];

  const handlePickFile = () => {
    setShowFilePicker(true);
  };

  const handleSelectFromDevice = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const annotation: FileAnnotation = {
          filePath: asset.name,
          content,
          annotations: [],
        };

        addFileAnnotation(session.id, annotation);
      }
      setShowFilePicker(false);
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
      setShowFilePicker(false);
    }
  };

  const handleAddAnnotation = () => {
    if (!selectedFile) return;

    const lineStart = parseInt(newAnnotation.lineStart);
    const lineEnd = parseInt(newAnnotation.lineEnd);

    if (isNaN(lineStart) || isNaN(lineEnd) || !newAnnotation.note.trim()) {
      Alert.alert('Error', 'Please fill in all annotation fields');
      return;
    }

    if (lineStart < 1 || lineEnd < lineStart) {
      Alert.alert('Error', 'Invalid line range');
      return;
    }

    const updatedFile: FileAnnotation = {
      ...selectedFile,
      annotations: [
        ...selectedFile.annotations,
        {
          lineStart,
          lineEnd,
          note: newAnnotation.note,
        },
      ],
    };

    addFileAnnotation(session.id, updatedFile);
    setNewAnnotation({ lineStart: '', lineEnd: '', note: '' });
    setSelectedFile(updatedFile);
  };

  const handleRemoveAnnotation = (index: number) => {
    if (!selectedFile) return;

    const updatedFile: FileAnnotation = {
      ...selectedFile,
      annotations: selectedFile.annotations.filter((_, i) => i !== index),
    };

    addFileAnnotation(session.id, updatedFile);
    setSelectedFile(updatedFile);
  };

  const handleSendAnnotatedFiles = async () => {
    if (sessionAnnotations.length === 0) {
      Alert.alert('Error', 'No annotated files to send');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    let fullMessage = message + '\n\n';

    for (const file of sessionAnnotations) {
      fullMessage += `\n--- File: ${file.filePath} ---\n`;

      if (file.annotations.length > 0) {
        fullMessage += 'Annotations:\n';
        for (const ann of file.annotations) {
          fullMessage += `  Lines ${ann.lineStart}-${ann.lineEnd}: ${ann.note}\n`;
        }
        fullMessage += '\n';
      }

      fullMessage += 'Content:\n';
      const lines = file.content.split('\n');
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const hasAnnotation = file.annotations.some(
          (ann) => lineNum >= ann.lineStart && lineNum <= ann.lineEnd
        );
        fullMessage += `${lineNum.toString().padStart(4, ' ')}: ${hasAnnotation ? '→ ' : '  '}${line}\n`;
      });
      fullMessage += '\n';
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: fullMessage,
      timestamp: new Date().toISOString(),
    };

    addMessage(session.id, userMessage);
    setMessage('');

    try {
      const response = await service.sendMessage(session.id, fullMessage);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      addMessage(session.id, assistantMessage);
      clearFileAnnotations(session.id);
      Alert.alert('Success', 'Annotated files sent successfully');
    } catch (error) {
      console.error('Error sending annotated files:', error);
      Alert.alert('Error', 'Failed to send annotated files');
    }
  };

  const renderFileItem = ({ item }: { item: FileAnnotation }): React.ReactElement => (
    <TouchableOpacity className="bg-surface rounded-xl p-4 mb-3 shadow-sm" onPress={() => setSelectedFile(item)}>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-base font-semibold text-text font-mono flex-1">{item.filePath}</Text>
        <TouchableOpacity onPress={() => removeFileAnnotation(session.id, item.filePath)}>
          <Text className="text-3xl text-danger font-bold px-2">×</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-sm text-text-muted">
        {item.annotations.length} annotation(s)
      </Text>
    </TouchableOpacity>
  );

  const renderFileContent = () => {
    if (!selectedFile) return null;

    const lines = selectedFile.content.split('\n');

    return (
      <View className="flex-1 bg-surface-elevated">
        <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
          <TouchableOpacity onPress={() => setSelectedFile(null)}>
            <Text className="text-base text-primary min-w-[60]">← Back</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-base font-semibold text-text text-center font-mono">{selectedFile.filePath}</Text>
          <View className="min-w-[60]" />
        </View>

        <ScrollView className="flex-1 p-3">
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const annotation = selectedFile.annotations.find(
              (ann) => lineNum >= ann.lineStart && lineNum <= ann.lineEnd
            );

            return (
              <View key={idx}>
                <View className={['flex-row py-0.5', annotation ? 'bg-info/20' : ''].join(' ')}>
                  <Text className="text-text-subtle font-mono text-xs w-10 text-right mr-3">{lineNum}</Text>
                  <Text className="text-text font-mono text-xs flex-1">{line}</Text>
                </View>
                {annotation && lineNum === annotation.lineStart && (
                  <View className="bg-border-muted p-2 ml-[52px] mb-1 border-l-2 border-info">
                    <Text className="text-info text-xs italic">{annotation.note}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View className="bg-surface p-4 border-t border-border">
          <Text className="text-text text-base font-bold mb-3">Add Annotation</Text>
          <View className="flex-row items-center mb-3">
            <TextInput
              className="bg-surface-elevated text-text border border-border rounded-md p-2 text-sm w-[70]"
              placeholder="Start"
              placeholderTextColor={colors.textSubtle}
              value={newAnnotation.lineStart}
              onChangeText={(text) => setNewAnnotation({ ...newAnnotation, lineStart: text })}
              keyboardType="number-pad"
            />
            <Text className="text-text-subtle mx-2">to</Text>
            <TextInput
              className="bg-surface-elevated text-text border border-border rounded-md p-2 text-sm w-[70]"
              placeholder="End"
              placeholderTextColor={colors.textSubtle}
              value={newAnnotation.lineEnd}
              onChangeText={(text) => setNewAnnotation({ ...newAnnotation, lineEnd: text })}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            className="bg-surface-elevated text-text border border-border rounded-md p-3 text-sm mb-3 min-h-[60]"
            placeholder="Annotation note..."
            placeholderTextColor={colors.textSubtle}
            value={newAnnotation.note}
            onChangeText={(text) => setNewAnnotation({ ...newAnnotation, note: text })}
            multiline
          />
          <TouchableOpacity className="bg-primary py-2.5 rounded-md items-center" onPress={handleAddAnnotation}>
            <Text className="text-white font-semibold">Add Annotation</Text>
          </TouchableOpacity>

          {selectedFile.annotations.length > 0 && (
            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-text text-sm font-semibold mb-2">Current Annotations:</Text>
              {selectedFile.annotations.map((ann, idx) => (
                <View key={idx} className="flex-row justify-between items-center bg-border-muted p-2 rounded-md mb-1.5">
                  <Text className="text-text text-xs flex-1">
                    Lines {ann.lineStart}-{ann.lineEnd}: {ann.note}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveAnnotation(idx)}>
                    <Text className="text-danger text-lg font-bold px-2">×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (selectedFile) {
    return renderFileContent();
  }

  if (showFilePicker) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
          <Text className="text-xl font-bold text-text">Select files to annotate</Text>
          <TouchableOpacity className="bg-border px-4 py-2 rounded-lg" onPress={() => setShowFilePicker(false)}>
            <Text className="text-text font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-lg text-text-muted mb-4">Choose a file from your device</Text>
          <TouchableOpacity className="bg-primary px-6 py-3 rounded-lg" onPress={handleSelectFromDevice}>
            <Text className="text-white font-semibold">Browse Files</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-text">File Annotations</Text>
        <TouchableOpacity className="bg-primary px-4 py-2 rounded-lg" onPress={handlePickFile} testID="add-file-btn">
          <Text className="text-white font-semibold">+ Add File</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessionAnnotations}
        renderItem={renderFileItem}
        keyExtractor={(item: FileAnnotation) => item.filePath}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center justify-center pt-16">
            <Text className="text-lg font-semibold text-text-muted mb-2">No annotated files</Text>
            <Text className="text-sm text-text-subtle">Add files and annotate them</Text>
          </View>
        }
      />

      {sessionAnnotations.length > 0 && (
        <View className="p-4 bg-surface border-t border-border">
          <TextInput
            className="border border-border rounded-lg p-3 text-base mb-3 min-h-[60] text-text"
            placeholder="Message to send with annotations..."
            placeholderTextColor={colors.textSubtle}
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity className="bg-success py-3 rounded-lg items-center" onPress={handleSendAnnotatedFiles}>
            <Text className="text-white font-semibold text-base">Send All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}