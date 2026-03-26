import { log, saveToFile } from "./utils.js";
import {
  DefaultResponse,
  RequestResult,
  SipService,
  AutoMaintain,
} from "./types.js";

export async function runGetConfig(
  object: SipService,
  host: string,
  datafile: string,
  scanPortsFile: string,
) {
  const timeoutSipList: DefaultResponse =
    await object.getConfigSip(scanPortsFile);
  if (!timeoutSipList.success) {
    log.error(
      `GET_CONFIG ${host}: Failed to fetch SIP.RegExpiration - ${timeoutSipList.message}`,
    );
    return;
  }
  const statusSave = await saveToFile(datafile, timeoutSipList.message);
  if (!statusSave.success) {
    log.error(
      `GET_CONFIG ${datafile} ${host}: Failed to save file - ${statusSave.message}`,
    );
    return;
  }
  log.info(`GET_CONFIG ${datafile} ${host}: File saved successfully`);
}

export async function runSetConfig(
  object: SipService,
  host: string,
  datafile: string,
) {
  const setTimeoutSip: DefaultResponse = await object.setTimeoutSip(datafile);
  if (!setTimeoutSip.success) {
    log.error(
      `SET_TIMEOUT_SIP ${host}: Failed to configure device - ${setTimeoutSip.message}`,
    );
    return;
  }
  try {
    const data = JSON.parse(setTimeoutSip.message);
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
  datafile: string,
) {
  const setAutoMaintainReboot: DefaultResponse =
    await object.setAutoMaintainReboot(datafile);
  if (!setAutoMaintainReboot.success) {
    log.error(
      `SET_AUTO_MAINTAIN_REBOOT ${host}: Failed to configure device - ${setAutoMaintainReboot.message}`,
    );
    return;
  }
  try {
    const data = JSON.parse(setAutoMaintainReboot.message);
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
