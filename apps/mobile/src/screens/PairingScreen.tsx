import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Card, Screen, SectionHeader } from "../components/HealthUI";
import { colors, radius, spacing } from "../theme/tokens";

export function PairingScreen({
  loading,
  syncError,
  onPairUrl,
}: {
  loading: boolean;
  syncError: string;
  onPairUrl(input: string): Promise<boolean>;
}) {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Harness Health</Text>
        <Text style={styles.title}>Healthy habits for your AI harness</Text>
        <Text style={styles.subtitle}>
          Pair this iPhone to your Mac health source and review live harness
          vitals, education, trends, awards, recommendations, and private
          sources.
        </Text>
      </View>

      <Card style={styles.intentCard}>
        <SectionHeader
          title="Private sync"
          subtitle="Cloudflare signaling helps devices find each other. Reports move over encrypted peer sync with encrypted backup fallback when enabled."
        />
        <View style={styles.routeGrid}>
          <View style={styles.routeTile}>
            <Text style={styles.routeValue}>1</Text>
            <Text style={styles.routeLabel}>Scan desktop QR</Text>
          </View>
          <View style={styles.routeTile}>
            <Text style={styles.routeValue}>2</Text>
            <Text style={styles.routeLabel}>Verify encrypted pair</Text>
          </View>
          <View style={styles.routeTile}>
            <Text style={styles.routeValue}>3</Text>
            <Text style={styles.routeLabel}>Build healthy habits</Text>
          </View>
        </View>
        {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
      </Card>

      <PairingControls
        loading={loading}
        syncError={syncError}
        onPairUrl={onPairUrl}
      />
    </Screen>
  );
}

export function PairingControls({
  loading,
  syncError,
  onPairUrl,
}: {
  loading: boolean;
  syncError: string;
  onPairUrl(input: string): Promise<boolean>;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualUrl, setManualUrl] = useState("");
  const [scanning, setScanning] = useState(false);

  async function submitPairing(input: string): Promise<void> {
    const paired = await onPairUrl(input);
    if (!paired) {
      Alert.alert(
        "Invalid pairing link",
        "Paste or scan the pairing link from the desktop QR card."
      );
      return;
    }
    setManualUrl("");
    setScanning(false);
  }

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>Connect this iPhone</Text>
          <Text style={styles.controlSubtitle}>
            Scan the desktop QR or paste a pairing link. In dev, the simulator
            attempts local auto-pairing first.
          </Text>
        </View>
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
            void submitPairing(data);
          }}
        />
      ) : (
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            permission?.granted ? setScanning(true) : void requestPermission()
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
        placeholder="Paste harnesshealth://pair?... link"
        placeholderTextColor={colors.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      <Pressable
        style={styles.secondaryButton}
        onPress={() => void submitPairing(manualUrl)}
      >
        <Text style={styles.secondaryButtonText}>
          {loading ? "Pairing..." : "Pair from link"}
        </Text>
      </Pressable>
      {syncError ? <Text style={styles.errorText}>{syncError}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  hero: {
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  eyebrow: {
    color: colors.tertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.label,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    color: colors.secondary,
    fontSize: 16,
    lineHeight: 23,
  },
  intentCard: {
    backgroundColor: colors.heroSurface,
    borderColor: colors.heroBorder,
  },
  routeGrid: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  routeTile: {
    backgroundColor: colors.card,
    borderColor: colors.separator,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minHeight: 86,
    padding: spacing.sm,
  },
  routeValue: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "800",
  },
  routeLabel: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 16,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: colors.label,
    fontSize: 18,
    fontWeight: "700",
  },
  controlSubtitle: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  camera: {
    borderRadius: radius.md,
    height: 300,
    overflow: "hidden",
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.separatorStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.label,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.separatorStrong,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.label,
    fontSize: 15,
    fontWeight: "800",
  },
  smallButton: {
    backgroundColor: colors.elevated,
    borderRadius: radius.sm,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  smallButtonText: {
    color: colors.label,
    fontWeight: "800",
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    lineHeight: 17,
  },
});
