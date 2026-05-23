import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { ChatQuestion } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface QuestionDisplayProps {
  questions: ChatQuestion[];
  onAnswer: (answers: string[][]) => void;
  answered?: boolean;
}

export default function QuestionDisplay({ questions, onAnswer, answered = false }: QuestionDisplayProps) {
  const colors = useThemeColors();
  const [selectedOptions, setSelectedOptions] = useState<string[][]>(() => questions.map(() => []));
  const [customTexts, setCustomTexts] = useState<string[]>(() => questions.map(() => ''));
  const [submitted, setSubmitted] = useState(false);

  const isDisabled = answered || submitted;

  const answers = useMemo(
    () => questions.map((question, index) => {
      const values = [...selectedOptions[index]];
      const customText = customTexts[index]?.trim();
      if (question.custom && customText) {
        values.push(customText);
      }
      return values;
    }),
    [customTexts, questions, selectedOptions],
  );

  const hasAnyAnswer = answers.some((value) => value.length > 0);

  const toggleOption = (questionIndex: number, label: string) => {
    if (isDisabled) return;

    setSelectedOptions((prev) => {
      const next = [...prev];
      const current = new Set(next[questionIndex] || []);

      if (questions[questionIndex].multiple) {
        if (current.has(label)) {
          current.delete(label);
        } else {
          current.add(label);
        }
        next[questionIndex] = Array.from(current);
      } else {
        next[questionIndex] = [label];
      }

      return next;
    });
  };

  const updateCustomText = (questionIndex: number, value: string) => {
    if (isDisabled) return;

    setCustomTexts((prev) => {
      const next = [...prev];
      next[questionIndex] = value;
      return next;
    });
  };

  const handleSubmit = () => {
    if (isDisabled || !hasAnyAnswer) return;
    setSubmitted(true);
    onAnswer(answers);
  };

  return (
    <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
      {questions.map((question, questionIndex) => {
        const hasOptions = question.options && question.options.length > 0;
        const selected = new Set(selectedOptions[questionIndex] || []);
        const customText = customTexts[questionIndex] || '';

        return (
          <View key={`${question.requestId}-${questionIndex}`} className={questionIndex > 0 ? 'mt-4 pt-4 border-t border-border' : ''}>
            {question.header ? (
              <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">
                {question.header}
              </Text>
            ) : null}

            {questions.length > 1 ? (
              <Text className="text-text-subtle text-xs mb-1">Question {questionIndex + 1}</Text>
            ) : null}

            <Text className="text-text font-medium mb-3">{question.question}</Text>

            {hasOptions && (
              <View className="mb-2">
                {question.options.map((opt) => {
                  const isSelected = selected.has(opt.label);
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      onPress={() => toggleOption(questionIndex, opt.label)}
                      disabled={isDisabled}
                      className={`p-3 rounded-md border mb-2 ${
                        isSelected ? 'bg-primary/10 border-primary' : 'bg-surface border-border'
                      } ${isDisabled && !isSelected ? 'opacity-50' : ''}`}
                    >
                      <Text className={`${isSelected ? 'text-primary' : 'text-text'} font-medium`}>
                        {opt.label}
                      </Text>
                      {opt.description ? (
                        <Text className="text-text-subtle text-xs mt-0.5">{opt.description}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {question.custom ? (
              <View className={`p-3 rounded-md border ${customText.trim() ? 'bg-primary/10 border-primary' : 'bg-surface border-border'}`}>
                <TextInput
                  value={customText}
                  onChangeText={(value) => updateCustomText(questionIndex, value)}
                  editable={!isDisabled}
                  placeholder="Type your answer..."
                  placeholderTextColor={colors.textSubtle}
                  className={`${customText.trim() ? 'text-primary' : 'text-text'} font-medium`}
                  returnKeyType="done"
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isDisabled || !hasAnyAnswer}
        className={`px-4 py-3 rounded-md bg-primary self-end mt-4 ${
          isDisabled || !hasAnyAnswer ? 'opacity-50' : ''
        }`}
      >
        <Text className="text-on-primary font-medium">Confirm</Text>
      </TouchableOpacity>
    </View>
  );
}
