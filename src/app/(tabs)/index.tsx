import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getLocalShoots,
  type LocalShootSummary,
} from '@/lib/local-shoots';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#69747D',
};

function formatUpdatedAt(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HomeScreen() {
  const [shoots, setShoots] = useState<LocalShootSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadShoots = useCallback(async (refreshing = false) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const savedShoots = await getLocalShoots();

      setShoots(savedShoots);
      setLoadError(null);
    } catch (error) {
      console.error(error);
      setLoadError('Saved shoots could not be loaded.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadShoots();
    }, [loadShoots]),
  );

  const openShoot = (shootId: string) => {
    router.push({
      pathname: '/shoot-media',
      params: { shootId },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        contentContainerStyle={[
          styles.content,
          shoots.length === 0 && styles.emptyContent,
        ]}
        data={shoots}
        keyExtractor={(shoot) => shoot.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadShoots(true)}
            tintColor={colors.gold}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>PICCHUSPOT</Text>

            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Shoots</Text>
                <Text style={styles.subtitle}>
                  Capture and organize each property, even when you are offline.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a new shoot"
                onPress={() => router.push('/new-shoot')}
                style={({ pressed }) => [
                  styles.newShootButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.newShootPlus}>+</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Saved locally</Text>
              {shoots.length > 0 && (
                <Text style={styles.sectionCount}>{shoots.length}</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.gold} size="large" />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {loadError ? 'Could not load shoots' : 'Your first shoot starts here'}
              </Text>
              <Text style={styles.emptyText}>
                {loadError
                  ? loadError
                  : 'Create a property shoot, then import photos that stay available on this device.'}
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={
                  loadError
                    ? () => void loadShoots()
                    : () => router.push('/new-shoot')
                }
                style={({ pressed }) => [
                  styles.emptyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.emptyButtonText}>
                  {loadError ? 'Try Again' : 'New Shoot'}
                </Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.propertyName}, ${item.photoCount} ${item.photoCount === 1 ? 'photo' : 'photos'}`}
            onPress={() => openShoot(item.id)}
            style={({ pressed }) => [
              styles.shootRow,
              pressed && styles.shootRowPressed,
            ]}
          >
            <View style={styles.thumbnail}>
              {item.coverPhotoUri ? (
                <Image
                  resizeMode="cover"
                  source={{ uri: item.coverPhotoUri }}
                  style={styles.thumbnailImage}
                />
              ) : (
                <Text style={styles.thumbnailPlaceholder}>PS</Text>
              )}
            </View>

            <View style={styles.shootDetails}>
              <Text numberOfLines={1} style={styles.shootName}>
                {item.propertyName}
              </Text>
              {!!item.address && (
                <Text numberOfLines={1} style={styles.address}>
                  {item.address}
                </Text>
              )}
              <Text style={styles.metadata}>
                {item.photoCount} {item.photoCount === 1 ? 'photo' : 'photos'} · Updated{' '}
                {formatUpdatedAt(item.updatedAt)}
              </Text>
            </View>

            <Text accessibilityElementsHidden style={styles.rowArrow}>
              ›
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 28,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  titleRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    color: colors.navy,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 10,
    maxWidth: 330,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  newShootButton: {
    width: 56,
    height: 56,
    marginTop: 4,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  newShootPlus: {
    marginTop: -2,
    color: colors.white,
    fontSize: 31,
    fontWeight: '300',
  },
  pressed: {
    opacity: 0.86,
  },
  sectionHeading: {
    marginTop: 44,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    minHeight: 300,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    maxWidth: 300,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyButton: {
    minWidth: 150,
    height: 52,
    marginTop: 24,
    paddingHorizontal: 22,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  shootRow: {
    minHeight: 106,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shootRowPressed: {
    backgroundColor: '#FBF9F6',
  },
  thumbnail: {
    width: 82,
    height: 72,
    overflow: 'hidden',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shootDetails: {
    flex: 1,
    marginLeft: 15,
  },
  shootName: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  address: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
  metadata: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowArrow: {
    marginLeft: 10,
    color: colors.navy,
    fontSize: 28,
    fontWeight: '300',
  },
});
