import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const handleNewShoot = () => {
    Alert.alert('Test', 'Button works');
    router.push('/new-shoot');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>PicchuSpot</Text>

        <Pressable style={styles.button} onPress={handleNewShoot}>
          <Text style={styles.buttonText}>New Shoot</Text>
        </Pressable>
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
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 30,
    color: '#071A2B',
    fontSize: 36,
    fontWeight: '700',
  },
  button: {
    height: 60,
    borderRadius: 16,
    backgroundColor: '#071A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});