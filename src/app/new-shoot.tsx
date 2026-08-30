import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#69747D',
};

export default function NewShootScreen() {
  const [propertyName, setPropertyName] = useState('');
  const [address, setAddress] = useState('');

  const canContinue = propertyName.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => router.back()}
            >
              <Text style={styles.back}>‹</Text>
            </Pressable>

            <Text style={styles.step}>NEW SHOOT</Text>

            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>Property details</Text>

            <Text style={styles.subtitle}>
              Give this shoot a clear name so you can find it quickly later.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Property name</Text>

              <TextInput
                accessibilityLabel="Property name"
                autoCapitalize="words"
                autoCorrect={false}
                placeholder="Villa Jávea"
                placeholderTextColor="#9AA2A8"
                returnKeyType="next"
                value={propertyName}
                onChangeText={setPropertyName}
                style={styles.input}
              />

              <Text style={styles.helper}>
                Required · Visible only inside your account.
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>

              <TextInput
                accessibilityLabel="Property address"
                autoCapitalize="words"
                placeholder="Optional"
                placeholderTextColor="#9AA2A8"
                value={address}
                onChangeText={setAddress}
                style={styles.input}
              />

              <Text style={styles.helper}>
                Optional for now. You can add or change it later.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            disabled={!canContinue}
            onPress={() => {
              // Local-only prototype for now.
              console.log({
                propertyName: propertyName.trim(),
                address: address.trim(),
              });
            }}
            style={({ pressed }) => [
              styles.continueButton,
              !canContinue && styles.continueButtonDisabled,
              pressed && canContinue && styles.continueButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.continueText,
                !canContinue && styles.continueTextDisabled,
              ]}
            >
              Continue
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 36,
    color: colors.navy,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '300',
  },
  step: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  topBarSpacer: {
    width: 36,
  },
  intro: {
    paddingTop: 38,
  },
  title: {
    color: colors.navy,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 15,
    maxWidth: 340,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    marginTop: 48,
    gap: 30,
  },
  field: {
    gap: 9,
  },
  label: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 58,
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.white,
    color: colors.navy,
    fontSize: 16,
  },
  helper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  continueButton: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  continueButtonDisabled: {
    backgroundColor: colors.ivory,
  },
  continueButtonPressed: {
    opacity: 0.88,
  },
  continueText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  continueTextDisabled: {
    color: '#9AA2A8',
  },
});