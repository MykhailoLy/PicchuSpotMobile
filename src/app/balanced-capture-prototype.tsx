import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BalancedPrototypeModule, {
  BalancedPrototypePreview,
  type BalancedPrototypeComparison,
  type ManualBracketCandidateId,
  type PrototypeFrame,
  type PrototypeStatus,
  type SourceFrameMetrics,
  type TemporaryExposurePlannerId,
} from '../../modules/PicchuSpotBalancedPrototype';

const UNAVAILABLE_MESSAGE =
  'This diagnostic harness is available only in Android development builds.';

const BRACKET_CANDIDATES: {
  id: ManualBracketCandidateId;
  title: string;
  detail: string;
}[] = [
  {
    id: 'candidate-a-three-frame',
    title: 'Candidate A · 3 frames',
    detail: '-2 / 0 / +2 EV',
  },
  {
    id: 'candidate-b-five-frame',
    title: 'Candidate B · 5 frames',
    detail: '-2 / -1 / 0 / +1 / +2 EV',
  },
];

const EXPOSURE_PLANNERS: {
  id: TemporaryExposurePlannerId;
  title: string;
  detail: string;
}[] = [
  {
    id: 'manual-range',
    title: 'Planner 1 · manual range',
    detail: 'Baseline ISO where possible; sensor-range clamp only.',
  },
  {
    id: 'positive-ev-cap-1-30',
    title: 'Planner 2 · ~1/30 s cap',
    detail: 'Positive EV cap with ISO redistribution.',
  },
  {
    id: 'positive-ev-cap-1-15',
    title: 'Planner 3 · ~1/15 s cap',
    detail: 'Positive EV cap with ISO redistribution.',
  },
];

