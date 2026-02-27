// src/middlewares/verifyToken.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const verifyToken = (req, res, next) => {
  try {
    // 1️⃣ 토큰 추출: Authorization 헤더 → 쿠키 순으로 확인
    const authHeader = req.headers.authorization;
    const token =
      (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) ||
      req.cookies?.ambassador_token;

    if (!token) {
      return res.status(401).json({ message: "인증 토큰이 없습니다." });
    }

    // 2️⃣ 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ 검증 성공 시 사용자 정보 요청 객체에 저장
    req.user = decoded;

    next();
  } catch (err) {
    console.error("❌ JWT 인증 실패:", err);
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};
