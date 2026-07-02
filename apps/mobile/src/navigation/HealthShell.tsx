import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigatorScreenParams,
  type Theme,
  useNavigationContainerRef,
} from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, StyleSheet, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { enableScreens } from "react-native-screens";
import { HealthTabBar } from "../components/HealthUI";
import { buildHarnessHealthModel } from "../domain/harnessHealth";
import type { HarnessProfileKey, HealthTab } from "../domain/types";
import { AwardsScreen } from "../screens/AwardsScreen";
import { BrowseScreen, MetricDetailScreen } from "../screens/BrowseScreen";
import { SourcesScreen } from "../screens/SourcesScreen";
import { SummaryScreen } from "../screens/SummaryScreen";
import { useHarnessHealthSync } from "../sync/useHarnessHealthSync";
import { colors } from "../theme/tokens";

enableScreens();

type MetricRouteParams = {
  metricKey: string;
};

type SummaryStackParamList = {
  SummaryHome: undefined;
  SummaryMetricDetail: MetricRouteParams;
};

type BrowseStackParamList = {
  BrowseHome: undefined;
  BrowseMetricDetail: MetricRouteParams;
};

type AwardsStackParamList = {
  AwardsHome: undefined;
};

type SourcesStackParamList = {
  SourcesHome: undefined;
};

type HealthTabParamList = {
  SummaryTab: NavigatorScreenParams<SummaryStackParamList>;
  BrowseTab: NavigatorScreenParams<BrowseStackParamList>;
  AwardsTab: NavigatorScreenParams<AwardsStackParamList>;
  SourcesTab: NavigatorScreenParams<SourcesStackParamList>;
};

const Tab = createBottomTabNavigator<HealthTabParamList>();
const SummaryStack = createNativeStackNavigator<SummaryStackParamList>();
const BrowseStack = createNativeStackNavigator<BrowseStackParamList>();
const AwardsStack = createNativeStackNavigator<AwardsStackParamList>();
const SourcesStack = createNativeStackNavigator<SourcesStackParamList>();

const TAB_TO_ROUTE: Record<HealthTab, keyof HealthTabParamList> = {
  summary: "SummaryTab",
  browse: "BrowseTab",
  awards: "AwardsTab",
  sources: "SourcesTab",
};

const ROUTE_TO_TAB: Record<keyof HealthTabParamList, HealthTab> = {
  SummaryTab: "summary",
  BrowseTab: "browse",
  AwardsTab: "awards",
  SourcesTab: "sources",
};

const LIGHT_NAV_COLORS = {
  background: "#f6f8fb",
  border: "rgba(20, 27, 38, 0.1)",
  card: "#f6f8fb",
  notification: "#ff375f",
  primary: "#0a84ff",
  text: "#111827",
};

const DARK_NAV_COLORS = {
  background: "#080a0f",
  border: "rgba(255, 255, 255, 0.09)",
  card: "#080a0f",
  notification: "#ff375f",
  primary: "#64d2ff",
  text: "#f4f7fb",
};

export function HealthShell() {
  return (
    <SafeAreaProvider>
      <HealthShellContent />
    </SafeAreaProvider>
  );
}

