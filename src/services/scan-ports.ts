import net from "net";
import { DefaultResponse } from "../types.js";
import { log, promisesLimit, UnknownError } from "../utils.js";
import { saveToFile } from "../utils.js";

const pLimit = promisesLimit();

// testa se a porta do host está aberta
const scanPort = (
  host: string,
  port: number,
  socket_timeout: number = 1000,
): Promise<DefaultResponse> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(socket_timeout);
    try {
      socket.connect(port, host, () => {
        socket.removeAllListeners();
        socket.destroy();
        resolve({ message: `${host}:${port}`, success: true });
      });

      socket.on("error", (error: any) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve({
          message: `${host}:${port} Erro: ${error.message}`,
          success: false,
        });
      });

      socket.on("timeout", () => {
        socket.removeAllListeners();
        socket.destroy();
        resolve({ message: `${host}:${port} Timeout`, success: false });
      });
    } catch (error: unknown) {
      const customError = new UnknownError(error);
      return customError.toJSON();
    }
  });
};

// testa uma lista de portas de um host e retorna uma lista com os liberados
const scanPortList = async (
  host: string,
  startPort: number,
  endPort: number,
): Promise<DefaultResponse> => {
  const portRange = Array.from(
    { length: endPort - startPort + 1 },
    (_, i) => startPort + i,
  );

  const promises = portRange.map((port) => pLimit(() => scanPort(host, port)));
  const results = await Promise.all(promises);

  const openPorts = results.filter((r) => r.success).map((r) => r.message);

  return {
    message: JSON.stringify({ hosts: openPorts }, null, 2),
    success: true,
  };
};

async function runScanList(
  scanPortsFile: string,
  host: string,
  startPort: number,
  endPort: number,
) {
  // faz o scan de portas e salva no arquivo json somente os liberados
  const scanList: DefaultResponse = await scanPortList(
    host,
    startPort,
    endPort,
  );
  const statusSave = await saveToFile(scanPortsFile, scanList.message);
  if (!statusSave.success) {
    log.error(
      `❌ ${scanPortsFile} ${host}: Erro ao salvar arquivo!\n${statusSave.message}`,
    );
    return;
  }
  log.info(`✅ ${scanPortsFile} ${host}: Arquivo salvo com sucesso!`);
}

export default runScanList;
