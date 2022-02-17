const express = require("express");
const axios = require("axios");

const Blockchain = require("../blockchain");
const utils = require("../utils");
const { logger } = require("../services");

const router = express.Router();
const nodeAddress = utils.generateUuid();
const rewardAddress = utils.generateUuid();
const bitcoinBlockchain = new Blockchain(nodeAddress);

// Get blockchain
router.get("/", async (req, res) => {
  try {
    logger.info("GET /blockchain - sending back the blockchain");
    return utils.buildResponse(res, 200, bitcoinBlockchain);
  } catch (err) {
    logger.error(
      `GET /blockchain - Unexpected error when getting the blockchain: ${err.message}`
    );
    const payload = { message: "Could not retrieve blockchain data" };
    return utils.buildResponse(res, 500, payload);
  }
});

// Create a new block with all pending transactions and add it into the blockchain
router.get("/block/mine", (req, res) => {
  try {
    logger.info(`GET /blockchain/block/mine`);
    const lastBlock = bitcoinBlockchain.getLastBlock();
    const previousBlockHash = lastBlock["hash"];
    logger.debug(`Retrieved previousBlockHash = ${previousBlockHash}.`);

    const currentBlockData = {
      transactions: bitcoinBlockchain.pendingTransactions,
      index: lastBlock["index"] + 1,
    };

    const nonce = bitcoinBlockchain.proofOfWork(
      previousBlockHash,
      currentBlockData
    );
    logger.debug(`Obtained nonce via proof-of-work: ${nonce}`);

    const blockHash = bitcoinBlockchain.hashBlock(
      previousBlockHash,
      currentBlockData,
      nonce
    );
    logger.debug(`Obtained block hash: ${blockHash}`);

    const newBlock = bitcoinBlockchain.createNewBlock(
      nonce,
      previousBlockHash,
      blockHash
    );
    logger.debug(`Created new block: ${JSON.stringify(newBlock)}`);

    const requestsArray = [];
    bitcoinBlockchain.networkNodes.forEach((networkNodeUrl) => {
      const request = axios.post(
        networkNodeUrl + "/blockchain/receive-new-block",
        { newBlock }
      );
      requestsArray.push(request);
    });

    logger.debug(
      `Broadcasting the new mined block to all network nodes to update their copy of the blockchain.`
    );
    Promise.all(requestsArray)
      .then(() => {
        const payload = { ...newBlock };
        return utils.buildResponse(res, 201, payload);
      })
      .catch((err) => {
        logger.error(
          `GET /blockchain/block/mine - Failed to broadcast new block to all nodes - ${err.message}.`
        );
        const payload = {
          message: "Failed to broadcast new block to all nodes.",
        };
        return utils.buildResponse(res, 500, payload);
      });
  } catch (err) {
    logger.error(
      `GET /blockchain/block/mine - Failed to mine new block - ${err.message}.`
    );
    const payload = { message: "Failed to mine new block." };
    return utils.buildResponse(res, 500, payload);
  }
});

// Get block from blockchain based on its hash
router.get("/block/:blockHash", (req, res) => {
  logger.info(`GET /blockchain/block/:blockHash`);
  const blockHash = req.params.blockHash;

  if (!blockHash) {
    logger.error(`Did not receive blockHash string.`);
    return utils.buildResponse(res, 500, "Did not receive blockHash string.");
  }

  logger.debug(`Received blockhash ${blockHash}`);
  const retrievedBlock = bitcoinBlockchain.getBlock(blockHash);
  const payload = { ...retrievedBlock };
  return utils.buildResponse(res, 200, payload);
});

// Add received new block into the blockchain
router.post("/receive-new-block", (req, res) => {
  try {
    logger.info(`POST /blockchain/receive-new-block`);
    const newBlock = req.body.newBlock;

    if (!newBlock) {
      logger.error(`Did not receive newBlock object.`);
      const payload = { message: "Did not receive newBlock object." };
      return utils.buildResponse(res, 500, payload);
    }

    logger.debug(`Received new block: ${JSON.stringify(newBlock)}`);
    const lastBlock = bitcoinBlockchain.getLastBlock();

    logger.debug(
      `Checking the previousHash and index of the newly created block.`
    );
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock.index + 1 === newBlock.index;
    logger.debug(
      `Blocks has same previous hash? ${correctHash}; New block has correct index? ${correctIndex}`
    );

    if (correctHash && correctIndex) {
      logger.debug(
        `Adding new block into the blockchain and clearing out the pending transactions list.`
      );
      bitcoinBlockchain.chain.push(newBlock);
      bitcoinBlockchain.pendingTransactions = [];

      const payload = { ...newBlock };
      return utils.buildResponse(res, 200, payload);
    } else {
      logger.error(
        `The new block was altered or incorrectly created, rejecting it from the blockchain.`
      );
      const payload = {
        message: "This block has been altered or incorrectly created.",
        newBlock,
      };
      return utils.buildResponse(res, 400, payload);
    }
  } catch (err) {
    logger.error(
      `POST /receive-new-block - Failed to add new block to blockchain - ${err.message}.`
    );
    const payload = { message: "Failed to add new block to blockchain" };
    return utils.buildResponse(res, 500, payload);
  }
});

