import { readFile } from "fs/promises";
import "dotenv/config";
import { request } from "urllib";
import {
  FileData,
  HostConfig,
  DefaultResponse,
  RequestResult,
} from "../types.js";
import {
  promisesLimit,
  UnknownError,
  getRequiredEnv,
  getRequiredNumberEnv,
  log,
} from "../utils.js";

const pLimit = promisesLimit();

const HTTP_TIMEOUT = 5000;

const options = Object.freeze({
  headers: { "Content-type": "text/plain;charset=utf-8" },
  digestAuth: `${getRequiredEnv("INTELBRAS_USER")}:${getRequiredEnv("INTELBRAS_PWD")}`,
});

const parseIntelbrasResponse = (text: string) => {
  const [label, value] = text.split("=");
  const cleanLabel = label.replace(/\./g, "");
  return { host: cleanLabel, sipTimeout: Number(value), extension: 0 };
};

const getConfigSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const fileData: string = await readFile(filename, "utf-8");
    const obj: FileData = JSON.parse(fileData);

    const promises = obj.hosts.map((host) =>
      pLimit(async () => {
        const address = typeof host === "string" ? host : host.host;
        try {
          const url: string = `http://${address}/cgi-bin/configManager.cgi?action=getConfig&name=SIP.RegExpiration`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
            timeout: HTTP_TIMEOUT,
          });

          if (res.status === 200 && data) {
            const sipInfo: HostConfig = parseIntelbrasResponse(data.toString());
            if (sipInfo.sipTimeout != null) {
              const sipInfoObject: HostConfig = {
                host: address,
                sipTimeout: Number(sipInfo.sipTimeout),
              };

              return sipInfoObject;
            }
          }
          return null;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          log.warn(`Intelbras getConfigSip failed for ${address}: ${msg}`);
          return null;
        }
      }),
    );
    const results = await Promise.all(promises);
    const hosts = results.filter((h): h is HostConfig => h !== null);

    return {
      message: JSON.stringify({ hosts }, null, 2),
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};

const setTimeoutSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const SIP_TIMEOUT: number = getRequiredNumberEnv("SIP_TIMEOUT_INTELBRAS");
    const fileData: string = await readFile(filename, "utf-8");
    const hostConfig: { hosts: HostConfig[] } = JSON.parse(fileData);

    const promises = hostConfig.hosts.map((host: HostConfig) =>
      pLimit(async () => {
        if (host.sipTimeout !== SIP_TIMEOUT) {
          const address = typeof host === "string" ? host : host.host;
          const encodedTimeout = encodeURIComponent(String(SIP_TIMEOUT));
          const url: string = `http://${address}/cgi-bin/configManager.cgi?action=setConfig&SIP.RegExpiration=${encodedTimeout}`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
            timeout: HTTP_TIMEOUT,
          });

          if (res.status === 200 && data) {
            return { host: address, data: data.toString(), status_code: 200 };
          }
        }
        return null;
      }),
    );

    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is RequestResult => r !== null);

    return {
      message: JSON.stringify({ result: validResults }, null, 2),
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};

const setAutoMaintainReboot = async (
  filename: string,
): Promise<DefaultResponse> => {
  try {
    const AUTOREBOOTDAY: number = Number(process.env.AUTOREBOOTDAY) || 7;
    const raw = process.env.AUTOREBOOTENABLE ?? "true";
    const AUTOREBOOTENABLE: boolean = raw.toLowerCase() === "true";
    const AUTOREBOOTHOUR: number = Number(process.env.AUTOREBOOTHOUR) || 4;
    const fileData: string = await readFile(filename, "utf-8");
    const hostConfig: { hosts: HostConfig[] } = JSON.parse(fileData);

    const promises = hostConfig.hosts.map((host: HostConfig) =>
      pLimit(async () => {
        const address = typeof host === "string" ? host : host.host;
        const params = [
          `AutoMaintain.AutoRebootDay=${encodeURIComponent(String(AUTOREBOOTDAY))}`,
          `AutoMaintain.AutoRebootEnable=${encodeURIComponent(String(AUTOREBOOTENABLE))}`,
          `AutoMaintain.AutoRebootHour=${encodeURIComponent(String(AUTOREBOOTHOUR))}`,
        ].join("&");
        const url: string = `http://${address}/cgi-bin/configManager.cgi?action=setConfig&${params}`;
        const { data, res } = await request(url, {
          ...options,
          method: "GET",
          timeout: HTTP_TIMEOUT,
        });

        let textResponse: string = "";

        if (res.status === 200 && data) {
          textResponse = data.toString().replace(/\s/g, "");
        }

        if (textResponse === "OK") {
          return { host: address, data: textResponse, status_code: 200 };
        }

        return null;
      }),
    );

    const results = await Promise.all(promises);
    const validResults = results.filter((r): r is RequestResult => r !== null);

    return {
      message: JSON.stringify({ result: validResults }, null, 2),
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};
export default { getConfigSip, setTimeoutSip, setAutoMaintainReboot };
