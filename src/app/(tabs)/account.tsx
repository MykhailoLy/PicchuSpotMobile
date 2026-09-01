import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PICCHUSPOT</Text>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.text}>
          Profile, preferences and account settings will live here.
        </Text>

        {__DEV__ && (
          <View style={styles.developmentTools}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/camera-diagnostics' as Href)}
              style={({ pressed }) => [
                styles.diagnosticsButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.diagnosticsKicker}>DEVELOPMENT ONLY</Text>
              <Text style={styles.diagnosticsTitle}>Camera2 diagnostics</Text>
              <Text style={styles.diagnosticsBody}>
                Inspect rear-camera capabilities and run the temporary native
                feasibility probes.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push('/balanced-capture-prototype' as Href)
              }
              style={({ pressed }) => [
                styles.diagnosticsButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.diagnosticsKicker}>DEVELOPMENT ONLY</Text>
              <Text style={styles.diagnosticsTitle}>
                Balanced capture prototype
              </Text>
              <Text style={styles.diagnosticsBody}>
                Compare real Camera2 AE JPEG sequencing with a manual Camera2
                JPEG burst. This does not alter Quick capture.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push('/balanced-compatibility-probe' as Href)
              }
              style={({ pressed }) => [
                styles.diagnosticsButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.diagnosticsKicker}>DEVELOPMENT ONLY</Text>
              <Text style={styles.diagnosticsTitle}>
                Balanced compatibility probe
              </Text>
              <Text style={styles.diagnosticsBody}>
                Validate the current manual Camera2 candidate from actual
                capability data and one temporary JPEG burst.
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  eyebrow: {
    color: '#C7A94E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 12,
    color: '#071A2B',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  text: {
    marginTop: 16,
    maxWidth: 330,
    color: '#69747D',
    fontSize: 16,
    lineHeight: 24,
  },
  diagnosticsButton: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#DED3C6',
    borderRadius: 16,
    backgroundColor: '#F4EFE8',
  },
  developmentTools: {
    marginTop: 36,
    gap: 12,
  },
  diagnosticsKicker: {
    color: '#C7A94E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  diagnosticsTitle: {
    marginTop: 8,
    color: '#071A2B',
    fontSize: 18,
    fontWeight: '700',
  },
  diagnosticsBody: {
    marginTop: 7,
    color: '#53616B',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.82,
  },
});
