import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function RegisterScreen() {
  const router = useRouter();
  const login = useAuthStore(s => s.login);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Nama, email, dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', { full_name: fullName, email: email.trim(), phone, password });
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
            {[
              { label: 'Nama Lengkap', value: fullName, onChange: setFullName, placeholder: 'John Doe', type: 'default' },
              { label: 'Email', value: email, onChange: setEmail, placeholder: 'john@email.com', type: 'email-address' },
              { label: 'No. WhatsApp', value: phone, onChange: setPhone, placeholder: '08xxxxxxxxxx', type: 'phone-pad' },
              { label: 'Password', value: password, onChange: setPassword, placeholder: 'Min. 8 karakter', type: 'default', secure: true },
            ].map(field => (
              <View key={field.label} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor="#9CA3AF"
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType={field.type as any}
                  secureTextEntry={field.secure}
                  autoCapitalize={field.type === 'email-address' ? 'none' : 'words'}
                  autoCorrect={false}
                />
              </View>
            ))}

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
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 24, alignSelf: 'flex-start' },
  backText: { fontSize: 32, color: '#1D63ED', fontWeight: '300', lineHeight: 36 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 28 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  btn: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  switchText: { textAlign: 'center', color: '#6B7280', fontSize: 14 },
  switchLink: { color: '#6366F1', fontWeight: '700' },
});
