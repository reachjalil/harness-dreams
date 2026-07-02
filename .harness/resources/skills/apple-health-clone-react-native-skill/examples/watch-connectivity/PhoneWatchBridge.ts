import type { WatchDailySnapshot } from '../data/healthModels';

/**
 * Skeleton bridge for watch-connectivity/react-native-watch-connectivity.
 * Verify exact imports against the installed package version.
 */
export interface PhoneWatchBridge {
  updateDailySnapshot(snapshot: WatchDailySnapshot): Promise<void>;
  sendImmediateAction(action: Record<string, unknown>): Promise<void>;
  subscribeToWatchActions(handler: (action: Record<string, unknown>) => void): () => void;
}

export class WatchConnectivityBridge implements PhoneWatchBridge {
  async updateDailySnapshot(snapshot: WatchDailySnapshot): Promise<void> {
    const payload = {
      type: 'dailySnapshot',
      schemaVersion: snapshot.schemaVersion,
      payload: snapshot,
    };

    // Example only:
    // await updateApplicationContext(payload);
    console.log('Send application context to watch', payload);
  }

  async sendImmediateAction(action: Record<string, unknown>): Promise<void> {
    const payload = {
      type: 'phoneAction',
      schemaVersion: 1,
      payload: action,
    };

    // Example only:
    // await sendMessage(payload);
    console.log('Send immediate watch message', payload);
  }

  subscribeToWatchActions(handler: (action: Record<string, unknown>) => void): () => void {
    // Example only:
    // const sub = watchEvents.addListener('message', handler);
    // return () => sub.remove();
    return () => {};
  }
}
