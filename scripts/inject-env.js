import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetPath = path.join(__dirname, "../edge/env.ts");

const appCode = process.env.ALIYUN_IDPHOTO_APPCODE || "";
const apiUrl =
  process.env.ALIYUN_IDPHOTO_URL ||
  "https://idp2.market.alicloudapi.com/idphoto/make";
const arrangeApiUrl =
  process.env.ALIYUN_IDPHOTO_ARRANGE_URL ||
  "https://idp2.market.alicloudapi.com/idphoto/arrange";

const content = `/**
 * Generated at build time. Do not commit secrets here.
 */
export const APP_CODE = ${JSON.stringify(appCode)};
export const API_URL = ${JSON.stringify(apiUrl)};
export const ARRANGE_API_URL = ${JSON.stringify(arrangeApiUrl)};
`;

try {
  fs.writeFileSync(targetPath, content);
  console.log(`[Build] Generated ${targetPath}`);
  console.log(`[Build] ALIYUN_IDPHOTO_APPCODE length: ${appCode.length}`);
} catch (error) {
  console.error("[Build] Failed to generate edge env file:", error);
  process.exit(1);
}
