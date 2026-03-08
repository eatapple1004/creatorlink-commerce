import jwt from "jsonwebtoken";

const ADMIN_SECRET = () => process.env.ADMIN_PASSWORD || "admin";

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
    jwt.verify(token, ADMIN_SECRET());
    next();
  } catch {
    return res.status(403).json({ message: "Invalid or expired session" });
  }
}

export function loginAdmin(req, res) {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const token = jwt.sign({ role: "admin" }, ADMIN_SECRET(), { expiresIn: "8h" });
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ success: true });
}
