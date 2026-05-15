import { timingSafeEqual } from "crypto";

/**
 * Verifies Basic authentication credentials from a Request object.
 * Reads expected credentials from APP_BASIC_USER and APP_BASIC_PASS env vars.
 * Returns false if env vars are not set, header is missing/malformed, or credentials don't match.
 */
export function verifyBasicAuth(req: Request): boolean {
  const expectedUser = process.env.APP_BASIC_USER;
  const expectedPass = process.env.APP_BASIC_PASS;

  // If env vars are not configured, deny all access
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
    decoded = Buffer.from(base64Credentials, "base64").toString("utf-8");
  } catch {
    return false;
  }

  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    return false;
  }

  const user = decoded.slice(0, colonIndex);
  const pass = decoded.slice(colonIndex + 1);

  try {
    const userBuf = Buffer.from(user);
    const passBuf = Buffer.from(pass);
    const expectedUserBuf = Buffer.from(expectedUser);
    const expectedPassBuf = Buffer.from(expectedPass);

    // timingSafeEqual requires same-length buffers; pad to avoid length leaking
    const userLen = Math.max(userBuf.length, expectedUserBuf.length);
    const passLen = Math.max(passBuf.length, expectedPassBuf.length);

    const paddedUser = Buffer.alloc(userLen);
    const paddedExpectedUser = Buffer.alloc(userLen);
    const paddedPass = Buffer.alloc(passLen);
    const paddedExpectedPass = Buffer.alloc(passLen);

    userBuf.copy(paddedUser);
    expectedUserBuf.copy(paddedExpectedUser);
    passBuf.copy(paddedPass);
    expectedPassBuf.copy(paddedExpectedPass);

    const userMatch = timingSafeEqual(paddedUser, paddedExpectedUser);
    const passMatch = timingSafeEqual(paddedPass, paddedExpectedPass);

    // Both must match AND original lengths must be equal (avoid padding-length bypass)
    return (
      userMatch &&
      passMatch &&
      userBuf.length === expectedUserBuf.length &&
      passBuf.length === expectedPassBuf.length
    );
  } catch {
    return false;
  }
}
