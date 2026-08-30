import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  colors,
  formatFileSize,
  MAX_TEST_ZOOM,
  ZOOM_STEP,
  type LastCapture,
} from '../quick-camera-theme';

type QuickCameraControlsProps = {
  captureError: string | null;
  isCameraReady: boolean;
  isCapturing: boolean;
  isLandscape: boolean;
  lastCapture: LastCapture | null;
  onAdjustZoom: (amount: number) => void;
  onCapture: () => Promise<void>;
  onResetZoom: () => void;
  sessionCaptureCount: number;
  zoom: number;
};

export function QuickCameraControls({
  captureError,
  isCameraReady,
  isCapturing,
  isLandscape,
  lastCapture,
  onAdjustZoom,
  onCapture,
  onResetZoom,
  sessionCaptureCount,
  zoom,
}: QuickCameraControlsProps) {
  return (
    <View
      style={[styles.cameraFooter, isLandscape && styles.cameraFooterLandscape]}
    >
      {!!captureError && (
        <Text accessibilityLiveRegion="polite" style={styles.captureError}>
          {captureError}
        </Text>
      )}

      <View style={styles.zoomControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease camera zoom"
          disabled={zoom === 0 || isCapturing}
          onPress={() => onAdjustZoom(-ZOOM_STEP)}
          style={({ pressed }) => [
            styles.zoomButton,
            (zoom === 0 || isCapturing) && styles.controlDisabled,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.zoomButtonText}>−</Text>
        </Pressable>
        <Text style={styles.zoomValue}>Zoom {Math.round(zoom * 100)}%</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase camera zoom"
          disabled={zoom >= MAX_TEST_ZOOM || isCapturing}
          onPress={() => onAdjustZoom(ZOOM_STEP)}
          style={({ pressed }) => [
            styles.zoomButton,
            (zoom >= MAX_TEST_ZOOM || isCapturing) && styles.controlDisabled,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset camera zoom"
          disabled={zoom === 0 || isCapturing}
          onPress={onResetZoom}
          style={({ pressed }) => [
            styles.resetButton,
            (zoom === 0 || isCapturing) && styles.controlDisabled,
            pressed && styles.controlPressed,
          ]}
        >
          <Text style={styles.resetButtonText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.captureRow}>
        <View style={styles.thumbnailSlot}>
          {lastCapture ? (
            <Image
              accessibilityLabel="Last captured photo"
              source={{ uri: lastCapture.uri }}
              style={styles.thumbnail}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder} />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take Quick photo"
          disabled={!isCameraReady || isCapturing}
          onPress={() => void onCapture()}
          style={({ pressed }) => [
            styles.shutterOuter,
            (!isCameraReady || isCapturing) && styles.controlDisabled,
            pressed && isCameraReady && styles.shutterPressed,
          ]}
        >
          <View style={styles.shutterInner}>
            {isCapturing && (
              <ActivityIndicator color={colors.navy} size="small" />
            )}
          </View>
        </Pressable>

        <View style={styles.sessionCount}>
          <Text style={styles.sessionCountNumber}>{sessionCaptureCount}</Text>
          <Text style={styles.sessionCountLabel}>THIS SESSION</Text>
        </View>
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.captureStatus}>
        {isCapturing
          ? 'Saving photo…'
          : isCameraReady
            ? 'Ready'
            : 'Preparing camera…'}
      </Text>
      {lastCapture && (
        <Text style={styles.captureDetails}>
          Last: {lastCapture.width} × {lastCapture.height} ·{' '}
          {formatFileSize(lastCapture.byteSize)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cameraFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 26, 43, 0.86)',
  },
  cameraFooterLandscape: {
    width: 260,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingVertical: 18,
    justifyContent: 'center',
  },
  captureError: {
    marginBottom: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  zoomControls: {
    minHeight: 38,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  zoomButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonText: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 26,
  },
  zoomValue: {
    width: 82,
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  resetButton: {
    minWidth: 58,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  captureRow: {
    width: '100%',
    maxWidth: 430,
    minHeight: 82,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnailSlot: {
    width: 66,
    alignItems: 'center',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 8,
    backgroundColor: colors.navy,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  shutterPressed: {
    transform: [{ scale: 0.96 }],
  },
  sessionCount: {
    width: 66,
    alignItems: 'center',
  },
  sessionCountNumber: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
  },
  sessionCountLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  captureStatus: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  captureDetails: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'center',
  },
  controlDisabled: {
    opacity: 0.42,
  },
  controlPressed: {
    opacity: 0.7,
  },
});
