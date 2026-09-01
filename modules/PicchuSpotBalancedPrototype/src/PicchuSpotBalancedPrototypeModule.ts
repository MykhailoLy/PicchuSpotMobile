import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  BalancedPrototypeComparison,
  ManualBracketCandidateId,
  PrototypeStatus,
  TemporaryExposurePlannerId,
} from './PicchuSpotBalancedPrototype.types';

declare class PicchuSpotBalancedPrototypeModule extends NativeModule<{}> {
  getStatusAsync(): Promise<{
    status: PrototypeStatus;
    reason?: string;
  }>;
  runComparisonAsync(): Promise<BalancedPrototypeComparison>;
  runExperimentAsync(
    candidateId: ManualBracketCandidateId,
    plannerId: TemporaryExposurePlannerId,
  ): Promise<BalancedPrototypeComparison>;
  clearPrototypeFilesAsync(): Promise<{
    status: 'cleared' | 'failed' | 'unavailable-in-release';
    removedFileCount: number;
    failure: string | null;
  }>;
}

export default requireOptionalNativeModule<PicchuSpotBalancedPrototypeModule>(
  'PicchuSpotBalancedPrototype',
);
