import path from "node:path";
import runScanList from "./services/scan-ports.js";
import hikvision from "./services/hikvision.js";
import intelbras from "./services/intelbras.js";
import { readHostsFile, promisesLimit, UnknownError, log } from "./utils.js";
import { runGetConfig, runSetConfig } from "./orchestrator.js";
import { Command } from "commander";

const program = new Command();

program.option("-d, --dst-host <string>", "Destination host");
program.option("-r, --read-file", "Read hosts from file ./data/hosts.json");
program.parse(process.argv);
const options = program.opts();

(async () => {
  let hosts: string[] = [
    options.dstHost || process.env.DST_HOST || "localhost",
  ];
  if (options.readFile) {
    const dataFile = await readHostsFile(path.resolve("data", "hosts.json"));
    hosts = JSON.parse(dataFile.message).hosts;
  }
  const startPort: number = Number(process.env.START_PORT || 8084);
  const endPort: number = Number(process.env.END_PORT || 8099);
  const scanPortsFile: string = path.resolve("data", "scan-ports.json");
  const datafileIntelbras: string = path.resolve("data", "intelbras.json");
  const datafileHikvision: string = path.resolve("data", "hikvision.json");

  try {
    for (const address of hosts) {
      // scan ports
      await runScanList(scanPortsFile, address, startPort, endPort);

      // Hikvision
      await runGetConfig(hikvision, address, datafileHikvision, scanPortsFile);
      await runSetConfig(hikvision, address, datafileHikvision);

      // Intelbras
      await runGetConfig(intelbras, address, datafileIntelbras, scanPortsFile);
      await runSetConfig(intelbras, address, datafileIntelbras);
    }
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    log.error(customError.toJSON());
  }
})();
