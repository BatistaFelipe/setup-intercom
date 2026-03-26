import path from "node:path";
import runScanList from "./services/scan-ports.js";
import hikvision from "./services/hikvision.js";
import intelbras from "./services/intelbras.js";
import {
  readHostsFile,
  UnknownError,
  log,
  validateHost,
  validatePortRange,
} from "./utils.js";
import {
  runGetConfig,
  runSetConfig,
  runSetAutoMaintainReboot,
} from "./orchestrator.js";
import { Command } from "commander";
import { FileData } from "./types.js";

const program = new Command();

program.option("-d, --dst-host <string>", "set destination host");
program.option("-r, --read-file", "read hosts from file ./data/hosts.json");
program.option("-a, --auto-reboot", "set auto reboot in Intelbras devices");

program.parse(process.argv);
const options = program.opts();

(async () => {
  let hosts: string[] = [
    options.dstHost || process.env.DST_HOST || "localhost",
  ];
  if (options.readFile) {
    const dataFile = await readHostsFile(path.resolve("data", "hosts.json"));
    if (!dataFile.success) {
      log.error(`Failed to read hosts file: ${dataFile.message}`);
      process.exit(1);
    }
    const parsed: FileData = JSON.parse(dataFile.message);
    if (!Array.isArray(parsed.hosts)) {
      log.error("Invalid hosts file: missing 'hosts' array");
      process.exit(1);
    }
    hosts = parsed.hosts.map((h) => (typeof h === "string" ? h : h.host));
  }

  for (const host of hosts) {
    validateHost(host);
  }

  const startPort: number = Number(process.env.START_PORT || 8084);
  const endPort: number = Number(process.env.END_PORT || 8099);
  validatePortRange(startPort, endPort);

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

      if (options.autoReboot) {
        // Auto Reboot Intelbras
        await runSetAutoMaintainReboot(intelbras, address, scanPortsFile);
      }
    }
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    log.error(customError.toJSON());
  }
})();
