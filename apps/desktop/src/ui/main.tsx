import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import PeerHost from "./PeerHost";
import "./styles.css";

const container = document.getElementById("root");
if (container) {
  const Root = new URLSearchParams(window.location.search).has("peerHost")
    ? PeerHost
    : App;
  createRoot(container).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
}
