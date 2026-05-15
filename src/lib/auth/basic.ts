/**
 * Verifies Basic authentication credentials from a Request object.
 * Edge Runtime 互換のためシンプルな文字列比較を使用（個人用アプリのため十分）。
 */
export function verifyBasicAuth(req: Request): boolean {
  const expectedUser = process.env.APP_BASIC_USER?.trim();
  const expectedPass = process.env.APP_BASIC_PASS?.trim();

  if (!expectedUser || !expectedPass) {
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.slice("Basic ".length);
  let decoded: string;
  try {
    // atob は Edge Runtime でも使える
    decoded = atob(base64Credentials);
  } catch {
    return false;
  }

  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    return false;
  }

  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  return user === expectedUser && pass === expectedPass;
}
