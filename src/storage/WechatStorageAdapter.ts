import type { StorageAdapter } from './StorageAdapter';

export class WechatStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      const value = wx.getStorageSync(key);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      wx.setStorageSync(key, value);
    } catch {
      // Ignore storage failures so gameplay can continue.
    }
  }

  removeItem(key: string): void {
    try {
      wx.removeStorageSync(key);
    } catch {
      // Ignore storage failures so gameplay can continue.
    }
  }
}