function HealthShellContent() {
  const sync = useHarnessHealthSync();
  const navigationRef = useNavigationContainerRef<HealthTabParamList>();
  const pendingUrlRef = useRef<string | null>(null);
  const navigationTheme = useNavigationTheme();
  const [harnessProfile, setHarnessProfile] =
    useState<HarnessProfileKey>("global");
  const [summaryExplainerKey, setSummaryExplainerKey] = useState<string | null>(
    null
  );

  const model = useMemo(
    () =>
      buildHarnessHealthModel(
        sync.snapshot,
        sync.pairing,
        sync.connectionStatus,
        sync.lastSyncedAt,
        sync.signalBaseUrl,
        harnessProfile
      ),
    [
      sync.connectionStatus,
      harnessProfile,
      sync.lastSyncedAt,
      sync.pairing,
      sync.signalBaseUrl,
      sync.snapshot,
    ]
  );

  const stackScreenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      animation: "default",
      contentStyle: styles.nativeScene,
      headerBackTitle: "Back",
      headerLargeTitle: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: navigationTheme.colors.background },
      headerTintColor: navigationTheme.colors.primary,
      headerTitleStyle: { color: navigationTheme.colors.text },
    }),
    [
      navigationTheme.colors.background,
      navigationTheme.colors.primary,
      navigationTheme.colors.text,
    ]
  );

  const metricTitle = useCallback(
    (metricKey: string) =>
      model.metrics.find((metric) => metric.key === metricKey)?.label ??
      "Metric",
    [model.metrics]
  );

  const navigateFromUrl = useCallback(
    (url: string): void => {
      if (!navigationRef.isReady()) {
        pendingUrlRef.current = url;
        return;
      }

      const lower = url.toLowerCase();
      const metricKey = url.match(/[?&]key=([^&]+)/)?.[1];
      const explainerKey = url.match(/[?&]explainer=([^&]+)/)?.[1];

      if (explainerKey) {
        setSummaryExplainerKey(decodeURIComponent(explainerKey));
        navigationRef.navigate("SummaryTab", { screen: "SummaryHome" });
        return;
      }

      if (metricKey) {
        navigationRef.navigate("BrowseTab", {
          screen: "BrowseMetricDetail",
          params: { metricKey: decodeURIComponent(metricKey) },
        });
        return;
      }

      if (lower.includes("://summary") || lower.includes("/summary")) {
        navigationRef.navigate("SummaryTab", { screen: "SummaryHome" });
        return;
      }

      if (lower.includes("://browse") || lower.includes("/browse")) {
        navigationRef.navigate("BrowseTab", { screen: "BrowseHome" });
        return;
      }

      if (lower.includes("://awards") || lower.includes("/awards")) {
        navigationRef.navigate("AwardsTab", { screen: "AwardsHome" });
        return;
      }

      if (lower.includes("://sources") || lower.includes("/sources")) {
        navigationRef.navigate("SourcesTab", { screen: "SourcesHome" });
      }
    },
    [navigationRef]
  );

  useEffect(() => {
    let mounted = true;

    void Linking.getInitialURL().then((url) => {
      if (mounted && url) navigateFromUrl(url);
    });

    const subscription = Linking.addEventListener("url", (event) => {
      navigateFromUrl(event.url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [navigateFromUrl]);

  function renderSummaryStack() {
    return (
      <SummaryStack.Navigator screenOptions={stackScreenOptions}>
        <SummaryStack.Screen
          name="SummaryHome"
          options={{ headerShown: false }}
        >
          {({
            navigation,
          }: NativeStackScreenProps<SummaryStackParamList, "SummaryHome">) => (
            <SummaryScreen
              model={model}
              requestedExplainerKey={summaryExplainerKey}
              loading={sync.loading || sync.devAutoPairing}
              onRefresh={() => void sync.refresh()}
              onExplainerRequestHandled={() => setSummaryExplainerKey(null)}
              onSelectHarness={setHarnessProfile}
              onOpenMetric={(metricKey) =>
                navigation.push("SummaryMetricDetail", { metricKey })
              }
              onDecision={(findingId, state) =>
                void sync.markDecision(findingId, state)
              }
            />
          )}
        </SummaryStack.Screen>
        <SummaryStack.Screen
          name="SummaryMetricDetail"
          options={({ route }) => ({
            title: metricTitle(route.params.metricKey),
          })}
        >
          {({
            navigation,
            route,
          }: NativeStackScreenProps<
            SummaryStackParamList,
            "SummaryMetricDetail"
          >) => (
            <MetricDetailScreen
              metricKey={route.params.metricKey}
              model={model}
              onOpenMetric={(metricKey) =>
                navigation.push("SummaryMetricDetail", { metricKey })
              }
            />
          )}
        </SummaryStack.Screen>
      </SummaryStack.Navigator>
    );
  }

  function renderBrowseStack() {
    return (
      <BrowseStack.Navigator screenOptions={stackScreenOptions}>
        <BrowseStack.Screen name="BrowseHome" options={{ headerShown: false }}>
          {({
            navigation,
          }: NativeStackScreenProps<BrowseStackParamList, "BrowseHome">) => (
            <BrowseScreen
              model={model}
              loading={sync.loading || sync.devAutoPairing}
              onRefresh={() => void sync.refresh()}
              onOpenMetric={(metricKey) =>
                navigation.push("BrowseMetricDetail", { metricKey })
              }
            />
          )}
        </BrowseStack.Screen>
        <BrowseStack.Screen
          name="BrowseMetricDetail"
          options={({ route }) => ({
            title: metricTitle(route.params.metricKey),
          })}
        >
          {({
            navigation,
            route,
          }: NativeStackScreenProps<
            BrowseStackParamList,
            "BrowseMetricDetail"
          >) => (
            <MetricDetailScreen
              metricKey={route.params.metricKey}
              model={model}
              onOpenMetric={(metricKey) =>
                navigation.push("BrowseMetricDetail", { metricKey })
              }
            />
          )}
        </BrowseStack.Screen>
      </BrowseStack.Navigator>
    );
  }

  return (
    <View style={styles.appFrame}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => {
          const pendingUrl = pendingUrlRef.current;
          pendingUrlRef.current = null;
          if (pendingUrl) navigateFromUrl(pendingUrl);
        }}
      >
        <Tab.Navigator
          initialRouteName="SummaryTab"
          screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
          tabBar={(props) => <NavigationTabBar {...props} />}
        >
          <Tab.Screen name="SummaryTab" options={{ title: "Summary" }}>
            {renderSummaryStack}
          </Tab.Screen>
          <Tab.Screen name="BrowseTab" options={{ title: "Browse" }}>
            {renderBrowseStack}
          </Tab.Screen>
          <Tab.Screen name="AwardsTab" options={{ title: "Awards" }}>
            {() => (
              <AwardsStack.Navigator screenOptions={stackScreenOptions}>
                <AwardsStack.Screen
                  name="AwardsHome"
                  options={{ headerShown: false }}
                >
                  {() => (
                    <AwardsScreen
                      model={model}
                      loading={sync.loading || sync.devAutoPairing}
                      onRefresh={() => void sync.refresh()}
                    />
                  )}
                </AwardsStack.Screen>
              </AwardsStack.Navigator>
            )}
          </Tab.Screen>
          <Tab.Screen name="SourcesTab" options={{ title: "Sources" }}>
            {() => (
              <SourcesStack.Navigator screenOptions={stackScreenOptions}>
                <SourcesStack.Screen
                  name="SourcesHome"
                  options={{ headerShown: false }}
                >
                  {() => (
                    <SourcesScreen
                      model={model}
                      paired={sync.paired}
                      loading={sync.loading || sync.devAutoPairing}
                      devAutoPairEnabled={sync.devAutoPairEnabled}
                      devAutoPairing={sync.devAutoPairing}
                      connectionStatus={sync.connectionStatus}
                      lastSyncedAt={sync.lastSyncedAt}
                      syncError={sync.syncError}
                      onPairUrl={sync.pairFromUrl}
                      onRefresh={() => void sync.refresh()}
                      onUnpair={() => void sync.unpair()}
                    />
                  )}
                </SourcesStack.Screen>
              </SourcesStack.Navigator>
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  );
}

function NavigationTabBar({ insets, navigation, state }: BottomTabBarProps) {
  const activeRoute = state.routes[state.index]?.name as
    | keyof HealthTabParamList
    | undefined;
  const activeTab = activeRoute ? ROUTE_TO_TAB[activeRoute] : "summary";

  return (
    <HealthTabBar
      active={activeTab}
      bottomInset={insets.bottom}
      onChange={(tab) => {
        const routeName = TAB_TO_ROUTE[tab];
        const route = state.routes.find((item) => item.name === routeName);
        if (!route) return;

        const event = navigation.emit({
          type: "tabPress",
          target: route.key,
          canPreventDefault: true,
        });

        if (!event.defaultPrevented) {
          navigation.navigate(routeName);
        }
      }}
    />
  );
}

function useNavigationTheme(): Theme {
  const colorScheme = useColorScheme();

  return useMemo(() => {
    const baseTheme = colorScheme === "dark" ? DarkTheme : DefaultTheme;
    const navigationColors =
      colorScheme === "dark" ? DARK_NAV_COLORS : LIGHT_NAV_COLORS;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        ...navigationColors,
      },
    };
  }, [colorScheme]);
}

const styles = StyleSheet.create({
  appFrame: {
    backgroundColor: colors.background,
    flex: 1,
  },
  nativeScene: {
    backgroundColor: colors.background,
  },
});
