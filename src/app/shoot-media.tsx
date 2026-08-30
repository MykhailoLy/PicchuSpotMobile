import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deletePersistedShootDirectory,
  deletePersistedShootImage,
  persistShootImage,
} from '@/lib/local-files';
import {
  addLocalShootAssets,
  deleteLocalShoot,
  getLocalShoot,
  getLocalShootAssets,
  removeLocalShootAsset,
  renameLocalShoot,
  restoreLocalShoot,
  restoreLocalShootAsset,
  type LocalShoot,
  type LocalShootAsset,
} from '@/lib/local-shoots';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#69747D',
  danger: '#A23B3B',
};

export default function ShootMediaScreen() {
  const { shootId: shootIdParam } = useLocalSearchParams<{
    shootId?: string;
  }>();
  const shootId = typeof shootIdParam === 'string' ? shootIdParam : null;

  const [shoot, setShoot] = useState<LocalShoot | null>(null);
  const [assets, setAssets] = useState<LocalShootAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadShoot = useCallback(async () => {
    if (!shootId) {
      throw new Error('Shoot identifier is unavailable.');
    }

    const [savedShoot, savedAssets] = await Promise.all([
      getLocalShoot(shootId),
      getLocalShootAssets(shootId),
    ]);

    if (!savedShoot) {
      throw new Error('Shoot not found.');
    }

    setShoot(savedShoot);
    setAssets(savedAssets);
  }, [shootId]);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        await loadShoot();
      } catch (error) {
        console.error(error);

        if (isActive) {
          Alert.alert(
            'Shoot unavailable',
            'This local shoot could not be opened.',
            [{ text: 'Back', onPress: () => router.back() }],
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isActive = false;
    };
  }, [loadShoot]);

  const handleImportPhotos = async () => {
    if (!shootId || !shoot || isImporting) {
      return;
    }

    setIsImporting(true);
    const copiedUris: string[] = [];
    let metadataCommitted = false;

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

      for (const selectedAsset of result.assets) {
        const uri = await persistShootImage(shootId, {
          uri: selectedAsset.uri,
          fileName: selectedAsset.fileName,
          mimeType: selectedAsset.mimeType,
        });

        copiedUris.push(uri);
      }

      const importedAssets = await addLocalShootAssets(
        shootId,
        result.assets.map((selectedAsset, index) => ({
          uri: copiedUris[index],
          originalFilename: selectedAsset.fileName,
          mimeType: selectedAsset.mimeType,
          width: selectedAsset.width || null,
          height: selectedAsset.height || null,
        })),
      );

      metadataCommitted = true;
      setAssets((currentAssets) => [...currentAssets, ...importedAssets]);
      setShoot((currentShoot) =>
        currentShoot
          ? { ...currentShoot, updatedAt: Date.now() }
          : currentShoot,
      );
    } catch (error) {
      console.error(error);

      if (!metadataCommitted) {
        for (const uri of copiedUris) {
          try {
            deletePersistedShootImage(shootId, uri);
          } catch (cleanupError) {
            console.error('Failed to clean up copied image:', cleanupError);
          }
        }
      }

      Alert.alert(
        'Import failed',
        'The selected photos could not be saved. Please try again.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleRemovePhoto = async (asset: LocalShootAsset) => {
    if (!shootId || removingAssetId) {
      return;
    }

    setRemovingAssetId(asset.id);

    try {
      const removedAsset = await removeLocalShootAsset(asset.id, shootId);

      if (!removedAsset) {
        await loadShoot();
        return;
      }

      try {
        deletePersistedShootImage(shootId, removedAsset.uri);
      } catch (fileError) {
        await restoreLocalShootAsset(removedAsset);
        throw fileError;
      }

      setAssets((currentAssets) =>
        currentAssets.filter((currentAsset) => currentAsset.id !== asset.id),
      );
      setShoot((currentShoot) =>
        currentShoot
          ? { ...currentShoot, updatedAt: Date.now() }
          : currentShoot,
      );
    } catch (error) {
      console.error(error);

      try {
        await loadShoot();
      } catch (reloadError) {
        console.error('Failed to reload shoot after removal error:', reloadError);
      }

      Alert.alert('Could not remove photo', 'Please try again.');
    } finally {
      setRemovingAssetId(null);
    }
  };

  const confirmRemovePhoto = (asset: LocalShootAsset, index: number) => {
    Alert.alert(
      'Remove photo?',
      `Photo ${index + 1} will be removed from this local shoot. Your original gallery photo will not be changed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void handleRemovePhoto(asset),
        },
      ],
    );
  };

  const beginRename = () => {
    if (!shoot) {
      return;
    }

    setRenameValue(shoot.propertyName);
    setIsRenaming(true);
  };

  const handleRename = async () => {
    if (!shootId || !renameValue.trim() || isSavingName) {
      return;
    }

    setIsSavingName(true);

    try {
      const renamedShoot = await renameLocalShoot(shootId, renameValue);

      setShoot(renamedShoot);
      setIsRenaming(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Could not rename shoot', 'Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteShoot = async () => {
    if (!shootId || isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const snapshot = await deleteLocalShoot(shootId);

      if (!snapshot) {
        router.dismissTo('/');
        return;
      }

      try {
        deletePersistedShootDirectory(shootId);
      } catch (fileError) {
        await restoreLocalShoot(snapshot);
        throw fileError;
      }

      router.dismissTo('/');
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Could not delete shoot',
        'The shoot was kept so you can try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteShoot = () => {
    if (!shoot) {
      return;
    }

    Alert.alert(
      `Delete “${shoot.propertyName}”?`,
      'This removes the shoot and PicchuSpot-owned copies of its photos from this device. Gallery originals are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Shoot',
          style: 'destructive',
          onPress: () => void handleDeleteShoot(),
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

  if (!shoot || !shootId) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.errorText}>Shoot unavailable.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to shoots"
              hitSlop={12}
              onPress={() => router.back()}
            >
              <Text style={styles.back}>‹</Text>
            </Pressable>

            <Text style={styles.step}>SHOOT GALLERY</Text>

            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.intro}>
            {isRenaming ? (
              <View style={styles.renamePanel}>
                <Text style={styles.renameLabel}>Shoot name</Text>
                <TextInput
                  accessibilityLabel="Shoot name"
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setRenameValue}
                  onSubmitEditing={() => void handleRename()}
                  returnKeyType="done"
                  style={styles.renameInput}
                  value={renameValue}
                />

                <View style={styles.renameActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSavingName}
                    onPress={() => setIsRenaming(false)}
                    style={({ pressed }) => [
                      styles.renameCancel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.renameCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    disabled={!renameValue.trim() || isSavingName}
                    onPress={() => void handleRename()}
                    style={({ pressed }) => [
                      styles.renameSave,
                      (!renameValue.trim() || isSavingName) &&
                        styles.renameSaveDisabled,
                      pressed && !isSavingName && styles.pressed,
                    ]}
                  >
                    <Text style={styles.renameSaveText}>
                      {isSavingName ? 'Saving…' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.propertyHeading}>
                <View style={styles.propertyCopy}>
                  <Text style={styles.propertyName}>{shoot.propertyName}</Text>
                  {!!shoot.address && (
                    <Text style={styles.address}>{shoot.address}</Text>
                  )}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rename shoot"
                  hitSlop={10}
                  onPress={beginRename}
                >
                  <Text style={styles.renameLink}>Rename</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.title}>Add property photos</Text>

            <Text style={styles.subtitle}>
              Import existing images now. Native PicchuSpot camera capture will
              be added in a later step.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Capture photos, coming soon"
              onPress={() =>
                Alert.alert(
                  'Camera coming soon',
                  'Native camera capture is not included in this local persistence update.',
                )
              }
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.actionText}>
                <Text style={styles.actionEyebrow}>COMING SOON</Text>
                <Text style={styles.primaryActionTitle}>Capture Photos</Text>
                <Text style={styles.primaryActionDescription}>
                  Use the PicchuSpot camera for this property.
                </Text>
              </View>

              <Text style={styles.primaryArrow}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Import photos from gallery"
              disabled={isImporting}
              onPress={() => void handleImportPhotos()}
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
                  Select multiple images in one gallery visit.
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
            <Text style={styles.galleryTitle}>Photos</Text>
            <Text style={styles.galleryCount}>{assets.length}</Text>
          </View>

          {assets.length === 0 ? (
            <View style={styles.emptyGallery}>
              <Text style={styles.emptyGalleryTitle}>No photos added</Text>
              <Text style={styles.emptyGalleryText}>
                Imported photos are copied to secure app storage on this device.
              </Text>
            </View>
          ) : (
            <View style={styles.gallery}>
              {assets.map((asset, index) => (
                <View key={asset.id} style={styles.photoCard}>
                  <Image
                    resizeMode="cover"
                    source={{ uri: asset.uri }}
                    style={styles.photo}
                  />

                  <View style={styles.photoNumber}>
                    <Text style={styles.photoNumberText}>{index + 1}</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    disabled={removingAssetId !== null}
                    hitSlop={8}
                    onPress={() => confirmRemovePhoto(asset, index)}
                    style={styles.removeButton}
                  >
                    {removingAssetId === asset.id ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.removeButtonText}>×</Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.note}>
            <Text style={styles.noteTitle}>Stored locally</Text>
            <Text style={styles.noteText}>
              These PicchuSpot-owned copies remain on this device across
              navigation and app restarts. No upload has started.
            </Text>
          </View>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Delete this shoot</Text>
            <Text style={styles.dangerText}>
              Removes this local shoot and only the copies stored inside its
              PicchuSpot folder.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={confirmDeleteShoot}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && !isDeleting && styles.pressed,
              ]}
            >
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting…' : 'Delete Shoot'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    paddingBottom: 52,
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
    paddingTop: 24,
  },
  propertyHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  propertyCopy: {
    flex: 1,
  },
  propertyName: {
    color: colors.navy,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  address: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  renameLink: {
    paddingTop: 6,
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  renamePanel: {
    padding: 17,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: '#FBF9F6',
  },
  renameLabel: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  renameInput: {
    height: 52,
    marginTop: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.white,
    color: colors.navy,
    fontSize: 16,
  },
  renameActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameCancel: {
    minWidth: 84,
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  renameCancelText: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  renameSave: {
    minWidth: 84,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  renameSaveDisabled: {
    opacity: 0.45,
  },
  renameSaveText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    marginTop: 32,
    color: colors.navy,
    fontSize: 37,
    lineHeight: 43,
    fontWeight: '700',
    letterSpacing: -1.1,
  },
  subtitle: {
    marginTop: 14,
    maxWidth: 350,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    marginTop: 34,
    gap: 14,
  },
  primaryAction: {
    minHeight: 106,
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderRadius: 18,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryAction: {
    minHeight: 96,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  actionText: {
    flex: 1,
    marginRight: 12,
  },
  actionEyebrow: {
    marginBottom: 5,
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
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
    minHeight: 150,
    marginTop: 18,
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
    maxWidth: 275,
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
  photoNumber: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 26, 43, 0.82)',
  },
  photoNumberText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  removeButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 26, 43, 0.86)',
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
  dangerZone: {
    marginTop: 42,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  dangerTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  dangerText: {
    marginTop: 7,
    maxWidth: 345,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  deleteButton: {
    height: 50,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#D9AFAF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F8',
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
