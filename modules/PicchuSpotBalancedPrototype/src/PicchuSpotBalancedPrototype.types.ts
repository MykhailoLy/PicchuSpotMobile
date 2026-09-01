import type { NativeSyntheticEvent, ViewProps } from 'react-native';

export type PrototypeStatus =
  | 'idle'
  | 'opening-camera'
  | 'preview-ready'
  | 'capturing'
  | 'error'
  | 'unavailable-in-release';

export type ManualBracketCandidateId =
  | 'candidate-a-three-frame'
  | 'candidate-b-five-frame';

export type TemporaryExposurePlannerId =
  | 'manual-range'
  | 'positive-ev-cap-1-30'
  | 'positive-ev-cap-1-15';

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

export type SourceFrameMetrics = {
  status: 'measured' | 'unavailable';
  method?: string;
  sourceDimensions?: { width: number; height: number };
  analysisDimensions?: { width: number; height: number };
  inSampleSize?: number;
  pixelsAnalyzed?: number;
  nearBlack?: {
    thresholdLumaInclusive: number;
    pixelCount: number;
    percentage: number;
  };
  nearWhite?: {
    thresholdLumaInclusive: number;
    pixelCount: number;
    percentage: number;
  };
  luminancePercentiles?: {
    p01: number;
    p05: number;
    p50: number;
    p95: number;
    p99: number;
  };
  luminanceHistogram16?: Array<{
    lowerInclusive: number;
    upperInclusive: number;
    pixelCount: number;
    percentage: number;
  }>;
  detailProxy?: {
    name: string;
    value: number | null;
    comparisonCount: number;
    note: string;
  };
  sourceModified: false;
  failure: string | null;
};

export type PrototypeFrame = {
  requestIndex: number;
  label: string;
  fileUri: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  sourceFrameMetrics: SourceFrameMetrics | null;
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
  kind: 'android-balanced-bracket-policy-experiment';
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
  aeBaseline: CaptureStrategyResult;
  manualExperiment: {
    candidate: {
      id: ManualBracketCandidateId;
      label: string;
      evOffsets: number[];
      temporaryExperimentOnly: true;
    };
    planner: {
      id: TemporaryExposurePlannerId;
      label: string;
      positiveEvShutterCeilingNs: number | null;
      positiveEvShutterCeilingDescription: string;
      temporaryExperimentOnly: true;
    };
    capture: CaptureStrategyResult;
  };
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

export type BalancedCompatibilityClassification =
  | 'FULL_BALANCED'
  | 'LIMITED'
  | 'UNSUPPORTED';

export type BalancedCompatibilityInventory = {
  schemaVersion: number;
  kind: 'android-balanced-compatibility-inventory' | 'android-balanced-compatibility-probe';
  status?: 'failed';
  capturedAtUtc?: string;
  device?: {
    manufacturer: string;
    model: string;
    androidRelease: string;
    apiLevel: number;
    buildFingerprint: string;
  };
  candidate?: Record<string, unknown>;
  cameraTopology?: {
    rearCameraIds: string[];
    selectedRearLogicalCameraId: string | null;
    selectedBy: string;
    cameras: Array<Record<string, unknown>>;
  };
  selectedJpegSize?: {
    width: number;
    height: number;
  };
  sensors?: {
    gyroscopeAvailable: boolean;
    linearAccelerationAvailable: boolean;
  };
  staticEvaluation?: {
    status: 'passed' | 'failed';
    requiredContractPassed: boolean;
    reasons: string[];
    requiredRules: string[];
    diagnosticOnly: string[];
  };
  failure?: string;
};

export type BalancedCompatibilityProbeReport =
  BalancedCompatibilityInventory & {
    kind: 'android-balanced-compatibility-probe';
    runtimeValidation: Record<string, unknown>;
    classification: {
      status: BalancedCompatibilityClassification;
      reasons: string[];
    };
    storage: {
      directory: string;
      evidenceFilename: string;
      filesAreCacheOnly: true;
      galleryWrite: false;
      shootSqliteWrite: false;
      upload: false;
    };
  };

export type LocalCompatibilityProbeEvidence = {
  status: 'available' | 'missing' | 'failed' | 'unavailable-in-release';
  filename: string | null;
  json: string | null;
  failure: string | null;
};
