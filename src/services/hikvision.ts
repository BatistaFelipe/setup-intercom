import { readFile } from "fs/promises";
import "dotenv/config";
import { request } from "urllib";
import {
  FileData,
  HostConfig,
  DefaultResponse,
  SetTimeoutSipResult,
} from "../types.js";
import { xml2json } from "xml-js";
import xmlbuilder from "xmlbuilder";
import { promisesLimit, UnknownError } from "../utils.js";

const pLimit = promisesLimit();

let options = {
  digestAuth: `${process.env.HIKVISION_USER}:${process.env.HIKVISION_PWD}`,
};

const getConfigSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const fileData: string = await readFile(filename, "utf-8");
    const hostConfig: FileData = JSON.parse(fileData);

    const promises = hostConfig.hosts.map((host) =>
      pLimit(async () => {
        try {
          const address = typeof host === "string" ? host : host.host;
          const url: string = `http://${address}/ISAPI/System/Network/SIP`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
          });

          if (res.status === 200 && data) {
            const result = JSON.parse(
              xml2json(data, { compact: true, spaces: 4 }),
            );
            const extension: number =
              result["SIPServerList"]["SIPServer"]["Standard"]["authID"][
                "_text"
              ];
            const sipTimeout: number =
              result["SIPServerList"]["SIPServer"]["Standard"]["expires"][
                "_text"
              ];

            const sipInfoObject: HostConfig = {
              host: address,
              extension,
              sipTimeout,
            };

            return sipInfoObject;
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

// prettier-ignore
const postXmlBody = (extension: number): string => {
  const xml = xmlbuilder
    .create("SIPServer", { encoding: "utf-8" })
    .att("xmlns", "http://www.isapi.org/ver20/XMLSchema")
    .ele("id", process.env.SIP_ID).up()
    .ele("Standard")
      .ele("enabled", process.env.SIP_ENABLE).up()
      .ele("proxy", process.env.SIP_SERVER).up()
      .ele("proxyPort", process.env.SIP_SERVER_PORT).up()
      .ele("userName", extension).up()
      .ele("displayName", extension).up()
      .ele("authID", extension).up()
      .ele("password", process.env.SIP_PASSWORD).up()
      .ele("expires", process.env.SIP_TIMEOUT_HIKVISION)
    .end({ pretty: true });
  return xml.toString();
};

const setTimeoutSip = async (filename: string): Promise<DefaultResponse> => {
  try {
    const SIP_TIMEOUT: number = Number(process.env.SIP_TIMEOUT_HIKVISION);
    const fileData: string = await readFile(filename, "utf-8");
    const hostConfig: { hosts: HostConfig[] } = JSON.parse(fileData);

    const promises = hostConfig.hosts.map((host: HostConfig) =>
      pLimit(async () => {
        if (Number(host.sipTimeout) !== SIP_TIMEOUT) {
          const address = typeof host === "string" ? host : host.host;
          const url: string = `http://${address}/ISAPI/System/Network/SIP`;
          const body: string = postXmlBody(host.extension);

          const { data, res } = await request(url, {
            ...options,
            method: "PUT",
            data: body,
          });

          if (res.status === 200 && data) {
            const setSipTimeoutObject: SetTimeoutSipResult = {
              host: address,
              data: data.toString(),
              status_code: 200,
            };
            return setSipTimeoutObject;
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
