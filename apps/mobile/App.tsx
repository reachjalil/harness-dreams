import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { LogBox, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HealthShell } from "./src/navigation/HealthShell";

LogBox.ignoreLogs([
  "Attempted to import the module",
  "Sending `onAnimatedValueUpdate` with no listeners registered.",
]);

export default function App() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <HealthShell />
    </GestureHandlerRootView>
  );
}
