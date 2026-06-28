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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PAIRING_KEY = "harness-dreams-pairing";

type FindingType = "win" | "mistake" | "opportunity" | "risk";
type RingKey = "efficiency" | "effectiveness" | "alignment";

interface Pairing {
  token: string;
  syncBaseUrl: string;
  deviceName?: string;
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
    deviceName: queryParam(input, "deviceName") || undefined,
  };
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

async function tokenHash(token: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

function compositeScore(rings: Ring[]): number {
  if (rings.length === 0) return 0;
  return Math.round(rings.reduce((sum, ring) => sum + ring.score, 0) / rings.length);
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastTokenHash, setLastTokenHash] = useState("");

  const paired = Boolean(pairing);
  const score = useMemo(
    () => compositeScore(snapshot?.report?.rings ?? []),
    [snapshot?.report?.rings],
  );

  const pair = useCallback(async (next: Pairing) => {
    await savePairing(next);
    setPairing(next);
    setScanning(false);
    setLastTokenHash(await tokenHash(next.token));
  }, []);

  const refresh = useCallback(async () => {
    if (!pairing) return;
    setLoading(true);
    try {
      const response = await fetch(`${pairing.syncBaseUrl}/v1/snapshot`, {
        headers: { Authorization: `Bearer ${pairing.token}` },
      });
      if (!response.ok) throw new Error(`Sync failed: ${response.status}`);
      setSnapshot((await response.json()) as Snapshot);
    } catch (err) {
      Alert.alert("Sync failed", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pairing]);

  useEffect(() => {
    void loadPairing().then((stored) => {
      if (!stored) return;
      setPairing(stored);
      void tokenHash(stored.token).then(setLastTokenHash);
    });
  }, []);

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
      Alert.alert("Invalid pairing link", "Paste the link from the desktop QR card.");
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

  return (
    <SafeAreaView style={styles.safe}>
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
            <Pressable style={styles.secondaryButton} onPress={() => void pairManual()}>
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
                <Pressable style={styles.smallButton} onPress={() => void refresh()}>
                  <Text style={styles.smallButtonText}>
                    {loading ? "Syncing" : "Sync"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>Token hash {lastTokenHash.slice(0, 12)}</Text>
              <Text style={styles.meta}>{pairing?.syncBaseUrl}</Text>
            </View>

            {loading && !snapshot ? (
              <ActivityIndicator color="#2dd4bf" />
            ) : snapshot?.report ? (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.eyebrow}>{snapshot.report.rangeLabel}</Text>
                  <Text style={styles.score}>{score}</Text>
                  <Text style={styles.sectionTitle}>Harness health</Text>
                  <Text style={styles.body}>{snapshot.report.digest}</Text>
                  <Text style={styles.meta}>
                    {snapshot.report.sessions} sessions · {snapshot.report.projects} projects
                  </Text>
                </View>

                <View style={styles.grid}>
                  {snapshot.report.rings.map((ring) => (
                    <View key={ring.key} style={styles.tile}>
                      <Text style={styles.tileValue}>{ring.score}</Text>
                      <Text style={styles.tileLabel}>{ring.label}</Text>
                      <Text style={styles.delta}>{ring.delta >= 0 ? "+" : ""}{ring.delta}</Text>
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
                <Text style={styles.body}>Run a Sleep Cycle on the desktop app.</Text>
              </View>
            )}

            <Pressable style={styles.dangerButton} onPress={() => void unpair()}>
              <Text style={styles.dangerButtonText}>Remove pairing</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1020" },
  content: { gap: 16, padding: 20, paddingBottom: 36 },
  header: { gap: 6, paddingTop: 12 },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { color: "#f8fafc", fontSize: 36, fontWeight: "800" },
  subtitle: { color: "#cbd5e1", fontSize: 15, lineHeight: 21 },
  card: {
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#263244",
    backgroundColor: "#111827",
    padding: 16,
  },
  heroCard: {
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#102a2f",
    padding: 18,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { color: "#f8fafc", fontSize: 20, fontWeight: "800" },
  body: { color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  meta: { color: "#94a3b8", fontSize: 12 },
  score: { color: "#5eead4", fontSize: 64, fontWeight: "900" },
  camera: { height: 280, overflow: "hidden", borderRadius: 8 },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#f8fafc",
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#14b8a6",
    padding: 13,
  },
  primaryButtonText: { color: "#042f2e", fontSize: 15, fontWeight: "800" },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
  },
  secondaryButtonText: { color: "#e2e8f0", fontWeight: "700" },
  smallButton: {
    borderRadius: 8,
    backgroundColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: { color: "#e2e8f0", fontWeight: "700" },
  dangerButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    padding: 12,
  },
  dangerButtonText: { color: "#fecaca", fontWeight: "800" },
  grid: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    gap: 3,
    borderRadius: 8,
    backgroundColor: "#111827",
    padding: 12,
  },
  tileValue: { color: "#f8fafc", fontSize: 24, fontWeight: "900" },
  tileLabel: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  delta: { color: "#86efac", fontSize: 12, fontWeight: "800" },
  finding: { gap: 4, borderTopWidth: 1, borderTopColor: "#263244", paddingTop: 12 },
  findingType: { color: "#5eead4", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  findingTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "800" },
});
