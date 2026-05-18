import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

// Validasi nomor HP Indonesia: 08xx / +628xx / 628xx, 10–13 digit
function isValidPhone(phone: string): boolean {
  return /^(\+?62|0)8[1-9][0-9]{6,10}$/.test(phone.trim());
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+62')) return '0' + trimmed.slice(3);
  if (trimmed.startsWith('62'))  return '0' + trimmed.slice(2);
  return trimmed;
}

export default function RegisterScreen() {
  const router = useRouter();
  const login  = useAuthStore(s => s.login);

  const [fullName,        setFullName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);

  const phoneTouched    = phone.length > 0;
  const phoneValid      = isValidPhone(phone);
  const passwordMatch   = password === confirmPassword;
  const confirmTouched  = confirmPassword.length > 0;

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Lengkapi Data', 'Nama, email, dan password wajib diisi.');
      return;
    }
    if (phone && !phoneValid) {
      Alert.alert('Nomor Tidak Valid', 'Masukkan nomor WhatsApp yang valid.\nContoh: 08123456789');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password Terlalu Pendek', 'Password minimal 8 karakter.');
      return;
    }
    if (!passwordMatch) {
      Alert.alert('Password Tidak Cocok', 'Pastikan konfirmasi password sama dengan password yang dimasukkan.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = phone ? normalizePhone(phone) : '';
      await api.post('/auth/register', {
        full_name: fullName.trim(),
        email:     email.trim(),
        phone:     normalizedPhone,
        password,
      });
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Pendaftaran gagal. Coba lagi.';
      Alert.alert('Gagal Daftar', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Buat Akun</Text>
          <Text style={styles.subtitle}>Bergabung dan temukan event terbaikmu</Text>

          <View style={styles.form}>

            {/* Nama Lengkap */}
            <View style={styles.field}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="john@email.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* No. WhatsApp */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>No. WhatsApp</Text>
                <Text style={styles.optional}>Opsional</Text>
              </View>
              <TextInput
                style={[styles.input, phoneTouched && !phoneValid && styles.inputError]}
                placeholder="08xxxxxxxxxx"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              {phoneTouched && (
                <Text style={phoneValid ? styles.matchOk : styles.matchErr}>
                  {phoneValid
                    ? '✓ Nomor valid'
                    : '✗ Format tidak valid — contoh: 08123456789 atau +6281234567'}
                </Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 8 karakter"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {password.length > 0 && password.length < 8 && (
                <Text style={styles.matchErr}>✗ Password minimal 8 karakter</Text>
              )}
            </View>

            {/* Konfirmasi Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Konfirmasi Password</Text>
              <TextInput
                style={[styles.input, confirmTouched && !passwordMatch && styles.inputError]}
                placeholder="Ulangi password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {confirmTouched && (
                <Text style={passwordMatch ? styles.matchOk : styles.matchErr}>
                  {passwordMatch ? '✓ Password cocok' : '✗ Password tidak cocok'}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>Daftar Sekarang</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.switchText}>
                Sudah punya akun? <Text style={styles.switchLink}>Masuk</Text>
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24, paddingBottom: 48 },
  backBtn:   { marginBottom: 24, alignSelf: 'flex-start' },
  backText:  { fontSize: 32, color: '#1D63ED', fontWeight: '300', lineHeight: 36 },
  title:     { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle:  { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  form:      { gap: 16 },
  field:     { gap: 6 },
  labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  optional:  { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  matchOk:   { fontSize: 12, color: '#059669', fontWeight: '600' },
  matchErr:  { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  btn:         { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  switchText:  { textAlign: 'center', color: '#6B7280', fontSize: 14 },
  switchLink:  { color: '#6366F1', fontWeight: '700' },
});
