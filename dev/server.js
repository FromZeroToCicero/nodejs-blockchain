const express = require("express");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const cors = require("cors");
const uuid = require("uuid/v1");
const rp = require("request-promise");

const port = process.argv[2]; // the port on which the blockchain node will work on
const nodeAddress = uuid().split("-").join(""); // generate random address for this blockchain node that will be used when emitting transactions
const bitcoinRewardingSystemAddress = "00"; // address of the rewarding system, that gives 12.5 bitcoins to the mining node

const Blockchain = require("./blockchain");

// initialise bitcoin blockchain
const bitcoin = new Blockchain(nodeAddress);

// express server setup
const app = express();
app.use(cors());
// THIS IS SET AS FALSE ONLY BECAUSE CONTENT SECURITY POLICY IS BLOCKING THE LOADING OF BOOTSTRAP AND ANGULAR EXTERNAL SCRIPTS
// IN PRODUCTION ENVIRONMENT, THIS SHOULD ALWAYS BE SET TO TRUE AND HANDLED PROPERLY!
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// route that retrieves the whole blockchain
app.get("/blockchain", (req, res) => {
  res.status(200).send(bitcoin);
});

// route that creates a new transaction that will be added in the next block
app.post("/transaction", (req, res) => {
  try {
    const newTransaction = req.body;
    const nextBlockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
    res.status(201).json({ ...newTransaction, nextBlockIndex });
  } catch (err) {
    res.status(500).json({ message: "Failed to create new transaction." });
  }
});

// route that starts the mining process - create a new block with all pending transactions, add it to each blockchain copy of all nodes, reward the node for mining the block
app.get("/mine-block", (req, res) => {
  try {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock["hash"];
    const currentBlockData = {
      transactions: bitcoin.pendingTransactions,
      index: lastBlock["index"] + 1,
    };
    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

    const reqPromises = [];
    bitcoin.networkNodes.forEach((networkNodeUrl) => {
      const requestOptions = {
        uri: networkNodeUrl + "/receive-new-block",
        method: "POST",
        body: { newBlock },
        json: true,
      };
      reqPromises.push(rp(requestOptions));
    });

    Promise.all(reqPromises)
      .then(() => {
        const requestOptions = {
          uri: bitcoin.currentNodeUrl + "/transaction/broadcast",
          method: "POST",
          body: { isRewardTransaction: true },
          json: true,
        };
        return rp(requestOptions);
      })
      .then(() => {
        res.status(201).send(newBlock);
      });
  } catch (err) {
    res.status(500).json({ message: "Failed to mine new block." });
  }
});

// route that adds the newly created block into the blockchain
app.post("/receive-new-block", (req, res) => {
  try {
    const newBlock = req.body.newBlock;
    const lastBlock = bitcoin.getLastBlock();

    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock.index + 1 === newBlock.index;

    if (correctHash && correctIndex) {
      bitcoin.chain.push(newBlock);
      bitcoin.pendingTransactions = [];
      res.status(200).send(newBlock);
    } else {
      res.status(400).json({ message: "This block has been altered or incorrectly created.", newBlock });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to add new block to blockchain." });
  }
});

// route that creates a decentralised network of nodes by connecting a new node to the existing network
app.post("/register-and-broadcast-node", (req, res) => {
  try {
    const newNodeUrl = req.body.newNodeUrl;

    if (bitcoin.networkNodes.indexOf(newNodeUrl) === -1) {
      bitcoin.networkNodes.push(newNodeUrl);
    }

    const registerNodesPromises = [];
    bitcoin.networkNodes.forEach((networkNodeUrl) => {
      const requestOptions = {
        uri: networkNodeUrl + "/register-node",
        method: "POST",
        body: { newNodeUrl },
        json: true,
      };
      registerNodesPromises.push(rp(requestOptions));
    });

    Promise.all(registerNodesPromises)
      .then(() => {
        const bulkRegisterOptions = {
          uri: newNodeUrl + "/register-bulk-nodes",
          method: "POST",
          body: { allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl] },
          json: true,
        };
        return rp(bulkRegisterOptions);
      })
      .then(() => {
        res.status(200).json({ message: "New node added into the network", newNodeUrl });
      });
  } catch (err) {
    res.status(500).json({ message: "Failed to register new node to blockchain network." });
  }
});

