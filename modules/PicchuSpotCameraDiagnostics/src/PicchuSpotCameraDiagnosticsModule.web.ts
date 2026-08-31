import { NativeModule, registerWebModule } from 'expo';

class PicchuSpotCameraDiagnosticsModule extends NativeModule<{}> {}

export default registerWebModule(
  PicchuSpotCameraDiagnosticsModule,
  'PicchuSpotCameraDiagnosticsModule',
);
