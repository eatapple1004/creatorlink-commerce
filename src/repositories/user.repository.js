const users = [];

export async function createUser(user) {
  users.push(user);
  console.log("✅ 유저 생성:", user.email);
  return user;
}

export async function findUserByEmail(email) {
  return users.find(u => u.email === email);
}
