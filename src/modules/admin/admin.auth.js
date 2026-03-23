import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { getSetting, setSetting } from "./admin.repository.js";

const ADMIN_SECRET = () => process.env.ADMIN_PASSWORD || "admin";
const SESSION_DURATION = 30 * 60; // 30분 (초)
const SESSION_DURATION_MS = SESSION_DURATION * 1000;

/**
 * 관리자 인증 미들웨어
 * - JWT 검증
 * - 30분 세션 타임아웃 (슬라이딩 윈도우: 매 요청마다 토큰 갱신)
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
    const decoded = jwt.verify(token, ADMIN_SECRET());

    // 2FA 미완료 임시 토큰은 접근 차단
    if (decoded.pending_2fa) {
      return res.status(403).json({ message: "2FA verification required" });
    }

    // 슬라이딩 윈도우: 새 토큰 발급하여 쿠키 갱신
    const newToken = jwt.sign({ role: "admin" }, ADMIN_SECRET(), {
      expiresIn: SESSION_DURATION,
    });
    res.cookie("admin_token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_DURATION_MS,
    });

    next();
  } catch {
    return res.status(403).json({ message: "Session expired. Please login again." });
  }
}

/**
 * 1단계: 비밀번호 로그인
 * - 비밀번호 확인 후 2FA 상태에 따라 분기
 */
export async function loginAdmin(req, res) {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }

  // 2FA 설정 여부 확인
  const totpSecret = await getSetting("admin_totp_secret");

  if (!totpSecret) {
    // 2FA 미설정 → 새 secret 생성 + QR 코드 반환
    const secret = speakeasy.generateSecret({
      name: "CreatorLink Admin",
      issuer: "CreatorLink",
    });

    // 임시 토큰 (2FA 설정 완료 전까지만 유효, 5분)
    const tempToken = jwt.sign(
      { role: "admin", pending_2fa: true, temp_secret: secret.base32 },
      ADMIN_SECRET(),
      { expiresIn: "5m" }
    );

    const qrUrl = await QRCode.toDataURL(secret.otpauth_url);

    return res.json({
      success: true,
      requires_2fa: true,
      setup_required: true,
      temp_token: tempToken,
      qr_url: qrUrl,
      secret_manual: secret.base32, // 수동 입력용
    });
  }

  // 2FA 설정됨 → OTP 입력 요구
  const tempToken = jwt.sign(
    { role: "admin", pending_2fa: true },
    ADMIN_SECRET(),
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
 * - 최초 설정 시 secret을 DB에 저장
 * - 검증 성공 시 본 세션 토큰 발급
 */
export async function verifyOtp(req, res) {
  const { otp, temp_token } = req.body;

  if (!otp || !temp_token) {
    return res.status(400).json({ message: "OTP and temp_token are required" });
  }

  // 임시 토큰 검증
  let decoded;
  try {
    decoded = jwt.verify(temp_token, ADMIN_SECRET());
  } catch {
    return res.status(403).json({ message: "Temporary session expired. Please login again." });
  }

  if (!decoded.pending_2fa) {
    return res.status(400).json({ message: "Invalid token" });
  }

  // secret 결정: 최초 설정이면 토큰에서, 기존이면 DB에서
  let secret;
  if (decoded.temp_secret) {
    // 최초 설정 중
    secret = decoded.temp_secret;
  } else {
    secret = await getSetting("admin_totp_secret");
    if (!secret) {
      return res.status(400).json({ message: "2FA not configured" });
    }
  }

  // OTP 검증
  const verified = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: otp,
    window: 1, // ±30초 허용
  });

  if (!verified) {
    return res.status(401).json({ message: "Invalid OTP code" });
  }

  // 최초 설정이면 secret을 DB에 저장
  if (decoded.temp_secret) {
    await setSetting("admin_totp_secret", secret);
  }

  // 본 세션 토큰 발급 (30분)
  const token = jwt.sign({ role: "admin" }, ADMIN_SECRET(), {
    expiresIn: SESSION_DURATION,
  });
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_MS,
  });

  res.json({ success: true });
}
