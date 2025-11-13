import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserByEmail, insertUser, insertInitialPoints } from "../repositories/auth.repository.js";
import { generateReferralCode } from "../utils/referralCode.js";

/**
 * ✅ 회원가입 서비스 (앰버서더 전용)
 */
export const registerUserService = async ({ name, email, password, paypal_email, currency = "USD", country_code = "US" }) => {
    console.log(email)
    // 1️⃣ 이메일 중복 확인
    const existingUser = await findUserByEmail(email);
    if (existingUser) throw new Error("EMAIL_EXISTS");

    // 2️⃣ 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ 추천 코드 생성
    const referral_code = generateReferralCode(name);

    // 4️⃣ 사용자 저장
    const newUser = await insertUser({
        name,
        email,
        password: hashedPassword,
        paypal_email,
        referral_code,
    });

    // 5️⃣ 반환
    return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        paypal_email: newUser.paypal_email,
        currency: newUser.currency,
        country_code: newUser.country_code,
        created_at: newUser.created_at,
    };
};

/**
 * ✅ 로그인 서비스 (JWT 발급)
 */
export const loginUserService = async ({ email, password }) => {
    // 1️⃣ 이메일로 사용자 조회
    const user = await findUserByEmail(email);
    if (!user) throw new Error("USER_NOT_FOUND");

    // 2️⃣ 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("INVALID_PASSWORD");

    // 3️⃣ 계정 상태 확인
    if (user.status !== "active") throw new Error("ACCOUNT_SUSPENDED");

    // 4️⃣ JWT 토큰 발급
    const token = jwt.sign(
        {
        id: user.id,
        email: user.email,
        name: user.name,
        paypal_email: user.paypal_email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    // 5️⃣ 반환
    return {
        token,
        user: {
        id: user.id,
        email: user.email,
        name: user.name,
        paypal_email: user.paypal_email,
        currency: user.currency,
        country_code: user.country_code,
        created_at: user.created_at,
        },
    };
};