// Get a copy of the longest blockchain
router.get("/consensus", (req, res) => {
  logger.info(`GET /blockchain/consensus`);
  logger.debug(`Getting all blockchain copies from all nodes in the network.`);
  const requestArray = [];
  bitcoinBlockchain.networkNodes.forEach((networkNodeUrl) => {
    const request = axios.get(networkNodeUrl + "/blockchain");
    requestArray.push(request);
  });

  Promise.all(requestArray)
    .then((blockchains) => {
      const currentChainLength = bitcoinBlockchain.chain.length;
      let maxChainLength = currentChainLength;
      let newLongestChain = null;
      let newPendingTransactions = null;

      logger.debug(
        `Checking if any node has a longer blockchain than the others.`
      );
      blockchains.forEach((blockchainReq) => {
        const blockchain = blockchainReq.data;
        if (blockchain.chain.length > maxChainLength) {
          logger.debug(`Found a longer blockchain than the current one.`);
          maxChainLength = blockchain.chain.length;
          newLongestChain = blockchain.chain;
          newPendingTransactions = blockchain.pendingTransactions;
        }
      });

      if (
        !newLongestChain ||
        (newLongestChain && !bitcoinBlockchain.isChainValid(newLongestChain))
      ) {
        logger.debug(
          `There is no other longer chain or there is one, but it's invalid.`
        );
        const payload = {
          message: "Current chain has not been replaced",
          chain: bitcoinBlockchain.chain,
        };
        return utils.buildResponse(res, 200, payload);
      } else {
        logger.debug(
          `There is a longer valid chain. Overwriting the current chain with the longer one.`
        );
        bitcoinBlockchain.chain = newLongestChain;
        bitcoinBlockchain.pendingTransactions = newPendingTransactions;
        const payload = {
          message:
            "The chain has been updated with the longest valid blockchain from the network",
          chain: bitcoinBlockchain.chain,
        };
        return utils.buildResponse(res, 200, payload);
      }
    })
    .catch((err) => {
      logger.error(
        `GET /blockchain/consensus - Failed to get the list of blockchains - ${err.message}`
      );
      const payload = { message: "Failed to get the list of blockchains" };
      return utils.buildResponse(res, 500, payload);
    });
});

// Create a new transaction that will be added in the next block
router.post("/transaction", (req, res) => {
  try {
    logger.info(`POST /blockchain/transaction`);
    const newTransaction = req.body;

    if (!newTransaction.transactionId) {
      logger.error(`Did not receive newTransaction object.`);
      const payload = { message: "Did not receive newTransaction object" };
      return utils.buildResponse(res, 500, payload);
    }

    logger.debug(`Received transaction: ${JSON.stringify(newTransaction)}`);
    const nextBlockIndex =
      bitcoinBlockchain.addTransactionToPendingTransactions(newTransaction);
    logger.debug(
      `Transaction will be added in the block with index ${nextBlockIndex}`
    );

    const payload = { ...newTransaction, nextBlockIndex };
    return utils.buildResponse(res, 201, payload);
  } catch (err) {
    logger.error(
      `POST /blockchain/transaction - Failed to create new transaction - ${err.message}.`
    );
    const payload = { message: "Failed to create new transaction." };
    return utils.buildResponse(res, 500, payload);
  }
});

