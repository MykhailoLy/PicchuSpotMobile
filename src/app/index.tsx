import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  navy: '#071A2B',
  ivory: '#F4EFE8',
  gold: '#C7A94E',
  line: '#DED3C6',
  white: '#FFFFFF',
  muted: '#64707A',
};

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>PICCHUSPOT</Text>
            <Text style={styles.eyebrow}>REAL ESTATE VISUALS</Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>P</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>
            Property media,{'\n'}ready to move.
          </Text>

          <Text style={styles.subtitle}>
            Capture, organise and order professional real-estate visuals from
            one place.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new shoot"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonIcon}>+</Text>
            <Text style={styles.primaryButtonText}>New Shoot</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Shoots</Text>
          <Text style={styles.sectionAction}>View all</Text>
        </View>

        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>+</Text>
          </View>

          <Text style={styles.emptyTitle}>No shoots yet</Text>

          <Text style={styles.emptyText}>
            Create your first property shoot to start capturing and organising
            photos.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  eyebrow: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  hero: {
    paddingTop: 42,
    paddingBottom: 48,
  },
  title: {
    color: colors.navy,
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  subtitle: {
    marginTop: 18,
    maxWidth: 330,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  primaryButton: {
    marginTop: 32,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonIcon: {
    color: colors.gold,
    fontSize: 25,
    lineHeight: 25,
    fontWeight: '400',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingTop: 6,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginTop: 18,
    color: colors.navy,
    fontSize: 19,
    fontWeight: '700',
  },
  sectionAction: {
    marginTop: 18,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    minHeight: 245,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ivory,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },
  emptyIconText: {
    color: colors.gold,
    fontSize: 24,
    fontWeight: '500',
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
});