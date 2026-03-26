import "dotenv/config";
import { request } from "urllib";
import { HostConfig, DefaultResponse, RequestResult } from "../types.js";
import {
  promisesLimit,
  UnknownError,
  getRequiredEnv,
  getRequiredNumberEnv,
  getDeviceProtocol,
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

const getConfigSip = async (hosts: string[]): Promise<DefaultResponse> => {
  try {
    const promises = hosts.map((address) =>
      pLimit(async () => {
        try {
          const url = `${getDeviceProtocol()}://${address}/cgi-bin/configManager.cgi?action=getConfig&name=SIP.RegExpiration`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
            timeout: HTTP_TIMEOUT,
          });

          if (res.status === 200 && data) {
            const sipInfo = parseIntelbrasResponse(data.toString());
            if (sipInfo.sipTimeout != null) {
              const config: HostConfig = {
                host: address,
                sipTimeout: Number(sipInfo.sipTimeout),
              };
              return config;
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
    const validHosts = results.filter(
      (h): h is HostConfig => h !== null,
    );

    return {
      message: JSON.stringify({ hosts: validHosts }, null, 2),
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};

const setTimeoutSip = async (
  configs: HostConfig[],
): Promise<DefaultResponse> => {
  try {
    const SIP_TIMEOUT = getRequiredNumberEnv("SIP_TIMEOUT_INTELBRAS");

    const promises = configs.map((host) =>
      pLimit(async () => {
        if (host.sipTimeout !== SIP_TIMEOUT) {
          const address = host.host;
          const encodedTimeout = encodeURIComponent(String(SIP_TIMEOUT));
          const url = `${getDeviceProtocol()}://${address}/cgi-bin/configManager.cgi?action=setConfig&SIP.RegExpiration=${encodedTimeout}`;
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
  configs: HostConfig[],
): Promise<DefaultResponse> => {
  try {
    const AUTOREBOOTDAY = Number(process.env.AUTOREBOOTDAY) || 7;
    const raw = process.env.AUTOREBOOTENABLE ?? "true";
    const AUTOREBOOTENABLE = raw.toLowerCase() === "true";
    const AUTOREBOOTHOUR = Number(process.env.AUTOREBOOTHOUR) || 4;

    const promises = configs.map((host) =>
      pLimit(async () => {
        const address = host.host;
        const params = [
          `AutoMaintain.AutoRebootDay=${encodeURIComponent(String(AUTOREBOOTDAY))}`,
          `AutoMaintain.AutoRebootEnable=${encodeURIComponent(String(AUTOREBOOTENABLE))}`,
          `AutoMaintain.AutoRebootHour=${encodeURIComponent(String(AUTOREBOOTHOUR))}`,
        ].join("&");
        const url = `${getDeviceProtocol()}://${address}/cgi-bin/configManager.cgi?action=setConfig&${params}`;
        const { data, res } = await request(url, {
          ...options,
          method: "GET",
          timeout: HTTP_TIMEOUT,
        });

        let textResponse = "";

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
