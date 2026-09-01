import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BalancedPrototypeModule, {
  BalancedPrototypePreview,
  BalancedCompatibilityInventory,
  BalancedCompatibilityProbeReport,
  PrototypeStatus,
} from '../../modules/PicchuSpotBalancedPrototype';

const UNAVAILABLE_MESSAGE =
  'This development-only compatibility probe is available only in Android development builds.';

export default function BalancedCompatibilityProbeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraId, setCameraId] = useState('0');
  const [previewStatus, setPreviewStatus] =
    useState<PrototypeStatus>('opening-camera');
  const [inventory, setInventory] =
    useState<BalancedCompatibilityInventory | null>(null);
  const [report, setReport] =
    useState<BalancedCompatibilityProbeReport | null>(null);
  const [evidenceJson, setEvidenceJson] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const inspect = useCallback(async () => {
    if (!BalancedPrototypeModule) {
      setMessage('The development-only native module is unavailable.');
      return;
    }
    setIsInspecting(true);
    setMessage(null);
    try {
      const next = await BalancedPrototypeModule.inspectCompatibilityAsync();
      setInventory(next);
      const selected = next.cameraTopology?.selectedRearCameraId;
      if (selected && selected !== cameraId) {
        setCameraId(selected);
        setMessage(
          'Selected the capability-ranked rear camera ' +
            selected +
            '. Preview is restarting before runtime validation.',
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Static Camera2 capability inspection could not complete.',
      );
    } finally {
      setIsInspecting(false);
    }
  }, [cameraId]);

  const readLatestEvidence = useCallback(async () => {
    if (!BalancedPrototypeModule) return;
    try {
      const latest = await BalancedPrototypeModule.readLatestCompatibilityProbeAsync();
      setEvidenceJson(latest.json);
      if (latest.failure) setMessage(latest.failure);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Compatibility evidence could not be read from app cache.',
      );
    }
  }, []);

  const runProbe = async () => {
    if (!BalancedPrototypeModule) return;
    setIsRunning(true);
    setMessage(null);
    try {
      const next = await BalancedPrototypeModule.runCompatibilityProbeAsync();
      setReport(next);
      setEvidenceJson(JSON.stringify(next, null, 2));
      const selected = next.cameraTopology?.selectedRearCameraId;
      if (selected && selected !== cameraId) {
        setMessage(
          'The selected rear camera changed while the preview was mounted. Inspect again, then rerun after the preview restarts.',
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'The candidate compatibility runtime validation could not complete.',
      );
    } finally {
      setIsRunning(false);
    }
  };

  const clearEvidence = async () => {
    if (!BalancedPrototypeModule) return;
    try {
      const result = await BalancedPrototypeModule.clearCompatibilityProbeFilesAsync();
      setReport(null);
      setEvidenceJson(null);
      setMessage(
        result.failure ??
          'Cleared ' + result.removedFileCount + ' compatibility-probe cache files.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Compatibility-probe cache cleanup could not complete.',
      );
    }
  };

  if (!__DEV__ || Platform.OS !== 'android') {
    return <UnavailableScreen />;
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#C7A94E" />
        <Text style={styles.body}>Checking Camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
        <Text style={styles.title}>Balanced compatibility probe</Text>
        <Text style={styles.body}>
          Camera permission is required to inspect and validate the selected
          non-production Camera2 candidate.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Allow Camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const classification = report?.classification;
  const selectedCamera = inventory?.cameraTopology?.selectedRearCameraId;
  const readyToRun =
    previewStatus === 'preview-ready' &&
    inventory?.staticEvaluation?.requiredContractPassed === true &&
    selectedCamera === cameraId;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Account"
            onPress={() => router.back()}
          >
            <Text style={styles.back}>‹ Account</Text>
          </Pressable>
          <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
          <Text style={styles.title}>Balanced compatibility</Text>
          <Text style={styles.body}>
            Capability-driven Camera2 evidence only. This never enables
            production Balanced, affects Quick, writes a Shoot, or uploads.
          </Text>
        </View>

        <View style={styles.preview}>
          <BalancedPrototypePreview
            cameraId={cameraId}
            zoomRatio={1}
            onStatusChanged={(event) => {
              setPreviewStatus(event.nativeEvent.status);
              if (event.nativeEvent.status === 'error') {
                setMessage(event.nativeEvent.message ?? 'Camera2 preview failed.');
              }
            }}
            style={styles.previewNative}
          />
        </View>

        <Text style={styles.status}>
          Preview: {previewStatus.replaceAll('-', ' ')} · requested camera {cameraId}
        </Text>
        {!!message && <Text style={styles.message}>{message}</Text>}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isInspecting || isRunning || previewStatus !== 'preview-ready'}
            onPress={() => void inspect()}
            style={({ pressed }) => [
              styles.secondaryButton,
              (isInspecting || isRunning || previewStatus !== 'preview-ready') &&
                styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isInspecting ? 'Inspecting…' : 'Inspect static capabilities'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!readyToRun || isRunning || isInspecting}
            onPress={() => void runProbe()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!readyToRun || isRunning || isInspecting) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isRunning ? 'Running candidate burst…' : 'Run runtime validation'}
            </Text>
          </Pressable>
        </View>

        <InventoryCard inventory={inventory} />
        <ClassificationCard classification={classification} />

        <View style={styles.evidence}>
          <Text style={styles.sectionTitle}>LOCAL JSON EVIDENCE</Text>
          <Text style={styles.body}>
            Reports and temporary probe JPEGs remain app-private in cache only.
            Read the generated JSON here, or retrieve the named cache report by
            local development tooling. Clearing affects only this probe folder.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void readLatestEvidence()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Read latest JSON</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void clearEvidence()}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearButtonText}>Clear probe cache</Text>
            </Pressable>
          </View>
          {!!evidenceJson && (
            <ScrollView horizontal style={styles.jsonScroll}>
              <Text selectable style={styles.json}>
                {evidenceJson}
              </Text>
            </ScrollView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InventoryCard({
  inventory,
}: {
  inventory: BalancedCompatibilityInventory | null;
}) {
  if (!inventory?.staticEvaluation) return null;
  const camera = inventory.cameraTopology?.selectedRearCameraId ?? 'none';
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>STATIC CONTRACT</Text>
      <Text style={styles.cardTitle}>
        {inventory.staticEvaluation.requiredContractPassed ? 'Static contract passed' : 'Static contract limited'}
      </Text>
      <Text style={styles.body}>Selected rear camera: {camera}</Text>
      {inventory.staticEvaluation.reasons.map((reason) => (
        <Text key={reason} style={styles.reason}>
          • {reason}
        </Text>
      ))}
    </View>
  );
}

function ClassificationCard({
  classification,
}: {
  classification: BalancedCompatibilityProbeReport['classification'] | undefined;
}) {
  if (!classification) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>ENGINEERING CLASSIFICATION</Text>
      <Text style={styles.classification}>{classification.status}</Text>
      {classification.reasons.map((reason) => (
        <Text key={reason} style={styles.reason}>
          • {reason}
        </Text>
      ))}
    </View>
  );
}

