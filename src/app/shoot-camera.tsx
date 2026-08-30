import { useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuickCameraControls } from '@/features/camera/components/quick-camera-controls';
import { QuickCameraHeader } from '@/features/camera/components/quick-camera-header';
import { QuickCameraPreview } from '@/features/camera/components/quick-camera-preview';
import { colors } from '@/features/camera/quick-camera-theme';
import { useQuickCapture } from '@/features/camera/use-quick-capture';
import { getLocalShoot, type LocalShoot } from '@/lib/local-shoots';

export default function ShootCameraScreen() {
  const { shootId: shootIdParam } = useLocalSearchParams<{
    shootId?: string;
  }>();
  const shootId = typeof shootIdParam === 'string' ? shootIdParam : null;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [permission, requestPermission, getPermission] =
    useCameraPermissions();
  const [shoot, setShoot] = useState<LocalShoot | null>(null);
  const [isLoadingShoot, setIsLoadingShoot] = useState(true);
  const [shootError, setShootError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const {
    cameraKey,
    cameraMountError,
    cameraRef,
    captureError,
    deactivateCamera,
    handleCameraMountError,
    handleCameraReady,
    handleCapture,
    handleRetryCamera,
    isCameraReady,
    isCapturing,
    lastCapture,
    sessionCaptureCount,
    zoom,
    adjustZoom,
    resetZoom,
  } = useQuickCapture({ isLeaving, shootId });

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
    deactivateCamera();
    router.back();
  }, [deactivateCamera, isCapturing, isLeaving]);

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
      <SafeAreaView pointerEvents="box-none" style={styles.cameraOverlay}>
        <View
          style={[
            styles.cameraLayout,
            isLandscape
              ? styles.cameraLayoutLandscape
              : styles.cameraLayoutPortrait,
          ]}
        >
          <QuickCameraHeader
            isCapturing={isCapturing}
            isLandscape={isLandscape}
            onLeave={leaveCamera}
            shootName={shoot.propertyName}
          />
          <QuickCameraPreview
            cameraKey={cameraKey}
            cameraRef={cameraRef}
            isLandscape={isLandscape}
            isLeaving={isLeaving}
            onCameraReady={handleCameraReady}
            onMountError={handleCameraMountError}
            zoom={zoom}
          />
          <QuickCameraControls
            captureError={captureError}
            isCameraReady={isCameraReady}
            isCapturing={isCapturing}
            isLandscape={isLandscape}
            lastCapture={lastCapture}
            onAdjustZoom={adjustZoom}
            onCapture={handleCapture}
            onResetZoom={resetZoom}
            sessionCaptureCount={sessionCaptureCount}
            zoom={zoom}
          />
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
  cameraLayout: {
    flex: 1,
  },
  cameraLayoutPortrait: {
    flexDirection: 'column',
  },
  cameraLayoutLandscape: {
    flexDirection: 'row',
  },
  cameraOverlay: {
    flex: 1,
  },
});
