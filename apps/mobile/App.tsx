import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const PAIRING_KEY = "harness-dreams-pairing";
const LOCAL_DEV_MODE_KEY = "harness-dreams-local-dev-mode";
const DEV_SYNC_BASE_URL = "http://127.0.0.1:39391";
const DEV_AUTO_PAIR_DEVICE_NAME = "Dev iPhone Simulator";
const DEV_AUTO_PAIR_ENABLED = typeof __DEV__ !== "undefined" && __DEV__;

const theme = {
  ink900: "#0b0e14",
  ink850: "#0f131b",
  ink800: "#141925",
  ink750: "#1a2130",
  ink700: "#222a3a",
  ink600: "#2b333f",
  text: "#eef1f6",
  text2: "#b6c0d0",
  muted: "#8793a6",
  faint: "#5b6678",
  border: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(255, 255, 255, 0.13)",
  teal: "#2dd4bf",
  teal700: "#14b8a6",
  tealWeak: "rgba(45, 212, 191, 0.14)",
  blue: "#4f7cff",
  blueWeak: "rgba(79, 124, 255, 0.14)",
  violet: "#8b7bff",
  negative: "#f0726a",
  negativeWeak: "rgba(240, 114, 106, 0.14)",
};

type FindingType = "win" | "mistake" | "opportunity" | "risk";
type RingKey = "efficiency" | "effectiveness" | "alignment";

interface Pairing {
  token: string;
  syncBaseUrl: string;
  devSyncBaseUrl?: string;
  deviceName?: string;
}

interface DevPairingResponse {
  token?: string;
  pairingUrl?: string;
  syncBaseUrl?: string;
  devSyncBaseUrl?: string;
  device?: {
    deviceName?: string;
  };
}

interface Ring {
  key: RingKey;
  label: string;
  score: number;
  delta: number;
  hint: string;
}

interface Metric {
  key: string;
  label: string;
  value: string;
  delta: number;
  trend: "up" | "down" | "flat";
  good: boolean;
}

interface Finding {
  id: string;
  type: FindingType;
  title: string;
  summary: string;
  action: string;
  confidence: string;
  project: string;
}

interface Snapshot {
  userId: string;
  desktopDeviceId: string;
  desktopDeviceName: string;
  deviceId: string;
  report: null | {
    id: string;
    timestamp: number;
    rangeLabel: string;
    sessions: number;
    projects: number;
    harness: string;
    digest: string;
    rings: Ring[];
    metrics: Metric[];
    findings: Finding[];
  };
}

function queryParam(input: string, key: string): string {
  const queryStart = input.indexOf("?");
  if (queryStart === -1) return "";
  const params = new URLSearchParams(input.slice(queryStart + 1));
  return params.get(key) ?? "";
}

function parsePairingUrl(input: string): Pairing | null {
  const token = queryParam(input, "token");
  const syncBaseUrl = queryParam(input, "syncBaseUrl");
  if (!token || !syncBaseUrl) return null;
  return {
    token,
    syncBaseUrl,
    devSyncBaseUrl: queryParam(input, "devSyncBaseUrl") || undefined,
    deviceName: queryParam(input, "deviceName") || undefined,
  };
}

function localhostFallback(input: string): string {
  try {
    const url = new URL(input);
    url.hostname = "127.0.0.1";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return input;
  }
}

async function loadPairing(): Promise<Pairing | null> {
  const stored = await SecureStore.getItemAsync(PAIRING_KEY);
  return stored ? (JSON.parse(stored) as Pairing) : null;
}

async function savePairing(pairing: Pairing): Promise<void> {
  await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(pairing));
}

async function clearPairing(): Promise<void> {
  await SecureStore.deleteItemAsync(PAIRING_KEY);
}

async function loadLocalDevMode(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(LOCAL_DEV_MODE_KEY);
  if (stored === null) return DEV_AUTO_PAIR_ENABLED;
  return stored === "1";
}

