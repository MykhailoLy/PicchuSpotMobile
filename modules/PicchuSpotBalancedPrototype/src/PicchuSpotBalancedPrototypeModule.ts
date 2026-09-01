import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { BalancedPrototypeComparison, PrototypeStatus } from './PicchuSpotBalancedPrototype.types';

declare class PicchuSpotBalancedPrototypeModule extends NativeModule<{}> {
  getStatusAsync(): Promise<{
    status: PrototypeStatus;
    reason?: string;
  }>;
  runComparisonAsync(): Promise<BalancedPrototypeComparison>;
  clearPrototypeFilesAsync(): Promise<{
    status: 'cleared' | 'failed' | 'unavailable-in-release';
    removedFileCount: number;
    failure: string | null;
  }>;
}

export default requireOptionalNativeModule<PicchuSpotBalancedPrototypeModule>(
  'PicchuSpotBalancedPrototype',
);
