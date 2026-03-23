import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import pool from "../../config/db.js";

const JWT_SECRET = () => process.env.JWT_SECRET || "admin-fallback-secret";
const SESSION_DURATION = 30 * 60; // 30분 (초)
const SESSION_DURATION_MS = SESSION_DURATION * 1000;

// ── DB 헬퍼 ──

async function findAdminByUsername(username) {
  const { rows } = await pool.query(
    "SELECT * FROM admin_users WHERE username = $1",
    [username]
  );
  return rows[0] || null;
}

async function setTotpSecret(userId, secret) {
  await pool.query(
    "UPDATE admin_users SET totp_secret = $1, updated_at = NOW() WHERE id = $2",
    [secret, userId]
  );
}

// ── 미들웨어 ──

/**
 * 관리자 인증 미들웨어
 * - JWT 검증
 * - 30분 세션 타임아웃 (슬라이딩 윈도우)
 */
export function adminAuth(req, res, next) {
  const token =
    req.cookies?.admin_token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    return res.status(401).json({ message: "Admin login required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET());

    if (decoded.pending_2fa) {
      return res.status(403).json({ message: "2FA verification required" });
    }

    // 슬라이딩 윈도우: 새 토큰 발급
    const newToken = jwt.sign(
      { role: "admin", userId: decoded.userId, username: decoded.username },
      JWT_SECRET(),
      { expiresIn: SESSION_DURATION }
    );
    res.cookie("admin_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_DURATION_MS,
    });

    req.adminUser = { id: decoded.userId, username: decoded.username };
    next();
  } catch {
    return res.status(403).json({ message: "Session expired. Please login again." });
  }
}

// ── 엔드포인트 ──

/**
 * 1단계: 아이디 + 비밀번호 로그인
 */
export async function loginAdmin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const user = await findAdminByUsername(username);
  if (!user) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  if (!user.totp_secret) {
    // 2FA 미설정 → QR 코드 생성
    const secret = speakeasy.generateSecret({
      name: `CreatorLink Admin (${username})`,
      issuer: "CreatorLink",
    });

    const tempToken = jwt.sign(
      { role: "admin", pending_2fa: true, userId: user.id, username: user.username, temp_secret: secret.base32 },
      JWT_SECRET(),
      { expiresIn: "5m" }
    );

    const qrUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      success: true,
      requires_2fa: true,
      setup_required: true,
      temp_token: tempToken,
      qr_url: qrUrl,
      secret_manual: secret.base32,
    });
  }

  // 2FA 설정됨 → OTP 입력 요구
  const tempToken = jwt.sign(
    { role: "admin", pending_2fa: true, userId: user.id, username: user.username },
    JWT_SECRET(),
    { expiresIn: "5m" }
  );

  return res.json({
    success: true,
    requires_2fa: true,
    setup_required: false,
    temp_token: tempToken,
  });
}

/**
 * 2단계: OTP 검증
 */
export async function verifyOtp(req, res) {
  const { otp, temp_token } = req.body;

  if (!otp || !temp_token) {
    return res.status(400).json({ message: "OTP and temp_token are required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(temp_token, JWT_SECRET());
  } catch {
    return res.status(403).json({ message: "Temporary session expired. Please login again." });
  }

  if (!decoded.pending_2fa) {
    return res.status(400).json({ message: "Invalid token" });
  }

  // secret 결정
  let secret;
  if (decoded.temp_secret) {
    secret = decoded.temp_secret;
  } else {
    const user = await findAdminByUsername(decoded.username);
    secret = user?.totp_secret;
    if (!secret) {
      return res.status(400).json({ message: "2FA not configured" });
    }
  }

  // OTP 검증
  const verified = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: otp,
    window: 1,
  });

  if (!verified) {
    return res.status(401).json({ message: "Invalid OTP code" });
  }

  // 최초 설정이면 DB에 저장
  if (decoded.temp_secret) {
    await setTotpSecret(decoded.userId, secret);
  }

  // 본 세션 토큰 발급
  const token = jwt.sign(
    { role: "admin", userId: decoded.userId, username: decoded.username },
    JWT_SECRET(),
    { expiresIn: SESSION_DURATION }
  );
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_MS,
  });

  res.json({ success: true, username: decoded.username });
}