async function saveLocalDevMode(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(LOCAL_DEV_MODE_KEY, enabled ? "1" : "0");
}

async function tokenHash(token: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

async function fetchDevPairing(): Promise<Pairing> {
  const url = new URL(`${DEV_SYNC_BASE_URL}/v1/dev/pair`);
  url.searchParams.set("kind", "iphone");
  url.searchParams.set("deviceName", DEV_AUTO_PAIR_DEVICE_NAME);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Dev auto-pair failed: ${response.status}`);
  }
  const body = (await response.json()) as DevPairingResponse;
  const fromUrl = body.pairingUrl ? parsePairingUrl(body.pairingUrl) : null;
  if (fromUrl) return fromUrl;
  if (!body.token || !body.syncBaseUrl) {
    throw new Error("Dev auto-pair response was missing token or sync URL");
  }
  return {
    token: body.token,
    syncBaseUrl: body.syncBaseUrl,
    devSyncBaseUrl: body.devSyncBaseUrl,
    deviceName: body.device?.deviceName ?? DEV_AUTO_PAIR_DEVICE_NAME,
  };
}

function compositeScore(rings: Ring[]): number {
  if (rings.length === 0) return 0;
  return Math.round(
    rings.reduce((sum, ring) => sum + ring.score, 0) / rings.length
  );
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastTokenHash, setLastTokenHash] = useState("");
  const [localDevMode, setLocalDevMode] = useState(false);
  const [devConnectError, setDevConnectError] = useState("");
  const [devAutoPairing, setDevAutoPairing] = useState(false);

  const paired = Boolean(pairing);
  const syncBaseUrl = useMemo(() => {
    if (!pairing) return "";
    if (!localDevMode) return pairing.syncBaseUrl;
    return pairing.devSyncBaseUrl ?? localhostFallback(pairing.syncBaseUrl);
  }, [localDevMode, pairing]);
  const score = useMemo(
    () => compositeScore(snapshot?.report?.rings ?? []),
    [snapshot?.report?.rings]
  );

  const pair = useCallback(async (next: Pairing) => {
    await savePairing(next);
    setPairing(next);
    setScanning(false);
    setLastTokenHash(await tokenHash(next.token));
  }, []);

  const pairDevDevice = useCallback(async () => {
    setDevAutoPairing(true);
    setDevConnectError("");
    try {
      const next = await fetchDevPairing();
      await pair(next);
    } catch (err) {
      setDevConnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setDevAutoPairing(false);
    }
  }, [pair]);

  const refresh = useCallback(async () => {
    if (!pairing || !syncBaseUrl) return;
    setLoading(true);
    try {
      const response = await fetch(`${syncBaseUrl}/v1/snapshot`, {
        headers: { Authorization: `Bearer ${pairing.token}` },
      });
      if (
        response.status === 401 &&
        DEV_AUTO_PAIR_ENABLED &&
        localDevMode &&
        syncBaseUrl.startsWith(DEV_SYNC_BASE_URL)
      ) {
        await clearPairing();
        setPairing(null);
        await pairDevDevice();
        return;
      }
      if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
      setSnapshot((await response.json()) as Snapshot);
      setDevConnectError("");
    } catch (err) {
      Alert.alert(
        "Sync failed",
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, [localDevMode, pairDevDevice, pairing, syncBaseUrl]);

  useEffect(() => {
    void loadPairing().then((stored) => {
      if (!stored) return;
      setPairing(stored);
      void tokenHash(stored.token).then(setLastTokenHash);
    });
    void loadLocalDevMode().then(setLocalDevMode);
  }, []);

  useEffect(() => {
    if (
      !DEV_AUTO_PAIR_ENABLED ||
      !localDevMode ||
      pairing ||
      devAutoPairing
    ) {
      return;
    }
    void pairDevDevice();
  }, [devAutoPairing, localDevMode, pairDevDevice, pairing]);

  useEffect(() => {
    if (pairing) void refresh();
  }, [pairing, refresh]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const next = parsePairingUrl(url);
      if (next) void pair(next);
    });
    void Linking.getInitialURL().then((url) => {
      if (!url) return;
      const next = parsePairingUrl(url);
      if (next) void pair(next);
    });
    return () => subscription.remove();
  }, [pair]);

  async function pairManual(): Promise<void> {
    const next = parsePairingUrl(manualUrl.trim());
    if (!next) {
      Alert.alert(
        "Invalid pairing link",
        "Paste the link from the desktop QR card."
      );
      return;
    }
    await pair(next);
    setManualUrl("");
  }

  async function unpair(): Promise<void> {
    await clearPairing();
    setPairing(null);
    setSnapshot(null);
    setLastTokenHash("");
  }

  async function toggleLocalDevMode(enabled: boolean): Promise<void> {
    setLocalDevMode(enabled);
    await saveLocalDevMode(enabled);
    setSnapshot(null);
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Harness Dreams</Text>
          <Text style={styles.title}>Companion</Text>
          <Text style={styles.subtitle}>
            Pair by QR. Your Mac owns sync access; this device only receives a
            signed token.
          </Text>
        </View>

        <View style={styles.modeCard}>
          <View style={styles.modeText}>
            <Text style={styles.modeLabel}>Sync route</Text>
            <Text style={styles.modeHint}>
              {localDevMode ? "Local Mac simulator" : "LAN device"}
            </Text>
            {DEV_AUTO_PAIR_ENABLED && localDevMode ? (
              <Text style={styles.modeMeta}>
                {devAutoPairing
                  ? "Auto-connecting..."
                  : devConnectError
                    ? `Waiting for ${DEV_SYNC_BASE_URL}`
                    : `Dev auto-connect ${DEV_SYNC_BASE_URL}`}
              </Text>
            ) : null}
          </View>
          <View style={styles.segmented}>
            <Pressable
              style={[
                styles.segment,
                !localDevMode ? styles.segmentActive : null,
              ]}
              onPress={() => void toggleLocalDevMode(false)}
            >
              <Text
                style={[
                  styles.segmentText,
                  !localDevMode ? styles.segmentTextActive : null,
                ]}
              >
                LAN
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.segment,
                localDevMode ? styles.segmentActive : null,
              ]}
              onPress={() => void toggleLocalDevMode(true)}
            >
              <Text
                style={[
                  styles.segmentText,
                  localDevMode ? styles.segmentTextActive : null,
                ]}
              >
                Local Mac
              </Text>
            </Pressable>
          </View>
        </View>

        {!paired ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Add this device</Text>
              <Pressable
                style={styles.smallButton}
                onPress={() => void requestPermission()}
              >
                <Text style={styles.smallButtonText}>Camera</Text>
              </Pressable>
            </View>

            {permission?.granted && scanning ? (
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  const next = parsePairingUrl(data);
                  if (next) void pair(next);
                }}
              />
            ) : (
              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  permission?.granted
                    ? setScanning(true)
                    : void requestPermission()
                }
              >
                <Text style={styles.primaryButtonText}>
                  {permission?.granted ? "Scan QR code" : "Allow camera"}
                </Text>
              </Pressable>
            )}

            <TextInput
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="Paste harnessdreams://pair?... link"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void pairManual()}
            >
              <Text style={styles.secondaryButtonText}>Pair from link</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.eyebrow}>Paired</Text>
                  <Text style={styles.sectionTitle}>
                    {snapshot?.desktopDeviceName ?? "Desktop"}
                  </Text>
                </View>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => void refresh()}
                >
                  <Text style={styles.smallButtonText}>
                    {loading ? "Syncing" : "Sync"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>
                Token hash {lastTokenHash.slice(0, 12)}
              </Text>
              <Text style={styles.meta}>{syncBaseUrl}</Text>
            </View>

            {loading && !snapshot ? (
              <ActivityIndicator color="#2dd4bf" />
            ) : snapshot?.report ? (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.eyebrow}>
                    {snapshot.report.rangeLabel}
                  </Text>
                  <Text style={styles.score}>{score}</Text>
                  <Text style={styles.sectionTitle}>Harness health</Text>
                  <Text style={styles.body}>{snapshot.report.digest}</Text>
                  <Text style={styles.meta}>
                    {snapshot.report.sessions} sessions ·{" "}
                    {snapshot.report.projects} projects
                  </Text>
                </View>

                <View style={styles.grid}>
                  {snapshot.report.rings.map((ring) => (
                    <View key={ring.key} style={styles.tile}>
                      <Text style={styles.tileValue}>{ring.score}</Text>
                      <Text style={styles.tileLabel}>{ring.label}</Text>
                      <Text style={styles.delta}>
                        {ring.delta >= 0 ? "+" : ""}
                        {ring.delta}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Findings</Text>
                  {snapshot.report.findings.map((finding) => (
                    <View key={finding.id} style={styles.finding}>
                      <Text style={styles.findingType}>{finding.type}</Text>
                      <Text style={styles.findingTitle}>{finding.title}</Text>
                      <Text style={styles.body}>{finding.action}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>No cycle yet</Text>
                <Text style={styles.body}>
                  Run a Sleep Cycle on the desktop app.
                </Text>
              </View>
            )}

            <Pressable
              style={styles.dangerButton}
              onPress={() => void unpair()}
            >
              <Text style={styles.dangerButtonText}>Remove pairing</Text>
            </Pressable>
          </>
        )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.ink900 },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  header: { gap: 8, paddingTop: 12 },
  eyebrow: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: { color: theme.text, fontSize: 36, fontWeight: "800" },
  subtitle: { color: theme.text2, fontSize: 15, lineHeight: 22 },
  modeCard: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.ink850,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  modeText: { flex: 1, gap: 2 },
  modeLabel: { color: theme.text, fontSize: 14, fontWeight: "700" },
  modeHint: { color: theme.muted, fontSize: 12 },
  modeMeta: { color: theme.faint, fontSize: 11 },
  segmented: {
    alignItems: "center",
    backgroundColor: theme.ink900,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  segment: {
    alignItems: "center",
    borderRadius: 6,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentActive: { backgroundColor: theme.ink700 },
  segmentText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: theme.text },
  card: {
    gap: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.ink800,
    padding: 16,
  },
  heroCard: {
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.ink850,
    padding: 18,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { color: theme.text, fontSize: 20, fontWeight: "800" },
  body: { color: theme.text2, fontSize: 14, lineHeight: 20 },
  meta: { color: theme.muted, fontSize: 12 },
  score: { color: theme.teal, fontSize: 64, fontWeight: "900" },
  camera: { height: 280, overflow: "hidden", borderRadius: 10 },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.ink900,
    color: theme.text,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: theme.teal,
    padding: 13,
  },
  primaryButtonText: { color: theme.ink900, fontSize: 15, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    padding: 12,
  },
  secondaryButtonText: { color: theme.text, fontWeight: "700" },
  smallButton: {
    borderRadius: 8,
    backgroundColor: theme.ink750,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: { color: theme.text, fontWeight: "700" },
  dangerButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.negativeWeak,
    padding: 12,
  },
  dangerButtonText: { color: theme.negative, fontWeight: "800" },
  grid: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    gap: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.ink800,
    padding: 12,
  },
  tileValue: { color: theme.text, fontSize: 24, fontWeight: "900" },
  tileLabel: { color: theme.text2, fontSize: 12, fontWeight: "700" },
  delta: { color: theme.teal, fontSize: 12, fontWeight: "800" },
  finding: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 12,
  },
  findingType: {
    color: theme.teal,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  findingTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
});