// Create a transaction and broadcast it to the other nodes
router.post("/transaction/broadcast", (req, res) => {
  try {
    logger.info(`POST /blockchain/transaction/broadcast`);
    let newTransaction;

    if (req.body.isRewardTransaction) {
      logger.debug(
        `Creating new transaction using sender: ${rewardAddress}, recipient: ${nodeAddress}, body: 12.5 BTC`
      );

      newTransaction = bitcoinBlockchain.createNewTransaction(
        rewardAddress,
        nodeAddress,
        12.5
      );
    } else {
      logger.debug(
        `Creating new transaction using sender: ${req.body.sender}, recipient: ${req.body.recipient}, body: ${req.body.amount} BTC`
      );

      newTransaction = bitcoinBlockchain.createNewTransaction(
        req.body.sender,
        req.body.recipient,
        req.body.amount
      );
    }

    logger.debug(
      `Adding new transaction ${JSON.stringify(
        newTransaction
      )} to the pending transactions list.`
    );
    bitcoinBlockchain.addTransactionToPendingTransactions(newTransaction);

    logger.debug(
      `Broadcasting transaction to all other nodes inside the network.`
    );
    const requestsArray = [];
    bitcoinBlockchain.networkNodes.forEach((networkNodeUrl) => {
      const request = axios.post(
        networkNodeUrl + "/blockchain/transaction",
        newTransaction
      );
      requestsArray.push(request);
    });
    Promise.all(requestsArray)
      .then(() => {
        logger.debug(
          `Transaction was successfully created and broadcasted to entire network.`
        );
        const payload = {
          message:
            "Transaction was successfully created and broadcasted to entire network.",
          newTransaction,
        };
        return utils.buildResponse(res, 201, payload);
      })
      .catch((err) => {
        logger.error(
          `POST /blockchain/transaction/broadcast - Failed to broadcast new transaction to all nodes - ${err.message}.`
        );
        const payload = {
          message: "Failed to broadcast new transaction to all nodes",
        };
        return utils.buildResponse(res, 500, payload);
      });
  } catch (err) {
    logger.error(
      `POST /blockchain/transaction/broadcast - Failed to create new transaction - ${err.message}.`
    );
    const payload = { message: "Failed to create new transaction." };
    return utils.buildResponse(res, 500, payload);
  }
});

// Get transaction from blockchain based on its id
router.get("/transaction/:transactionId", (req, res) => {
  logger.info(`GET /blockchain/transaction/:transactionId`);
  const transactionId = req.params.transactionId;

  if (!transactionId) {
    logger.error(`Did not receive transactionId string.`);
    return utils.buildResponse(
      res,
      500,
      "Did not receive transactionId string."
    );
  }

  logger.debug(`Received transactionId ${transactionId}`);
  const { retrievedTransaction, retrievedBlock } =
    bitcoinBlockchain.getTransaction(transactionId);
  const payload = { ...retrievedTransaction, ...retrievedBlock };
  return utils.buildResponse(res, 200, payload);
});

// Register a new node into the network
router.post("/register-and-broadcast-node", (req, res) => {
  try {
    logger.info(`POST /blockchain/register-and-broadcast-node`);
    const newNodeUrl = req.body.newNodeUrl;

    if (!newNodeUrl) {
      logger.error(`Did not receive newNodeUrl string.`);
      const payload = { message: "Did not receive newNodeUrl string." };
      return utils.buildResponse(res, 500, payload);
    }

    if (bitcoinBlockchain.networkNodes.indexOf(newNodeUrl) === -1) {
      logger.debug(`Adding new node ${newNodeUrl} to the network`);
      bitcoinBlockchain.networkNodes.push(newNodeUrl);
    }

    logger.debug(
      `Registering all existing nodes from the network with the new node`
    );
    const registerNodesRequests = [];
    bitcoinBlockchain.networkNodes.forEach((networkNodeUrl) => {
      const request = axios.post(networkNodeUrl + "/blockchain/register-node", {
        newNodeUrl,
      });
      registerNodesRequests.push(request);
    });

    Promise.all(registerNodesRequests)
      .then(() => {
        logger.debug(
          `Registering the new node with all other nodes in the network.`
        );
        const request = axios.post(
          newNodeUrl + "/blockchain/register-bulk-nodes",
          {
            nodeUrls: [
              ...bitcoinBlockchain.networkNodes,
              bitcoinBlockchain.currentNodeUrl,
            ],
          }
        );
        return request;
      })
      .then(() => {
        logger.debug(
          `Sending the longest valid blockchain copy to the new node via the /consensus endpoint`
        );
        return axios.get(newNodeUrl + "/blockchain/consensus");
      })
      .then(() => {
        logger.debug(
          `Successfully registered node ${newNodeUrl} into the network.`
        );
        const payload = {
          message: "New node added into the network",
          newNodeUrl,
        };
        return utils.buildResponse(res, 200, payload);
      })
      .catch((err) => {
        console.log(err);
        logger.error(
          `POST /blockchain/register-and-broadcast-node - Failed to register new node to network - ${err.message}.`
        );
        const payload = { message: "Failed to register new node to network." };
        return utils.buildResponse(res, 500, payload);
      });
  } catch (err) {
    logger.error(
      `POST /blockchain/register-and-broadcast-node - Failed to register new node to network - ${err.message}.`
    );
    const payload = { message: "Failed to register new node to network." };
    return utils.buildResponse(res, 500, payload);
  }
});

