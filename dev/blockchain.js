const sha256 = require("sha256");
const uuid = require("uuid/v1");

const currentNodeUrl = process.argv[3] || "";

class Blockchain {
  constructor(nodeAddress) {
    this.chain = []; // where the meat of the blockchain will be stored (all the blocks that are created/mined will be stored here)
    this.pendingTransactions = []; // where the new transactions are stored before they are placed in blocks to be mined
    this.currentNodeUrl = currentNodeUrl;
    this.currentNodeAddress = nodeAddress;
    this.networkNodes = []; // we will add all the urls of each node that will be inside the network

    this.createNewBlock(100, "0", "0"); // arbitrary values for the genesis block

    // the pending transactions are saved in the blockchain when a new block is mined (which is when a new block is created)
  }

  createNewBlock = (nonce, previousBlockHash, hash) => {
    // function that creates a new block using the current hash, previousBlockHash and a nonce provided via the proof-of-work method
    const newBlock = {
      index: this.chain.length + 1, // the index of the block on the chain
      timestamp: Date.now(), // when the block was created
      transactions: this.pendingTransactions, // we put the new transactions inside the new block
      nonce, // is a number that represents the proof that we created the new block in a legitimate way by using a proof-of-work method
      hash, // the data for the new block
      previousBlockHash, // the data from the previous block
    };

    this.pendingTransactions = []; // clear the transactions array
    this.chain.push(newBlock); // push the block up the chain

    return newBlock;
  };

  getLastBlock = () => {
    // returns the last block from the chain
    return this.chain[this.chain.length - 1];
  };

  createNewTransaction = (amount, sender, recipient) => {
    // function that creates a new transaction with the amount of bitcoins sent, the sender and recipient adresses
    const newTransaction = {
      transactionId: uuid().split("-").join(""),
      amount,
      sender,
      recipient,
    };
    return newTransaction;
  };

  addTransactionToPendingTransactions = (transaction) => {
    // store the new transaction in the list of pending transactions that are to be added in a new block
    this.pendingTransactions.push(transaction);
    return this.getLastBlock()["index"] + 1; // returns the block number where this transaction will be stored
  };

  hashBlock = (previousBlockHash, currentBlockData, nonce) => {
    // used to hash the data that we pass in for a block - returns the resulting sha256 hash string
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
  };

  proofOfWork = (previousBlockHash, currentBlockData) => {
    // function that repeatedly hashes the block data with different nonce values until it finds the correct hash (which starts with 4 zeros)
    // uses both current block data and the previousBlockHash
    // returns the nonce value that creates the correct hash
    // the number of leading zeros determines how difficult it is to validate the block - for Bitcoin it's 4 leading zeros
    let nonce = 0;
    let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    while (hash.substring(0, 4) !== "0000") {
      nonce++;
      hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
    }

    return nonce;
  };

  isChainValid = (blockchain) => {
    let validChain = true;
    // verify all blocks inside the blockchain
    for (let i = 1; i < blockchain.length; i++) {
      const currentBlock = blockchain[i];
      const previousBlock = blockchain[i - 1];
      const blockHash = this.hashBlock(previousBlock.hash, { transactions: currentBlock.transactions, index: currentBlock.index }, currentBlock.nonce);
      // if the hash of the previous block is different than the previousBlockHash of the current block or if the current hash doesn't start with 4 zeros, it means that the chain is not valid
      if (currentBlock.previousBlockHash !== previousBlock.hash || blockHash.substring(0, 4) !== "0000") {
        validChain = false;
      }
    }
    // verify the genesis block values
    const genesisBlock = blockchain[0];
    const correctNonce = genesisBlock.nonce === 100;
    const correctPreviousBlockHash = genesisBlock.previousBlockHash === "0";
    const correctHash = genesisBlock.hash === "0";
    const correctTransactions = genesisBlock.transactions.length === 0;
    if (!correctHash || !correctNonce || !correctPreviousBlockHash || !correctTransactions) {
      validChain = false;
    }
    // if the blockchain is valid, return true
    return validChain;
  };

  getBlock = (blockHash) => {
    // function that retrieves a block from the blockchain based on its hash
    return this.chain.find((block) => block.hash === blockHash);
  };

  getTransaction = (transactionId) => {
    // function that retrieves a transaction and the block that contains it based on the transactionId
    let retrievedTransaction = null;
    let retrievedBlock = null;
    this.chain.forEach((block) => {
      block.transactions.forEach((transaction) => {
        if (transaction.transactionId === transactionId) {
          retrievedTransaction = transaction;
          retrievedBlock = block;
        }
      });
    });
    return { retrievedTransaction, retrievedBlock };
  };

  getAddressData = (address) => {
    // function that finds all transactions made by a sender/recipient address and the balance of bitcoins in their account
    const addressTransactions = [];
    this.chain.forEach((block) => {
      block.transactions.forEach((transaction) => {
        if (transaction.sender === address || transaction.recipient === address) {
          addressTransactions.push(transaction);
        }
      });
    });

    let balance = 0;
    addressTransactions.forEach((transaction) => {
      if (transaction.recipient === address) {
        balance += transaction.amount;
      } else if (transaction.sender === address) {
        balance -= transaction.amount;
      }
    });

    return { addressTransactions, balance };
  };
}

module.exports = Blockchain;
