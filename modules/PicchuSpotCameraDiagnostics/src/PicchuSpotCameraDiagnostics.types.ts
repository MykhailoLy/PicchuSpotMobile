export type CameraSize = {
  width: number;
  height: number;
};

export type CameraRange<T> = {
  lower: T;
  upper: T;
};

export type CameraInventory = {
  schemaVersion: number;
  generatedAtUtc: string;
  android: {
    apiLevel: number;
    manufacturer: string;
    model: string;
    release: string;
  };
  permission: {
    cameraGranted: boolean;
  };
  discoveredCameraIds: string[];
  rearCameraCount: number;
  physicalCameraCount: number;
  enumerationErrors: Array<{
    cameraId: string;
    error: string;
  }>;
  rearCameras: RearCameraDiagnostics[];
  physicalCameraCharacterizationErrors: Array<{
    physicalCameraId: string;
    logicalParentCameraIds: string[];
    error: string;
  }>;
  physicalCameras: PhysicalCameraDiagnostics[];
  motionSensors: MotionSensorInventory;
  notes: string[];
};

export type MotionSensorInventory = {
  requestedSamplingPeriodUs: number;
  sensors: Array<{
    type: number;
    typeName: string;
    available: boolean;
    details: Record<string, unknown> | null;
  }>;
  notes: string[];
};

export type RearCameraDiagnostics = {
  cameraId: string;
  lensFacing: 'BACK';
  topology: {
    kind: 'logical' | 'physical-or-single';
    isLogicalMultiCamera: boolean;
    physicalCameraIds: string[];
    evidence: string;
    lensLabels: string[];
    mappingInference: string | null;
  };
  hardwareLevel: {
    raw: number | null;
    name: string;
  };
  requestCapabilities: {
    raw: number[];
    names: string[];
  };
  supports: {
    manualSensor: boolean;
    burstCapture: boolean;
    raw: boolean;
    logicalMultiCamera: boolean;
  };
  lens: {
    focalLengthsMm: number[];
    aperturesFNumber: number[];
    minimumFocusDistanceDiopters: number | null;
    opticalStabilizationModes: {
      raw: number[];
      names: string[];
    };
  };
  flash: {
    available: boolean | null;
  };
  zoom: {
    minimumDigitalZoom: number;
    maximumDigitalZoom: number | null;
    range: CameraRange<number>;
    cropRegionAtMinimumZoom: CameraRect | null;
    cropRegionAtMaximumZoom: CameraRect | null;
    zoomRatioRange: CameraRange<number> | null;
    captureResultKeyAvailability: {
      effectiveZoomRatio: boolean;
      activePhysicalCameraId: boolean;
      activePhysicalSensorCropRegion: boolean;
      focalLength: boolean;
      cropRegion: boolean;
    };
    evidence: string;
  };
  aeCompensation: {
    integerRange: CameraRange<number> | null;
    step: {
      numerator: number;
      denominator: number;
      ev: number;
    } | null;
    evRange: CameraRange<number> | null;
  };
  sensor: {
    exposureTimeRangeNs: CameraRange<number> | null;
    sensitivityRangeIso: CameraRange<number> | null;
    maxFrameDurationNs: number | null;
    physicalSizeMm: {
      width: number;
      height: number;
    } | null;
    orientationDegrees: number | null;
    timestampSource: {
      raw: number | null;
      name: string;
    };
    activeArray: CameraRect | null;
    pixelArray: CameraSize | null;
  };
  ae: {
    lockAvailable: boolean | null;
    modes: {
      raw: number[];
      names: string[];
    };
    antibanding: {
      raw: number[];
      names: string[];
    };
    fpsRanges: Array<CameraRange<number>>;
  };
  outputs: {
    jpeg: CameraSize[];
    raw: CameraSize[];
    yuv: CameraSize[];
  };
};

export type PhysicalCameraDiagnostics = {
  physicalCameraId: string;
  logicalParentCameraIds: string[];
  independentlyOpenable: boolean;
  relationship:
    | 'independently-openable-and-physical'
    | 'physical-only-backing-logical-camera';
  lensLabels: string[];
  mappingInference: string | null;
  hardwareLevel: RearCameraDiagnostics['hardwareLevel'];
  lens: RearCameraDiagnostics['lens'];
  sensor: {
    physicalSizeMm: {
      width: number;
      height: number;
    } | null;
    activeArray: CameraRect | null;
    pixelArray: CameraSize | null;
    exposureTimeRangeNs: CameraRange<number> | null;
    sensitivityRangeIso: CameraRange<number> | null;
    maxFrameDurationNs: number | null;
    orientationDegrees: number | null;
    timestampSource: {
      raw: number | null;
      name: string;
    };
  };
  zoom: RearCameraDiagnostics['zoom'];
  outputs: RearCameraDiagnostics['outputs'];
};

export type CameraRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type CameraDiagnosticRun = {
  schemaVersion: number;
  kind: 'android-camera2-diagnostic-run';
  capturedAtUtc: string;
  android: CameraInventory['android'];
  permission: CameraInventory['permission'];
  cameraInventory: CameraInventory;
  selection: {
    cameraId: string | null;
    reason: string;
    candidates: string[];
  };
  diagnostics: {
    aeCompensation: Record<string, unknown>;
    manualSensor: Record<string, unknown>;
    burst: Record<string, unknown>;
    zoomRatios: Record<string, unknown>;
    manualBurst: Record<string, unknown>;
  };
  cacheReport: {
    written: boolean;
    filename: string | null;
  };
};

export type SensorDiagnosticRun = {
  schemaVersion: number;
  kind: 'android-sensor-diagnostic-run';
  capturedAtUtc: string;
  android: CameraInventory['android'];
  measurements: Record<string, unknown>;
  cacheReport: {
    written: boolean;
    filename: string | null;
  };
};
