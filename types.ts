export interface AudioStreamConfig {
  sampleRate: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface VolumeLevel {
  input: number;
  output: number;
}
