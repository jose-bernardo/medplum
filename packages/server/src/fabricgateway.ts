import { FabricGateway } from '@medplum/fabric';
import { MedplumServerConfig } from './config';
import { globalLogger } from './logger';

let gateway: FabricGateway | undefined;

export function getFabricGateway(): FabricGateway {
  if (!gateway) {
    throw new Error("Fabric Gateway not setup");
  }
  return gateway;
}

export function initFabricGateway(serverConfig: MedplumServerConfig): void {
  const config = serverConfig.fabric;

  gateway = new FabricGateway(config);

  gateway.connect().then().catch((err: Error) => {
    globalLogger.error("Fabric network connection error: " + err);
  })
}

export async function closeFabricGateway(): Promise<void> {
  if (gateway) {
    await gateway.close();
    gateway = undefined;
  }
}