export type RoleLandingUser = {
  role: "ADMIN" | "USER";
};

export function getRoleLandingPath(user: RoleLandingUser) {
  return user.role === "ADMIN" ? "/admin" : "/workbench";
}
