import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

const PRIMARY = '#5B8EF0';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⌂" label="Beranda" />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⊙" label="Cari" />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◫" label="Tiketku" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◉" label="Akun" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 8 },
  tabIcon: { fontSize: 22, color: '#AAAAAA' },
  tabIconActive: { color: '#0064D2' },
  tabLabel: { fontSize: 10, color: '#AAAAAA', fontWeight: '500' },
  tabLabelActive: { color: '#0064D2', fontWeight: '700' },
});
