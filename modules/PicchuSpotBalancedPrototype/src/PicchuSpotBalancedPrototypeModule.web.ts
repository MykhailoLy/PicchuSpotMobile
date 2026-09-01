import { NativeModule, registerWebModule } from 'expo';

class PicchuSpotBalancedPrototypeModule extends NativeModule<{}> {}

export default registerWebModule(
  PicchuSpotBalancedPrototypeModule,
  'PicchuSpotBalancedPrototype',
);
