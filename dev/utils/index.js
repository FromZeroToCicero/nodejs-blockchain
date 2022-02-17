const { v4: uuidv4 } = require("uuid");

const { logger } = require("../services");

const generateUuid = () => {
  return uuidv4().split("-").join("");
};

const buildResponse = (res, statusCode, message) => {
  logger.debug(
    `Building response with ${statusCode}, ${JSON.stringify(message)}`
  );
  return res.status(statusCode).json(message);
};

const utils = {
  generateUuid,
  buildResponse,
};

module.exports = utils;
