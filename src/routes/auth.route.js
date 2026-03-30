import express from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

// 회원가입
router.post("/register", registerUser);

// 로그인
router.post("/login", loginUser);

// 로그아웃
router.post("/logout", logoutUser);

router.get("/profile", verifyToken, (req, res) => {
    res.json({
      message: "인증 성공",
      user: req.user, // JWT 안의 사용자 정보
    });
  });

export default router;
