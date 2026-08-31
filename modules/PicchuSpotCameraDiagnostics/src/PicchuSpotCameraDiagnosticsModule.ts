import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  CameraDiagnosticRun,
  CameraInventory,
  SensorDiagnosticRun,
} from './PicchuSpotCameraDiagnostics.types';

declare class PicchuSpotCameraDiagnosticsModule extends NativeModule<{}> {
  getCameraDiagnosticsAsync(): Promise<CameraInventory>;
  runDiagnosticsAsync(): Promise<CameraDiagnosticRun>;
  runSensorDiagnosticsAsync(): Promise<SensorDiagnosticRun>;
}

export default requireOptionalNativeModule<PicchuSpotCameraDiagnosticsModule>(
  'PicchuSpotCameraDiagnostics',
);
