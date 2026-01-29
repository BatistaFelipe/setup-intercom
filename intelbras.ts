import { readFile } from "fs/promises";
import "dotenv/config";
import { request } from "urllib";
import {
  ScanResult,
  HostObject,
  SipInfo,
  DefaultResponse,
  SetTimeoutSipResult,
} from "./types.js";

// Intelbras API https://intelbras-caco-api.intelbras.com.br/
let options = {
  headers: { "Content-type": "text/plain;charset=utf-8" },
  digestAuth: `${process.env.INTELBRAS_USER}:${process.env.INTELBRAS_PWD}`,
};

const parseIntelbrasResponse = (text: string) => {
  const [label, value] = text.split("=");
  const cleanLabel = label.replace(/\./g, "");
  return { name: cleanLabel, time: Number(value) };
};

const getConfigSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const fileData: string = await readFile(filename, "utf-8");
    const obj: ScanResult = JSON.parse(fileData);

    const promises = obj.hosts.map(async (host) => {
      const url: string = `http://${host}/cgi-bin/configManager.cgi?action=getConfig&name=SIP.RegExpiration`;
      const { data, res } = await request(url, { ...options, method: "GET" });

      if (res.status === 200 && data) {
        const sipInfo: SipInfo = parseIntelbrasResponse(data.toString());
        if (sipInfo.time) return { host, sipTimeout: sipInfo.time };
      }
      return null;
    });
    const results = await Promise.all(promises);
    const hosts = results.filter((h): h is HostObject => h !== null);

    return {
      message: JSON.stringify({ hosts }, null, 2),
      success: true,
    };
  } catch (error: any) {
    return {
      message: error.message || "Erro desconhecido",
      success: false,
    };
  }
};

const setTimeoutSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const SIP_TIMEOUT: number = Number(process.env.SIP_TIMEOUT);
    const fileData: string = await readFile(filename, "utf-8");
    const obj: ScanResult = JSON.parse(fileData);

    const promises = obj.hosts.map(async (host: any) => {
      if (host.sipTimeout !== SIP_TIMEOUT) {
        const address = host.host;
        const url: string = `http://${address}/cgi-bin/configManager.cgi?action=setConfig&SIP.RegExpiration=${SIP_TIMEOUT}`;
        const { data, res } = await request(url, { ...options, method: "GET" });

        if (res.status === 200 && data) {
          return { host: address, status: data.toString() };
        }
      }
      return null;
    });

    const results = await Promise.all(promises);
    const validResults = results.filter(
      (r): r is SetTimeoutSipResult => r !== null,
    );

    return {
      message: JSON.stringify({ result: validResults }, null, 2),
      success: true,
    };
  } catch (error: any) {
    return {
      message: error.message || "Erro desconhecido",
      success: false,
    };
  }
};

export default { getConfigSip, setTimeoutSip };
