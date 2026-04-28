import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

const P = '#5B8EF0';

const MENU_SECTIONS = [
  {
    title: 'Aktivitas',
    items: [
      { icon: '🎫', label: 'Tiket Saya', route: '/(tabs)/bookings', chevron: true },
      { icon: '❤️', label: 'Event Favorit', route: null, chevron: true },
    ],
  },
  {
    title: 'Akun',
    items: [
      { icon: '👤', label: 'Edit Profil', route: null, chevron: true },
      { icon: '🔔', label: 'Notifikasi', route: null, chevron: true },
      { icon: '⚙️', label: 'Pengaturan', route: null, chevron: true },
    ],
  },
  {
    title: 'Bantuan',
    items: [
      { icon: '❓', label: 'Pusat Bantuan', route: null, chevron: true },
      { icon: '📝', label: 'Syarat & Ketentuan', route: null, chevron: true },
    ],
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar dari akun ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Akun</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>?</Text>
          </View>
          <Text style={styles.emptyTitle}>Belum Login</Text>
          <Text style={styles.emptyText}>Login untuk akses semua fitur</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>Login / Daftar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Akun</Text>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Tiket Aktif</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Dihadiri</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Favorit</Text>
          </View>
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map(section => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => item.route && router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIconWrap}>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  {item.chevron && <Text style={styles.chevron}>›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>🚪  Keluar dari Akun</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFD' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF2F9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EEF3FF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#C7D7FD',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: P },
  userName: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  userEmail: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  editBtn: {
    backgroundColor: '#EEF3FF',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: '#C7D7FD',
  },
  editBtnText: { fontSize: 13, color: P, fontWeight: '600' },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#5B8EF0', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: '#EEF3FF',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 22, fontWeight: '800', color: P },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#EEF3FF' },

  // Menu
  menuSection: { paddingHorizontal: 16, marginTop: 20 },
  menuSectionTitle: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8, letterSpacing: 0.8 },
  menuCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#5B8EF0', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#EFF2F9',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFD' },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center',
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 14, color: '#1E293B', fontWeight: '500' },
  chevron: { fontSize: 20, color: '#C7D7FD' },

  // Logout
  logoutBtn: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#FFFFFF', paddingVertical: 14,
    borderRadius: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FCA5A5',
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },

  // Not logged in
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  avatarLargeText: { fontSize: 32, color: '#94A3B8' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  loginBtn: {
    backgroundColor: P, paddingVertical: 13, paddingHorizontal: 40,
    borderRadius: 12, marginTop: 8,
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