export default function BalancedCapturePrototypeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [previewStatus, setPreviewStatus] = useState<PrototypeStatus>('idle');
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [comparison, setComparison] =
    useState<BalancedPrototypeComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<PrototypeFrame | null>(
    null,
  );
  const [selectedCandidateId, setSelectedCandidateId] =
    useState<ManualBracketCandidateId>('candidate-a-three-frame');
  const [selectedPlannerId, setSelectedPlannerId] =
    useState<TemporaryExposurePlannerId>('manual-range');

  const refreshStatus = useCallback(async () => {
    if (!__DEV__ || Platform.OS !== 'android') {
      return;
    }

    if (!BalancedPrototypeModule) {
      setPreviewStatus('error');
      setPreviewMessage('The development-only native module is unavailable.');
      return;
    }

    try {
      const status = await BalancedPrototypeModule.getStatusAsync();
      setPreviewStatus(status.status);
      setPreviewMessage(status.reason ?? null);
    } catch (statusError) {
      console.error(statusError);
    }
  }, []);

  const handleCaptureExperiment = async () => {
    if (!BalancedPrototypeModule) {
      setError('The development-only native module is unavailable.');
      return;
    }
    setError(null);
    setIsCapturing(true);

    try {
      const result = await BalancedPrototypeModule.runExperimentAsync(
        selectedCandidateId,
        selectedPlannerId,
      );
      setComparison(result);
      setPreviewStatus('preview-ready');
      if (result.failure) {
        setError(result.failure);
      }
    } catch (captureError) {
      console.error(captureError);
      setError(
        captureError instanceof Error
          ? captureError.message
          : 'The selected Camera2 experiment could not complete.',
      );
    } finally {
      setIsCapturing(false);
      void refreshStatus();
    }
  };

  const handleClearFiles = async () => {
    if (!BalancedPrototypeModule) {
      setError('The development-only native module is unavailable.');
      return;
    }
    setError(null);
    setIsClearing(true);

    try {
      const result = await BalancedPrototypeModule.clearPrototypeFilesAsync();
      if (result.failure) {
        setError(result.failure);
        return;
      }

      setComparison(null);
      setSelectedFrame(null);
    } catch (clearError) {
      console.error(clearError);
      setError('Temporary prototype JPEGs could not be cleared.');
    } finally {
      setIsClearing(false);
    }
  };

  const handlePermission = async () => {
    setError(null);
    try {
      await requestPermission();
    } catch (permissionError) {
      console.error(permissionError);
      setError('Android camera permission could not be requested.');
    }
  };

  if (!__DEV__ || Platform.OS !== 'android') {
    return <UnavailableScreen message={UNAVAILABLE_MESSAGE} />;
  }

  if (!permission) {
    return <UnavailableScreen message="Checking Android camera permission…" loading />;
  }

  if (!permission.granted) {
    return (
      <UnavailableScreen
        message="Camera permission is required to open the development-only Camera2 preview."
        actionLabel={permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}
        onAction={() =>
          void (permission.canAskAgain ? handlePermission() : Linking.openSettings())
        }
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            isLandscape && styles.contentLandscape,
          ]}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Back to Account"
              accessibilityRole="button"
              disabled={isCapturing}
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && !isCapturing && styles.pressed,
              ]}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
              <Text style={styles.title}>Balanced capture prototype</Text>
            </View>
          </View>

          <Text style={styles.intro}>
            Camera2 writes temporary, app-private source JPEGs only. Select one
            temporary manual candidate and planner for each measured run; this
            never enters a Shoot, Gallery, upload queue, or Quick Camera flow.
          </Text>

          <View
            style={[
              styles.previewFrame,
              isLandscape
                ? styles.previewFrameLandscape
                : styles.previewFramePortrait,
            ]}
          >
            <BalancedPrototypePreview
              cameraId="0"
              onStatusChanged={(event) => {
                setPreviewStatus(event.nativeEvent.status);
                setPreviewMessage(event.nativeEvent.message ?? null);
              }}
              style={styles.preview}
              zoomRatio={1}
            />
            <View pointerEvents="none" style={styles.previewOverlay}>
              <Text style={styles.previewLabel}>LOGICAL CAMERA 0 · 1.0×</Text>
              <Text style={styles.previewState}>
                {previewStatus.replaceAll('-', ' ')}
              </Text>
            </View>
          </View>

          {!!previewMessage && (
            <Text style={styles.previewMessage}>{previewMessage}</Text>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.selectionSection}>
            <Text style={styles.selectionLabel}>TEMPORARY BRACKET CANDIDATE</Text>
            <View style={styles.selectionOptions}>
              {BRACKET_CANDIDATES.map((candidate) => {
                const selected = candidate.id === selectedCandidateId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={candidate.id}
                    disabled={isCapturing}
                    onPress={() => setSelectedCandidateId(candidate.id)}
                    style={({ pressed }) => [
                      styles.selectionOption,
                      selected && styles.selectionOptionSelected,
                      isCapturing && styles.disabledSecondaryButton,
                      pressed && !isCapturing && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectionOptionTitle,
                        selected && styles.selectionOptionTitleSelected,
                      ]}
                    >
                      {candidate.title}
                    </Text>
                    <Text
                      style={[
                        styles.selectionOptionDetail,
                        selected && styles.selectionOptionDetailSelected,
                      ]}
                    >
                      {candidate.detail}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.selectionSection}>
            <Text style={styles.selectionLabel}>TEMPORARY EXPOSURE PLANNER</Text>
            <View style={styles.selectionOptions}>
              {EXPOSURE_PLANNERS.map((planner) => {
                const selected = planner.id === selectedPlannerId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={planner.id}
                    disabled={isCapturing}
                    onPress={() => setSelectedPlannerId(planner.id)}
                    style={({ pressed }) => [
                      styles.selectionOption,
                      selected && styles.selectionOptionSelected,
                      isCapturing && styles.disabledSecondaryButton,
                      pressed && !isCapturing && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectionOptionTitle,
                        selected && styles.selectionOptionTitleSelected,
                      ]}
                    >
                      {planner.title}
                    </Text>
                    <Text
                      style={[
                        styles.selectionOptionDetail,
                        selected && styles.selectionOptionDetailSelected,
                      ]}
                    >
                      {planner.detail}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isCapturing || previewStatus !== 'preview-ready'}
              onPress={() => void handleCaptureExperiment()}
              style={({ pressed }) => [
                styles.primaryButton,
                (isCapturing || previewStatus !== 'preview-ready') &&
                  styles.disabledButton,
                pressed && !isCapturing && styles.pressed,
              ]}
            >
              {isCapturing && <ActivityIndicator color="#FFFFFF" size="small" />}
              <Text style={styles.primaryButtonText}>
                {isCapturing
                  ? 'Capturing Camera2 experiment…'
                  : 'Capture Selected Manual Set'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isCapturing || isClearing}
              onPress={() => void handleClearFiles()}
              style={({ pressed }) => [
                styles.secondaryButton,
                (isCapturing || isClearing) && styles.disabledSecondaryButton,
                pressed && !isClearing && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {isClearing ? 'Clearing temporary files…' : 'Clear Temporary JPEGs'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Each run first captures a one-frame 0 EV AE control for the current
            manual baseline, then one real full-resolution Camera2
            captureBurst(). The bracket values and shutter caps are experiment
            inputs, not production settings.
          </Text>

          {comparison && (
            <ComparisonResults
              comparison={comparison}
              onSelectFrame={setSelectedFrame}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedFrame(null)}
        transparent
        visible={!!selectedFrame}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close full-frame inspection"
            accessibilityRole="button"
            onPress={() => setSelectedFrame(null)}
            style={styles.modalClose}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
          {!!selectedFrame?.fileUri && (
            <Image
              resizeMode="contain"
              source={{ uri: selectedFrame.fileUri }}
              style={styles.fullFrame}
            />
          )}
          <Text style={styles.modalCaption}>
            {selectedFrame?.label} · {selectedFrame?.width}×
            {selectedFrame?.height} · {selectedFrame?.byteSize ?? 0} bytes
          </Text>
        </View>
      </Modal>
    </View>
  );
}

function UnavailableScreen({
  actionLabel,
  loading = false,
  message,
  onAction,
}: {
  actionLabel?: string;
  loading?: boolean;
  message: string;
  onAction?: () => void;
}) {
  return (
    <SafeAreaView style={styles.unavailable}>
      <StatusBar style="dark" />
      {loading && <ActivityIndicator color="#C7A94E" size="large" />}
      <Text style={styles.eyebrow}>BALANCED PROTOTYPE</Text>
      <Text style={styles.unavailableTitle}>Camera2 development harness</Text>
      <Text style={styles.unavailableText}>{message}</Text>
      {!!onAction && !!actionLabel && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
      >
        <Text style={styles.backLinkText}>Back to Account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function ComparisonResults({
  comparison,
  onSelectFrame,
}: {
  comparison: BalancedPrototypeComparison;
  onSelectFrame: (frame: PrototypeFrame) => void;
}) {
  const strategies = [
    comparison.aeBaseline,
    comparison.manualExperiment.capture,
  ];

  return (
    <View style={styles.results}>
      <Text style={styles.resultsKicker}>LATEST CACHE-ONLY RESULT</Text>
      <Text style={styles.resultsTitle}>
        {comparison.camera.selectedJpegSize.width}×
        {comparison.camera.selectedJpegSize.height} Camera2 JPEG
      </Text>
      <Text style={styles.resultsBody}>
        Device {comparison.android.manufacturer} {comparison.android.model} ·
        Camera {comparison.camera.logicalCameraId} · {comparison.camera.timestampSource}
        {' '}timestamps
      </Text>
      <Text style={styles.resultsBody}>
        {comparison.manualExperiment.candidate.label} ·{' '}
        {comparison.manualExperiment.planner.label}
      </Text>

      {strategies.map((strategy) => (
        <View key={strategy.label} style={styles.strategy}>
          <View style={styles.strategyHeader}>
            <Text style={styles.strategyTitle}>{strategy.label}</Text>
            <Text style={styles.strategyStatus}>{strategy.status}</Text>
          </View>
          <Text style={styles.strategyTiming}>
            {formatNumber(strategy.totalDurationMs)} ms total · sensor intervals{' '}
            {strategy.interFrameSensorIntervalsMs
              .map(formatNumber)
              .join(', ') || 'n/a'} ms · callback intervals{' '}
            {strategy.interFrameCompletionIntervalsMs
              .map(formatNumber)
              .join(', ') || 'n/a'} ms
          </Text>

          <View style={styles.frameGrid}>
            {strategy.frames.map((frame) => (
              <Pressable
                accessibilityLabel={`Inspect ${strategy.label} ${frame.label} JPEG`}
                accessibilityRole="button"
                disabled={!frame.fileUri}
                key={`${strategy.label}-${frame.requestIndex}`}
                onPress={() => onSelectFrame(frame)}
                style={styles.frameCard}
              >
                {frame.fileUri ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: frame.fileUri }}
                    style={styles.thumbnail}
                  />
                ) : (
                  <View style={styles.missingThumbnail}>
                    <Text style={styles.missingThumbnailText}>No JPEG</Text>
                  </View>
                )}
                <Text style={styles.frameLabel}>{frame.label}</Text>
                <Text style={styles.frameMeta}>
                  requested {formatExposure(frame.requested)}
                </Text>
                <Text style={styles.frameMeta}>
                  actual {formatNumber(frame.actual.exposureTimeNs)} ns · ISO{' '}
                  {formatNumber(frame.actual.iso)}
                </Text>
                <Text style={styles.frameMeta}>
                  {frame.actual.aeState} · {frame.actual.afState} ·{' '}
                  {frame.actual.awbState}
                </Text>
                <Text style={styles.frameMeta}>
                  physical {frame.actual.activePhysicalCameraId ?? 'not exposed'}
                </Text>
                <Text style={styles.frameMeta}>
                  {formatSourceMetrics(frame.sourceFrameMetrics)}
                </Text>
                {!!frame.imageAssociation && (
                  <Text style={styles.frameMeta}>
                    JPEG linked by {frame.imageAssociation.replaceAll('-', ' ')}
                  </Text>
                )}
                {!!frame.failure && (
                  <Text style={styles.frameFailure}>{frame.failure}</Text>
                )}
              </Pressable>
            ))}
          </View>
          {!!strategy.failure && (
            <Text style={styles.frameFailure}>{strategy.failure}</Text>
          )}
        </View>
      ))}

      <MovementEvidence movementWindows={comparison.movementWindows} />
      <Text style={styles.resultsBody}>
        Detailed timestamped samples are retained in the dedicated temporary
        prototype cache as {comparison.storage.evidenceFilename ?? 'an evidence JSON file'}.
        No movement threshold or production warning is selected.
      </Text>
    </View>
  );
}

function MovementEvidence({
  movementWindows,
}: {
  movementWindows: Record<string, unknown>;
}) {
  const windows = [
    ['AE baseline', asRecord(movementWindows.aeBaseline)],
    ['Manual burst', asRecord(movementWindows.manualBurst)],
  ] as const;

  return (
    <View>
      <Text style={styles.movementTitle}>Movement windows (diagnostic only)</Text>
      {windows.map(([label, window]) => (
        <View key={label} style={styles.movementCard}>
          <Text style={styles.movementLabel}>{label}</Text>
          <Text style={styles.movementMetric}>
            Gyroscope: {formatMotionSummary(asRecord(window?.gyroscope))}
          </Text>
          <Text style={styles.movementMetric}>
            Linear acceleration: {formatMotionSummary(asRecord(window?.linearAcceleration))}
          </Text>
        </View>
      ))}
    </View>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatMotionSummary(summary: Record<string, unknown> | null) {
  const sampleCount = summary?.sampleCount;
  const sampleRateHz = summary?.sampleRateHz;
  const magnitudeRms = summary?.magnitudeRms;
  const magnitudePeak = summary?.magnitudePeak;
  return `${formatNumber(sampleCount as number | null)} samples · ${formatNumber(
    sampleRateHz as number | null,
  )} Hz · RMS ${formatNumber(magnitudeRms as number | null)} · peak ${formatNumber(
    magnitudePeak as number | null,
  )}`;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString('en-US') : 'n/a';
}

function formatExposure(requested: Record<string, unknown>) {
  if (typeof requested.sensorExposureTimeNs === 'number') {
    const requestedEv = requested.requestedEv;
    const evPrefix = typeof requestedEv === 'number' ? `${requestedEv > 0 ? '+' : ''}${requestedEv} EV · ` : '';
    return `${evPrefix}${requested.sensorExposureTimeNs.toLocaleString('en-US')} ns · ISO ${formatNumber(
      requested.sensorSensitivityIso as number | undefined,
    )}`;
  }

  return `${formatNumber(requested.aeRequestedEv as number | undefined)} EV`;
}

function formatSourceMetrics(metrics: SourceFrameMetrics | null) {
  if (!metrics || metrics.status !== 'measured') {
    return `source metrics unavailable${metrics?.failure ? `: ${metrics.failure}` : ''}`;
  }
  const percentiles = metrics.luminancePercentiles;
  const detail = metrics.detailProxy?.value;
  return `metrics: black ${formatNumber(metrics.nearBlack?.percentage)}% · white ${formatNumber(
    metrics.nearWhite?.percentage,
  )}% · p05/p95 ${formatNumber(percentiles?.p05)}/${formatNumber(percentiles?.p95)} · detail ${formatNumber(detail)}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#071A2B',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 38,
  },
  contentLandscape: {
    paddingHorizontal: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '300',
    lineHeight: 42,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 8,
  },
  eyebrow: {
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  intro: {
    marginTop: 16,
    color: '#D4DBDF',
    fontSize: 13,
    lineHeight: 19,
  },
  previewFrame: {
    overflow: 'hidden',
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#3E5060',
    borderRadius: 18,
    backgroundColor: '#000000',
  },
  previewFramePortrait: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  previewFrameLandscape: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  preview: {
    flex: 1,
  },
  previewOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    left: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  previewState: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },
  previewMessage: {
    marginTop: 9,
    color: '#B9C5CD',
    fontSize: 12,
    lineHeight: 17,
  },
  selectionSection: {
    marginTop: 20,
  },
  selectionLabel: {
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  selectionOptions: {
    marginTop: 9,
    gap: 8,
  },
  selectionOption: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#3E5060',
    borderRadius: 12,
    backgroundColor: '#102A3B',
  },
  selectionOptionSelected: {
    borderColor: '#C7A94E',
    backgroundColor: '#253743',
  },
  selectionOptionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  selectionOptionTitleSelected: {
    color: '#F4EFE8',
  },
  selectionOptionDetail: {
    marginTop: 3,
    color: '#B1BEC6',
    fontSize: 11,
    lineHeight: 16,
  },
  selectionOptionDetailSelected: {
    color: '#D8E2E8',
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#C7A94E',
  },
  primaryButtonText: {
    color: '#071A2B',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#617381',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#786B42',
  },
  disabledSecondaryButton: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  note: {
    marginTop: 15,
    color: '#9EADB8',
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    marginTop: 12,
    color: '#F0A4A4',
    fontSize: 13,
    lineHeight: 19,
  },
  results: {
    marginTop: 28,
  },
  resultsKicker: {
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  resultsTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
  },
  resultsBody: {
    marginTop: 6,
    color: '#BDCAD1',
    fontSize: 12,
    lineHeight: 18,
  },
  strategy: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3E5060',
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  strategyTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  strategyStatus: {
    color: '#C7A94E',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  strategyTiming: {
    marginTop: 6,
    color: '#B1BEC6',
    fontSize: 11,
    lineHeight: 17,
  },
  frameGrid: {
    marginTop: 12,
    gap: 10,
  },
  frameCard: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#3E5060',
    borderRadius: 12,
    backgroundColor: '#102A3B',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 7,
    backgroundColor: '#000000',
  },
  missingThumbnail: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#243B4B',
  },
  missingThumbnailText: {
    color: '#B1BEC6',
    fontSize: 12,
    fontWeight: '700',
  },
  frameLabel: {
    marginTop: 9,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  frameMeta: {
    marginTop: 3,
    color: '#BDCAD1',
    fontSize: 10,
    lineHeight: 15,
  },
  frameFailure: {
    marginTop: 5,
    color: '#F0A4A4',
    fontSize: 11,
    lineHeight: 16,
  },
  movementTitle: {
    marginTop: 22,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  movementCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#102B40',
  },
  movementLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  movementMetric: {
    marginTop: 5,
    color: '#BDCAD1',
    fontSize: 12,
    lineHeight: 18,
  },
  unavailable: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EFE8',
  },
  unavailableTitle: {
    marginTop: 11,
    color: '#071A2B',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  unavailableText: {
    marginTop: 14,
    maxWidth: 360,
    color: '#53616B',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  backLink: {
    marginTop: 18,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLinkText: {
    color: '#071A2B',
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
  },
  modalClose: {
    position: 'absolute',
    top: 54,
    right: 22,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fullFrame: {
    width: '100%',
    height: '78%',
  },
  modalCaption: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
});
