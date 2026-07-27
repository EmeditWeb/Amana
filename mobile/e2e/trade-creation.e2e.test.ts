/**
 * E2E device tests for trade creation flow.
 *
 * This file tests the complete trade creation user journey on the mobile app:
 *  1. Navigate to CreateTrade screen
 *  2. Fill Step 1 (commodity, quantity, price, seller address)
 *  3. Fill Step 2 (loss ratio negotiation, delivery window)
 *  4. Step 3 review and submit
 *  5. Verify success state
 *
 * These tests use @testing-library/react-native to simulate a device runtime
 * with mocked API responses, making them invokable on CI without real hardware.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../src/types/navigation';

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const Stack = createStackNavigator<RootStackParamList>();

const mockApiClient = jest.requireMock('../src/api/client').default;

function renderWithNavigation(screen: React.ComponentType<any>, name: string, params?: object) {
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name={name as any} component={screen} initialParams={params as any} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

describe('Trade Creation E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the create trade form with step 1 (details)', () => {
    const CreateTradeScreen = require('../src/screens/CreateTradeScreen').default;
    const { getByText, getByPlaceholderText } = renderWithNavigation(CreateTradeScreen, 'CreateTrade');

    expect(getByText('Create Trade')).toBeTruthy();
    expect(getByText('Step 1: Details')).toBeTruthy();
    expect(getByText('Commodity')).toBeTruthy();
    expect(getByPlaceholderText('e.g. 500')).toBeTruthy();
    expect(getByPlaceholderText('e.g. 450')).toBeTruthy();
    expect(getByPlaceholderText('G...')).toBeTruthy();
    expect(getByText('Maize')).toBeTruthy();
    expect(getByText('Rice')).toBeTruthy();
  });

  it('advances through step 1 -> step 2 -> step 3 when fields are filled', async () => {
    const CreateTradeScreen = require('../src/screens/CreateTradeScreen').default;
    const {
      getByText,
      getByPlaceholderText,
      queryByText,
    } = renderWithNavigation(CreateTradeScreen, 'CreateTrade');

    // Step 1: Fill fields
    fireEvent.press(getByText('Maize'));
    fireEvent.changeText(getByPlaceholderText('e.g. 500'), '25');
    fireEvent.changeText(getByPlaceholderText('e.g. 450'), '1000');
    fireEvent.changeText(
      getByPlaceholderText('G...'),
      'GDNM7WSJ7VIUVK2TSZ2OQES5XR2663TZEIBFXRDT56B5IRLHERVWSXMU',
    );

    // Should show estimated total
    await waitFor(() => {
      expect(getByText('NGN 25,000')).toBeTruthy();
    });

    // Continue to Step 2
    const continueBtn = getByText('Continue');
    expect(continueBtn).toBeTruthy();
    fireEvent.press(continueBtn);

    // Step 2: Negotiation
    await waitFor(() => {
      expect(getByText('Step 2: Negotiation')).toBeTruthy();
    });

    expect(queryByText('Loss Ratio')).toBeTruthy();
    expect(getByText('Delivery Window (days)')).toBeTruthy();

    // Continue to Step 3
    const reviewBtn = getByText('Review');
    fireEvent.press(reviewBtn);

    // Step 3: Review
    await waitFor(() => {
      expect(getByText('Step 3: Review & Submit')).toBeTruthy();
    });

    expect(getByText('Maize')).toBeTruthy();
    expect(getByText('25 kg')).toBeTruthy();
    expect(queryByText('Buyer 50% / Seller 50%')).toBeTruthy();
    expect(getByText('Create Trade')).toBeTruthy();
  });

  it('shows "Back" button on step 2 that returns to step 1', async () => {
    const CreateTradeScreen = require('../src/screens/CreateTradeScreen').default;
    const {
      getByText,
      getByPlaceholderText,
    } = renderWithNavigation(CreateTradeScreen, 'CreateTrade');

    // Fill Step 1
    fireEvent.press(getByText('Maize'));
    fireEvent.changeText(getByPlaceholderText('e.g. 500'), '25');
    fireEvent.changeText(getByPlaceholderText('e.g. 450'), '1000');
    fireEvent.changeText(
      getByPlaceholderText('G...'),
      'GDNM7WSJ7VIUVK2TSZ2OQES5XR2663TZEIBFXRDT56B5IRLHERVWSXMU',
    );
    fireEvent.press(getByText('Continue'));

    // Verify on step 2
    await waitFor(() => {
      expect(getByText('Step 2: Negotiation')).toBeTruthy();
    });

    // Go back
    fireEvent.press(getByText('Back'));

    // Should be back on step 1
    await waitFor(() => {
      expect(getByText('Step 1: Details')).toBeTruthy();
    });
  });

  it('submits trade creation and calls the API', async () => {
    mockApiClient.post.mockResolvedValueOnce({
      data: { tradeId: 'trade-e2e-001', unsignedXdr: 'aaaabbbb' },
    });

    const CreateTradeScreen = require('../src/screens/CreateTradeScreen').default;
    const {
      getByText,
      getByPlaceholderText,
    } = renderWithNavigation(CreateTradeScreen, 'CreateTrade');

    // Fill Step 1
    fireEvent.press(getByText('Maize'));
    fireEvent.changeText(getByPlaceholderText('e.g. 500'), '25');
    fireEvent.changeText(getByPlaceholderText('e.g. 450'), '1000');
    fireEvent.changeText(
      getByPlaceholderText('G...'),
      'GDNM7WSJ7VIUVK2TSZ2OQES5XR2663TZEIBFXRDT56B5IRLHERVWSXMU',
    );
    fireEvent.press(getByText('Continue'));

    // Step 2
    await waitFor(() => {
      expect(getByText('Step 2: Negotiation')).toBeTruthy();
    });
    fireEvent.press(getByText('Review'));

    // Step 3: Submit
    await waitFor(() => {
      expect(getByText('Step 3: Review & Submit')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByText('Create Trade'));
    });

    // Wait for API call
    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalled();
    });

    const callArgs = mockApiClient.post.mock.calls[0];
    expect(callArgs[0]).toBe('/trades');
    expect(callArgs[1]).toMatchObject({
      sellerAddress: 'GDNM7WSJ7VIUVK2TSZ2OQES5XR2663TZEIBFXRDT56B5IRLHERVWSXMU',
      commodity: 'Maize',
      quantity: '25',
      unit: 'kg',
    });
  });

  it('disables Continue button when seller address is invalid', async () => {
    const CreateTradeScreen = require('../src/screens/CreateTradeScreen').default;
    const {
      getByText,
      getByPlaceholderText,
    } = renderWithNavigation(CreateTradeScreen, 'CreateTrade');

    // Fill fields but with invalid address
    fireEvent.press(getByText('Maize'));
    fireEvent.changeText(getByPlaceholderText('e.g. 500'), '25');
    fireEvent.changeText(getByPlaceholderText('e.g. 450'), '1000');
    fireEvent.changeText(getByPlaceholderText('G...'), 'invalid-address');

    const continueBtn = getByText('Continue');
    // Button should be disabled (opacity styling won't block press in test, but logic will)
    fireEvent.press(continueBtn);

    // Should still be on step 1 (Step 2 not visible)
    expect(getByText('Step 1: Details')).toBeTruthy();
  });
});
