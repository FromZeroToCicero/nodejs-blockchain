const sha256 = require("sha256");

const Blockchain = require("../blockchain");
const utils = require("../utils");

let bitcoinBlockchain;
const nodeAddress = utils.generateUuid();

describe("Bitcoin Blockchain", () => {
  beforeEach(() => {
    bitcoinBlockchain = new Blockchain(nodeAddress);
  });

  describe("bitcoinBlockchain constructor", () => {
    it("should add the genesisBlock to this.chain", () => {
      expect(bitcoinBlockchain.chain.length).toBe(1);
    });

    it("should have index = 1 the genesis block", () => {
      expect(bitcoinBlockchain.chain[0].index).toBe(1);
    });

    it("should have timestamp property the genesis block", () => {
      expect(bitcoinBlockchain.chain[0]).toHaveProperty("timestamp");
    });

    it("should have no transactions the genesis block", () => {
      expect(bitcoinBlockchain.chain[0].transactions).toEqual([]);
    });

    it("should have nonce = 0 the genesis block", () => {
      expect(bitcoinBlockchain.chain[0].nonce).toBe(0);
    });

    it("should have hash = '0' the genesis block", () => {
      expect(bitcoinBlockchain.chain[0].hash).toBe("0");
    });

    it("should have previousBlockHash = '0' the genesis block", () => {
      expect(bitcoinBlockchain.chain[0].previousBlockHash).toBe("0");
    });

    it("should initialise this.pendingTransactions as an empty array", () => {
      expect(bitcoinBlockchain.pendingTransactions).toEqual([]);
    });

    it("should initialise this.currentNodeUrl", () => {
      expect(bitcoinBlockchain.currentNodeUrl).toBe("");
    });

    it("should initialise this.currentNodeAddress with the received nodeAddress", () => {
      expect(bitcoinBlockchain.currentNodeAddress).toBe(nodeAddress);
    });

    it("should initialise this.networkNodes as an empty array", () => {
      expect(bitcoinBlockchain.networkNodes).toEqual([]);
    });
  });

  describe("createNewBlock", () => {
    it("should return a new block with index = 2", () => {
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock.index).toBe(2);
    });

    it("should return a new block with timestamp = Date.now()", () => {
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock).toHaveProperty("timestamp");
    });

    it("should return a new block with the existing pending transactions", () => {
      const pendingTransactions = [{ transactionId: "5jas" }];
      bitcoinBlockchain.pendingTransactions = pendingTransactions;
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock.transactions).toEqual(pendingTransactions);
    });

    it("should return a new block with the given nonce", () => {
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock.nonce).toBe(10);
    });

    it("should return a new block with the given hash", () => {
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock.hash).toBe("3ftc");
    });

    it("should return a new block with the given previousBlockHash", () => {
      const newBlock = bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(newBlock.previousBlockHash).toBe("2afb");
    });

    it("should clear the pending transactions after a new block is created", () => {
      const pendingTransactions = [{ transactionId: "5jas" }];
      bitcoinBlockchain.pendingTransactions = pendingTransactions;
      bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(bitcoinBlockchain.pendingTransactions).toEqual([]);
    });

    it("should increment the number of blocks stored in the chain", () => {
      const pendingTransactions = [{ transactionId: "5jas" }];
      bitcoinBlockchain.pendingTransactions = pendingTransactions;
      bitcoinBlockchain.createNewBlock(10, "2afb", "3ftc");
      expect(bitcoinBlockchain.chain.length).toBe(2);
    });
  });

  describe("getLastBlock", () => {
    it("should return the last block of the blockchain - genesis block", () => {
      const lastBlock = bitcoinBlockchain.getLastBlock();
      expect(lastBlock.hash).toBe("0");
    });
  });

  describe("addTransactionToPendingTransactions", () => {
    it("should add new transaction to the list of pending transactions", () => {
      const newTransaction = { transactionId: "23jd" };
      bitcoinBlockchain.addTransactionToPendingTransactions(newTransaction);
      expect(bitcoinBlockchain.pendingTransactions.length).toBe(1);
    });

    it("should return the index of the block that would contain the new transaction", () => {
      const newTransaction = { transactionId: "23jd" };
      const blockIndex =
        bitcoinBlockchain.addTransactionToPendingTransactions(newTransaction);
      expect(blockIndex).toBe(1);
    });

    it("should call getLastBlock", () => {
      const getLastBlockSpy = jest.spyOn(bitcoinBlockchain, "getLastBlock");
      const newTransaction = { transactionId: "23jd" };
      bitcoinBlockchain.addTransactionToPendingTransactions(newTransaction);
      expect(getLastBlockSpy).toHaveBeenCalled();
    });
  });

  describe("createNewTransaction", () => {
    it("should create a transaction having a transactionId", () => {
      const transaction = bitcoinBlockchain.createNewTransaction("A", "B", 10);
      expect(transaction).toHaveProperty("transactionId");
    });

    it("should create a transaction having the given sender", () => {
      const transaction = bitcoinBlockchain.createNewTransaction("A", "B", 10);
      expect(transaction.sender).toBe("A");
    });

    it("should create a transaction having the given recipient", () => {
      const transaction = bitcoinBlockchain.createNewTransaction("A", "B", 10);
      expect(transaction.recipient).toBe("B");
    });
  });

  describe("hashBlock", () => {
    it("should generate the hash for the given inputs", () => {
      const previousBlockHash = "6jfu";
      const blockData = { index: 1, transactions: [{ transactionId: "3man" }] };
      const nonce = 1620;
      const dataAsString =
        previousBlockHash + nonce.toString() + JSON.stringify(blockData);
      const expectedHash = sha256(dataAsString);
      const obtainedHash = bitcoinBlockchain.hashBlock(
        previousBlockHash,
        blockData,
        nonce
      );
      expect(obtainedHash).toBe(expectedHash);
    });
  });

  describe("proofOfWork", () => {
    it("should generate the correct nonce for the given inputs", () => {
      const previousBlockHash = "6jfu";
      const blockData = { index: 1, transactions: [{ transactionId: "3man" }] };
      const expectedNonce = 15741;
      const obtainedNonce = bitcoinBlockchain.proofOfWork(
        previousBlockHash,
        blockData
      );
      expect(obtainedNonce).toBe(expectedNonce);
    });

    it("should call this.hashBlock method 15742 times", () => {
      const previousBlockHash = "6jfu";
      const blockData = { index: 1, transactions: [{ transactionId: "3man" }] };
      const hashBlockSpy = jest.spyOn(bitcoinBlockchain, "hashBlock");
      bitcoinBlockchain.proofOfWork(previousBlockHash, blockData);
      expect(hashBlockSpy).toHaveBeenCalledTimes(15742);
    });
  });

  describe("isChainValid", () => {
    it("should call hashBlock when verifying the blockchain validity", () => {
      const hashBlockSpy = jest.spyOn(bitcoinBlockchain, "hashBlock");
      const lastBlock = bitcoinBlockchain.getLastBlock();
      const previousBlockHash = lastBlock["hash"];
      const currentBlockData = {
        transactions: bitcoinBlockchain.pendingTransactions,
        index: lastBlock["index"] + 1,
      };
      const nonce = bitcoinBlockchain.proofOfWork(
        previousBlockHash,
        currentBlockData
      );
      const blockHash = bitcoinBlockchain.hashBlock(
        previousBlockHash,
        currentBlockData,
        nonce
      );

      bitcoinBlockchain.createNewBlock(nonce, previousBlockHash, blockHash);

      bitcoinBlockchain.isChainValid(bitcoinBlockchain.chain);
      expect(hashBlockSpy).toHaveBeenCalled();
    });

    it("should return true if the blockchain has valid blocks", () => {
      const lastBlock = bitcoinBlockchain.getLastBlock();
      const previousBlockHash = lastBlock["hash"];
      const currentBlockData = {
        transactions: bitcoinBlockchain.pendingTransactions,
        index: lastBlock["index"] + 1,
      };
      const nonce = bitcoinBlockchain.proofOfWork(
        previousBlockHash,
        currentBlockData
      );
      const blockHash = bitcoinBlockchain.hashBlock(
        previousBlockHash,
        currentBlockData,
        nonce
      );

      bitcoinBlockchain.createNewBlock(nonce, previousBlockHash, blockHash);

      const blockchainValidity = bitcoinBlockchain.isChainValid(
        bitcoinBlockchain.chain
      );
      expect(blockchainValidity).toBe(true);
    });

    it("should return true if the blockchain has a valid genesis block", () => {
      const blockchainValidity = bitcoinBlockchain.isChainValid(
        bitcoinBlockchain.chain
      );
      expect(blockchainValidity).toBe(true);
    });

    it("should return false if the blockchain has one or more invalid blocks", () => {
      bitcoinBlockchain.createNewBlock(100, "0", "aaa");
      bitcoinBlockchain.createNewBlock(150, "aac", "bbb");
      bitcoinBlockchain.createNewBlock(200, "bbb", "ccc");
      const blockchainValidity = bitcoinBlockchain.isChainValid(
        bitcoinBlockchain.chain
      );
      expect(blockchainValidity).toBe(false);
    });

    it("should return false if the blockchain has an invalid genesis block", () => {
      bitcoinBlockchain.chain[0].nonce = 150;
      const blockchainValidity = bitcoinBlockchain.isChainValid(
        bitcoinBlockchain.chain
      );
      expect(blockchainValidity).toBe(false);
    });
  });

  describe("getBlock", () => {
    it("should retrive correct block based on a given blockHash", () => {
      const expectedBlock = bitcoinBlockchain.chain[0];
      const obtainedBlock = bitcoinBlockchain.getBlock("0");
      expect(obtainedBlock).toEqual(expectedBlock);
    });
  });

  describe("getTransaction", () => {
    it("should retrive correct transaction based on a given transactionId", () => {
      const transactions = [{ transactionId: "3" }, { transactionId: "4" }];
      bitcoinBlockchain.addTransactionToPendingTransactions(transactions[0]);
      bitcoinBlockchain.addTransactionToPendingTransactions(transactions[1]);
      bitcoinBlockchain.createNewBlock(100, "0", "1ab");
      const result = bitcoinBlockchain.getTransaction("3");
      expect(result.retrievedTransaction).toEqual(transactions[0]);
    });

    it("should retrive correct block that contains the transaction with the given transactionId", () => {
      const transactions = [{ transactionId: "3" }, { transactionId: "4" }];
      bitcoinBlockchain.addTransactionToPendingTransactions(transactions[0]);
      bitcoinBlockchain.addTransactionToPendingTransactions(transactions[1]);
      const newBlock = bitcoinBlockchain.createNewBlock(100, "0", "1ab");
      const result = bitcoinBlockchain.getTransaction("3");
      expect(result.retrievedBlock).toEqual(newBlock);
    });
  });
});
