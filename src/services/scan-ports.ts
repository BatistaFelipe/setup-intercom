import net from "net";
import { DefaultResponse } from "../types.js";
import { promisesLimit } from "../utils.js";

const pLimit = promisesLimit();

export const scanPort = (
  host: string,
  port: number,
  socket_timeout: number = 1000,
): Promise<DefaultResponse> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(socket_timeout);

    socket.connect(port, host, () => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ message: `${host}:${port}`, success: true });
    });

    socket.on("error", (error: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({
        message: `${host}:${port} Error: ${error.message}`,
        success: false,
      });
    });

    socket.on("timeout", () => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ message: `${host}:${port} Timeout`, success: false });
    });
  });
};

// Scans a port range on a host and returns open ports
export const scanPortList = async (
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

