import { useState } from 'react';
import { StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Input } from '../../components/input';
import { Button } from '../../components/button';
import { useAuthStore } from '../../stores/auth-store';
import { useTheme } from '../../hooks/use-theme';
import { Spacing } from '../../constants/theme';

export default function PhoneLoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const sendPhoneOtp = useAuthStore((s) => s.sendPhoneOtp);
  const verifyPhoneOtp = useAuthStore((s) => s.verifyPhoneOtp);
  const colors = useTheme();
  const router = useRouter();

  const handleSendOtp = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(phone);
      setStep('otp');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone, otp);
      router.replace('/(app)/todos');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText variant="title" style={styles.title}>Phone Login</ThemedText>
          <ThemedText variant="secondary" style={styles.subtitle}>
            {step === 'phone' ? 'Enter your phone number to receive a code' : 'Enter the 6-digit code sent to your phone'}
          </ThemedText>

          {step === 'phone' ? (
            <>
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1234567890"
                keyboardType="phone-pad"
                testID="phone-input"
              />
              <Button title="Send Code" onPress={handleSendOtp} loading={loading} style={styles.button} testID="send-code-button" />
            </>
          ) : (
            <>
              <Input
                label="Verification Code"
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                testID="otp-input"
              />
              <Button title="Verify" onPress={handleVerifyOtp} loading={loading} style={styles.button} testID="verify-button" />
              <Button
                title="Resend Code"
                variant="outline"
                onPress={handleSendOtp}
                style={styles.resend}
              />
            </>
          )}

          <Link href="/(auth)/login" style={[styles.link, { color: colors.primary }]}>
            Back to Email Login
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  title: { marginBottom: Spacing.xs },
  subtitle: { marginBottom: Spacing.xl },
  button: { marginTop: Spacing.sm },
  resend: { marginTop: Spacing.sm },
  link: {
    marginTop: Spacing.lg,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
