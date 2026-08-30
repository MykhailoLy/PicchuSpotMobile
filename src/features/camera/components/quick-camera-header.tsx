import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../quick-camera-theme';

type QuickCameraHeaderProps = {
  isCapturing: boolean;
  isLandscape: boolean;
  onLeave: () => void;
  shootName: string;
};

export function QuickCameraHeader({
  isCapturing,
  isLandscape,
  onLeave,
  shootName,
}: QuickCameraHeaderProps) {
  return (
    <View
      style={[
        styles.cameraTopBar,
        isLandscape && styles.cameraTopBarLandscape,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Shoot"
        disabled={isCapturing}
        hitSlop={10}
        onPress={onLeave}
        style={({ pressed }) => [
          styles.topAction,
          pressed && styles.controlPressed,
        ]}
      >
        <Text style={styles.topActionText}>Back</Text>
      </Pressable>

      <View
        style={[styles.shootHeading, isLandscape && styles.shootHeadingLandscape]}
      >
        <Text style={styles.cameraKicker}>QUICK</Text>
        <Text style={styles.cameraShootName} numberOfLines={1}>
          {shootName}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isCapturing}
        hitSlop={10}
        onPress={onLeave}
        style={({ pressed }) => [
          styles.topAction,
          pressed && styles.controlPressed,
        ]}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraTopBar: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7, 26, 43, 0.76)',
  },
  cameraTopBarLandscape: {
    width: 160,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingVertical: 18,
    flexDirection: 'column',
  },
  topAction: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  doneText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  shootHeading: {
    flex: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  shootHeadingLandscape: {
    width: '100%',
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  cameraKicker: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cameraShootName: {
    maxWidth: '100%',
    marginTop: 3,
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  controlPressed: {
    opacity: 0.7,
  },
});
