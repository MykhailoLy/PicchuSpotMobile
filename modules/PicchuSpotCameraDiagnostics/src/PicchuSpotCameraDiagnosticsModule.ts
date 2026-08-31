import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  CameraDiagnosticRun,
  CameraInventory,
} from './PicchuSpotCameraDiagnostics.types';

declare class PicchuSpotCameraDiagnosticsModule extends NativeModule<{}> {
  getCameraDiagnosticsAsync(): Promise<CameraInventory>;
  runDiagnosticsAsync(): Promise<CameraDiagnosticRun>;
}

export default requireOptionalNativeModule<PicchuSpotCameraDiagnosticsModule>(
  'PicchuSpotCameraDiagnostics',
);
