import "dotenv/config";
import { request } from "urllib";
import { HostConfig, DefaultResponse, RequestResult } from "../types.js";
import { xml2json } from "xml-js";
import xmlbuilder from "xmlbuilder";
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
  digestAuth: `${getRequiredEnv("HIKVISION_USER")}:${getRequiredEnv("HIKVISION_PWD")}`,
});

const getConfigSip = async (hosts: string[]): Promise<DefaultResponse> => {
  try {
    const promises = hosts.map((address) =>
      pLimit(async () => {
        try {
          const url = `${getDeviceProtocol()}://${address}/ISAPI/System/Network/SIP`;
          const { data, res } = await request(url, {
            ...options,
            method: "GET",
            timeout: HTTP_TIMEOUT,
          });

          if (res.status === 200 && data) {
            const result = JSON.parse(
              xml2json(data.toString(), { compact: true, spaces: 4 }),
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
          const msg = error instanceof Error ? error.message : "Unknown error";
          log.warn(`Hikvision getConfigSip failed for ${address}: ${msg}`);
          return null;
        }
      }),
    );
    const results = await Promise.all(promises);
    const validHosts = results.filter((h): h is HostConfig => h !== null);

    return {
      message: JSON.stringify({ hosts: validHosts }, null, 2),
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

const setTimeoutSip = async (
  configs: HostConfig[],
): Promise<DefaultResponse> => {
  try {
    const SIP_TIMEOUT = getRequiredNumberEnv("SIP_TIMEOUT_HIKVISION");

    const promises = configs.map((host) =>
      pLimit(async () => {
        if (Number(host.sipTimeout) !== SIP_TIMEOUT) {
          const address = host.host;
          const url = `${getDeviceProtocol()}://${address}/ISAPI/System/Network/SIP`;
          const body = postXmlBody(host.extension!);

          const { data, res } = await request(url, {
            ...options,
            method: "PUT",
            data: body,
            timeout: HTTP_TIMEOUT,
          });

          if (res.status === 200 && data) {
            const setSipTimeoutObject: RequestResult = {
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

export default { getConfigSip, setTimeoutSip };
