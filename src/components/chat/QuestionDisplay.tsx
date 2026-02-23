import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { ChatQuestion } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface QuestionDisplayProps {
  question: ChatQuestion;
  onAnswer: (answer: any) => void;
  answered?: boolean;
}

export default function QuestionDisplay({ question, onAnswer, answered = false }: QuestionDisplayProps) {
  const colors = useThemeColors();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState<string>('');

  const handleSelect = (option: string) => {
    if (answered) return;
    setSelectedOption(option);
    onAnswer(option);
  };

  const handleConfirm = (confirmed: boolean) => {
     if (answered) return;
     onAnswer(confirmed);
  }

  const handleTextSubmit = () => {
    if (answered || !textAnswer.trim()) return;
    onAnswer(textAnswer);
  };

  if (question.kind === 'confirm') {
    return (
      <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
        <Text className="text-text font-medium mb-3">{question.text}</Text>
        <View className="flex-row justify-end">
          <TouchableOpacity
            onPress={() => handleConfirm(false)}
            disabled={answered}
             className={`px-4 py-2 rounded-md mr-2 ${answered ? 'opacity-50' : ''} bg-surface border border-border`}
          >
            <Text className="text-text">No</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleConfirm(true)}
            disabled={answered}
            className={`px-4 py-2 rounded-md ${answered ? 'opacity-50' : ''} bg-primary`}
          >
            <Text className="text-on-primary">Yes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (question.kind === 'select' && question.options) {
    return (
      <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
        <Text className="text-text font-medium mb-3">{question.text}</Text>
        <View>
          {question.options.map((option, index) => (
            <TouchableOpacity
              key={option}
              onPress={() => handleSelect(option)}
              disabled={answered}
              className={`p-3 rounded-md border mb-2 ${
                selectedOption === option
                  ? 'bg-primary/10 border-primary'
                  : 'bg-surface border-border'
              } ${answered && selectedOption !== option ? 'opacity-50' : ''}`}
            >
              <Text
                className={`${
                  selectedOption === option ? 'text-primary' : 'text-text'
                } font-medium`}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  
  // Default to text input
  return (
    <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
      <Text className="text-text font-medium mb-3">{question.text}</Text>
      <View className="flex-row items-center">
        <TextInput
          value={textAnswer}
          onChangeText={setTextAnswer}
          editable={!answered}
          placeholder="Type your answer..."
          placeholderTextColor={colors.textSubtle}
          className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-text mr-2"
        />
        <TouchableOpacity
            onPress={handleTextSubmit}
            disabled={answered || !textAnswer.trim()}
             className={`px-4 py-2 rounded-md bg-primary justify-center ${answered || !textAnswer.trim() ? 'opacity-50' : ''}`}
        >
            <Text className="text-on-primary font-medium">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
