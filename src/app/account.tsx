import { StyleSheet, Text, View } from 'react-native';
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
});