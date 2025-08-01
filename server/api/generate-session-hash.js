import crypto from "crypto";

// Generate a cryptographically strong session hash
const generateSessionHash = () => {
  return crypto.randomBytes(32).toString("base64url");
};

export default defineEventHandler(async (event) => {
  try {
    const sessionHash = generateSessionHash();
    return {
      success: true,
      sessionHash,
    };
  } catch (error) {
    console.error("Error generating session hash:", error.message, error.stack);
    return {
      success: false,
      error: `Failed to generate session hash: ${error.message}`,
    };
  }
});