import winston from 'winston';
import { env } from '../config/environment.js';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'mcp-server' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: env.LOG_FILE,
      format: logFormat
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: logFormat
    })
  ]
});

// Add request ID to logs for tracing
export const addRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

// Performance timing utility
export const timing = {
  start: (operation: string) => {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        logger.info(`Operation completed`, { operation, duration });
        return duration;
      }
    };
  }
};

export default logger;
