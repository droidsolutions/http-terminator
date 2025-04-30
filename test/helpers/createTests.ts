import chai from "chai";
import got from "got";
import { Agent, IncomingMessage, OutgoingMessage } from "http";
import https from "https";
import sinon from "sinon";
import { HttpTerminator } from "../../src/HttpTerminator";
import { HttpServerFactoryType, HttpServerType } from "./createHttpServer";
import { HttpsServerFactoryType, HttpsServerType } from "./createHttpsServer";
import { delay } from "./Delay";

// eslint-disable-next-line mocha/no-exports
export const createTests = (createHttpServer: HttpServerFactoryType | HttpsServerFactoryType): void => {
  let httpServer: HttpServerType | HttpsServerType | undefined;

  // eslint-disable-next-line mocha/no-top-level-hooks
  afterEach(async function () {
    if (httpServer) {
      try {
        // Fallback cleanup to prevent never ending test run
        await httpServer.stop();
      } catch (_: unknown) {
        // catch when the server was already stopped by the test
      }

      httpServer = undefined;
    }
  });

  it("should terminate HTTP server with no connections", async function () {
    this.slow(400);
    httpServer = await createHttpServer(() => {});

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    chai.expect(httpServer.server.listening).to.be.true;

    const terminator = new HttpTerminator(httpServer.server);
    await terminator.terminate();

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    chai.expect(httpServer.server.listening).to.be.false;
  });

  it("should terminate hanging sockets after gracefulTerminationTimeout", async function () {
    this.slow(900);

    const spy = sinon.spy();

    httpServer = await createHttpServer(() => {
      spy();
    });

    const terminator = new HttpTerminator(httpServer.server);
    got(httpServer.url, { https: { rejectUnauthorized: false } }).catch((_: unknown) => {});
    await delay(50);

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    chai.expect(spy.called).to.be.true;

    void terminator.terminate(150);

    await delay(100);

    // The timeout has not passed.
    await chai.expect(httpServer.getConnections()).to.eventually.equal(1);

    await delay(100);

    await chai.expect(httpServer.getConnections()).to.eventually.equal(0);
  });

  it("server should stop accepting new connections after terminate is called", async function () {
    this.slow(500);

    const stub = sinon.stub();

    stub.onCall(0).callsFake((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      setTimeout(() => {
        outgoingMessage.end("foo");
      }, 100);
    });
    stub.onCall(1).callsFake((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      outgoingMessage.end("bar");
    });

    httpServer = await createHttpServer(stub);

    const terminator = new HttpTerminator(httpServer.server);

    const request0 = got(httpServer.url, { https: { rejectUnauthorized: false } });

    await delay(50);

    void terminator.terminate(150);

    await delay(50);

    const request1 = got(httpServer.url, { retry: 0, timeout: { connect: 50 }, https: { rejectUnauthorized: false } });
    await chai.expect(request1).to.be.rejected;

    const response0 = await request0;
    chai.expect(response0.headers.connection).to.equal("close");
    chai.expect(response0.body).to.equal("foo");
  });

  it("ongoing requests should receive {connection: close} header", async function () {
    this.slow(300);
    httpServer = await createHttpServer((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      setTimeout(() => {
        outgoingMessage.end("foo");
      }, 100);
    });

    const terminator = new HttpTerminator(httpServer.server);
    const httpAgent = new Agent({ keepAlive: true, maxSockets: 1, keepAliveMsecs: 10000 });
    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 1, keepAliveMsecs: 10000 });

    const request = got(httpServer.url, {
      agent: { http: httpAgent, https: httpsAgent },
      https: { rejectUnauthorized: false },
    });

    await delay(50);

    void terminator.terminate(150);

    const response = await request;

    chai.expect(response.headers.connection).to.equal("close");
    chai.expect(response.body).to.equal("foo");
  });

  // eslint-disable-next-line @stylistic/js/max-len
  it("ongoing requests should receive connection close header and new requests should reusing existing sockets", async function () {
    this.slow(600);

    const stub = sinon.stub();

    stub.onCall(0).callsFake((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      outgoingMessage.write("foo");
      setTimeout(() => {
        outgoingMessage.end("bar");
      }, 50);
    });

    stub.onCall(1).callsFake((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      setTimeout(() => {
        outgoingMessage.end("baz");
      }, 50);
    });

    httpServer = await createHttpServer(stub);

    const terminator = new HttpTerminator(httpServer.server);
    const httpAgent = new Agent({ keepAlive: true, maxSockets: 1 });
    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 1 });

    const request0 = got(httpServer.url, {
      agent: { http: httpAgent, https: httpsAgent },
      https: { rejectUnauthorized: false },
    });
    await delay(50);

    void terminator.terminate(150);

    const request1 = got(httpServer.url, {
      agent: { http: httpAgent, https: httpsAgent },
      https: { rejectUnauthorized: false },
    });

    await delay(50);

    chai.expect(stub.callCount).to.equal(2);

    const response0 = await request0;
    chai.expect(response0.headers.connection).to.equal("keep-alive");
    chai.expect(response0.body).to.equal("foobar");

    const response1 = await request1;
    chai.expect(response1.headers.connection).to.equal("close");
    chai.expect(response1.body).to.equal("baz");
  });

  it("should not send connection close header when server is not terminating", async function () {
    this.slow(400);

    httpServer = await createHttpServer((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      setTimeout(() => {
        outgoingMessage.end("foo");
      }, 50);
    });

    const terminator = new HttpTerminator(httpServer.server);
    const httpAgent = new Agent({ keepAlive: true, maxSockets: 1 });
    const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 1 });

    const response = await got(httpServer.url, {
      agent: { http: httpAgent, https: httpsAgent },
      https: { rejectUnauthorized: false },
    });

    chai.expect(response.headers.connection).to.equal("keep-alive");
    await terminator.terminate(0);
  });

  it("should clear the internal socket collections", async function () {
    this.slow(500);

    httpServer = await createHttpServer((_: IncomingMessage, outgoingMessage: OutgoingMessage) => {
      outgoingMessage.end("foo");
    });

    const terminator = new HttpTerminator(httpServer.server);

    const req = got(httpServer.url, { https: { rejectUnauthorized: false } });
    req.cancel();
    await delay(50);

    chai.expect(terminator["sockets"].size).to.equal(0);
    chai.expect(terminator["secureSockets"].size).to.equal(0);

    await terminator.terminate(150);
  });
};
