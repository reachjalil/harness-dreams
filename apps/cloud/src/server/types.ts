export interface Env {
  SIGNAL_ROOM: DurableObjectNamespace;
  SNAPSHOT_BACKUP: DurableObjectNamespace;
  RTC_ICE_SERVERS_JSON?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_URL?: string;
  LIVEKIT_AGENT_NAME?: string;
  TURN_URL?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
}
