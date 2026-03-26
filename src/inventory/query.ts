import { scanPortList } from "../services/scan-ports.js";
import { validateHost, validatePortRange, promisesLimit } from "../utils.js";
import { detectVendor } from "./detect-vendor.js";
import { collect as intelbrasCollect } from "./intelbras-inventory.js";
import { collect as hikvisionCollect } from "./hikvision-inventory.js";
import type {
  QueryCondominiumOptions,
  QueryDeviceOptions,
  CondominiumInventory,
  DeviceInventory,
  DeviceProtocol,
  InventoryError,
  InventoryCredentials,
  DeviceVendor,
} from "./types.js";

const pLimit = promisesLimit();

async function collectByVendor(
  address: string,
  vendor: DeviceVendor,
  credentials: InventoryCredentials,
  protocol: DeviceProtocol = "http",
): Promise<DeviceInventory> {
  if (vendor === "INTELBRAS") {
    return intelbrasCollect(address, credentials.intelbras, protocol);
  }

  if (vendor === "HIKVISION") {
    return hikvisionCollect(address, credentials.hikvision, protocol);
  }

  return {
    address,
    vendor: "KHOMP",
    model: null,
    firmware: null,
    serialNumber: null,
    macAddress: null,
    lanIp: null,
    sipExtension: null,
    sipTimeout: null,
    autoReboot: null,
    deviceDatetime: null,
  };
}

export async function queryCondominium(
  options: QueryCondominiumOptions,
): Promise<CondominiumInventory> {
  validateHost(options.host);
  validatePortRange(options.startPort, options.endPort);

  const protocol = options.protocol ?? "http";

  const scanResult = await scanPortList(
    options.host,
    options.startPort,
    options.endPort,
  );
  const { hosts: openPorts } = JSON.parse(scanResult.message) as {
    hosts: string[];
  };

  for (const addr of openPorts) {
    validateHost(addr);
  }

  const devices: DeviceInventory[] = [];
  const errors: InventoryError[] = [];

  const tasks = openPorts.map((address) =>
    pLimit(async () => {
      try {
        const vendor = await detectVendor(address, options.credentials, protocol);
        const device = await collectByVendor(
          address,
          vendor,
          options.credentials,
          protocol,
        );
        devices.push(device);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push({ address, message: msg });
      }
    }),
  );

  await Promise.all(tasks);

  return {
    host: options.host,
    queriedAt: new Date().toISOString(),
    devices,
    errors,
  };
}

export async function queryDevice(
  options: QueryDeviceOptions,
): Promise<DeviceInventory> {
  const { address, credentials, protocol = "http" } = options;

  if (!address || !address.includes(":")) {
    throw new Error(`Invalid device address: ${address}`);
  }
  validateHost(address);

  const vendor = await detectVendor(address, credentials, protocol);
  return collectByVendor(address, vendor, credentials, protocol);
}
