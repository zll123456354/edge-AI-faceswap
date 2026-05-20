import { API_URL, APP_CODE, ARRANGE_API_URL } from "../env";

type IdPhotoMakeBody = {
  photo?: string;
  type?: string;
  photo_key?: string;
  spec?: string;
  bk?: string;
  beauty_degree?: number;
};

type IdPhotoArrangeBody = {
  photo_key?: string;
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
  if (key === "ALIYUN_IDPHOTO_APPCODE" && APP_CODE.trim()) {
    return APP_CODE.trim();
  }
  if (key === "ALIYUN_IDPHOTO_URL" && API_URL.trim()) {
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

const toStringValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toNumberValue = (value: unknown) => {
  if (value === "" || value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseBody = async <TBody>(request: Request) => {
  try {
    return (await request.json()) as TBody;
  } catch {
    return null;
  }
};

const normalizePayload = (body: IdPhotoMakeBody) => {
  const payload: IdPhotoMakeBody = {
    spec: toStringValue(body.spec),
    bk: toStringValue(body.bk),
  };

  const photo = toStringValue(body.photo);
  const photoType = toStringValue(body.type).toLowerCase();
  const photoKey = toStringValue(body.photo_key);
  const beautyDegree = toNumberValue(body.beauty_degree);

  if (photo) payload.photo = photo;
  if (photoType) payload.type = photoType;
  if (photoKey) payload.photo_key = photoKey;
  if (beautyDegree !== undefined) payload.beauty_degree = beautyDegree;

  return payload;
};

const validatePayload = (payload: IdPhotoMakeBody) => {
  if (!payload.photo && !payload.photo_key) return "photo or photo_key is required";
  if (payload.photo && !payload.type) return "type is required when photo is provided";
  if (payload.type && !["jpg", "png"].includes(payload.type)) return "type must be jpg or png";
  if (!payload.spec) return "spec is required";
  if (!payload.bk) return "bk is required";
  if (payload.beauty_degree !== undefined && (payload.beauty_degree < 1 || payload.beauty_degree > 5)) {
    return "beauty_degree must be in [1.0, 5.0]";
  }
  return "";
};

async function handleIdPhotoDownloadRequest(request: Request) {
  if (request.method !== "GET") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url") || "";
  let imageUrl: URL;

  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return json({ error: "Invalid image url" }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || imageUrl.hostname !== "oapi.aisegment.com") {
    return json({ error: "Unsupported image url" }, { status: 400 });
  }

  const upstream = await fetch(imageUrl.toString(), {
    headers: { Accept: "image/jpeg,image/png,image/*" },
  });

  if (!upstream.ok || !upstream.body) {
    return json(
      { error: "Image download failed", upstreamStatus: upstream.status },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("Content-Type") || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : "jpg";
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="idphoto-result.${extension}"`,
    "Cache-Control": "no-store",
  });

  return new Response(upstream.body, { status: 200, headers });
}

async function handleIdPhotoMakeRequest(
  request: Request,
  env: Record<string, unknown> | undefined,
) {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const body = await parseBody<IdPhotoMakeBody>(request);
  if (!body) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = normalizePayload(body);
  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ error: validationError }, { status: 400 });
  }

  const appCode = readEnv(env, "ALIYUN_IDPHOTO_APPCODE");
  if (!appCode || appCode === "YOUR_APP_CODE_HERE") {
    return json(
      {
        error: "AppCode is missing. Set ALIYUN_IDPHOTO_APPCODE in ESA environment variables.",
      },
      { status: 500 },
    );
  }

  const upstreamUrl =
    readEnv(env, "ALIYUN_IDPHOTO_URL") || "https://idp2.market.alicloudapi.com/idphoto/make";

  const sendUpstream = async () =>
    fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `APPCODE ${appCode}`,
        Accept: "application/json",
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

  let response: Response;
  try {
    const timeout = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error("Aliyun idphoto make request timeout")), 30000);
    });

    response = await Promise.race([
      sendUpstream(),
      timeout,
    ]);
  } catch (error: any) {
    return json({ error: error?.message || "Aliyun idphoto make request failed" }, { status: 502 });
  }

  let upstreamText = await response.text();

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
        error: "Aliyun idphoto make request failed",
        upstreamUrl,
        upstreamStatus: response.status,
        upstreamBody,
      },
      { status: 502 },
    );
  }

  return json(upstreamBody);
}

async function handleIdPhotoArrangeRequest(
  request: Request,
  env: Record<string, unknown> | undefined,
) {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const body = await parseBody<IdPhotoArrangeBody>(request);
  if (!body) {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const photoKey = toStringValue(body.photo_key);
  if (!photoKey) {
    return json({ error: "photo_key is required" }, { status: 400 });
  }

  const appCode = readEnv(env, "ALIYUN_IDPHOTO_APPCODE");
  if (!appCode || appCode === "YOUR_APP_CODE_HERE") {
    return json(
      {
        error: "AppCode is missing. Set ALIYUN_IDPHOTO_APPCODE in ESA environment variables.",
      },
      { status: 500 },
    );
  }

  const upstreamUrl =
    readEnv(env, "ALIYUN_IDPHOTO_ARRANGE_URL") ||
    ARRANGE_API_URL ||
    "https://idp2.market.alicloudapi.com/idphoto/arrange";

  const sendUpstream = async () =>
    fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `APPCODE ${appCode}`,
        Accept: "application/json",
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ photo_key: photoKey }),
    });

  let response: Response;
  try {
    const timeout = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error("Aliyun idphoto arrange request timeout")), 30000);
    });

    response = await Promise.race([sendUpstream(), timeout]);
  } catch (error: any) {
    return json({ error: error?.message || "Aliyun idphoto arrange request failed" }, { status: 502 });
  }

  let upstreamText = await response.text();

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
        error: "Aliyun idphoto arrange request failed",
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
    if (url.pathname === "/api/idphoto/download") {
      return handleIdPhotoDownloadRequest(request);
    }

    if (url.pathname === "/api/idphoto/arrange" || url.pathname === "/idphoto/arrange") {
      return handleIdPhotoArrangeRequest(request, env);
    }

    if (url.pathname === "/api/idphoto" || url.pathname === "/idphoto") {
      return handleIdPhotoMakeRequest(request, env);
    }

    if (!url.pathname.startsWith("/api/")) {
      return fetch(new URL("/index.html", request.url));
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
