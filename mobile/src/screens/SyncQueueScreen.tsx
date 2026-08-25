import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';
import { offlineQueue, QueuedAction } from '../services/offline-queue';

type Props = StackScreenProps<RootStackParamList, 'SyncQueue'>;

function QueueItem({ item }: { item: QueuedAction }) {
  const title = item.type.replace(/_/g, ' ');
  const detail = item.lastError ?? new Date(item.createdAt).toLocaleString();

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={[styles.status, styles[item.status]]}>{item.status}</Text>
      </View>
      <Text style={styles.itemDetail}>{detail}</Text>
      {item.status === 'failed' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => offlineQueue.retry(item.id)}>
            <Text style={styles.actionText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => offlineQueue.remove(item.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function SyncQueueScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<QueuedAction[]>([]);

  useEffect(() => offlineQueue.subscribe(setItems), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sync Queue</Text>
        <TouchableOpacity onPress={() => offlineQueue.process()}>
          <Text style={styles.sync}>Sync</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        renderItem={({ item }) => <QueueItem item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>No drafts are waiting to sync.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e8e0',
  },
  back: { color: '#2d6a2d', fontWeight: '600' },
  title: { color: '#1a3a1a', fontSize: 18, fontWeight: '700' },
  sync: { color: '#2d6a2d', fontWeight: '700' },
  list: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a3a1a', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#667' },
  item: { backgroundColor: '#fff', borderRadius: 8, padding: 14, gap: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontWeight: '700', color: '#1a3a1a' },
  itemDetail: { color: '#667', fontSize: 13 },
  status: { textTransform: 'uppercase', fontSize: 11, fontWeight: '800' },
  pending: { color: '#B45309' },
  processing: { color: '#2563EB' },
  failed: { color: '#DC2626' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#2d6a2d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: '#fff', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  deleteText: { color: '#DC2626', fontWeight: '700' },
});
