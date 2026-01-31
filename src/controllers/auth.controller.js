import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { registerUserService, loginUserService } from "../services/auth.service.js";

/**
 * 회원가입 컨트롤러 (앰버서더 전용)
 * Air Wallex가 지원하는 국가와 은행 리스트를 보여준다
 */
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, paypal_email, currency = "USD", country_code = "US" } = req.body;

    // 필수값 검증
    if (!name || !email || !password || !paypal_email) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    // 서비스 계층 호출
    const user = await registerUserService({ name, email, password, paypal_email, currency, country_code });

    res.status(201).json({
      message: "회원가입 성공",
      user,
    });
  } catch (err) {
    console.error("❌ registerUser error:", err.message);

    if (err.message === "EMAIL_EXISTS") {
      return res.status(409).json({ message: "이미 등록된 이메일입니다." });
    }

    res.status(500).json({ message: "서버 오류" });
  }
};

/**
 * 로그인 컨트롤러 (JWT 발급)
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 필수값 확인
    if (!email || !password) {
      return res.status(400).json({ message: "이메일과 비밀번호를 모두 입력해주세요." });
    }

    const { token, user } = await loginUserService({ email, password });

    res.status(200).json({
      message: "로그인 성공",
      token,
      user,
    });
  } catch (err) {
    console.error("❌ loginUser error:", err.message);

    if (err.message === "USER_NOT_FOUND") {
      return res.status(404).json({ message: "존재하지 않는 이메일입니다." });
    }

    if (err.message === "INVALID_PASSWORD") {
      return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });
    }

    res.status(500).json({ message: "서버 오류" });
  }
};
