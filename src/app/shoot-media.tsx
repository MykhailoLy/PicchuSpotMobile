import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#69747D',
};

type LocalMedia = {
  id: string;
  uri: string;
  fileName: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: string;
};

type ShootManifest = {
  id: string;
  propertyName: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  media: LocalMedia[];
};

function createMediaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getExtension(asset: ImagePicker.ImagePickerAsset) {
  const fileNameExtension = asset.fileName
    ?.split('.')
    .pop()
    ?.toLowerCase();

  if (
    fileNameExtension &&
    /^[a-z0-9]+$/i.test(fileNameExtension)
  ) {
    return fileNameExtension;
  }

  switch (asset.mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
}

export default function ShootMediaScreen() {
  const { shootId } = useLocalSearchParams<{
    shootId?: string;
  }>();

  const [shoot, setShoot] = useState<ShootManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const getPaths = useCallback(() => {
    if (!FileSystem.documentDirectory || !shootId) {
      return null;
    }

    const directory =
      `${FileSystem.documentDirectory}picchuspot/shoots/${shootId}/`;

    return {
      directory,
      manifest: `${directory}manifest.json`,
      mediaDirectory: `${directory}media/`,
    };
  }, [shootId]);

  const saveManifest = useCallback(
    async (nextShoot: ShootManifest) => {
      const paths = getPaths();

      if (!paths) {
        throw new Error('Shoot paths are unavailable.');
      }

      await FileSystem.writeAsStringAsync(
        paths.manifest,
        JSON.stringify(nextShoot, null, 2),
      );

      setShoot(nextShoot);
    },
    [getPaths],
  );

  const loadShoot = useCallback(async () => {
    const paths = getPaths();

    if (!paths) {
      setIsLoading(false);
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(paths.manifest);

      if (!info.exists) {
        throw new Error('Shoot manifest not found.');
      }

      const content = await FileSystem.readAsStringAsync(paths.manifest);

      const parsed = JSON.parse(content) as ShootManifest;

      setShoot(parsed);
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Shoot unavailable',
        'This local shoot could not be opened.',
        [
          {
            text: 'Back',
            onPress: () => router.back(),
          },
        ],
      );
    } finally {
      setIsLoading(false);
    }
  }, [getPaths]);

  useEffect(() => {
    void loadShoot();
  }, [loadShoot]);

  const handleImportPhotos = async () => {
    const paths = getPaths();

    if (!paths || !shoot || isImporting) {
      return;
    }

    setIsImporting(true);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 0,
        quality: 1,
        orderedSelection: true,
      });

      if (result.canceled) {
        return;
      }

      await FileSystem.makeDirectoryAsync(paths.mediaDirectory, {
        intermediates: true,
      });

      const imported: LocalMedia[] = [];

      for (let index = 0; index < result.assets.length; index += 1) {
        const asset = result.assets[index];

        const mediaId = createMediaId();
        const extension = getExtension(asset);

        const fileName =
          `photo-${Date.now()}-${index + 1}-${mediaId}.${extension}`;

        const destination = `${paths.mediaDirectory}${fileName}`;

        await FileSystem.copyAsync({
          from: asset.uri,
          to: destination,
        });

        imported.push({
          id: mediaId,
          uri: destination,
          fileName,
          mimeType: asset.mimeType ?? undefined,
          width: asset.width || undefined,
          height: asset.height || undefined,
          createdAt: new Date().toISOString(),
        });
      }

      const nextShoot: ShootManifest = {
        ...shoot,
        media: [...shoot.media, ...imported],
        updatedAt: new Date().toISOString(),
      };

      await saveManifest(nextShoot);
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Import failed',
        'The selected photos could not be saved. Please try again.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  const removePhoto = (media: LocalMedia) => {
    if (!shoot) {
      return;
    }

    Alert.alert(
      'Remove photo?',
      'This photo will be removed from this local shoot.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(media.uri, {
                idempotent: true,
              });

              const nextShoot: ShootManifest = {
                ...shoot,
                media: shoot.media.filter(
                  (item) => item.id !== media.id,
                ),
                updatedAt: new Date().toISOString(),
              };

              await saveManifest(nextShoot);
            } catch (error) {
              console.error(error);

              Alert.alert(
                'Could not remove photo',
                'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.gold} />
      </SafeAreaView>
    );
  }

  if (!shoot) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.errorText}>Shoot unavailable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>

          <Text style={styles.step}>NEW SHOOT</Text>

          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.intro}>
          <Text style={styles.propertyName}>
            {shoot.propertyName}
          </Text>

          {!!shoot.address && (
            <Text style={styles.address}>{shoot.address}</Text>
          )}

          <Text style={styles.title}>Add property photos</Text>

          <Text style={styles.subtitle}>
            Capture new photos on site or import images already saved on your
            device.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture photos"
            onPress={() =>
              Alert.alert(
                'Camera',
                'PicchuSpot camera capture is the next development step.',
              )
            }
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.actionText}>
              <Text style={styles.primaryActionTitle}>
                Capture Photos
              </Text>

              <Text style={styles.primaryActionDescription}>
                Use the PicchuSpot camera for this property.
              </Text>
            </View>

            <Text style={styles.primaryArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import photos"
            disabled={isImporting}
            onPress={handleImportPhotos}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && !isImporting && styles.pressed,
            ]}
          >
            <View style={styles.actionText}>
              <Text style={styles.secondaryActionTitle}>
                {isImporting ? 'Saving Photos…' : 'Import Photos'}
              </Text>

              <Text style={styles.secondaryActionDescription}>
                Choose existing images from your device.
              </Text>
            </View>

            {isImporting ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <Text style={styles.secondaryArrow}>›</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.galleryHeader}>
          <Text style={styles.galleryTitle}>
            Photos
          </Text>

          <Text style={styles.galleryCount}>
            {shoot.media.length}
          </Text>
        </View>

        {shoot.media.length === 0 ? (
          <View style={styles.emptyGallery}>
            <Text style={styles.emptyGalleryTitle}>
              No photos added
            </Text>

            <Text style={styles.emptyGalleryText}>
              Import photos from your device to add them to this shoot.
            </Text>
          </View>
        ) : (
          <View style={styles.gallery}>
            {shoot.media.map((media) => (
              <View key={media.id} style={styles.photoCard}>
                <Image
                  source={{ uri: media.uri }}
                  style={styles.photo}
                  resizeMode="cover"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  hitSlop={8}
                  onPress={() => removePhoto(media)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Stored locally</Text>

          <Text style={styles.noteText}>
            These photos are saved on this device. No upload has started yet.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  errorText: {
    color: colors.muted,
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 36,
    color: colors.navy,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '300',
  },
  step: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  topBarSpacer: {
    width: 36,
  },
  intro: {
    paddingTop: 28,
  },
  propertyName: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  address: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
  },
  title: {
    marginTop: 18,
    color: colors.navy,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 15,
    maxWidth: 350,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    marginTop: 36,
    gap: 14,
  },
  primaryAction: {
    minHeight: 96,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryAction: {
    minHeight: 96,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  actionText: {
    flex: 1,
    marginRight: 12,
  },
  primaryActionTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  primaryActionDescription: {
    marginTop: 5,
    color: '#C7CED3',
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryActionTitle: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryActionDescription: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryArrow: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '300',
  },
  secondaryArrow: {
    color: colors.navy,
    fontSize: 30,
    fontWeight: '300',
  },
  galleryHeader: {
    marginTop: 34,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryTitle: {
    color: colors.navy,
    fontSize: 19,
    fontWeight: '700',
  },
  galleryCount: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyGallery: {
    marginTop: 18,
    minHeight: 150,
    paddingHorizontal: 30,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGalleryTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyGalleryText: {
    marginTop: 7,
    maxWidth: 270,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  gallery: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoCard: {
    position: 'relative',
    width: '48%',
    aspectRatio: 1.25,
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: colors.ivory,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 26, 43, 0.82)',
  },
  removeButtonText: {
    marginTop: -2,
    color: colors.white,
    fontSize: 22,
    lineHeight: 24,
  },
  note: {
    marginTop: 30,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  noteTitle: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  noteText: {
    marginTop: 6,
    maxWidth: 345,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});