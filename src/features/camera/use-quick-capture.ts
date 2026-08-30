import { CameraView, type CameraMountError } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';

import {
  deletePersistedShootImage,
  deleteTemporaryCameraImage,
  getPersistedShootImageSize,
  persistShootImage,
} from '@/lib/local-files';
import { addLocalShootAsset } from '@/lib/local-shoots';

import { MAX_TEST_ZOOM, type LastCapture } from './quick-camera-theme';

type UseQuickCaptureOptions = {
  shootId: string | null;
  isLeaving: boolean;
};

type UseQuickCaptureResult = {
  cameraKey: number;
  cameraRef: React.RefObject<CameraView | null>;
  captureError: string | null;
  deactivateCamera: () => void;
  handleCameraMountError: (event: CameraMountError) => void;
  handleCameraReady: () => void;
  handleCapture: () => Promise<void>;
  handleRetryCamera: () => void;
  isCameraReady: boolean;
  isCapturing: boolean;
  lastCapture: LastCapture | null;
  sessionCaptureCount: number;
  zoom: number;
  adjustZoom: (amount: number) => void;
  resetZoom: () => void;
  cameraMountError: string | null;
};

export function useQuickCapture({
  shootId,
  isLeaving,
}: UseQuickCaptureOptions): UseQuickCaptureResult {
  const cameraRef = useRef<CameraView | null>(null);
  const captureLockRef = useRef(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraMountError, setCameraMountError] = useState<string | null>(
    null,
  );
  const [cameraKey, setCameraKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [sessionCaptureCount, setSessionCaptureCount] = useState(0);
  const [lastCapture, setLastCapture] = useState<LastCapture | null>(null);
  const [zoom, setZoom] = useState(0);

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const handleCameraMountError = useCallback((event: CameraMountError) => {
    setIsCameraReady(false);
    setCameraMountError(event.message || 'The camera preview failed.');
  }, []);

  const deactivateCamera = useCallback(() => {
    setIsCameraReady(false);
  }, []);

  const handleRetryCamera = useCallback(() => {
    setCameraMountError(null);
    setCaptureError(null);
    setIsCameraReady(false);
    setCameraKey((currentKey) => currentKey + 1);
  }, []);

  const adjustZoom = useCallback((amount: number) => {
    setZoom((currentZoom) =>
      Math.min(MAX_TEST_ZOOM, Math.max(0, currentZoom + amount)),
    );
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(0);
  }, []);

  const handleCapture = useCallback(async () => {
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
  }, [isCameraReady, isLeaving, shootId]);

  return {
    cameraKey,
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
    cameraMountError,
  };
}
