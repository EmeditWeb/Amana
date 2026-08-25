import { useCallback, useState } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';
import { useAuthStore } from '../stores/authStore';

export interface DeepLinkTarget {
  screen: keyof RootStackParamList;
  params?: Record<string, any>;
}

interface UseDeepLinkReturn {
  pendingDeepLink: DeepLinkTarget | null;
  handleDeepLink: (target: DeepLinkTarget) => void;
  navigateToDeepLink: (navigation: NavigationProp<RootStackParamList>) => void;
}

export function useDeepLink(): UseDeepLinkReturn {
  const { token } = useAuthStore();
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLinkTarget | null>(null);

  const handleDeepLink = useCallback(
    (target: DeepLinkTarget) => {
      setPendingDeepLink(target);
    },
    []
  );

  const navigateToDeepLink = useCallback(
    (navigation: NavigationProp<RootStackParamList>) => {
      const target = pendingDeepLink;

      if (target && token) {
        setPendingDeepLink(null);

        switch (target.screen) {
          case 'TradeDetail':
            navigation.navigate('TradeDetail', { tradeId: String(target.params?.tradeId ?? target.params?.id) });
            break;
          case 'DisputeDetail':
            navigation.navigate('DisputeDetail', { id: String(target.params?.id) });
            break;
          case 'EvidenceCapture':
            navigation.navigate('EvidenceCapture', { tradeId: String(target.params?.tradeId) });
            break;
          case 'SyncQueue':
          case 'TradeList':
          case 'CreateTrade':
          case 'WalletConnect':
          case 'VaultDashboard':
          case 'SecuritySettings':
            navigation.navigate(target.screen);
            break;
        }
      }
    },
    [pendingDeepLink, token]
  );

  return {
    pendingDeepLink,
    handleDeepLink,
    navigateToDeepLink,
  };
}
