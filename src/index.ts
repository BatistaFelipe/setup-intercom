import path from "node:path";
import { scanPortList } from "./services/scan-ports.js";
import hikvision from "./services/hikvision.js";
import intelbras from "./services/intelbras.js";
import {
  readHostsFile,
  UnknownError,
  log,
  validateHost,
  validatePortRange,
  getRequiredEnv,
  getDeviceProtocol,
  promisesLimit,
} from "./utils.js";
import {
  runGetConfig,
  runSetConfig,
  runSetAutoMaintainReboot,
} from "./orchestrator.js";
import { queryCondominium } from "./inventory/query.js";
import { detectVendor } from "./inventory/detect-vendor.js";
import type { InventoryCredentials, DeviceVendor } from "./inventory/types.js";
import { Command } from "commander";
import { FileData } from "./types.js";

const program = new Command();

program.option("-d, --dst-host <string>", "set destination host");
program.option("-r, --read-file", "read hosts from file ./data/hosts.json");
program.option("-a, --auto-reboot", "set auto reboot in Intelbras devices");
program.option("-i, --info", "query device inventory for the target host(s)");

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
    hosts = parsed.hosts.map((h, index) => {
      if (typeof h === "string") {
        if (!h) throw new Error(`Invalid hosts file entry at index ${index}: empty string`);
        return h;
      }
      if (h && typeof h === "object" && typeof h.host === "string" && h.host) {
        return h.host;
      }
      throw new Error(`Invalid hosts file entry at index ${index}`);
    });
  }

  for (const host of hosts) {
    validateHost(host);
  }

  const startPort = Number(process.env.START_PORT || 8084);
  const endPort = Number(process.env.END_PORT || 8099);
  validatePortRange(startPort, endPort);

  const protocol = getDeviceProtocol();

  try {
    if (options.info) {
      const credentials = {
        intelbras: {
          user: getRequiredEnv("INTELBRAS_USER"),
          password: getRequiredEnv("INTELBRAS_PWD"),
        },
        hikvision: {
          user: getRequiredEnv("HIKVISION_USER"),
          password: getRequiredEnv("HIKVISION_PWD"),
        },
      };

      for (const address of hosts) {
        const inventory = await queryCondominium({
          host: address,
          startPort,
          endPort,
          credentials,
          protocol,
        });
        console.log(JSON.stringify(inventory, null, 2));
      }
      return;
    }

    const credentials: InventoryCredentials = {
      intelbras: {
        user: getRequiredEnv("INTELBRAS_USER"),
        password: getRequiredEnv("INTELBRAS_PWD"),
      },
      hikvision: {
        user: getRequiredEnv("HIKVISION_USER"),
        password: getRequiredEnv("HIKVISION_PWD"),
      },
    };

    for (const address of hosts) {
      const scanResult = await scanPortList(address, startPort, endPort);
      const { hosts: openPorts } = JSON.parse(scanResult.message) as {
        hosts: string[];
      };

      for (const port of openPorts) {
        validateHost(port);
      }

      log.info(
        `SCAN_PORTS ${address}: Found ${openPorts.length} open port(s)`,
      );

      const pLimit = promisesLimit();
      const vendorMap = new Map<string, DeviceVendor>();
      await Promise.all(
        openPorts.map((port) =>
          pLimit(async () => {
            const vendor = await detectVendor(port, credentials, protocol);
            vendorMap.set(port, vendor);
            log.info(`DETECT_VENDOR ${port}: ${vendor}`);
          }),
        ),
      );

      const hikvisionPorts = openPorts.filter((p) => vendorMap.get(p) === "HIKVISION");
      const intelbrasPorts = openPorts.filter((p) => vendorMap.get(p) === "INTELBRAS");

      if (hikvisionPorts.length > 0) {
        const hikvisionConfigs = await runGetConfig(hikvision, address, hikvisionPorts);
        await runSetConfig(hikvision, address, hikvisionConfigs);
      }

      if (intelbrasPorts.length > 0) {
        const intelbrasConfigs = await runGetConfig(intelbras, address, intelbrasPorts);
        await runSetConfig(intelbras, address, intelbrasConfigs);

        if (options.autoReboot) {
          await runSetAutoMaintainReboot(intelbras, address, intelbrasConfigs);
        }
      }
    }
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    log.error(customError.toJSON());
  }
})();
