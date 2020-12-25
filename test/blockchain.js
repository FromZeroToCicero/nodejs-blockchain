const chai = require("chai");
const spies = require("chai-spies");
const uuid = require("uuid/v1");
const sha256 = require("sha256");

const Blockchain = require("../dev/blockchain");

const nodeAddress = uuid().split("-").join("");

chai.use(spies);
chai.should();
const expect = chai.expect;

let bitcoin;

describe("Bitcoin Blockchain", () => {
  beforeEach(() => {
    bitcoin = new Blockchain(nodeAddress);
  });

  describe("Blockchain constructor", () => {
    it("it should call constructor function", () => {
      bitcoin.should.be.a("object");
      bitcoin.should.have.property("chain");
      bitcoin.chain.length.should.be.eql(1);
      bitcoin.chain[0].should.have.property("index").eql(1);
      bitcoin.chain[0].should.have.property("timestamp");
      bitcoin.chain[0].should.have.property("transactions").eql([]);
      bitcoin.chain[0].should.have.property("nonce").eql(100);
      bitcoin.chain[0].should.have.property("hash").eql("0");
      bitcoin.chain[0].should.have.property("previousBlockHash").eql("0");
      bitcoin.should.have.property("pendingTransactions").eql([]);
      bitcoin.should.have.property("currentNodeUrl");
      bitcoin.should.have.property("currentNodeAddress").eql(nodeAddress);
      bitcoin.should.have.property("networkNodes").eql([]);
    });
  });

  describe("createNewBlock", () => {
    it("it should create a new block", () => {
      bitcoin.pendingTransactions = [{ id: 1 }, { id: 2 }];
      const res = bitcoin.createNewBlock(100, "aaa", "bbb");
      res.should.be.a("object");
      res.should.have.property("index").eql(2);
      res.should.have.property("timestamp");
      res.should.have.property("transactions").eql([{ id: 1 }, { id: 2 }]);
      res.should.have.property("nonce").eql(100);
      res.should.have.property("hash").eql("bbb");
      res.should.have.property("previousBlockHash").eql("aaa");
      bitcoin.pendingTransactions.should.be.eql([]);
      bitcoin.chain.length.should.be.eql(2);
    });
  });

  describe("getLastBlock", () => {
    it("it should return the last block from the chain", () => {
      const res = bitcoin.getLastBlock();
      res.should.have.property("index").eql(1);
      res.should.have.property("timestamp");
      res.should.have.property("transactions").eql([]);
      res.should.have.property("nonce");
      res.should.have.property("hash");
      res.should.have.property("previousBlockHash");
    });
  });

  describe("createNewTransaction", () => {
    it("it should create a new transaction with the provided data", () => {
      const res = bitcoin.createNewTransaction(100, "aaa", "bbb");
      res.should.have.property("transactionId");
      res.should.have.property("amount").eql(100);
      res.should.have.property("sender").eql("aaa");
      res.should.have.property("recipient").eql("bbb");
    });
  });

  describe("addTransactionToPendingTransactions", () => {
    it("it should add the newly created transaction in the pending transactions list", () => {
      const transaction1 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      const transaction2 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      const res1 = bitcoin.addTransactionToPendingTransactions(transaction1);
      bitcoin.pendingTransactions.length.should.be.eql(1);
      const res2 = bitcoin.addTransactionToPendingTransactions(transaction2);
      bitcoin.pendingTransactions.length.should.be.eql(2);
      res1.should.be.eql(2);
      res2.should.be.eql(2);
    });
  });

  describe("hashBlock", () => {
    it("it should hash the data inside a block", () => {
      const dataAsString = `aaa150{"transactions":[{"id":1}],"index":2}`;
      const hashedValue = sha256(dataAsString);
      const res = bitcoin.hashBlock("aaa", { transactions: [{ id: 1 }], index: 2 }, 150);
      res.should.be.eql(hashedValue);
    });
  });

  describe("proofOfWork", () => {
    it("it should execute a proof of work method to obtain the nonce value", () => {
      const hashBlockSpy = chai.spy.on(bitcoin, "hashBlock");
      const res = bitcoin.proofOfWork("aaa", { transactions: [{ id: 1 }], index: 2 });
      res.should.be.a("number");
      expect(hashBlockSpy).to.have.been.called();
    });
  });

  describe("isChainValid", () => {
    it("it should return true if blockchain has valid blocks", () => {
      const hashBlockSpy = chai.spy.on(bitcoin, "hashBlock");

      const lastBlock = bitcoin.getLastBlock();
      const previousBlockHash = lastBlock["hash"];
      const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock["index"] + 1,
      };
      const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
      const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

      bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

      const res = bitcoin.isChainValid(bitcoin.chain);
      res.should.be.a("boolean");
      res.should.be.eql(true);
      expect(hashBlockSpy).to.have.been.called();
    });

    it("it should return true if blockchain has valid genesis block", () => {
      const res = bitcoin.isChainValid(bitcoin.chain);
      res.should.be.a("boolean");
      res.should.be.eql(true);
    });

    it("it should return false if blockchain has one or more invalid blocks", () => {
      const hashBlockSpy = chai.spy.on(bitcoin, "hashBlock");
      bitcoin.createNewBlock(100, "0", "aaa");
      bitcoin.createNewBlock(150, "aac", "bbb");
      bitcoin.createNewBlock(200, "bbb", "ccc");
      const res = bitcoin.isChainValid(bitcoin.chain);
      res.should.be.a("boolean");
      res.should.be.eql(false);
      expect(hashBlockSpy).to.have.been.called();
    });

    it("it should return false if blockchain has invalid genesis block", () => {
      const hashBlockSpy = chai.spy.on(bitcoin, "hashBlock");
      bitcoin.createNewBlock(100, "0", "aaa");
      bitcoin.chain[0].nonce = 150;
      const res = bitcoin.isChainValid(bitcoin.chain);
      res.should.be.a("boolean");
      res.should.be.eql(false);
      expect(hashBlockSpy).to.have.been.called();
    });
  });

  describe("getBlock", () => {
    it("it should get the correct block based on a blockHash", () => {
      const res = bitcoin.getBlock("0");
      res.should.have.property("index").eql(1);
      res.should.have.property("timestamp");
      res.should.have.property("transactions").eql([]);
      res.should.have.property("nonce").eql(100);
      res.should.have.property("hash").eql("0");
      res.should.have.property("previousBlockHash").eql("0");
    });
  });

  describe("getTransaction", () => {
    it("it should get the correct transaction based on a transactionId", () => {
      const transaction1 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      const transaction2 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      bitcoin.addTransactionToPendingTransactions(transaction1);
      bitcoin.addTransactionToPendingTransactions(transaction2);

      const lastBlock = bitcoin.getLastBlock();
      const previousBlockHash = lastBlock["hash"];
      const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock["index"] + 1,
      };
      const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
      const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

      bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

      const res = bitcoin.getTransaction(transaction1.transactionId);
      res.retrievedTransaction.should.have.property("transactionId");
      res.retrievedTransaction.should.have.property("amount").eql(100);
      res.retrievedTransaction.should.have.property("sender").eql("aaa");
      res.retrievedTransaction.should.have.property("recipient").eql("bbb");
      res.retrievedBlock.should.have.property("index").eql(2);
      res.retrievedBlock.should.have.property("timestamp");
      res.retrievedBlock.should.have.property("transactions");
      res.retrievedBlock.transactions.length.should.be.eql(2);
      res.retrievedBlock.should.have.property("nonce");
      res.retrievedBlock.should.have.property("hash");
      res.retrievedBlock.should.have.property("previousBlockHash");
    });
  });

  describe("getAddressData", () => {
    it("it should get the correct transactions based on an address", () => {
      const transaction1 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      const transaction2 = bitcoin.createNewTransaction(100, "aaa", "bbb");
      bitcoin.addTransactionToPendingTransactions(transaction1);
      bitcoin.addTransactionToPendingTransactions(transaction2);

      const lastBlock = bitcoin.getLastBlock();
      const previousBlockHash = lastBlock["hash"];
      const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock["index"] + 1,
      };
      const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
      const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

      bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

      const res = bitcoin.getAddressData("bbb");
      res.addressTransactions.length.should.be.eql(2);
      res.balance.should.be.eql(200);
    });
  });
});
