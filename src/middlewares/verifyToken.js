// src/middlewares/verifyToken.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 1️⃣ Authorization 헤더 존재 확인
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "인증 토큰이 없습니다." });
    }

    // 2️⃣ 토큰 추출
    const token = authHeader.split(" ")[1];

    // 3️⃣ 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4️⃣ 검증 성공 시 사용자 정보 요청 객체에 저장
    req.user = decoded; // { id, email, role }

    // 5️⃣ 다음 미들웨어로 이동
    next();
  } catch (err) {
    console.error("❌ JWT 인증 실패:", err);
    res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};
