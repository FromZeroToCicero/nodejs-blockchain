const { createLogger, format, transports } = require("winston");

const { combine, timestamp, printf, colorize } = format;

const customLevels = {
  levels: {
    debug: 3,
    info: 2,
    warn: 1,
    error: 0,
  },
  colors: {
    debug: "blue",
    info: "white",
    warn: "yellow",
    error: "red",
  },
};

const logger = createLogger({
  format: combine(
    timestamp({ format: "DD-MM-YYYY HH:mm:ss.SSS" }),
    printf(
      ({ level, message, timestamp }) =>
        `${timestamp}| ${level.toUpperCase()} | ${message}`
    ),
    colorize({ all: true, colors: customLevels.colors })
  ),
  levels: customLevels.levels,
  transports: [
    new transports.Console({
      level: "debug",
      colorize: true,
      silent: process.env.NODE_ENV === "test",
    }),
  ],
});

const loggerService = {
  error(text) {
    logger.error(`${text}`);
  },
  warn(text) {
    logger.warn(`${text}`);
  },
  info(text) {
    logger.info(`${text}`);
  },
  debug(text) {
    logger.debug(`${text}`);
  },
};

module.exports = loggerService;