// route that connects a node to the existing blockchain network
app.post("/register-node", (req, res) => {
  try {
    const newNodeUrl = req.body.newNodeUrl;
    const newNodeNotAlreadyExisting = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;

    if (newNodeNotAlreadyExisting && notCurrentNode) {
      bitcoin.networkNodes.push(newNodeUrl);
    }
    res.status(200).json({ message: "New node added into the network.", newNodeUrl });
  } catch (err) {
    res.status(500).json({ message: "Failed to register new node to blockchain network." });
  }
});

// route that connects multiple nodes to the existing blockchain network
app.post("/register-bulk-nodes", (req, res) => {
  try {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach((networkNodeUrl) => {
      const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
      const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;

      if (nodeNotAlreadyPresent && notCurrentNode) {
        bitcoin.networkNodes.push(networkNodeUrl);
      }
    });
    res.status(200).json({ message: "Nodes have been successfully connected with the network.", allNetworkNodes });
  } catch (err) {
    res.status(500).json({ message: "Failed to register multiple nodes to blockchain network." });
  }
});

// route that creates a new transaction and broadcasts it in the network
app.post("/transaction/broadcast", (req, res) => {
  try {
    let newTransaction;
    if (req.body.isRewardTransaction) {
      newTransaction = bitcoin.createNewTransaction(12.5, bitcoinRewardingSystemAddress, nodeAddress);
    } else {
      newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    }

    bitcoin.addTransactionToPendingTransactions(newTransaction);

    const reqPromises = [];
    bitcoin.networkNodes.forEach((networkNodeUrl) => {
      const requestOptions = {
        uri: networkNodeUrl + "/transaction",
        method: "POST",
        body: newTransaction,
        json: true,
      };
      reqPromises.push(rp(requestOptions));
    });
    Promise.all(reqPromises).then(() => {
      res.status(200).json({ message: "Transaction was successfully created and broadcasted to entire network.", newTransaction });
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create new transaction." });
  }
});

// route that synchronises the blockchain copies from each node - used to send a blockchain copy to all new nodes
app.get("/consensus", (req, res) => {
  const reqPromises = [];
  bitcoin.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      uri: networkNodeUrl + "/blockchain",
      method: "GET",
      json: true,
    };
    reqPromises.push(rp(requestOptions));
  });

  Promise.all(reqPromises).then((blockchains) => {
    const currentChainLength = bitcoin.chain.length;
    let maxChainLength = currentChainLength;
    let newLongestChain = null;
    let newPendingTransactions = null;

    blockchains.forEach((blockchain) => {
      if (blockchain.chain.length > maxChainLength) {
        maxChainLength = blockchain.chain.length;
        newLongestChain = blockchain.chain;
        newPendingTransactions = blockchain.pendingTransactions;
      }
    });

    if (!newLongestChain || (newLongestChain && !bitcoin.isChainValid(newLongestChain))) {
      res.status(400).json({ message: "Current chain has not been replaced.", chain: bitcoin.chain });
    } else {
      bitcoin.chain = newLongestChain;
      bitcoin.pendingTransactions = newPendingTransactions;
      res.status(200).json({ message: "The chain has been replaced.", chain: bitcoin.chain });
    }
  });
});

// route that retrieves a block based on its hash
app.get("/block/:blockHash", (req, res) => {
  const blockHash = req.params.blockHash;
  const retrievedBlock = bitcoin.getBlock(blockHash);
  res.status(200).send(retrievedBlock);
});

// route that retrieves a transaction and its block based on a transactionId
app.get("/transaction/:transactionId", (req, res) => {
  const transactionId = req.params.transactionId;
  const { retrievedTransaction, retrievedBlock } = bitcoin.getTransaction(transactionId);
  res.status(200).json({ transaction: { ...retrievedTransaction, blockIndex: retrievedBlock.index }, block: retrievedBlock });
});

// route that retrieves all transactions made by an address
app.get("/address/:address", (req, res) => {
  const address = req.params.address;
  const { addressTransactions, balance } = bitcoin.getAddressData(address);
  res.status(200).json({ transactions: addressTransactions, balance });
});

// route that returns the block explorer UI portal
app.get("/block-explorer", (req, res) => {
  res.sendFile("./block-explorer/index.html", { root: __dirname });
});

app.listen(port, () => {
  console.log(`bitcoin blockchain node is listening on port ${port}.`);
});

module.exports = app;
