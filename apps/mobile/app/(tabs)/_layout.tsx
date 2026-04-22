import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const TAB_ICON: Record<string, string> = {
  index: '🏠',
  search: '🔍',
  bookings: '🎫',
  profile: '👤',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICON[route.name] ?? '•'}</Text>
        ),
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#F3F4F6', height: 60, paddingBottom: 8 },
        headerShown: false,
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Tiketku' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
