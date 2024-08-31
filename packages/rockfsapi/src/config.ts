interface FabricConfig {
  channelName: string
  chaincodeName: string
  mspId: string
  keyPath: string
  certPath: string
  tlsCertPath: string
  peerEndpoint: string
  peerHostAlias: string
}

export interface RockFSConfig {
  port: number
  syncDir: string
  fabric: FabricConfig
}