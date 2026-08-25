import { renderHook, act } from '@testing-library/react-native';
import { DeepLinkTarget, useDeepLink } from './useDeepLink';
import * as authStore from '../stores/authStore';

// Mock the authStore
jest.mock('../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

describe('useDeepLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should parse trade deep link correctly', () => {
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: 'test-token',
    });

    const { result } = renderHook(() => useDeepLink());

    act(() => {
      const deepLink: DeepLinkTarget = {
        screen: 'TradeDetail',
        params: { tradeId: 'trade-123' },
      };
      result.current.handleDeepLink(deepLink);
    });

    expect(result.current.pendingDeepLink).toEqual({
      screen: 'TradeDetail',
      params: { tradeId: 'trade-123' },
    });
  });

  it('should parse dispute deep link correctly', () => {
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: 'test-token',
    });

    const { result } = renderHook(() => useDeepLink());

    act(() => {
      const deepLink: DeepLinkTarget = {
        screen: 'DisputeDetail',
        params: { id: 'dispute-456' },
      };
      result.current.handleDeepLink(deepLink);
    });

    expect(result.current.pendingDeepLink).toEqual({
      screen: 'DisputeDetail',
      params: { id: 'dispute-456' },
    });
  });

  it('should store pending deep link when user is not authenticated', () => {
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: null,
    });

    const { result, rerender } = renderHook(() => useDeepLink());

    act(() => {
      const deepLink: DeepLinkTarget = {
        screen: 'TradeDetail',
        params: { tradeId: 'trade-789' },
      };
      result.current.handleDeepLink(deepLink);
    });

    expect(result.current.pendingDeepLink).toEqual({
      screen: 'TradeDetail',
      params: { tradeId: 'trade-789' },
    });

    // Now authenticate
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: 'authenticated-token',
    });

    rerender(undefined);

    // The pending deep link should still be available
    expect(result.current.pendingDeepLink).toEqual({
      screen: 'TradeDetail',
      params: { tradeId: 'trade-789' },
    });
  });

  it('should handle trade list deep link', () => {
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: 'test-token',
    });

    const { result } = renderHook(() => useDeepLink());

    act(() => {
      const deepLink: DeepLinkTarget = {
        screen: 'TradeList',
      };
      result.current.handleDeepLink(deepLink);
    });

    expect(result.current.pendingDeepLink).toEqual({
      screen: 'TradeList',
    });
  });

  it('should handle evidence capture deep link', () => {
    (authStore.useAuthStore as unknown as jest.Mock).mockReturnValue({
      token: 'test-token',
    });

    const { result } = renderHook(() => useDeepLink());

    act(() => {
      const deepLink: DeepLinkTarget = {
        screen: 'EvidenceCapture',
        params: { tradeId: 'trade-101' },
      };
      result.current.handleDeepLink(deepLink);
    });

    expect(result.current.pendingDeepLink).toEqual({
      screen: 'EvidenceCapture',
      params: { tradeId: 'trade-101' },
    });
  });
});
