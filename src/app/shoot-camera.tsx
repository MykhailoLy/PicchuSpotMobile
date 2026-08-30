import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deletePersistedShootImage,
  deleteTemporaryCameraImage,
  getPersistedShootImageSize,
  persistShootImage,
} from '@/lib/local-files';
import {
  addLocalShootAsset,
  getLocalShoot,
  type LocalShoot,
} from '@/lib/local-shoots';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#AEB8BF',
  danger: '#FFD1D1',
};

const ZOOM_STEP = 0.1;
const MAX_TEST_ZOOM = 0.5;

type LastCapture = {
  uri: string;
  width: number;
  height: number;
  byteSize: number | null;
};

function formatFileSize(byteSize: number | null) {
  if (!byteSize) {
    return 'size unavailable';
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ShootCameraScreen() {
  const { shootId: shootIdParam } = useLocalSearchParams<{
    shootId?: string;
  }>();
  const shootId = typeof shootIdParam === 'string' ? shootIdParam : null;

  const cameraRef = useRef<CameraView | null>(null);
  const captureLockRef = useRef(false);
  const [permission, requestPermission, getPermission] =
    useCameraPermissions();
  const [shoot, setShoot] = useState<LocalShoot | null>(null);
  const [isLoadingShoot, setIsLoadingShoot] = useState(true);
  const [shootError, setShootError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [sessionCaptureCount, setSessionCaptureCount] = useState(0);
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null);
  const [zoom, setZoom] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadShoot = async () => {
      if (!shootId) {
        if (isActive) {
          setShootError('A valid local Shoot is required to open the camera.');
          setIsLoadingShoot(false);
        }
        return;
      }

      try {
        const savedShoot = await getLocalShoot(shootId);

        if (!savedShoot) {
          throw new Error('Shoot not found.');
        }

        if (isActive) {
          setShoot(savedShoot);
        }
      } catch (error) {
        console.error(error);

        if (isActive) {
          setShootError('This local Shoot is no longer available.');
        }
      } finally {
        if (isActive) {
          setIsLoadingShoot(false);
        }
      }
    };

    void loadShoot();

    return () => {
      isActive = false;
    };
  }, [shootId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => isCapturing,
    );

    return () => subscription.remove();
  }, [isCapturing]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void getPermission().catch((error: unknown) => {
          console.error('Could not refresh camera permission:', error);
        });
      }
    });

    return () => subscription.remove();
  }, [getPermission]);

  const leaveCamera = useCallback(() => {
    if (isCapturing || isLeaving) {
      return;
    }

    setIsLeaving(true);
    setIsCameraReady(false);
    router.back();
  }, [isCapturing, isLeaving]);

  const handleRequestPermission = async () => {
    setPermissionError(null);

    try {
      await requestPermission();
    } catch (error) {
      console.error(error);
      setPermissionError(
        'Camera access could not be requested. Please try again.',
      );
    }
  };

  const handleOpenSettings = async () => {
    setPermissionError(null);

    try {
      await Linking.openSettings();
    } catch (error) {
      console.error(error);
      setPermissionError('System Settings could not be opened.');
    }
  };

  const handleRetryCamera = () => {
    setCameraMountError(null);
    setCaptureError(null);
    setIsCameraReady(false);
    setCameraKey((currentKey) => currentKey + 1);
  };

  const adjustZoom = (amount: number) => {
    setZoom((currentZoom) =>
      Math.min(MAX_TEST_ZOOM, Math.max(0, currentZoom + amount)),
    );
  };

  const handleCapture = async () => {
    if (
      !shootId ||
      !cameraRef.current ||
      !isCameraReady ||
      captureLockRef.current ||
      isLeaving
    ) {
      return;
    }

    captureLockRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);

    let persistedUri: string | null = null;
    let metadataCommitted = false;

    try {
      const capturedPicture = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: false,
      });
      const mimeType =
        capturedPicture.format === 'png' ? 'image/png' : 'image/jpeg';
      const extension = capturedPicture.format === 'png' ? 'png' : 'jpg';

      persistedUri = await persistShootImage(shootId, {
        uri: capturedPicture.uri,
        fileName: `quick-${Date.now()}.${extension}`,
        mimeType,
      });

      await addLocalShootAsset({
        shootId,
        uri: persistedUri,
        originalFilename: null,
        mimeType,
        width: capturedPicture.width,
        height: capturedPicture.height,
      });
      metadataCommitted = true;

      let byteSize: number | null = null;

      try {
        byteSize = getPersistedShootImageSize(shootId, persistedUri);
      } catch (sizeError) {
        console.warn('Could not read captured photo size:', sizeError);
      }

      setLastCapture({
        uri: persistedUri,
        width: capturedPicture.width,
        height: capturedPicture.height,
        byteSize,
      });
      setSessionCaptureCount((currentCount) => currentCount + 1);

      try {
        deleteTemporaryCameraImage(capturedPicture.uri);
      } catch (cleanupError) {
        console.warn('Could not clean temporary camera image:', cleanupError);
      }
    } catch (error) {
      console.error(error);

      if (persistedUri && !metadataCommitted) {
        try {
          deletePersistedShootImage(shootId, persistedUri);
        } catch (rollbackError) {
          console.error(
            'Could not roll back captured photo copy:',
            rollbackError,
          );
        }
      }

      setCaptureError(
        'The photo was not saved. Keep the camera open and try again.',
      );
    } finally {
      captureLockRef.current = false;
      setIsCapturing(false);
    }
  };

  if (isLoadingShoot || !permission) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.gold} size="large" />
        <Text style={styles.stateKicker}>PICCHUSPOT CAMERA</Text>
        <Text style={styles.stateBody}>Preparing Quick capture…</Text>
      </SafeAreaView>
    );
  }

  if (shootError || !shoot || !shootId) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />
        <Text style={styles.stateKicker}>CAMERA UNAVAILABLE</Text>
        <Text style={styles.stateTitle}>Shoot not found</Text>
        <Text style={styles.stateBody}>{shootError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.statePrimaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.statePrimaryButtonText}>Back to Shoot</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const canRequestPermission = permission.canAskAgain;

    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar style="dark" />
        <View style={styles.permissionTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Shoot"
            hitSlop={12}
            onPress={leaveCamera}
          >
            <Text style={styles.permissionBack}>‹</Text>
          </Pressable>
          <Text style={styles.permissionShootName} numberOfLines={1}>
            {shoot.propertyName}
          </Text>
          <View style={styles.permissionTopSpacer} />
        </View>

        <View style={styles.permissionContent}>
          <Text style={styles.stateKicker}>QUICK CAPTURE</Text>
          <Text style={styles.stateTitle}>Camera access needed</Text>
          <Text style={styles.stateBody}>
            PicchuSpot uses the rear camera to photograph this property. Photos
            stay inside this local Shoot unless you remove them.
          </Text>
          {!!permissionError && (
            <Text style={styles.permissionError}>{permissionError}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void (canRequestPermission
                ? handleRequestPermission()
                : handleOpenSettings())
            }
            style={({ pressed }) => [
              styles.statePrimaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.statePrimaryButtonText}>
              {canRequestPermission ? 'Allow Camera' : 'Open Settings'}
            </Text>
          </Pressable>
          {!canRequestPermission && (
            <Text style={styles.settingsHint}>
              Enable Camera for PicchuSpot, then return here.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (cameraMountError) {
    return (
      <SafeAreaView style={styles.cameraErrorScreen}>
        <StatusBar style="light" />
        <Text style={styles.cameraErrorKicker}>QUICK CAPTURE</Text>
        <Text style={styles.cameraErrorTitle}>Camera could not start</Text>
        <Text style={styles.cameraErrorBody}>{cameraMountError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleRetryCamera}
          style={({ pressed }) => [
            styles.cameraRetryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cameraRetryButtonText}>Try Camera Again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={leaveCamera}
          style={({ pressed }) => [
            styles.cameraBackButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cameraBackButtonText}>Back to Shoot</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <StatusBar hidden />
      {!isLeaving && (
        <CameraView
          key={cameraKey}
          ref={cameraRef}
          facing="back"
          flash="off"
          mode="picture"
          onCameraReady={() => setIsCameraReady(true)}
          onMountError={(event) => {
            setIsCameraReady(false);
            setCameraMountError(event.message || 'The camera preview failed.');
          }}
          responsiveOrientationWhenOrientationLocked
          style={styles.cameraPreview}
          zoom={zoom}
        />
      )}

      <View pointerEvents="none" style={styles.grid}>
        <View style={[styles.verticalGridLine, styles.verticalGridThird]} />
        <View style={[styles.verticalGridLine, styles.verticalGridTwoThirds]} />
        <View style={[styles.horizontalGridLine, styles.horizontalGridThird]} />
        <View
          style={[styles.horizontalGridLine, styles.horizontalGridTwoThirds]}
        />
      </View>

      <SafeAreaView pointerEvents="box-none" style={styles.cameraOverlay}>
        <View style={styles.cameraTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Shoot"
            disabled={isCapturing}
            hitSlop={10}
            onPress={leaveCamera}
            style={({ pressed }) => [
              styles.topAction,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.topActionText}>Back</Text>
          </Pressable>

          <View style={styles.shootHeading}>
            <Text style={styles.cameraKicker}>QUICK</Text>
            <Text style={styles.cameraShootName} numberOfLines={1}>
              {shoot.propertyName}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isCapturing}
            hitSlop={10}
            onPress={leaveCamera}
            style={({ pressed }) => [
              styles.topAction,
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.cameraFooter}>
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
              onPress={() => adjustZoom(-ZOOM_STEP)}
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
              onPress={() => adjustZoom(ZOOM_STEP)}
              style={({ pressed }) => [
                styles.zoomButton,
                (zoom >= MAX_TEST_ZOOM || isCapturing) &&
                  styles.controlDisabled,
                pressed && styles.controlPressed,
              ]}
            >
              <Text style={styles.zoomButtonText}>+</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset camera zoom"
              disabled={zoom === 0 || isCapturing}
              onPress={() => setZoom(0)}
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
              onPress={() => void handleCapture()}
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.86,
  },
  stateScreen: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ivory,
  },
  stateKicker: {
    marginTop: 22,
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  stateTitle: {
    marginTop: 12,
    color: colors.navy,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 14,
    maxWidth: 390,
    color: '#53616B',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  statePrimaryButton: {
    minWidth: 190,
    height: 52,
    marginTop: 26,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  statePrimaryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.ivory,
  },
  permissionTopBar: {
    height: 62,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionBack: {
    width: 36,
    color: colors.navy,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '300',
  },
  permissionShootName: {
    maxWidth: '70%',
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  permissionTopSpacer: {
    width: 36,
  },
  permissionContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionError: {
    marginTop: 16,
    color: '#8E2E2E',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  settingsHint: {
    marginTop: 13,
    color: '#53616B',
    fontSize: 13,
    textAlign: 'center',
  },
  cameraErrorScreen: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  cameraErrorKicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cameraErrorTitle: {
    marginTop: 12,
    color: colors.white,
    fontSize: 29,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraErrorBody: {
    marginTop: 14,
    maxWidth: 380,
    color: '#C7CED3',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  cameraRetryButton: {
    minWidth: 190,
    height: 52,
    marginTop: 26,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  cameraRetryButtonText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  cameraBackButton: {
    minWidth: 190,
    height: 48,
    marginTop: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBackButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  grid: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  verticalGridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  horizontalGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.46)',
  },
  verticalGridThird: {
    left: '33.333%',
  },
  verticalGridTwoThirds: {
    left: '66.666%',
  },
  horizontalGridThird: {
    top: '33.333%',
  },
  horizontalGridTwoThirds: {
    top: '66.666%',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
  },
  cameraTopBar: {
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7, 26, 43, 0.76)',
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
  cameraFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 26, 43, 0.86)',
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
