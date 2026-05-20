import { API_URL, APP_CODE } from "../env";

type FaceSwapBody = {
  img_url?: string;
  template_id?: number;
  custom_watermark?: string;
  out_request_id?: string;
  mt_check_id?: string;
};

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
};

const readEnv = (env: Record<string, unknown> | undefined, key: string) => {
  if (key === "ALIYUN_FACESWAP_APPCODE" && APP_CODE.trim()) {
    return APP_CODE.trim();
  }
  if (key === "ALIYUN_FACESWAP_URL" && API_URL.trim()) {
    return API_URL.trim();
  }

  const fromEnv = env?.[key];
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }

  try {
    const fromProcess = process?.env?.[key];
    if (typeof fromProcess === "string" && fromProcess.trim()) {
      return fromProcess.trim();
    }
  } catch {
    // Edge runtimes may not expose process.
  }

  return undefined;
};

const parseBody = async (request: Request) => {
  try {
    return (await request.json()) as FaceSwapBody;
  } catch {
    return null;
  }
};

const normalizePayload = (body: FaceSwapBody) => {
  const imgUrl = body.img_url?.trim();
  const mtCheckId = body.mt_check_id?.trim();
  const payload: FaceSwapBody = {
    template_id: Number(body.template_id),
    out_request_id: body.out_request_id?.trim(),
  };

  if (imgUrl) {
    payload.img_url = imgUrl;
  }

  if (mtCheckId) {
    payload.mt_check_id = mtCheckId;
  }

  const watermark = body.custom_watermark?.trim();
  if (watermark) {
    payload.custom_watermark = watermark;
  }

  return payload;
};

const validatePayload = (payload: FaceSwapBody) => {
  if (!Number.isInteger(payload.template_id)) return "template_id must be an integer";
  if (!payload.out_request_id) return "out_request_id is required";
  if (!payload.img_url && !payload.mt_check_id) return "img_url or mt_check_id is required";
  if (payload.img_url && payload.mt_check_id) return "img_url and mt_check_id are mutually exclusive";
  return "";
};

async function handleFaceSwapRequest(request: Request, env: Record<string, unknown> | undefined) {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const body = await parseBody(request);
  if (!body) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = normalizePayload(body);
  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ error: validationError }, { status: 400 });
  }

  const appCode = readEnv(env, "ALIYUN_FACESWAP_APPCODE");
  if (!appCode || appCode === "YOUR_APP_CODE_HERE") {
    return json(
      {
        error:
          "AppCode is missing. Set ALIYUN_FACESWAP_APPCODE in ESA environment variables or build env.",
      },
      { status: 500 },
    );
  }

  const upstreamUrl =
    readEnv(env, "ALIYUN_FACESWAP_URL") ||
    "https://mtfaceswap.market.alicloudapi.com/openapi/idphoto/photo/aliyun/faceswap/make";

  let response: Response;
  try {
    const timeout = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error("Aliyun faceswap request timeout")), 30000);
    });

    response = await Promise.race([
      fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `APPCODE ${appCode}`,
          "Content-Type": "application/json; charset=UTF-8",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }),
      timeout,
    ]);
  } catch (error: any) {
    return json({ error: error?.message || "Aliyun faceswap request failed" }, { status: 502 });
  }

  const upstreamText = await response.text();
  let upstreamBody: unknown = upstreamText;
  if (upstreamText) {
    try {
      upstreamBody = JSON.parse(upstreamText);
    } catch {
      upstreamBody = upstreamText.slice(0, 2000);
    }
  }

  if (!response.ok) {
    return json(
      {
        error: "Aliyun faceswap request failed",
        upstreamUrl,
        upstreamStatus: response.status,
        upstreamBody,
      },
      { status: 502 },
    );
  }

  return json(upstreamBody);
}

export default {
  async fetch(request: Request, env?: Record<string, unknown>) {
    const url = new URL(request.url);
    if (url.pathname === "/api/faceswap" || url.pathname === "/faceswap") {
      return handleFaceSwapRequest(request, env);
    }

    if (!url.pathname.startsWith("/api/")) {
      return fetch(new URL("/index.html", request.url));
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
