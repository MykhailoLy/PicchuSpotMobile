import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const colors = {
  navy: '#071A2B',
  gold: '#C7A94E',
  white: '#FFFFFF',
  muted: '#69747D',
  line: '#DED3C6',
};

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarStyle: {
            height: 72,
            paddingTop: 8,
            paddingBottom: 10,
            backgroundColor: colors.white,
            borderTopColor: colors.line,
            borderTopWidth: 1,
          },
          tabBarIconStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Shoots',
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
          }}
        />

        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
          }}
        />
      </Tabs>
    </>
  );
}