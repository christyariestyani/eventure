import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { usePreferences } from '../hooks/usePreferences';
import OnboardingQuiz from '../components/OnboardingQuiz';

export default function PreferencesScreen() {
  const router = useRouter();
  const { data: prefs, isLoading } = usePreferences();

  if (isLoading || !prefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5B8EF0" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Preferensi',
        headerBackVisible: false,
        headerShadowVisible: false,
        headerLeft: () => null,
      }} />
      <OnboardingQuiz
        mode="edit"
        initialValues={prefs}
        onDone={() => router.back()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFD' },
});
