export interface DefaultResponse {
  message: string;
  success: boolean;
}

export interface HostConfig {
  host: string;
  extension?: number;
  sipTimeout?: number;
}

export interface FileData {
  hosts: (string | HostConfig)[];
}

export interface RequestResult {
  host: string;
  data: string;
  status_code: number;
}

export interface SipService {
  getConfigSip(hosts: string[]): Promise<DefaultResponse>;
  setTimeoutSip(configs: HostConfig[]): Promise<DefaultResponse>;
}

export interface AutoMaintain {
  setAutoMaintainReboot(configs: HostConfig[]): Promise<DefaultResponse>;
}
