import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { promisify } from "util";
import { AddressInfo } from "net";

type RequestHandlerType = (incomingMessage: IncomingMessage, outgoingMessage: ServerResponse) => void;

type HttpServerType = {
  getConnections: () => Promise<number>;
  port: number;
  server: Server;
  stop: () => Promise<void>;
  url: string;
};

export type HttpServerFactoryType = (requestHandler: RequestHandlerType) => Promise<HttpServerType>;

export const createHttpServer = (requestHandler: RequestHandlerType): Promise<HttpServerType> => {
  const server: Server = createServer(requestHandler);

  let serverShutingDown: Promise<void> | undefined;

  const stop = () => {
    if (serverShutingDown) {
      return serverShutingDown;
    }

    serverShutingDown = promisify(server.close.bind(server))();

    return serverShutingDown;
  };

  const getConnections = () => {
    return promisify(server.getConnections.bind(server))();
  };

  return new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(() => {
      const address = server.address();
      if (!address) {
        reject(new Error("Unable to determine address."));
        return;
      }
      const port = (address as AddressInfo).port;
      const url = `http://localhost:${port}`;

      resolve({
        getConnections,
        port,
        server,
        stop,
        url,
      });
    });
  });
};
