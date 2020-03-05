import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { createHttpServer } from "./helpers/createHttpServer";
import { createTests } from "./helpers/createTests";
import { createHttpsServer } from "./helpers/createHttpsServer";

describe("HttpTerminator", function() {
  before(function() {
    chai.should();
    chai.use(chaiAsPromised);
  });

  describe("http", function() {
    // eslint-disable-next-line mocha/no-setup-in-describe
    createTests(createHttpServer);
  });

  describe("https", function() {
    // eslint-disable-next-line mocha/no-setup-in-describe
    createTests(createHttpsServer);
  });
});
