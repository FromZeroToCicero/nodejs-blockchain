const request = require("supertest");

const server = require("../server");
const utils = require("../utils");

describe("GET /blockchain", () => {
  it("should call GET /blockchain endpoint and return the blockchain", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .get("/blockchain")
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("chain");
        expect(res.body.chain.length).toBe(1);
        expect(res.body.chain[0].index).toBe(1);
        expect(res.body.chain[0]).toHaveProperty("timestamp");
        expect(res.body.chain[0].transactions).toEqual([]);
        expect(res.body.chain[0].nonce).toBe(0);
        expect(res.body.chain[0].hash).toBe("0");
        expect(res.body.chain[0].previousBlockHash).toBe("0");
        expect(res.body).toHaveProperty("pendingTransactions");
        expect(res.body.pendingTransactions).toEqual([]);
        expect(res.body).toHaveProperty("currentNodeAddress");
        expect(res.body).toHaveProperty("networkNodes");
        expect(res.body.networkNodes).toEqual([]);
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});

describe("GET /blockchain/block/:blockhash", () => {
  it("should call GET /blockchain/block/:blockhash endpoint and return the correct block", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .get(`/blockchain/block/0`)
      .expect(200)
      .then((res) => {
        expect(res.body.index).toBe(1);
        expect(res.body).toHaveProperty("timestamp");
        expect(res.body.transactions).toEqual([]);
        expect(res.body.nonce).toBe(0);
        expect(res.body.hash).toBe("0");
        expect(res.body.previousBlockHash).toBe("0");
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });

  it("should return empty object if block is not found", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .get(`/blockchain/block/test`)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({});
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});

describe("POST /blockchain/transaction", () => {
  it("should call POST /blockchain/transaction and return transaction and next block index", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/transaction")
      .send({ transactionId: "2abf" })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty("transactionId");
        expect(res.body.transactionId).toBe("2abf");
        expect(res.body).toHaveProperty("nextBlockIndex");
        expect(res.body.nextBlockIndex).toBe(1);
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });

  it("should return error message if no newTransaction is passed as req.body", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/transaction")
      .expect(500)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe("Did not receive newTransaction object");
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});

describe("GET /blockchain/transaction/:transactionId", () => {
  it("should call GET /blockchain/transaction/:transactionId endpoint and return the correct transaction and block", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/transaction/broadcast")
      .send({ transactionId: "2abf" })
      .expect(201)
      .then(async () => {
        await request(server)
          .get("/blockchain/block/mine")
          .expect(201)
          .then(async () => {
            await request(server)
              .get(`/blockchain/transaction/2abf`)
              .expect(200)
              .then((res) => {
                expect(res.body.transactionId).toBe("2abf");
                expect(res.body.index).toBe(2);
                expect(res.body).toHaveProperty("timestamp");
                expect(res.body.transactions.length).toBe(2);
                expect(res.body).toHaveProperty("nonce");
                expect(res.body).toHaveProperty("hash");
                expect(res.body.previousBlockHash).toBe("0");
                expect(buildResponseSpy).toHaveBeenCalled();
              });
            done();
          });
      });
  });

  it("should return empty object if transaction and block are not found", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .get(`/blockchain/transaction/test`)
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({});
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});

describe("POST /blockchain/register-node", () => {
  it("should call POST /blockchain/register-node endpoint and return a confirmation message", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/register-node")
      .send({ newNodeUrl: "http://localhost:3002" })
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe(
          "New node successfully registered into the network"
        );
        expect(res.body).toHaveProperty("newNodeUrl");
        expect(res.body.newNodeUrl).toBe("http://localhost:3002");
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });

  it("should call POST /blockchain/register-node endpoint and return a specific message if the node is already registered", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/register-node")
      .send({ newNodeUrl: "http://localhost:3002" })
      .expect(200)
      .then(async () => {
        await request(server)
          .post("/blockchain/register-node")
          .send({ newNodeUrl: "http://localhost:3002" })
          .expect(200)
          .then((res) => {
            expect(res.body).toHaveProperty("message");
            expect(res.body.message).toBe(
              "Node already registered in the network."
            );
            expect(res.body).toHaveProperty("newNodeUrl");
            expect(res.body.newNodeUrl).toBe("http://localhost:3002");
            expect(buildResponseSpy).toHaveBeenCalled();
          });
      });
    done();
  });

  it("should return an error message if no newNodeUrl is passed", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/register-node")
      .expect(500)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe("Did not receive newNodeUrl string.");
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});

describe("POST /blockchain/register-bulk-nodes", () => {
  it("should call POST /blockchain/register-bulk-nodes endpoint and return a confirmation message", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    const registerNodes = ["http://localhost:3003", "http://localhost:3004"];
    await request(server)
      .post("/blockchain/register-bulk-nodes")
      .send({ nodeUrls: registerNodes })
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe(
          "Nodes have been successfully registered in the network"
        );
        expect(res.body).toHaveProperty("registeredNodes");
        expect(res.body.registeredNodes).toEqual(registerNodes);
        expect(res.body).toHaveProperty("rejectedNodes");
        expect(res.body.rejectedNodes).toEqual([]);
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });

  it("should call POST /blockchain/register-bulk-nodes endpoint and return a confirmation message if some of the nodes are already registered", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    const registerNodes = ["http://localhost:3005", "http://localhost:3006"];
    await request(server)
      .post("/blockchain/register-node")
      .send({ newNodeUrl: "http://localhost:3005" })
      .expect(200)
      .then(async () => {
        await request(server)
          .post("/blockchain/register-bulk-nodes")
          .send({ nodeUrls: registerNodes })
          .expect(200)
          .then((res) => {
            expect(res.body).toHaveProperty("message");
            expect(res.body.message).toBe(
              "Nodes have been successfully registered in the network"
            );
            expect(res.body).toHaveProperty("registeredNodes");
            expect(res.body.registeredNodes).toEqual(["http://localhost:3006"]);
            expect(res.body).toHaveProperty("rejectedNodes");
            expect(res.body.rejectedNodes).toEqual(["http://localhost:3005"]);
            expect(buildResponseSpy).toHaveBeenCalled();
          });
      });
    done();
  });

  it("should return an error message if passed nodeUrls array is empty", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/register-bulk-nodes")
      .send({ nodeUrls: [] })
      .expect(500)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe(
          "Did not receive nodeUrls array of strings."
        );
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });

  it("should return an error message if no nodeUrls are passed", async (done) => {
    const buildResponseSpy = jest.spyOn(utils, "buildResponse");
    await request(server)
      .post("/blockchain/register-bulk-nodes")
      .expect(500)
      .then((res) => {
        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toBe(
          "Failed to register multiple nodes to blockchain network."
        );
        expect(buildResponseSpy).toHaveBeenCalled();
      });
    done();
  });
});
