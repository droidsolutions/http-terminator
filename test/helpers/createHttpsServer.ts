/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createServer, Server } from "https";
import { IncomingMessage, ServerResponse } from "http";
import { createCertificate } from "pem";
import { promisify } from "util";
import { AddressInfo } from "net";

type RequestHandlerType = (incomingMessage: IncomingMessage, outgoingMessage: ServerResponse) => void;

export interface HttpsServerType {
  getConnections: () => Promise<number>;
  port: number;
  server: Server;
  stop: () => Promise<void>;
  url: string;
}

export type HttpsServerFactoryType = (requestHandler: RequestHandlerType) => Promise<HttpsServerType>;

export const createHttpsServer = async (requestHandler: RequestHandlerType): Promise<HttpsServerType> => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Promisify of overloaded functions is difficult, see https://github.com/microsoft/TypeScript/issues/26048
  const { serviceKey, certificate, csr } = await promisify(createCertificate)({
    days: 1,
    selfSigned: true,
  });

  // const { serviceKey, certificate, csr } = await new Promise((resolve, reject) => {
  //   createCertificate({
  //     days: 365,
  //     selfSigned: true,
  //   }, (err: any, pem: CertificateCreationResult) => {
  //     if (err) {
  //       reject(err);
  //       return;
  //     }

  //     resolve(pem);
  //   });
  // });

  const httpsOptions = {
    ca: csr,
    cert: certificate,
    key: serviceKey,
  };

  const server = createServer(httpsOptions, requestHandler);

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
      const url = `https://localhost:${port.toString()}`;

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
