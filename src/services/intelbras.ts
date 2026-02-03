import { readFile } from "fs/promises";
import "dotenv/config";
import { request } from "urllib";
import {
  FileData,
  HostConfig,
  DefaultResponse,
  SetTimeoutSipResult,
} from "../types.js";
import { promisesLimit, UnknownError } from "../utils.js";

const pLimit = promisesLimit();

// Intelbras API https://intelbras-caco-api.intelbras.com.br/
let options = {
  headers: { "Content-type": "text/plain;charset=utf-8" },
  digestAuth: `${process.env.INTELBRAS_USER}:${process.env.INTELBRAS_PWD}`,
};

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
        try {
          const address = typeof host === "string" ? host : host.host;
          const url: string = `http://${address}/cgi-bin/configManager.cgi?action=getConfig&name=SIP.RegExpiration`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
          });

          if (res.status === 200 && data) {
            const sipInfo: HostConfig = parseIntelbrasResponse(data.toString());
            if (sipInfo.sipTimeout) {
              const sipInfoObject: HostConfig = {
                host: address,
                sipTimeout: Number(sipInfo.sipTimeout),
              };

              return sipInfoObject;
            }
          }
          return null;
        } catch (error: unknown) {
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
    const SIP_TIMEOUT: number = Number(process.env.SIP_TIMEOUT_INTELBRAS);
    const fileData: string = await readFile(filename, "utf-8");
    const hostConfig: { hosts: HostConfig[] } = JSON.parse(fileData);

    const promises = hostConfig.hosts.map((host: HostConfig) =>
      pLimit(async () => {
        if (host.sipTimeout !== SIP_TIMEOUT) {
          const address = typeof host === "string" ? host : host.host;
          const url: string = `http://${address}/cgi-bin/configManager.cgi?action=setConfig&SIP.RegExpiration=${SIP_TIMEOUT}`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
          });

          if (res.status === 200 && data) {
            return { host: address, data: data.toString(), status_code: 200 };
          }
        }
        return null;
      }),
    );

    const results = await Promise.all(promises);
    const validResults = results.filter(
      (r): r is SetTimeoutSipResult => r !== null,
    );

    return {
      message: JSON.stringify({ result: validResults }, null, 2),
      success: true,
    };
  } catch (error: unknown) {
    const customError = new UnknownError(error);
    return customError.toJSON();
  }
};

export default { getConfigSip, setTimeoutSip };
