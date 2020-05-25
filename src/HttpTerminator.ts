import { Socket } from "net";
import { TLSSocket } from "tls";
import { IncomingMessage, OutgoingMessage, Server as HttpServer } from "http";
import { Server as HttpsServer } from "https";
import { Http2SecureServer } from "http2";

type NodeServer = HttpServer | HttpsServer | Http2SecureServer;

/**
 * A wrapper around a NodeJS server that handles termination.
 */
export class HttpTerminator {
  private sockets: Set<Socket>;
  private secureSockets: Set<TLSSocket>;

  private terminating: Promise<void> | undefined;

  /**
   * Initializes a new instance of the @see HttpTerminator class.
   * @param server The node server, either HTTP or HTTPS.
   */
  constructor(private server: NodeServer) {
    this.sockets = new Set();
    this.secureSockets = new Set();

    // Remember connections
    server.on("connection", (socket: Socket): void => {
      if (this.terminating) {
        socket.destroy();
      } else {
        this.sockets.add(socket);

        socket.once("close", () => {
          this.sockets.delete(socket);
        });
      }
    });

    // Remember TLS connections
    server.on("secureConnection", (socket: TLSSocket): void => {
      if (this.terminating) {
        socket.destroy();
      } else {
        this.secureSockets.add(socket);

        socket.once("close", () => {
          this.secureSockets.delete(socket);
        });
      }
    });
  }

  /**
   * Stops the server from accepting new requests, sets connection close header on existing requests and kills all
   * requests after the given @see gracefulTerminationTimeout .
   * @param gracefulTerminationTimeout A time in milliseconds to wait before killing existing connections.
   * @returns The promise returned by @see this.server.close .
   */
  public async terminate(gracefulTerminationTimeout = 1000): Promise<void> {
    // Return the existing promise when this method is called multiple times.
    if (this.terminating) {
      return this.terminating;
    }

    let resolveTerminating: () => void;
    let rejectTerminating: (err: Error) => void;

    this.terminating = new Promise((resolve, reject) => {
      resolveTerminating = resolve;
      rejectTerminating = reject;
    });

    // Set connection close header on all incoming requests.
    this.server.on("request", (_: IncomingMessage, outgoingMessage: OutgoingMessage): void => {
      this.setConnectionCloseHeader(outgoingMessage);
    });

    // Close all sockets that have no current requests.
    this.closeSockets(this.sockets);
    this.closeSockets(this.secureSockets);

    if (this.sockets.size > 0 || this.secureSockets.size) {
      // Wait the grace termination time before destroying the remaining sockets (those with existing requests).
      await new Promise((resolve) => setTimeout(resolve, gracefulTerminationTimeout));

      for (const socket of this.sockets) {
        socket.destroy();
      }
      for (const secureSocket of this.secureSockets) {
        secureSocket.destroy();
      }
    }

    // Tell the server to stop accepting new requests.
    this.server.close((err?: Error): void => {
      if (err) {
        rejectTerminating(err);
      } else {
        resolveTerminating();
      }
    });

    return this.terminating;
  }

  /**
   * Checks each socket sets connection close header for those with existing requests, destroys the others.
   * @param sockets A list of sockets.
   */
  private closeSockets(sockets: Set<Socket | TLSSocket>): void {
    for (const socket of sockets) {
      // This is the HTTP CONNECT request socket.
      if (!((socket as any).server instanceof HttpServer) && !(socket instanceof TLSSocket)) {
        continue;
      }

      const serverResponse: OutgoingMessage = (socket as any)._httpMessage;

      if (serverResponse) {
        this.setConnectionCloseHeader(serverResponse);

        continue;
      }

      this.destroySocket(socket);
    }
  }

  /**
   * Adds connection close header to the outgoing message.
   * @param serverResponse The outgoing message.
   */
  private setConnectionCloseHeader(serverResponse: OutgoingMessage): void {
    if (!serverResponse.headersSent) {
      serverResponse.setHeader("connection", "close");
    }
  }

  /**
   * Destroys the socket and removes it from the internal list of sockets.
   * @param socket The socket.
   */
  private destroySocket(socket: Socket | TLSSocket): void {
    socket.destroy();

    if (socket instanceof Socket) {
      this.sockets.delete(socket);
    } else {
      this.secureSockets.delete(socket);
    }
  }
}
