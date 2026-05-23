import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChatPermission } from '../../types';

interface PermissionDisplayProps {
  permission: ChatPermission;
  onReply: (reply: 'once' | 'always' | 'reject') => void;
  answered?: boolean;
}

export default function PermissionDisplay({ 
  permission, 
  onReply, 
  answered = false 
}: PermissionDisplayProps) {
  const [submitted, setSubmitted] = useState(false);

  const isDisabled = answered || submitted;

  const handleReply = (reply: 'once' | 'always' | 'reject') => {
    if (isDisabled) return;
    setSubmitted(true);
    onReply(reply);
  };

  return (
    <View className="bg-surface-elevated p-4 rounded-lg border border-border mt-2">
      {permission.type ? (
        <Text className="text-text-muted text-xs font-semibold uppercase tracking-wide mb-1">
          {permission.type.replace(/_/g, ' ')}
        </Text>
      ) : null}

      {/* Permission message */}
      <Text className="text-text font-medium mb-2">{permission.message}</Text>

      {/* Details (if provided) */}
      {permission.details ? (
        <Text className="text-text-subtle text-sm mb-3">{permission.details}</Text>
      ) : null}

      {permission.patterns && permission.patterns.length > 0 ? (
        <Text className="text-text-subtle text-xs mb-3">
          Allowed patterns: {permission.patterns.join(', ')}
        </Text>
      ) : null}

      {/* Action buttons */}
      <View className="flex-row gap-2 mt-2">
        <TouchableOpacity
          onPress={() => handleReply('once')}
          disabled={isDisabled}
          className={`flex-1 px-4 py-3 rounded-md bg-primary ${
            isDisabled ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-on-primary font-medium text-center">Once</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleReply('always')}
          disabled={isDisabled}
          className={`flex-1 px-4 py-3 rounded-md border border-border bg-surface ${
            isDisabled ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-text font-medium text-center">Always</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => handleReply('reject')}
        disabled={isDisabled}
        className={`px-4 py-3 rounded-md bg-danger mt-2 ${
          isDisabled ? 'opacity-50' : ''
        }`}
      >
        <Text className="text-on-primary font-medium text-center">Deny</Text>
      </TouchableOpacity>

      <Text className="text-text-subtle text-xs mt-3">
        Once approves just this request. Always remembers this pattern for future requests.
      </Text>
    </View>
  );
}
