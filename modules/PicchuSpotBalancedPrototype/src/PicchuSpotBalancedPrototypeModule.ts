import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  BalancedCompatibilityInventory,
  BalancedCompatibilityProbeReport,
  BalancedPrototypeComparison,
  LocalCompatibilityProbeEvidence,
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
  inspectCompatibilityAsync(): Promise<BalancedCompatibilityInventory>;
  runCompatibilityProbeAsync(): Promise<BalancedCompatibilityProbeReport>;
  readLatestCompatibilityProbeAsync(): Promise<LocalCompatibilityProbeEvidence>;
  clearCompatibilityProbeFilesAsync(): Promise<{
    status: 'cleared' | 'failed' | 'unavailable-in-release';
    removedFileCount: number;
    failure: string | null;
  }>;
  clearPrototypeFilesAsync(): Promise<{
    status: 'cleared' | 'failed' | 'unavailable-in-release';
    removedFileCount: number;
    failure: string | null;
  }>;
}

export default requireOptionalNativeModule<PicchuSpotBalancedPrototypeModule>(
  'PicchuSpotBalancedPrototype',
);
