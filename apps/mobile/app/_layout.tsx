import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import AppSplash from '../components/AppSplash';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  },
});

export default function RootLayout() {
  const restore = useAuthStore(s => s.restore);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    restore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!splashDone && <AppSplash onFinish={() => setSplashDone(true)} />}
      <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="booking/[id]/index" />
        <Stack.Screen name="booking/[id]/checkout" />
      </Stack>
    </QueryClientProvider>
  );
}
