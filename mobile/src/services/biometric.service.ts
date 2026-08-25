import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_LAST_AUTH_AT_KEY = 'biometric_last_auth_at';
const UNLOCK_GRACE_PERIOD_MS = 60_000;

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  return { available, enrolled, types };
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, String(enabled));
  if (!enabled) {
    await SecureStore.deleteItemAsync(BIOMETRIC_LAST_AUTH_AT_KEY);
  }
}

export async function canUseBiometricAuth(): Promise<boolean> {
  const capability = await getBiometricCapability();
  return capability.available && capability.enrolled;
}

async function markAuthenticated(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_LAST_AUTH_AT_KEY, String(Date.now()));
}

export async function isWithinUnlockGracePeriod(): Promise<boolean> {
  const lastAuthAt = await SecureStore.getItemAsync(BIOMETRIC_LAST_AUTH_AT_KEY);
  if (!lastAuthAt) return false;
  return Date.now() - Number(lastAuthAt) < UNLOCK_GRACE_PERIOD_MS;
}

export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  if (!(await canUseBiometricAuth())) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use passcode',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (result.success) {
    await markAuthenticated();
  }

  return result.success;
}

export async function authenticateAppUnlock(): Promise<boolean> {
  if (!(await isBiometricEnabled())) return true;
  if (await isWithinUnlockGracePeriod()) return true;
  return authenticateWithBiometrics('Unlock Amana');
}

export async function authorizeSensitiveAction(action: string): Promise<boolean> {
  if (!(await isBiometricEnabled())) return true;
  return authenticateWithBiometrics(action);
}
