import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import AppSplash from '../components/AppSplash';
import OnboardingQuiz from '../components/OnboardingQuiz';
import { usePreferences } from '../hooks/usePreferences';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  },
});

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const { data: prefs } = usePreferences(!!user);
  const [dismissed, setDismissed] = useState(false);

  const showOnboarding = !!user && prefs !== undefined && !prefs.onboarding_done && !dismissed;

  return (
    <>
      {children}
      <Modal visible={showOnboarding} animationType="slide" presentationStyle="fullScreen">
        <OnboardingQuiz onDone={() => setDismissed(true)} />
      </Modal>
    </>
  );
}

export default function RootLayout() {
  const restore = useAuthStore(s => s.restore);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    restore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!splashDone && <AppSplash onFinish={() => setSplashDone(true)} />}
      <OnboardingGate>
        <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="booking/[id]/index" />
          <Stack.Screen name="booking/[id]/checkout" />
          <Stack.Screen name="preferences" />
        </Stack>
      </OnboardingGate>
    </QueryClientProvider>
  );
}
