import type { Env as WorkerEnv } from "./server/types";
import type * as WorkerModule from "./worker";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}

    interface GlobalProps {
      mainModule: typeof WorkerModule;
      durableNamespaces: "SignalRoom" | "SnapshotBackupRoom";
    }
  }
}
