import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const generateReferralCode = (name) => {
  const prefix = name.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

// ✅ 회원가입
export const registerUser = async (req, res) => {
  const { email, password, name, role } = req.body;

  try {
    const checkUser = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "이미 존재하는 이메일입니다." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUserQuery = `
      INSERT INTO users (email, password, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role;
    `;
    const result = await pool.query(insertUserQuery, [email, hashedPassword, name, role || "member"]);
    const user = result.rows[0];

    if (user.role === "creator") {
      const code = generateReferralCode(user.name);
      await pool.query("INSERT INTO referral_codes (creator_id, code) VALUES ($1, $2)", [user.id, code]);
      user.referral_code = code;
    }

    res.status(201).json({ message: "회원가입 성공", user });
  } catch (err) {
    console.error("❌ registerUser error:", err);
    res.status(500).json({ message: "서버 오류" });
  }
};

// ✅ 로그인
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1️⃣ 이메일로 유저 조회
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "존재하지 않는 이메일입니다." });
    }

    const user = result.rows[0];

    // 2️⃣ 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });
    }

    // 3️⃣ JWT 토큰 발급
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // 7일 유효
    );

    // 4️⃣ 응답 반환
    res.status(200).json({
      message: "로그인 성공",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
    });
  } catch (err) {
    console.error("❌ loginUser error:", err);
    res.status(500).json({ message: "서버 오류" });
  }
};
