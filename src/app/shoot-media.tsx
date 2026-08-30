import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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

export default function ShootMediaScreen() {
  const { propertyName, address } = useLocalSearchParams<{
    propertyName?: string;
    address?: string;
  }>();

  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const handleImportPhotos = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        allowsEditing: false,
        selectionLimit: 0,
        quality: 1,
        orderedSelection: true,
      });

      if (result.canceled) {
        return;
      }

      setPhotos((currentPhotos) => {
        const existingUris = new Set(currentPhotos.map((photo) => photo.uri));

        const newPhotos = result.assets.filter(
          (photo) => !existingUris.has(photo.uri),
        );

        return [...currentPhotos, ...newPhotos];
      });
    } catch (error) {
      console.error('Failed to import photos:', error);

      Alert.alert(
        'Unable to import photos',
        'Please try selecting the photos again.',
      );
    }
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotos((currentPhotos) =>
      currentPhotos.filter((photo) => photo.uri !== uri),
    );
  };

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
            {propertyName || 'New property'}
          </Text>

          {!!address && <Text style={styles.address}>{address}</Text>}

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
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.primaryIcon}>
              <Text style={styles.primaryIconText}>●</Text>
            </View>

            <View style={styles.actionText}>
              <Text style={styles.primaryActionTitle}>Capture Photos</Text>

              <Text style={styles.primaryActionDescription}>
                Use the PicchuSpot camera for this property.
              </Text>
            </View>

            <Text style={styles.primaryArrow}>›</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import photos"
            onPress={handleImportPhotos}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <Text style={styles.secondaryIconText}>+</Text>
            </View>

            <View style={styles.actionText}>
              <Text style={styles.secondaryActionTitle}>Import Photos</Text>

              <Text style={styles.secondaryActionDescription}>
                Choose existing images from your device.
              </Text>
            </View>

            <Text style={styles.secondaryArrow}>›</Text>
          </Pressable>
        </View>

        {photos.length > 0 && (
          <View style={styles.photoSection}>
            <View style={styles.photoHeader}>
              <View>
                <Text style={styles.photoTitle}>Property photos</Text>

                <Text style={styles.photoCount}>
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add more photos"
                hitSlop={8}
                onPress={handleImportPhotos}
              >
                <Text style={styles.addMore}>Add more</Text>
              </Pressable>
            </View>

            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.photoItem}>
                  <Image
                    source={photo.uri}
                    style={styles.photo}
                    contentFit="cover"
                    transition={100}
                  />

                  <View style={styles.photoNumber}>
                    <Text style={styles.photoNumberText}>{index + 1}</Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    onPress={() => handleRemovePhoto(photo.uri)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Offline ready</Text>

          <Text style={styles.noteText}>
            Photos stay on this device for now. Uploading will be added later.
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

  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
    marginTop: 42,
    gap: 14,
  },

  primaryAction: {
    minHeight: 104,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
  },

  secondaryAction: {
    minHeight: 104,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pressed: {
    opacity: 0.88,
  },

  primaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryIconText: {
    color: colors.gold,
    fontSize: 17,
  },

  secondaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryIconText: {
    color: colors.gold,
    fontSize: 25,
    fontWeight: '400',
  },

  actionText: {
    flex: 1,
    marginLeft: 16,
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

  photoSection: {
    marginTop: 36,
    paddingTop: 26,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  photoTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
  },

  photoCount: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
  },

  addMore: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  photoItem: {
    width: '48%',
    aspectRatio: 4 / 3,
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
    left: 8,
    bottom: 8,
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: 'rgba(7,26,43,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoNumberText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },

  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(7,26,43,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeButtonText: {
    marginTop: -2,
    color: colors.white,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
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