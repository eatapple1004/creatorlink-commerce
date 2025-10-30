# ✅ Node 18 버전 이미지 사용
FROM node:18

# ✅ 컨테이너 내부 작업 디렉토리 설정
WORKDIR /app

# ✅ package.json, package-lock.json만 먼저 복사 (캐시 활용)
COPY package*.json ./

# ✅ 의존성 설치
RUN npm install

# ✅ 나머지 모든 코드 복사
COPY . .

# ✅ 환경 변수
ENV NODE_ENV=production
ENV PORT=8080

# ✅ 서버 포트 오픈
EXPOSE 8080

# ✅ 컨테이너 실행 시 실행할 명령
CMD ["node", "app.js"]
