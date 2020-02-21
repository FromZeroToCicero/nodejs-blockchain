const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid/v1');
const rp = require('request-promise');

const port = process.argv[2];
const nodeAddress = uuid().split('-').join('');

const Blockchain = require("./blockchain");

const bitcoin = new Blockchain();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/blockchain", (req, res) => {
    res.send(bitcoin);
});

app.post("/transaction", (req, res) => {
    const newTransaction = req.body;
    const blockIndex = bitcoin.addTransactionToPendingTransactions(newTransaction);
    res.json({ note: `Transaction will be added in block ${blockIndex}.`});
});

app.get("/mine", (req, res) => {
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];
    const currentBlockData = {
        transactions: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1
    };
    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
    const blockHash = bitcoin.hashBlock(previousBlockHash, currentBlockData, nonce);

    const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

    const reqPromises = [];
    bitcoin.networkNodes .forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/receive-new-block",
            method: "POST",
            body: { newBlock },
            json: true
        }
        reqPromises.push(rp(requestOptions));
    });
    Promise.all(reqPromises).then(data => {
        // rewarding the person who mined the block with 12.5 bitcoin
        // the '00' sender address tells you that it's a mining reward
        const requestOptions = {
            uri: bitcoin.currentNodeUrl + "/transaction/broadcast",
            method: "POST",
            body: { amount: 12.5, sender: "00", recipient: nodeAddress },
            json: true
        };
        return rp(requestOptions);
    }).then(data => {
        res.json({
            note: "New block mined and broadcasted successfully",
            block: newBlock
        });
    });
});

app.post("/receive-new-block", (req, res) => {
    const newBlock = req.body.newBlock;
    const lastBlock = bitcoin.getLastBlock();
    const correctHash = lastBlock.hash === newBlock.previousBlockHash;
    const correctIndex = lastBlock.index + 1 === newBlock.index;
    if (correctHash && correctIndex) {
        bitcoin.chain.push(newBlock);
        bitcoin.pendingTransactions = [];
        res.json({ note: "New block received and accepted.", newBlock });
    } else {
        res.json({ note: "New block rejected", newBlock });
    }
});

// register a node and broadcast it to the entire network
app.post('/register-and-broadcast-node', (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    // registering a node in the network
    if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) {
        bitcoin.networkNodes.push(newNodeUrl);
    }

    // broadcast it to the entire network
    const registerNodesPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        // call the /register-node function
        const requestOptions = {
            uri: networkNodeUrl + "/register-node",
            method: "POST",
            body: { newNodeUrl },
            json: true
        };
        registerNodesPromises.push(rp(requestOptions));
    });

    Promise.all(registerNodesPromises).then(data => {
        const bulkRegisterOptions = {
             uri: newNodeUrl + '/register-nodes-bulk',
             method: 'POST',
             body: { allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl] },
             json: true
        };
        return rp(bulkRegisterOptions);
    }).then(data => {
         res.json({ note: 'New node registered with network successfully!' });
    })
});

// register a node with the network
app.post("/register-node", (req, res) => {
    const newNodeUrl = req.body.newNodeUrl;
    const newNodeNotAlreadyExisting = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
    if (newNodeNotAlreadyExisting && notCurrentNode) {
        bitcoin.networkNodes.push(newNodeUrl);
    }
    res.json({ note: 'New node registered successfully.' });
});

// register multiple nodes at once
app.post("/register-nodes-bulk", (req, res) => {
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) {
            bitcoin.networkNodes.push(networkNodeUrl);
        }
    });
    res.json({ note: 'Bulk registration successful.' });
});

app.post("/transaction/broadcast", (req,res) => {
    const newTransaction = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    bitcoin.addTransactionToPendingTransactions(newTransaction);

    const reqPromises = [];
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + "/transaction",
            method: "POST",
            body: newTransaction,
            json: true
        }
        reqPromises.push(rp(requestOptions));
    });
    Promise.all(reqPromises).then(data => {
        res.json({ note: "Transaction created and broadcasted successfully." });
    });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});