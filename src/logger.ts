import winston from "winston";

const logLevel = process.env.LOG_LEVEL || "info";

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, label, ...meta }: winston.Logform.TransformableInfo) => {
      let msg = `${timestamp as string} [${level}]`;
      if (label) {
        msg += ` [${label as string}]`;
      }
      msg += `: ${message as string}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  ),
  transports: [new winston.transports.Console()],
});

// Helper to create labeled child loggers
export function createLogger(label: string) {
  return logger.child({ label });
}

export default logger;
