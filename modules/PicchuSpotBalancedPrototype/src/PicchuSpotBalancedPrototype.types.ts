import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type PrototypeStatus =
  | 'idle'
  | 'opening-camera'
  | 'preview-ready'
  | 'capturing'
  | 'error'
  | 'unavailable-in-release';

export type BalancedPrototypePreviewProps = ViewProps & {
  cameraId?: string;
  zoomRatio?: number;
  onStatusChanged?: (
    event: NativeSyntheticEvent<{
      status: PrototypeStatus;
      message?: string;
    }>,
  ) => void;
};

export type PrototypeFrame = {
  requestIndex: number;
  label: string;
  fileUri: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  imageAssociation: 'sensor-timestamp' | 'delivery-order-fallback' | null;
  jpegOrientationDegrees: number | null;
  requested: Record<string, unknown>;
  actual: {
    activePhysicalCameraId: string | null;
    focalLengthMm: number | null;
    exposureTimeNs: number | null;
    iso: number | null;
    aeState: string;
    afState: string;
    awbState: string;
    zoomRatio: number | null;
    sensorTimestampNs: number | null;
    completionTimestampNs: number | null;
    frameNumber: number | null;
  };
  shutterToCompleteMs: number | null;
  completionOrder: number | null;
  failure: string | null;
};

export type CaptureStrategyResult = {
  status: 'completed' | 'partial' | 'unavailable' | 'failed';
  label: string;
  requestedSequence: string[];
  startedAtElapsedRealtimeNs: number | null;
  finishedAtElapsedRealtimeNs: number | null;
  totalDurationMs: number | null;
  convergence?: Array<{
    label: string;
    framesObserved: number;
    elapsedMs: number;
    status: 'stable' | 'timeout';
  }>;
  frames: PrototypeFrame[];
  requestOrder: number[];
  completionOrder: number[];
  interFrameSensorIntervalsMs: number[];
  interFrameCompletionIntervalsMs: number[];
  failure: string | null;
};

export type BalancedPrototypeComparison = {
  schemaVersion: number;
  kind: 'android-balanced-capture-prototype';
  status: 'completed' | 'partial' | 'failed';
  capturedAtUtc: string;
  android: {
    apiLevel: number;
    manufacturer: string;
    model: string;
    release: string;
  };
  camera: {
    logicalCameraId: string;
    selectedJpegSize: {
      width: number;
      height: number;
    };
    sensorOrientationDegrees: number | null;
    zoomRatio: number;
    timestampSource: string;
  };
  focusWhiteBalance: Record<string, unknown>;
  aeSequence: CaptureStrategyResult;
  manualBurst: CaptureStrategyResult;
  movementWindows: Record<string, unknown>;
  storage: {
    directory: string;
    evidenceFilename: string | null;
    filesAreCacheOnly: true;
    galleryWrite: false;
    shootSqliteWrite: false;
    upload: false;
  };
  failure: string | null;
};
