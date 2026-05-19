import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.join(__dirname, "../edge/env.ts");

const appCode = process.env.ALIYUN_FACESWAP_APPCODE || "";
const apiUrl =
  process.env.ALIYUN_FACESWAP_URL ||
  "https://mtfaceswap.market.alicloudapi.com/openapi/idphoto/photo/aliyun/faceswap/make";

const content = `/**
 * Generated at build time. Do not commit secrets here.
 */
export const APP_CODE = ${JSON.stringify(appCode)};
export const API_URL = ${JSON.stringify(apiUrl)};
`;

try {
  fs.writeFileSync(targetPath, content);
  console.log(`[Build] Generated ${targetPath}`);
  console.log(`[Build] ALIYUN_FACESWAP_APPCODE length: ${appCode.length}`);
} catch (error) {
  console.error("[Build] Failed to generate edge env file:", error);
  process.exit(1);
}