// Register a node to the network
router.post("/register-node", (req, res) => {
  try {
    logger.info(`POST /blockchain/register-node`);
    const newNodeUrl = req.body.newNodeUrl;

    if (!newNodeUrl) {
      logger.error(`Did not receive newNodeUrl string.`);
      const payload = { message: "Did not receive newNodeUrl string." };
      return utils.buildResponse(res, 500, payload);
    }

    logger.debug(
      `Checking if new node is not the current one and is not already registered in the network.`
    );
    const nodeNotAlreadyRegistered =
      bitcoinBlockchain.networkNodes.indexOf(newNodeUrl) === -1;
    const notCurrentNode = bitcoinBlockchain.currentNodeUrl !== newNodeUrl;

    if (nodeNotAlreadyRegistered && notCurrentNode) {
      logger.debug(`Registering new node ${newNodeUrl} into the network.`);
      bitcoinBlockchain.networkNodes.push(newNodeUrl);
      const payload = {
        message: "New node successfully registered into the network",
        newNodeUrl,
      };
      return utils.buildResponse(res, 200, payload);
    } else {
      logger.debug(`Node ${newNodeUrl} already registered in the network.`);
      const payload = {
        message: "Node already registered in the network.",
        newNodeUrl,
      };
      return utils.buildResponse(res, 200, payload);
    }
  } catch (err) {
    logger.error(
      `POST /blockchain/register-node - Failed to register new node to blockchain network - ${err.message}.`
    );
    const payload = {
      message: "Failed to register new node to blockchain network.",
    };
    return utils.buildResponse(res, 500, payload);
  }
});

// Register multiple nodes to the network
router.post("/register-bulk-nodes", (req, res) => {
  try {
    logger.info(`POST /blockchain/register-bulk-nodes`);
    const nodeUrls = req.body.nodeUrls;

    if (nodeUrls.length === 0) {
      logger.error(`Did not receive nodeUrls array of strings.`);
      const payload = { message: "Did not receive nodeUrls array of strings." };
      return utils.buildResponse(res, 500, payload);
    }

    logger.debug(`Received multiple nodes: ${JSON.stringify(nodeUrls)}`);
    const nodesToBeRegistered = [];
    const rejectedNodes = [];
    nodeUrls.forEach((networkNodeUrl) => {
      logger.debug(
        `Checking if node ${networkNodeUrl} is not the current one and is not already registered in the network.`
      );
      const nodeNotAlreadyRegistered =
        bitcoinBlockchain.networkNodes.indexOf(networkNodeUrl) === -1;
      const notCurrentNode =
        bitcoinBlockchain.currentNodeUrl !== networkNodeUrl;

      if (nodeNotAlreadyRegistered && notCurrentNode) {
        logger.debug(
          `Registering new node ${networkNodeUrl} into the network.`
        );
        nodesToBeRegistered.push(networkNodeUrl);
      } else {
        logger.debug(
          `Node ${networkNodeUrl} already registered in the network.`
        );
        rejectedNodes.push(networkNodeUrl);
      }
    });

    logger.debug(`Registering nodes ${JSON.stringify(nodesToBeRegistered)}`);
    Array.prototype.push.apply(
      bitcoinBlockchain.networkNodes,
      nodesToBeRegistered
    );
    const payload = {
      message: "Nodes have been successfully registered in the network",
      registeredNodes: nodesToBeRegistered,
      rejectedNodes,
    };
    return utils.buildResponse(res, 200, payload);
  } catch (err) {
    logger.error(
      `POST /blockchain/register-bulk-nodes - Failed to register multiple nodes to blockchain network - ${err.message}.`
    );
    const payload = {
      message: "Failed to register multiple nodes to blockchain network.",
    };
    return utils.buildResponse(res, 500, payload);
  }
});

// Get transactions from blockchain based on given wallet address
router.get("/address/:address", (req, res) => {
  logger.info(`GET /blockchain/address/:address`);
  const address = req.params.address;

  if (!address) {
    logger.error(`Did not receive address string.`);
    return utils.buildResponse(res, 500, "Did not receive address string.");
  }

  logger.debug(`Received address ${address}`);
  const { addressTransactions, balance } =
    bitcoinBlockchain.getAddressData(address);
  const payload = { ...addressTransactions, ...balance };
  return utils.buildResponse(res, 200, payload);
});

module.exports = router;
