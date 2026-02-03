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
  getConfigSip(filename: string): Promise<DefaultResponse>;
  setTimeoutSip(filename: string): Promise<DefaultResponse>;
}

export interface AutoMaintain {
  setAutoMaintainReboot(filename: string): Promise<DefaultResponse>;
}