function UnavailableScreen() {
  return (
    <SafeAreaView style={styles.centered}>
      <Text style={styles.eyebrow}>UNAVAILABLE</Text>
      <Text style={styles.title}>Compatibility probe</Text>
      <Text style={styles.body}>{UNAVAILABLE_MESSAGE}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071A2B' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#071A2B',
  },
  content: { padding: 20, paddingBottom: 44, gap: 16 },
  header: { gap: 9 },
  back: { color: '#F4EFE8', fontSize: 14, fontWeight: '700' },
  eyebrow: { color: '#C7A94E', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  body: { color: '#C5D0D8', fontSize: 14, lineHeight: 20 },
  preview: { height: 240, overflow: 'hidden', borderRadius: 16, backgroundColor: '#000000' },
  previewNative: { flex: 1 },
  status: { color: '#C7A94E', fontSize: 12, fontWeight: '700' },
  message: { color: '#F4EFE8', fontSize: 13, lineHeight: 19 },
  actions: { gap: 10 },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: '#C7A94E',
  },
  primaryButtonText: { color: '#071A2B', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6C7E8B',
    borderRadius: 14,
    paddingHorizontal: 18,
  },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  clearButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A86A60',
    borderRadius: 14,
  },
  clearButtonText: { color: '#F0BCB5', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  card: {
    gap: 9,
    padding: 16,
    borderWidth: 1,
    borderColor: '#385064',
    borderRadius: 16,
    backgroundColor: '#102A3B',
  },
  sectionTitle: { color: '#C7A94E', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  classification: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
  reason: { color: '#C5D0D8', fontSize: 13, lineHeight: 19 },
  evidence: { gap: 12, paddingTop: 8 },
  jsonScroll: {
    maxHeight: 380,
    borderWidth: 1,
    borderColor: '#385064',
    borderRadius: 12,
    backgroundColor: '#06131E',
  },
  json: { padding: 12, color: '#DCE6EC', fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
});
