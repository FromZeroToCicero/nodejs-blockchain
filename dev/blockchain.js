const sha256 = require('sha256');
const uuid = require('uuid/v1');

const currentNodeUrl = process.argv[3];

class Blockchain {
  constructor() {
    this.chain = []; // where the meat of the blockchain will be stored (all the blocks that are created/mined will be stored here)
    this.pendingTransactions = []; // where the new transactions are stored before they are placed in blocks to mine
    this.currentNodeUrl = currentNodeUrl;
    this.networkNodes = []; // we will add all the urls of each node that will be inside the network

    this.createNewBlock(100, '0', '0'); // arbitrary values for the genesis block

    // the pending transactions are saved in the blockchain when a new block is mined (which is when a new block is created)
  }

  createNewBlock = (nonce, previousBlockHash, hash) => {
    const newBlock = {
        index: this.chain.length + 1,  // the number of the block on the chain
        timestamp: Date.now(), // when the block was created
        transactions: this.pendingTransactions, // we put the new transactions inside the new block
        nonce: nonce, // is a number that represents the proof that we created the new block in a legitimate way by using a proof-of-work method
        hash: hash, // the data from the new block
        previousBlockHash: previousBlockHash // the data from the previous block
    };

    this.pendingTransactions = []; // clear the transactions array
    this.chain.push(newBlock); // push the block up the chain

    return newBlock;
  }

  getLastBlock = () => { // returns the last block from the chain
      return this.chain[this.chain.length - 1];
  }

  createNewTransaction = (amount, sender, recipient) => {
    const newTransaction = { // create a new transaction
        transactionId: uuid().split('-').join(''),
        amount: amount,
        sender: sender,
        recipient: recipient
    };
    return newTransaction;
  }

  addTransactionToPendingTransactions = (transaction) => {
    this.pendingTransactions.push(transaction);
    return this.getLastBlock()['index'] + 1;
  }

  hashBlock = (previousBlockHash, currentBlockData, nonce) => { // used to hash the data that we pass in for a block
    const dataAsString = previousBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
  }

  proofOfWork = (previousBlockHash, currentBlockData) => {
      // repeatedly hash block until it finds the correct hash (which starts with 4 zeros)
      // uses current block data for the hask, but also the previousBlockHash
      // continously changes nonce value until it finds the correct hash
      // returns to us the nonce value that creates the correct hash
      // the number of leading zeros determines how difficult is to validate the block
      let nonce = 0;
      let hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
      while (hash.substring(0, 4) !== '0000') {
          nonce++;
          hash = this.hashBlock(previousBlockHash, currentBlockData, nonce);
      }

      return nonce;
  }
}

module.exports = Blockchain;