export type DeviceVendor = "INTELBRAS" | "HIKVISION" | "KHOMP";

export interface AutoRebootStatus {
  readonly enabled: boolean;
  readonly day: number;
  readonly hour: number;
}

export interface DeviceInventory {
  readonly address: string;
  readonly vendor: DeviceVendor;
  readonly model: string | null;
  readonly firmware: string | null;
  readonly serialNumber: string | null;
  readonly macAddress: string | null;
  readonly lanIp: string | null;
  readonly sipExtension: string | null;
  readonly sipTimeout: number | null;
  readonly autoReboot: AutoRebootStatus | null;
  readonly deviceDatetime: string | null;
}

export interface InventoryError {
  readonly address: string;
  readonly message: string;
}

export interface CondominiumInventory {
  readonly host: string;
  readonly queriedAt: string;
  readonly devices: readonly DeviceInventory[];
  readonly errors: readonly InventoryError[];
}

export interface InventoryCredentials {
  readonly intelbras: { readonly user: string; readonly password: string };
  readonly hikvision: { readonly user: string; readonly password: string };
}

export interface QueryCondominiumOptions {
  readonly host: string;
  readonly startPort: number;
  readonly endPort: number;
  readonly credentials: InventoryCredentials;
}

export interface QueryDeviceOptions {
  readonly address: string;
  readonly credentials: InventoryCredentials;
}

export interface VendorInventoryAdapter {
  probe(address: string, digestAuth: string): Promise<boolean>;
  collect(address: string, digestAuth: string): Promise<DeviceInventory>;
}
