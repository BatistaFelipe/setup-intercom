import { log, sanitizeLogMessage } from "./utils.js";
import {
  DefaultResponse,
  HostConfig,
  RequestResult,
  SipService,
  AutoMaintain,
} from "./types.js";

export async function runGetConfig(
  object: SipService,
  host: string,
  openPorts: string[],
): Promise<HostConfig[]> {
  const result: DefaultResponse = await object.getConfigSip(openPorts);
  if (!result.success) {
    log.error(
      `GET_CONFIG ${host}: Failed to fetch SIP config - ${sanitizeLogMessage(result.message)}`,
    );
    return [];
  }

  const parsed: { hosts: HostConfig[] } = JSON.parse(result.message);
  log.info(`GET_CONFIG ${host}: Retrieved ${parsed.hosts.length} device(s)`);
  return parsed.hosts;
}

export async function runSetConfig(
  object: SipService,
  host: string,
  configs: HostConfig[],
): Promise<void> {
  const result: DefaultResponse = await object.setTimeoutSip(configs);
  if (!result.success) {
    log.error(
      `SET_TIMEOUT_SIP ${host}: Failed to configure device - ${sanitizeLogMessage(result.message)}`,
    );
    return;
  }
  try {
    const data = JSON.parse(result.message);
    const results: RequestResult[] = data.result || [];

    for (const item of results) {
      log.info(
        `SET_TIMEOUT_SIP - host: ${item.host} status: ${item.status_code}`,
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log.error(`SET_TIMEOUT_SIP - Error: ${msg}`);
  }
}

export async function runSetAutoMaintainReboot(
  object: AutoMaintain,
  host: string,
  configs: HostConfig[],
): Promise<void> {
  const result: DefaultResponse = await object.setAutoMaintainReboot(configs);
  if (!result.success) {
    log.error(
      `SET_AUTO_MAINTAIN_REBOOT ${host}: Failed to configure device - ${sanitizeLogMessage(result.message)}`,
    );
    return;
  }
  try {
    const data = JSON.parse(result.message);
    const results: RequestResult[] = data.result || [];

    for (const item of results) {
      log.info(
        `SET_AUTO_MAINTAIN_REBOOT - host: ${item.host} status: ${item.status_code}`,
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log.error(`SET_AUTO_MAINTAIN_REBOOT - Error: ${msg}`);
  }
}
