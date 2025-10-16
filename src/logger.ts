import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, label, ...meta }) => {
      let msg = `${timestamp} [${level}]`;
      if (label) {
        msg += ` [${label}]`;
      }
      msg += `: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Helper to create labeled child loggers
export function createLogger(label: string) {
  return logger.child({ label });
}

export default logger;