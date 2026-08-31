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
  enumerationErrors: Array<{
    cameraId: string;
    error: string;
  }>;
  rearCameras: RearCameraDiagnostics[];
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
  };
  cacheReport: {
    written: boolean;
    filename: string | null;
  };
};
