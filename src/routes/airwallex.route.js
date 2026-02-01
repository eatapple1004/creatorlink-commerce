import express from "express";
import { getToken } from "../controllers/airwallex.controller.js";
import { listSupportedFinancialInstitutions } from '../controllers/airwallexBank.controller.js';

const router = express.Router();


// finish


// working
router.get("/token", getToken);  // 토큰 기능
router.get('/banks', listSupportedFinancialInstitutions); // 회원가입 은행 선택용


// to-do

//router.get();  // 가능 국가 리스트 조회
//router.get();  // 가능 은행 리스트 조회
//router.post(); // 수취인 등록
//router.post(); // 송금 기능

export default router;