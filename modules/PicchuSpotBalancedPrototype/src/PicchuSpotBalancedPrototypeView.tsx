import { requireNativeViewManager } from 'expo-modules-core';

import type { BalancedPrototypePreviewProps } from './PicchuSpotBalancedPrototype.types';

export default requireNativeViewManager<BalancedPrototypePreviewProps>(
  'PicchuSpotBalancedPrototype',
  'PicchuSpotBalancedPrototypeView',
);
