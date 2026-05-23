import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChatPermission } from '../../types';

interface PermissionDisplayProps {
  permission: ChatPermission;
  /** Called when user approves the permission */
  onApprove: () => void;
  /** Called when user denies the permission */
  onDeny: () => void;
  answered?: boolean;
}

export default function PermissionDisplay({ 
  permission, 
  onApprove, 
  onDeny, 
  answered = false 
}: PermissionDisplayProps) {
  const [submitted, setSubmitted] = useState(false);

  const isDisabled = answered || submitted;

  const handleApprove = () => {
    if (isDisabled) return;
    setSubmitted(true);
    onApprove();
  };

  const handleDeny = () => {
    if (isDisabled) return;
    setSubmitted(true);
    onDeny();
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
          onPress={handleDeny}
          disabled={isDisabled}
          className={`flex-1 px-4 py-3 rounded-md border border-border bg-surface ${
            isDisabled ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-text font-medium text-center">Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleApprove}
          disabled={isDisabled}
          className={`flex-1 px-4 py-3 rounded-md bg-primary ${
            isDisabled ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-on-primary font-medium text-center">Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
