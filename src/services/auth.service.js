import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserByEmail, insertUser } from "../repositories/auth.repository.js";

// ✅ 회원가입 서비스
export const registerUserService = async ({ name, email, password, paypal_id }) => {
    // 1️⃣ 이메일 중복 확인
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        throw new Error("EMAIL_EXISTS");
    }

    // 2️⃣ 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ DB 저장
    const newUser = await insertUser({
        name,
        email,
        password: hashedPassword,
        paypal_id,
    });

    return newUser;
};


// ✅ 로그인 서비스
export const loginUserService = async ({ email, password }) => {
    // 1️⃣ 이메일로 사용자 조회
    const user = await findUserByEmail(email);
    if (!user) throw new Error("USER_NOT_FOUND");
  
    // 2️⃣ 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("INVALID_PASSWORD");
  
    // 3️⃣ JWT 토큰 발급
    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" } // 7일 유효
    );
  
    // 4️⃣ 로그인 성공 시 사용자 정보 반환
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            paypal_id: user.paypal_id,
            created_at: user.created_at,
        },
    };
};