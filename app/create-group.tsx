import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { generateShareCode } from '../lib/utils';
import { colors, spacing, typography, borderRadius } from '../lib/theme';
import { Button, Input, Card } from '../components/ui';

const EMOJIS = ['💰', '🏠', '✈️', '🍕', '🎉', '👥', '💳', '🛒', '🎬', '⛽', '🏖️', '🎮'];

export default function CreateGroupScreen() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const shareCode = generateShareCode();

      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          emoji,
          share_code: shareCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as first member (using "You" as default name)
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          group_id: group.id,
          name: 'You',
        });

      if (memberError) throw memberError;

      router.replace(`/group/${group.id}`);
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Group Name</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g., Vacation 2025, Roommates"
            autoFocus
            error={error}
          />

          <Text style={[styles.sectionTitle, styles.emojiTitle]}>Icon</Text>
          <View style={styles.emojiGrid}>
            {EMOJIS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[
                  styles.emojiButton,
                  emoji === e && styles.emojiButtonSelected,
                ]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card style={styles.preview}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewEmoji}>{emoji}</Text>
              <Text style={styles.previewName}>
                {name.trim() || 'Your Group'}
              </Text>
            </View>
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Create Group"
            onPress={handleCreate}
            loading={loading}
            disabled={!name.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  emojiTitle: {
    marginTop: spacing.xl,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  emojiButton: {
    width: 56,
    height: 56,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  emojiText: {
    fontSize: 28,
  },
  preview: {
    marginTop: spacing.xl,
  },
  previewLabel: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  previewName: {
    ...typography.h3,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
