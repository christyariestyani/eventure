import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const restore = useAuthStore(s => s.restore);

  useEffect(() => {
    restore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="event/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="booking/[id]/checkout"
          options={{ headerShown: true, title: 'Checkout', headerBackTitle: '' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
