// config/logger.js

import winston from "winston";
import winstonDaily from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

// 로그 디렉토리 생성
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const { combine, timestamp, printf, colorize } = winston.format;

// 로그 출력 형식 정의
const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

// Daily Rotate File 설정
const dailyRotateFileTransport = new winstonDaily({
  level: "info",
  dirname: logDir,
  filename: "%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d", // 14일 보관
  zippedArchive: true,
});

const logger = winston.createLogger({
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat
  ),
  transports: [
    dailyRotateFileTransport,
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),
  ],
});

// 개발환경에서는 콘솔에도 출력
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
      ),
    })
  );
}

export default logger;
