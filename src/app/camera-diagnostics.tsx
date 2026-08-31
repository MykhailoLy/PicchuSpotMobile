import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CameraDiagnosticsModule, {
  type CameraDiagnosticRun,
  type CameraInventory,
  type SensorDiagnosticRun,
} from '../../modules/PicchuSpotCameraDiagnostics';

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2) ?? 'No diagnostic output.';
}

export default function CameraDiagnosticsScreen() {
  const [inventory, setInventory] = useState<CameraInventory | null>(null);
  const [run, setRun] = useState<CameraDiagnosticRun | null>(null);
  const [sensorRun, setSensorRun] = useState<SensorDiagnosticRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningSensors, setIsRunningSensors] = useState(false);
  const [sensorPhase, setSensorPhase] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    if (Platform.OS !== 'android' || !CameraDiagnosticsModule) {
      setError('Camera2 diagnostics require the Android development build.');
      return;
    }

    setIsLoadingInventory(true);
    setError(null);

    try {
      setInventory(await CameraDiagnosticsModule.getCameraDiagnosticsAsync());
    } catch (loadError) {
      console.error(loadError);
      setError('The native Camera2 inventory could not be loaded.');
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    if (Platform.OS !== 'android' || !CameraDiagnosticsModule) {
      setError('Camera2 diagnostics require the Android development build.');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      setRun(await CameraDiagnosticsModule.runDiagnosticsAsync());
    } catch (diagnosticError) {
      console.error(diagnosticError);
      setError('The native Camera2 diagnostics could not be completed.');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const runSensorDiagnostics = useCallback(async () => {
    if (Platform.OS !== 'android' || !CameraDiagnosticsModule) {
      setError('Sensor diagnostics require the Android development build.');
      return;
    }

    setIsRunningSensors(true);
    setError(null);
    setSensorPhase('Hold the handset still for 3 seconds.');
    const phaseTimers = [
      setTimeout(() => {
        setSensorPhase('Prepare to move the handset…');
      }, 3_000),
      setTimeout(() => {
        setSensorPhase('Move the handset deliberately for 3 seconds.');
      }, 4_500),
    ];

    try {
      setSensorRun(await CameraDiagnosticsModule.runSensorDiagnosticsAsync());
      setSensorPhase('Sensor probe complete.');
    } catch (sensorError) {
      console.error(sensorError);
      setError('The native level and movement diagnostics could not be completed.');
      setSensorPhase(null);
    } finally {
      phaseTimers.forEach(clearTimeout);
      setIsRunningSensors(false);
    }
  }, []);

  useEffect(() => {
    if (!__DEV__) {
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      void loadInventory();
    });
    return () => task.cancel();
  }, [loadInventory]);

  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <StatusBar style="dark" />
        <Text style={styles.eyebrow}>CAMERA2 SPIKE</Text>
        <Text style={styles.title}>Development-only screen</Text>
        <Text style={styles.body}>
          This diagnostic harness is not available in a production build.
        </Text>
      </SafeAreaView>
    );
  }

  const isBusy = isLoadingInventory || isRunning || isRunningSensors;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to Account"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
            <Text style={styles.title}>Camera2 diagnostics</Text>
          </View>
        </View>

        <Text style={styles.body}>
          Native Camera2 capability inventory and temporary feasibility probes.
          Frames are read through an app-private YUV surface and discarded; no
          images enter Gallery, Shoot SQLite, uploads, or production flows.
        </Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void loadInventory()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isLoadingInventory ? 'Loading inventory…' : 'Refresh inventory'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void runDiagnostics()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            {isRunning && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text style={styles.primaryButtonText}>
              {isRunning ? 'Running diagnostics…' : 'Run diagnostics'}
            </Text>
          </Pressable>
          <Text style={styles.sensorHint}>
            Sensor timing: keep the phone still for 3 seconds, use the 1.5-second
            transition to prepare, then move it deliberately for 3 seconds.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void runSensorDiagnostics()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}
          >
            {isRunningSensors && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text style={styles.primaryButtonText}>
              {isRunningSensors ? 'Measuring sensors…' : 'Run level + movement probe'}
            </Text>
          </Pressable>
          {!!sensorPhase && <Text style={styles.sensorPhase}>{sensorPhase}</Text>}
        </View>

        <Text style={styles.sectionLabel}>REAR CAMERA INVENTORY</Text>
        <Text selectable style={styles.output}>
          {inventory ? formatJson(inventory) : 'Inventory not loaded.'}
        </Text>

        <Text style={styles.sectionLabel}>DYNAMIC RESULTS</Text>
        <Text selectable style={styles.output}>
          {run ? formatJson(run) : 'Run diagnostics to collect dynamic results.'}
        </Text>

        <Text style={styles.sectionLabel}>LEVEL + MOVEMENT RESULTS</Text>
        <Text selectable style={styles.output}>
          {sensorRun
            ? formatJson(sensorRun)
            : 'Run the timed sensor probe to collect still and movement results.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stateScreen: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EFE8',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: {
    width: 40,
    color: '#071A2B',
    fontSize: 42,
    fontWeight: '300',
    lineHeight: 44,
  },
  headerCopy: {
    flex: 1,
    paddingLeft: 8,
  },
  eyebrow: {
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 9,
    color: '#071A2B',
    fontSize: 29,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  body: {
    marginTop: 18,
    color: '#53616B',
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    marginTop: 16,
    color: '#8E2E2E',
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
    marginTop: 22,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#071A2B',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#DED3C6',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4EFE8',
  },
  secondaryButtonText: {
    color: '#071A2B',
    fontSize: 14,
    fontWeight: '700',
  },
  sensorHint: {
    color: '#53616B',
    fontSize: 12,
    lineHeight: 18,
  },
  sensorPhase: {
    color: '#071A2B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 30,
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  output: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    color: '#DDE6EC',
    backgroundColor: '#071A2B',
    fontFamily: Platform.select({ android: 'monospace', default: undefined }),
    fontSize: 11,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.5,
  },
});
