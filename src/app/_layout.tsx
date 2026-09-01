import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          orientation: 'portrait',
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

        <Stack.Screen
          name="shoot-media"
          options={{
            animation: 'slide_from_right',
          }}
        />

        <Stack.Screen
          name="shoot-camera"
          options={{
            animation: 'fade',
            gestureEnabled: false,
            orientation: 'all',
          }}
        />

        <Stack.Screen
          name="camera-diagnostics"
          options={{
            animation: 'slide_from_right',
            orientation: 'portrait',
          }}
        />

        <Stack.Screen
          name="balanced-capture-prototype"
          options={{
            animation: 'fade',
            gestureEnabled: false,
            orientation: 'all',
          }}
        />
      </Stack>
    </>
  );
}
