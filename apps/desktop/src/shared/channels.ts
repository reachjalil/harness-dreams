/**
 * IPC channel names — runtime constants with no validation dependencies.
 *
 * Kept separate from `schemas.ts` so the sandboxed preload can import channel
 * names without pulling Zod into the renderer bundle.
 */

export const Invoke = {
  ConfigGet: "config:get",
  ConfigSet: "config:set",
  StateGet: "state:get",
  ReportGet: "report:get",
  ReportList: "report:list",
  CloudSyncStatus: "cloudSync:status",
  CloudSyncNow: "cloudSync:syncNow",
  CloudSyncPairDevice: "cloudSync:pairDevice",
  CloudSyncRemoveDevice: "cloudSync:removeDevice",
  DiscoverProjects: "projects:discover",
  AddProject: "projects:add",
  DreamNow: "action:dreamNow",
  NapNow: "action:napNow",
  PauseDream: "action:pauseDream",
  ResumeDream: "action:resumeDream",
  CompleteOnboarding: "action:completeOnboarding",
  MarkReviewed: "action:markReviewed",
  SetGoalDisposition: "action:setGoalDisposition",
  RevertConfigUpdate: "action:revertConfigUpdate",
  SetLaunchAtLogin: "action:setLaunchAtLogin",
  TestNotification: "action:testNotification",
  ResetOnboarding: "action:resetOnboarding",
  ResetAll: "action:resetAll",
  RevealData: "action:revealData",
  OpenMain: "action:openMain",
  Quit: "action:quit",
} as const;
export type Invoke = (typeof Invoke)[keyof typeof Invoke];

export const Send = {
  /** main → all UI windows */
  BroadcastConfig: "broadcast:config",
  BroadcastState: "broadcast:state",
  BroadcastReports: "broadcast:reports",
  BroadcastCloudSync: "broadcast:cloudSync",
  /** main → UI: select and show a specific past session */
  SelectReport: "broadcast:selectReport",
} as const;
export type Send = (typeof Send)[keyof typeof Send];
