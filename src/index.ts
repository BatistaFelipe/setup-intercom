import path from "node:path";
import runScanList from "./services/scan-ports.js";
import hikvision from "./services/hikvision.js";
import intelbras from "./services/intelbras.js";
import { log, saveToFile } from "./utils.js";
import { DefaultResponse, SetTimeoutSipResult, SipService } from "./types.js";
import { Command } from "commander";

const program = new Command();

program.option("-d, --dst-host <string>", "Destination host");
program.option("-r, --read-file", "Read hosts from file ./data/hosts.json");
program.parse(process.argv);
const options = program.opts();

async function runGetConfig(
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

async function runSetConfig(
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

(async () => {
  const host: string = options.dstHost || process.env.DST_HOST;
  const startPort: number = Number(process.env.START_PORT || 8084);
  const endPort: number = Number(process.env.END_PORT || 8099);

  const scanPortsFile: string = path.resolve("data", "scan-ports.json");
  const datafileHikvision: string = path.resolve("data", "hikvision.json");
  const datafileIntelbras: string = path.resolve("data", "intelbras.json");
  const datafileHosts: string = path.resolve("data", "hosts.json");

  await runScanList(scanPortsFile, host, startPort, endPort);
  await runGetConfig(hikvision, host, datafileHikvision, scanPortsFile);
  await runSetConfig(hikvision, host, datafileHikvision);

  await runGetConfig(intelbras, host, datafileIntelbras, scanPortsFile);
  await runSetConfig(intelbras, host, datafileIntelbras);
})();
