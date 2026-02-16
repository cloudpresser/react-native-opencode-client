import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { FileAnnotation, Server, Session, ChatMessage } from '../../types';
import { OpenCodeService } from '../../services/opencode';

interface FileAnnotationTabProps {
  session: Session;
  server: Server;
}

export default function FileAnnotationTab({ session, server }: FileAnnotationTabProps) {
  const { fileAnnotations, addFileAnnotation, removeFileAnnotation, clearFileAnnotations, addMessage } = useStore();
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileAnnotation | null>(null);
  const [newAnnotation, setNewAnnotation] = useState({
    lineStart: '',
    lineEnd: '',
    note: '',
  });
  const [service] = useState(() => new OpenCodeService(server));

  const sessionAnnotations = fileAnnotations[session.id] || [];

  const handlePickFile = async () => {
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
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
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
    
    // Update selected file to reflect changes
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

    // Build message with annotations
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

    // Create user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: fullMessage,
      timestamp: new Date().toISOString(),
    };

    addMessage(session.id, userMessage);
    setMessage('');

    try {
      // Send to OpenCode
      const response = await service.sendMessage(session.id, fullMessage);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      addMessage(session.id, assistantMessage);

      // Clear annotations after successful send
      clearFileAnnotations(session.id);

      Alert.alert('Success', 'Annotated files sent successfully');
    } catch (error) {
      console.error('Error sending annotated files:', error);
      Alert.alert('Error', 'Failed to send annotated files');
    }
  };

  const renderFileItem = ({ item }: { item: FileAnnotation }) => (
    <TouchableOpacity style={styles.fileCard} onPress={() => setSelectedFile(item)}>
      <View style={styles.fileHeader}>
        <Text style={styles.fileName}>{item.filePath}</Text>
        <TouchableOpacity onPress={() => removeFileAnnotation(session.id, item.filePath)}>
          <Text style={styles.removeButton}>×</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.annotationCount}>
        {item.annotations.length} annotation(s)
      </Text>
    </TouchableOpacity>
  );

  const renderFileContent = () => {
    if (!selectedFile) return null;

    const lines = selectedFile.content.split('\n');

    return (
      <View style={styles.fileViewContainer}>
        <View style={styles.fileViewHeader}>
          <TouchableOpacity onPress={() => setSelectedFile(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.fileViewTitle}>{selectedFile.filePath}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.codeContainer}>
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const annotation = selectedFile.annotations.find(
              (ann) => lineNum >= ann.lineStart && lineNum <= ann.lineEnd
            );

            return (
              <View key={idx}>
                <View style={[styles.codeLine, annotation && styles.annotatedLine]}>
                  <Text style={styles.lineNumber}>{lineNum}</Text>
                  <Text style={styles.lineContent}>{line}</Text>
                </View>
                {annotation && lineNum === annotation.lineStart && (
                  <View style={styles.annotationBox}>
                    <Text style={styles.annotationNote}>{annotation.note}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.annotationForm}>
          <Text style={styles.formTitle}>Add Annotation</Text>
          <View style={styles.formRow}>
            <TextInput
              style={styles.lineInput}
              placeholder="Start"
              value={newAnnotation.lineStart}
              onChangeText={(text) => setNewAnnotation({ ...newAnnotation, lineStart: text })}
              keyboardType="number-pad"
            />
            <Text style={styles.lineSeparator}>to</Text>
            <TextInput
              style={styles.lineInput}
              placeholder="End"
              value={newAnnotation.lineEnd}
              onChangeText={(text) => setNewAnnotation({ ...newAnnotation, lineEnd: text })}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            style={styles.noteInput}
            placeholder="Annotation note..."
            value={newAnnotation.note}
            onChangeText={(text) => setNewAnnotation({ ...newAnnotation, note: text })}
            multiline
          />
          <TouchableOpacity style={styles.addAnnotationButton} onPress={handleAddAnnotation}>
            <Text style={styles.addAnnotationButtonText}>Add Annotation</Text>
          </TouchableOpacity>

          {selectedFile.annotations.length > 0 && (
            <View style={styles.annotationsList}>
              <Text style={styles.annotationsListTitle}>Current Annotations:</Text>
              {selectedFile.annotations.map((ann, idx) => (
                <View key={idx} style={styles.annotationItem}>
                  <Text style={styles.annotationItemText}>
                    Lines {ann.lineStart}-{ann.lineEnd}: {ann.note}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveAnnotation(idx)}>
                    <Text style={styles.removeAnnotationButton}>×</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>File Annotations</Text>
        <TouchableOpacity style={styles.addButton} onPress={handlePickFile}>
          <Text style={styles.addButtonText}>+ Add File</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessionAnnotations}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.filePath}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No annotated files</Text>
            <Text style={styles.emptySubtext}>Add files and annotate them</Text>
          </View>
        }
      />

      {sessionAnnotations.length > 0 && (
        <View style={styles.sendContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Message to send with annotations..."
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendAnnotatedFiles}>
            <Text style={styles.sendButtonText}>Send All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  fileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
    flex: 1,
  },
  removeButton: {
    fontSize: 28,
    color: '#FF3B30',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  annotationCount: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  sendContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    minHeight: 60,
  },
  sendButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  fileViewContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  fileViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
    minWidth: 60,
  },
  fileViewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  placeholder: {
    minWidth: 60,
  },
  codeContainer: {
    flex: 1,
    padding: 12,
  },
  codeLine: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  annotatedLine: {
    backgroundColor: '#2d4a5a',
  },
  lineNumber: {
    color: '#858585',
    fontFamily: 'monospace',
    fontSize: 12,
    width: 40,
    textAlign: 'right',
    marginRight: 12,
  },
  lineContent: {
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  annotationBox: {
    backgroundColor: '#3d3d3d',
    padding: 8,
    marginLeft: 52,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#569cd6',
  },
  annotationNote: {
    color: '#569cd6',
    fontSize: 12,
    fontStyle: 'italic',
  },
  annotationForm: {
    backgroundColor: '#2d2d2d',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#3d3d3d',
  },
  formTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  lineInput: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    borderWidth: 1,
    borderColor: '#3d3d3d',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    width: 70,
  },
  lineSeparator: {
    color: '#858585',
    marginHorizontal: 8,
  },
  noteInput: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    borderWidth: 1,
    borderColor: '#3d3d3d',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    minHeight: 60,
  },
  addAnnotationButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  addAnnotationButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  annotationsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3d3d3d',
  },
  annotationsListTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  annotationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d3d3d',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  annotationItemText: {
    color: '#d4d4d4',
    fontSize: 12,
    flex: 1,
  },
  removeAnnotationButton: {
    color: '#FF3B30',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
});
