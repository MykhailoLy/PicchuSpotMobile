import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#FFFFFF',
          },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="new-shoot"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
    </>
  );
}