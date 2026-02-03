import { log, saveToFile } from "./utils.js";
import { DefaultResponse, SetTimeoutSipResult, SipService } from "./types.js";

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
      `❌ ${host}: Erro ao buscar SIP.RegExpiration! - ${timeoutSipList.message}`,
    );
    return;
  }
  const statusSave = await saveToFile(datafile, timeoutSipList.message);
  if (!statusSave.success) {
    log.error(
      `❌ ${datafile} ${host}: Erro ao salvar arquivo!\n${statusSave.message}`,
    );
    return;
  }
  log.info(`✅ ${datafile} ${host}: Arquivo salvo com sucesso!`);
}

export async function runSetConfig(
  object: SipService,
  host: string,
  datafile: string,
) {
  const setTimeoutSip: DefaultResponse = await object.setTimeoutSip(datafile);
  if (!setTimeoutSip.success) {
    log.error(
      `❌ SET_TIMEOUT_SIP ${host}: Erro ao configurar dispositivo!\n${setTimeoutSip.message}`,
    );
    return;
  }
  try {
    const data = JSON.parse(setTimeoutSip.message);
    const results: SetTimeoutSipResult[] = data.result || [];

    for (const item of results) {
      log.info(
        `✅ SET_TIMEOUT_SIP - host: ${item.host} status: ${item.status_code}`,
      );
    }
  } catch (error) {
    log.error(
      `❌ SET_TIMEOUT_SIP - Erro: ${error.message || "Erro desconhecido"}`,
    );
  }
}
