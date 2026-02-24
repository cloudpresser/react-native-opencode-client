import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { ChatQuestion } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface QuestionDisplayProps {
  question: ChatQuestion;
  /** Called with an array of selected option labels (or custom text entries) */
  onAnswer: (selectedLabels: string[]) => void;
  answered?: boolean;
}

export default function QuestionDisplay({ question, onAnswer, answered = false }: QuestionDisplayProps) {
  const colors = useThemeColors();
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isDisabled = answered || submitted;

  const handleToggleOption = (label: string) => {
    if (isDisabled) return;

    if (question.multiple) {
      // Multi-select: toggle the option in/out of the set
      setSelectedOptions((prev) => {
        const next = new Set(prev);
        if (next.has(label)) {
          next.delete(label);
        } else {
          next.add(label);
        }
        return next;
      });
    } else {
      // Single-select: pick immediately and submit
      setSubmitted(true);
      onAnswer([label]);
    }
  };

  const handleSubmitMultiple = () => {
    if (isDisabled) return;
    const labels = Array.from(selectedOptions);
    if (labels.length === 0 && !customText.trim()) return;

    const answers = [...labels];
    if (customText.trim()) {
      answers.push(customText.trim());
    }
    setSubmitted(true);
    onAnswer(answers);
  };

  const handleSubmitCustomOnly = () => {
    if (isDisabled || !customText.trim()) return;
    setSubmitted(true);
    onAnswer([customText.trim()]);
  };

  const hasOptions = question.options && question.options.length > 0;

  return (
    <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
      {/* Header */}
      {question.header ? (
        <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">
          {question.header}
        </Text>
      ) : null}

      {/* Question text */}
      <Text className="text-text font-medium mb-3">{question.question}</Text>

      {/* Options list */}
      {hasOptions && (
        <View className="mb-2">
          {question.options.map((opt) => {
            const isSelected = selectedOptions.has(opt.label);
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => handleToggleOption(opt.label)}
                disabled={isDisabled}
                className={`p-3 rounded-md border mb-2 ${
                  isSelected
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border'
                } ${isDisabled && !isSelected ? 'opacity-50' : ''}`}
              >
                <Text
                  className={`${
                    isSelected ? 'text-primary' : 'text-text'
                  } font-medium`}
                >
                  {opt.label}
                </Text>
                {opt.description ? (
                  <Text className="text-text-subtle text-xs mt-0.5">
                    {opt.description}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Custom text input - always available for "Other" option */}
      <TouchableOpacity
        onPress={() => {
          // In single-select mode with options, allow clicking to submit custom text
          if (!question.multiple && hasOptions && customText.trim()) {
            handleSubmitCustomOnly();
          }
        }}
        disabled={isDisabled || !customText.trim() || question.multiple || !hasOptions}
        activeOpacity={!question.multiple && hasOptions && customText.trim() ? 0.7 : 1}
        className={`p-3 rounded-md border mb-2 ${
          customText.trim()
            ? 'bg-primary/10 border-primary'
            : 'bg-surface border-border'
        } ${isDisabled && !customText.trim() ? 'opacity-50' : ''}`}
      >
        <TextInput
          value={customText}
          onChangeText={setCustomText}
          editable={!isDisabled}
          placeholder="Other (type your answer)..."
          placeholderTextColor={colors.textSubtle}
          className={`${customText.trim() ? 'text-primary' : 'text-text'} font-medium`}
          onSubmitEditing={hasOptions && question.multiple ? handleSubmitMultiple : handleSubmitCustomOnly}
          returnKeyType="send"
        />
      </TouchableOpacity>

      {/* Submit button for multi-select mode */}
      {question.multiple && hasOptions && (
        <TouchableOpacity
          onPress={handleSubmitMultiple}
          disabled={isDisabled || (selectedOptions.size === 0 && !customText.trim())}
          className={`px-4 py-2 rounded-md bg-primary self-end ${
            isDisabled || (selectedOptions.size === 0 && !customText.trim()) ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-on-primary font-medium">Confirm</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
