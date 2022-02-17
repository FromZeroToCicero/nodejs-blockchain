// Global imports
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

// Local imports
const blockchainRouter = require("./routes");
const { logger } = require("./services");

const port = process.argv[2];

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/blockchain", blockchainRouter);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    logger.info(`Blockchain server is listening on port ${port}.`);
  });
}

module.exports = app;
