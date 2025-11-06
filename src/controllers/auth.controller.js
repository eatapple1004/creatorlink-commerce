import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

import { registerUserService, loginUserService } from "../services/auth.service.js";

const generateReferralCode = (name) => {
  const prefix = name.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

// ✅ 회원가입 컨트롤러
export const registerUser = async (req, res) => {
    const { name, email, password, paypal_id } = req.body;
  
    try {
      const newUser = await registerUserService({ name, email, password, paypal_id });
      res.status(201).json({
        message: "회원가입 성공",
        user: newUser,
      });
    } catch (err) {
      console.error("❌ registerUser error:", err.message);
  
      if (err.message === "EMAIL_EXISTS") {
        return res.status(400).json({ message: "이미 존재하는 이메일입니다." });
      }
  
      res.status(500).json({ message: "서버 오류" });
    }
};

// ✅ 로그인 컨트롤러
export const loginUser = async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const { token, user } = await loginUserService({ email, password });
  
      res.status(200).json({
        message: "로그인 성공",
        token,
        user,
      });
    } catch (err) {
      console.error("❌ loginUser error:", err.message);
  
      if (err.message === "USER_NOT_FOUND") {
        return res.status(400).json({ message: "존재하지 않는 이메일입니다." });
      }
      if (err.message === "INVALID_PASSWORD") {
        return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });
      }
  
      res.status(500).json({ message: "서버 오류" });
    }
};