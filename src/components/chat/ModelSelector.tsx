import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Provider, Model } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ModelSelectorProps {
  providers: Provider[];
  connectedProviders: string[];
  defaultModelId?: string;
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  loading?: boolean;
}

export default function ModelSelector({
  providers,
  connectedProviders,
  defaultModelId,
  selectedModelId,
  onSelectModel,
  loading = false,
}: ModelSelectorProps) {
  const colors = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const hasInitialized = useRef(false);

  // Auto-expand connected providers initially
  useEffect(() => {
    if (providers.length > 0 && !hasInitialized.current) {
      const initialExpanded: Record<string, boolean> = {};
      providers.forEach(p => {
        if (connectedProviders.includes(p.id)) {
          initialExpanded[p.id] = true;
        }
      });
      setExpandedProviders(initialExpanded);
      hasInitialized.current = true;
    }
  }, [providers, connectedProviders]);

  const toggleProvider = (providerId: string) => {
    setExpandedProviders(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  // Only show providers that have auth configured (i.e. are connected)
  const connectedProviderList = useMemo(() => {
    return providers.filter(p => connectedProviders.includes(p.id));
  }, [providers, connectedProviders]);

  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return connectedProviderList;
    
    const query = searchQuery.toLowerCase();
    return connectedProviderList.map(provider => {
      const modelsMap = provider.models || {};
      const filteredModels = Object.values(modelsMap).filter(
        model => (model.name || '').toLowerCase().includes(query) || (model.id || '').toLowerCase().includes(query)
      );
      
      return {
        ...provider,
        models: filteredModels.reduce((acc, model) => {
          if (model.id) {
            acc[model.id] = model;
          }
          return acc;
        }, {} as Record<string, Model>)
      };
    }).filter(p => Object.keys(p.models || {}).length > 0 || (p.name || '').toLowerCase().includes(query));
  }, [connectedProviderList, searchQuery]);

  // Find the display name of the selected model
  const selectedModelName = useMemo(() => {
    if (!selectedModelId || typeof selectedModelId !== 'string') return 'Select Model';
    for (const p of providers) {
      if (p.models && p.models[selectedModelId]) {
        return p.models[selectedModelId].name;
      }
    }
    return selectedModelId.split('/').pop() || selectedModelId;
  }, [selectedModelId, providers]);

  const maxScrollHeight = Dimensions.get('window').height * 0.5;

  return (
    <>
      <View className="flex-row items-center px-3 pt-2 pb-1">
        <Text className="text-text-subtle text-xs mr-2">Model:</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : providers.length > 0 ? (
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            className="flex-row items-center bg-surface-elevated px-2.5 py-1 rounded-full border border-border flex-shrink"
          >
            <Text className="text-text text-xs font-medium" numberOfLines={1} ellipsizeMode="tail">
              {selectedModelName}
            </Text>
            <Text className="text-text-muted text-[10px] ml-1">▼</Text>
          </TouchableOpacity>
        ) : (
          <Text className="text-text-subtle text-xs">No models available</Text>
        )}
      </View>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            className="flex-1 bg-overlay justify-end"
            onPress={() => setShowPicker(false)}
          >
            <Pressable onPress={() => {/* stop propagation — prevent dismiss when tapping content */}}>
              <View className="bg-surface rounded-t-2xl p-4 pb-8">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-text font-semibold text-base">Select Model</Text>
                  <TouchableOpacity onPress={() => setShowPicker(false)}>
                    <Text className="text-text-muted text-xl">×</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  className="border border-border rounded-lg px-3 py-2 text-text mb-4 bg-background"
                  placeholder="Search models..."
                  placeholderTextColor={colors.textSubtle}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />

                <ScrollView style={{ maxHeight: maxScrollHeight }}>
                  {filteredProviders.map(provider => {
                    const modelEntries = Object.values(provider.models || {});
                    if (modelEntries.length === 0) return null;
                    
                    const isExpanded = expandedProviders[provider.id] || searchQuery.length > 0;
                    
                    return (
                      <View key={provider.id} className="mb-2">
                        <TouchableOpacity
                          className="flex-row justify-between items-center bg-surface-elevated p-3 rounded-lg"
                          onPress={() => toggleProvider(provider.id)}
                        >
                      <Text className="text-text font-medium">{provider.name}</Text>
                          <Text className="text-text-muted">{isExpanded ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View className="mt-1 ml-2">
                            {modelEntries.map(model => {
                              const isSelected = selectedModelId === model.id;
                              const isDefault = defaultModelId === model.id;
                              
                              return (
                                <TouchableOpacity
                                  key={model.id}
                                  className={`flex-row items-center justify-between p-3 rounded-lg mb-1 ${isSelected ? 'bg-primary/10 border border-primary' : 'border border-transparent'}`}
                                  onPress={() => {
                                    onSelectModel(model.id);
                                    setShowPicker(false);
                                  }}
                                >
                                  <View className="flex-1">
                                    <View className="flex-row items-center">
                                      <Text className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-text'}`}>
                                        {model.name}
                                      </Text>
                                      {isDefault && (
                                        <Text className="text-[10px] text-info ml-2 border border-info px-1 rounded">Default</Text>
                                      )}
                                    </View>
                                    {model.family && (
                                      <Text className="text-text-subtle text-xs mt-0.5">{model.family}</Text>
                                    )}
                                  </View>
                                  {isSelected && (
                                    <Text className="text-primary text-sm">✓</Text>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {filteredProviders.length === 0 && (
                    <Text className="text-text-muted text-center py-4">No models found</Text>
                  )}
                </ScrollView>


              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}