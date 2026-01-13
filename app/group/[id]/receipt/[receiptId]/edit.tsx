/**
 * Receipt Edit Screen
 *
 * Allows editing of receipt metadata and items.
 * Used for correcting OCR errors or adding items manually.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../../../../lib/theme';
import { Button, Input, Card } from '../../../../../components/ui';
import { useReceipt, useReceiptUpdate, useItemExpansion } from '../../../../../lib/useReceipts';
import {
  formatReceiptAmount,
  canExpandItem,
  isHiddenExpandedParent,
} from '../../../../../lib/receipts';
import { ReceiptItem } from '../../../../../lib/types';

export default function ReceiptEditScreen() {
  const { id, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();

  const { receipt, items, loading, error, refetch } = useReceipt(receiptId);
  const { updateReceipt, updateItem, deleteItem, addItem, updating } = useReceiptUpdate();
  const { expandItem, collapseItems, canExpand, expanding } = useItemExpansion(receiptId);

  // Form state
  const [merchantName, setMerchantName] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');

  // Item editing
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');

  // New item
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Initialize form state when receipt loads
  useEffect(() => {
    if (receipt) {
      setMerchantName(receipt.merchant_name || '');
      setReceiptDate(receipt.receipt_date || '');
      setTaxAmount(receipt.tax_amount?.toString() || '');
      setTipAmount(receipt.tip_amount?.toString() || '');
    }
  }, [receipt]);

  // Filter to regular items only (exclude tax, tip, subtotal, total, discount, service charges, modifiers, and hidden expanded parents)
  const regularItems = items.filter(
    (item) =>
      !item.is_tax &&
      !item.is_tip &&
      !item.is_subtotal &&
      !item.is_total &&
      !item.is_discount &&
      !item.is_service_charge &&
      !item.is_modifier &&
      !isHiddenExpandedParent(item)
  );

  // P0: Handle expanding multi-quantity items
  const handleExpandItem = async (item: ReceiptItem) => {
    const result = await expandItem(item.id);
    if (result.success) {
      refetch();
      Alert.alert(
        'Item Expanded',
        `"${item.description}" has been split into ${result.expandedCount} individual items.`
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to expand item');
    }
  };

  // P0: Handle collapsing expanded items back to original
  const handleCollapseItems = async (originalItemId: string) => {
    const result = await collapseItems(originalItemId);
    if (result.success) {
      refetch();
      Alert.alert('Items Collapsed', 'Items have been merged back together.');
    } else {
      Alert.alert('Error', result.error || 'Failed to collapse items');
    }
  };

  const handleSaveMetadata = async () => {
    if (!receiptId) return;

    const result = await updateReceipt(receiptId, {
      merchant_name: merchantName.trim() || null,
      receipt_date: receiptDate || null,
      tax_amount: taxAmount ? parseFloat(taxAmount) : null,
      tip_amount: tipAmount ? parseFloat(tipAmount) : null,
    });

    if (result.success) {
      Alert.alert('Success', 'Receipt updated');
      refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to update receipt');
    }
  };

  const handleStartEditItem = (item: ReceiptItem) => {
    setEditingItem(item.id);
    setEditItemDescription(item.description);
    setEditItemPrice(item.total_price.toString());
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;

    const price = parseFloat(editItemPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }

    if (!editItemDescription.trim()) {
      Alert.alert('Invalid Description', 'Please enter a description');
      return;
    }

    const result = await updateItem(editingItem, {
      description: editItemDescription.trim(),
      total_price: price,
    });

    if (result.success) {
      setEditingItem(null);
      refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteItem(itemId);
          if (result.success) {
            refetch();
          } else {
            Alert.alert('Error', result.error || 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleAddItem = async () => {
    if (!receiptId) return;

    const price = parseFloat(newItemPrice);
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }

    if (!newItemDescription.trim()) {
      Alert.alert('Invalid Description', 'Please enter a description');
      return;
    }

    const result = await addItem(receiptId, {
      description: newItemDescription.trim(),
      quantity: 1,
      total_price: price,
    });

    if (result.success) {
      setShowAddItem(false);
      setNewItemDescription('');
      setNewItemPrice('');
      refetch();
    } else {
      Alert.alert('Error', result.error || 'Failed to add item');
    }
  };

  // Calculate totals
  const subtotal = regularItems.reduce((sum, item) => sum + item.total_price, 0);
  const tax = parseFloat(taxAmount) || 0;
  const tip = parseFloat(tipAmount) || 0;
  const total = subtotal + tax + tip;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Receipt</Text>
          <Text style={styles.errorText}>{error || 'Receipt not found'}</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Metadata Section */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Details</Text>

            <Input
              label="Merchant Name"
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="e.g., Joe's Diner"
              containerStyle={styles.input}
            />

            <Input
              label="Date (YYYY-MM-DD)"
              value={receiptDate}
              onChangeText={setReceiptDate}
              placeholder="e.g., 2026-01-10"
              containerStyle={styles.input}
            />

            <View style={styles.row}>
              <Input
                label="Tax"
                value={taxAmount}
                onChangeText={setTaxAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                containerStyle={[styles.input, styles.halfInput]}
              />
              <Input
                label="Tip"
                value={tipAmount}
                onChangeText={setTipAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                containerStyle={[styles.input, styles.halfInput]}
              />
            </View>

            <Button
              title="Save Details"
              onPress={handleSaveMetadata}
              loading={updating}
              variant="secondary"
              style={styles.saveButton}
            />
          </Card>

          {/* Items Section */}
          <View style={styles.itemsHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddItem(true)}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Add Item Form */}
          {showAddItem && (
            <Card style={styles.addItemCard}>
              <Text style={styles.addItemTitle}>New Item</Text>
              <Input
                value={newItemDescription}
                onChangeText={setNewItemDescription}
                placeholder="Item description"
                containerStyle={styles.input}
              />
              <Input
                value={newItemPrice}
                onChangeText={setNewItemPrice}
                placeholder="Price"
                keyboardType="decimal-pad"
                containerStyle={styles.input}
              />
              <View style={styles.addItemActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => {
                    setShowAddItem(false);
                    setNewItemDescription('');
                    setNewItemPrice('');
                  }}
                  style={styles.addItemButton}
                />
                <Button
                  title="Add"
                  onPress={handleAddItem}
                  loading={updating}
                  style={styles.addItemButton}
                />
              </View>
            </Card>
          )}

          {/* Items List */}
          {regularItems.map((item) => {
            // P0: Check if this item is expandable
            const isExpandable = canExpandItem(item);
            // P0: Check if this is an expanded item
            const isExpanded = item.is_expansion;
            // P1: Get modifiers for this item
            const itemModifiers = items.filter((mod) => mod.parent_item_id === item.id);

            return (
              <View key={item.id}>
                {editingItem === item.id ? (
                  <Card style={styles.editItemCard}>
                    <Input
                      value={editItemDescription}
                      onChangeText={setEditItemDescription}
                      placeholder="Item description"
                      containerStyle={styles.input}
                    />
                    <Input
                      value={editItemPrice}
                      onChangeText={setEditItemPrice}
                      placeholder="Price"
                      keyboardType="decimal-pad"
                      containerStyle={styles.input}
                    />
                    <View style={styles.editItemActions}>
                      <Button
                        title="Cancel"
                        variant="secondary"
                        onPress={() => setEditingItem(null)}
                        style={styles.editItemButton}
                      />
                      <Button
                        title="Save"
                        onPress={handleSaveItem}
                        loading={updating}
                        style={styles.editItemButton}
                      />
                    </View>
                  </Card>
                ) : (
                  <View style={[styles.itemCard, isExpanded && styles.itemCardExpanded]}>
                    <View style={styles.itemContent}>
                      <View style={styles.itemDescriptionContainer}>
                        {/* Quantity badge for multi-quantity items */}
                        {item.quantity > 1 && (
                          <Text style={styles.quantityBadge}>{item.quantity}x</Text>
                        )}
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>
                        {formatReceiptAmount(item.total_price, receipt.currency)}
                      </Text>
                    </View>

                    {/* P1: Show modifiers */}
                    {itemModifiers.length > 0 && (
                      <View style={styles.modifiersContainer}>
                        {itemModifiers.map((mod) => (
                          <Text key={mod.id} style={styles.modifierText}>
                            + {mod.description} ({formatReceiptAmount(mod.total_price, receipt.currency)})
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* P0: Show shared/expanded indicators */}
                    {(item.is_likely_shared || isExpanded) && (
                      <View style={styles.itemBadges}>
                        {item.is_likely_shared && (
                          <View style={styles.sharedBadge}>
                            <Ionicons name="people" size={12} color={colors.primary} />
                            <Text style={styles.badgeText}>Shared</Text>
                          </View>
                        )}
                        {isExpanded && (
                          <View style={styles.expandedBadge}>
                            <Ionicons name="git-branch-outline" size={12} color={colors.textSecondary} />
                            <Text style={styles.badgeTextMuted}>Expanded</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={styles.itemActions}>
                      {/* P0: Expand button for multi-quantity items */}
                      {isExpandable && (
                        <TouchableOpacity
                          style={styles.itemActionButton}
                          onPress={() => handleExpandItem(item)}
                          disabled={expanding}
                        >
                          <Ionicons name="layers-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleStartEditItem(item)}
                      >
                        <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.itemActionButton}
                        onPress={() => handleDeleteItem(item.id)}
                      >
                        <Ionicons name="trash" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {regularItems.length === 0 && !showAddItem && (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No items yet</Text>
              <Text style={styles.emptySubtext}>
                Add items manually or re-scan the receipt
              </Text>
            </Card>
          )}

          {/* Totals Summary */}
          <Card style={styles.totalsCard}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                {formatReceiptAmount(subtotal, receipt.currency)}
              </Text>
            </View>
            {tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>
                  {formatReceiptAmount(tax, receipt.currency)}
                </Text>
              </View>
            )}
            {tip > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tip</Text>
                <Text style={styles.totalValue}>
                  {formatReceiptAmount(tip, receipt.currency)}
                </Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatReceiptAmount(total, receipt.currency)}
              </Text>
            </View>
          </Card>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Done Editing"
            onPress={() => router.replace(`/group/${id}/receipt/${receiptId}`)}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  addItemCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  addItemTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.md,
  },
  addItemActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  addItemButton: {
    flex: 1,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  itemCardExpanded: {
    backgroundColor: colors.borderLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.textSecondary,
  },
  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemDescriptionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: spacing.md,
  },
  quantityBadge: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },
  itemDescription: {
    ...typography.body,
    flex: 1,
  },
  itemPrice: {
    ...typography.bodyMedium,
  },
  modifiersContainer: {
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  modifierText: {
    ...typography.small,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  itemBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  expandedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary,
  },
  badgeTextMuted: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  itemActionButton: {
    padding: spacing.sm,
  },
  editItemCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.primaryLight,
  },
  editItemActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editItemButton: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  totalsCard: {
    marginTop: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.body,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  grandTotalLabel: {
    ...typography.h3,
  },
  grandTotalValue: {
    ...typography.h3,
    color: colors.primary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});
