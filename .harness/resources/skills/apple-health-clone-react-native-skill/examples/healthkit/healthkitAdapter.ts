import type { MetricSample } from '../data/healthModels';

export interface HealthPermissionRequest {
  read: string[];
  write?: string[];
}

export interface HealthPermissionResult {
  granted: boolean;
  partial: boolean;
  readGranted: string[];
  writeGranted: string[];
  deniedOrUnknown: string[];
}

export interface HealthSampleQuery {
  metricId: string;
  startDate: string;
  endDate: string;
  limit?: number;
}

export type Unsubscribe = () => void;

export interface HealthDataAdapter {
  isAvailable(): Promise<boolean>;
  requestAuthorization(request: HealthPermissionRequest): Promise<HealthPermissionResult>;
  readSamples(query: HealthSampleQuery): Promise<MetricSample[]>;
  observe(metricIds: string[], onChange: () => void): Promise<Unsubscribe>;
  writeSample?(sample: MetricSample): Promise<void>;
}

/**
 * Skeleton adapter for @kingstinct/react-native-healthkit.
 * Replace placeholder imports and type names with the exact library version used by your app.
 */
export class KingstinctHealthKitAdapter implements HealthDataAdapter {
  async isAvailable(): Promise<boolean> {
    // Example shape only:
    // const available = await Healthkit.isHealthDataAvailable();
    // return available;
    return true;
  }

  async requestAuthorization(request: HealthPermissionRequest): Promise<HealthPermissionResult> {
    // Map project metric IDs to HealthKit identifiers here.
    // Ask only for what the current feature needs.
    // const result = await Healthkit.requestAuthorization(toHealthKitPermissions(request));
    return {
      granted: true,
      partial: false,
      readGranted: request.read,
      writeGranted: request.write ?? [],
      deniedOrUnknown: [],
    };
  }

  async readSamples(query: HealthSampleQuery): Promise<MetricSample[]> {
    // const hkType = metricIdToHealthKitType(query.metricId);
    // const samples = await Healthkit.queryQuantitySamples(hkType, { ... });
    // return samples.map(normalizeHealthKitSample);
    return [];
  }

  async observe(metricIds: string[], onChange: () => void): Promise<Unsubscribe> {
    // Register HealthKit observers for each mapped type.
    // On change, call onChange and let the app re-query affected ranges.
    return () => {
      // unsubscribe observers
    };
  }
}

export function normalizeHealthKitQuantitySample(input: {
  uuid?: string;
  metricId: string;
  value: number;
  unit: string;
  startDate: string;
  endDate?: string;
  sourceId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
}): MetricSample {
  return {
    id: input.uuid ?? `${input.metricId}:${input.startDate}:${input.endDate ?? ''}:${input.value}:${input.sourceId ?? ''}`,
    metricId: input.metricId,
    value: input.value,
    unit: input.unit,
    startDate: input.startDate,
    endDate: input.endDate,
    sourceId: input.sourceId,
    deviceId: input.deviceId,
    metadata: input.metadata,
  };
}
