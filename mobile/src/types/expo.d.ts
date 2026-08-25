declare module 'expo-status-bar' {
  import React from 'react';
  interface StatusBarProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    animated?: boolean;
    hidden?: boolean;
    hideTransitionAnimation?: 'fade' | 'slide' | 'none';
    networkActivityIndicatorVisible?: boolean;
    translucent?: boolean;
  }
  export const StatusBar: React.FC<StatusBarProps>;
}

declare module 'expo-background-fetch' {
  export enum BackgroundFetchResult {
    NewData = 'newData',
    NoData = 'noData',
    Failed = 'failed',
  }
  export enum BackgroundFetchStatus {
    Restricted = 1,
    Denied = 2,
    Available = 3,
  }
  export function getStatusAsync(): Promise<BackgroundFetchStatus>;
  export function registerTaskAsync(taskName: string, options?: { minimumInterval?: number; stopOnTerminate?: boolean; startOnBoot?: boolean }): Promise<void>;
}

declare module 'expo-network' {
  export interface NetworkState {
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
  }
  export function getNetworkStateAsync(): Promise<NetworkState>;
}

declare module 'expo-sqlite' {
  export interface SQLiteDatabase {
    execAsync(sql: string): Promise<void>;
    runAsync(sql: string, params?: unknown[]): Promise<{ changes?: number; lastInsertRowId?: number }>;
    getAllAsync<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
    getFirstAsync<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
    withTransactionAsync(task: () => Promise<void>): Promise<void>;
  }
  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}

declare module 'expo-task-manager' {
  export function defineTask(taskName: string, taskExecutor: () => Promise<unknown>): void;
  export function isTaskRegisteredAsync(taskName: string): Promise<boolean>;
}

