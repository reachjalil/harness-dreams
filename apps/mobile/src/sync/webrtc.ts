import { RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import { recordValue, stringValue } from "./normalization";

export function parseRemoteDescription(value: string): RTCSessionDescription {
  const parsed = JSON.parse(value) as { type: string; sdp: string };
  return new RTCSessionDescription(parsed);
}

export function candidateFromUnknown(value: unknown): RTCIceCandidate | null {
  const record = recordValue(value);
  const candidate = stringValue(record.candidate);
  if (!candidate) return null;
  return new RTCIceCandidate(record);
}
