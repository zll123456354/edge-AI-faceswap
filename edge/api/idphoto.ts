import { API_URL, APP_CODE } from "../env";

type IdPhotoArrangeBody = {
  photo?: string;
  type?: string;
  photo_key?: string;
  with_photo_key?: number;
  spec?: string;
  bk?: string;
  beauty_degree?: number;
  size?: string;
  file_size?: string;
  dpi?: number;
  face_ratio?: number;
  face_center_y?: number;
  top_empty?: string;
  head_pose_correct?: boolean | string | number;
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

const toBooleanLike = (value: unknown) => {
  if (value === true || value === false) return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return undefined;
};

const parseBody = async (request: Request) => {
  try {
    return (await request.json()) as IdPhotoArrangeBody;
  } catch {
    return null;
  }
};

const normalizePayload = (body: IdPhotoArrangeBody) => {
  const payload: IdPhotoArrangeBody = {
    spec: toStringValue(body.spec),
    bk: toStringValue(body.bk),
  };

  const photo = toStringValue(body.photo);
  const photoType = toStringValue(body.type).toLowerCase();
  const photoKey = toStringValue(body.photo_key);
  const size = toStringValue(body.size);
  const fileSize = toStringValue(body.file_size);
  const topEmpty = toStringValue(body.top_empty);
  const withPhotoKey = toNumberValue(body.with_photo_key);
  const beautyDegree = toNumberValue(body.beauty_degree);
  const dpi = toNumberValue(body.dpi);
  const faceRatio = toNumberValue(body.face_ratio);
  const faceCenterY = toNumberValue(body.face_center_y);
  const headPoseCorrect = toBooleanLike(body.head_pose_correct);

  if (photo) payload.photo = photo;
  if (photoType) payload.type = photoType;
  if (photoKey) payload.photo_key = photoKey;
  if (size) payload.size = size;
  if (fileSize) payload.file_size = fileSize;
  if (topEmpty) payload.top_empty = topEmpty;
  if (withPhotoKey !== undefined) payload.with_photo_key = withPhotoKey;
  if (beautyDegree !== undefined) payload.beauty_degree = beautyDegree;
  if (dpi !== undefined) payload.dpi = dpi;
  if (faceRatio !== undefined) payload.face_ratio = faceRatio;
  if (faceCenterY !== undefined) payload.face_center_y = faceCenterY;
  if (headPoseCorrect !== undefined) payload.head_pose_correct = headPoseCorrect;

  return payload;
};

const validatePayload = (payload: IdPhotoArrangeBody) => {
  if (!payload.photo && !payload.photo_key) return "photo or photo_key is required";
  if (payload.photo && payload.photo_key) return "photo and photo_key are mutually exclusive";
  if (payload.photo && !payload.type) return "type is required when photo is provided";
  if (payload.type && !["jpg", "png"].includes(payload.type)) return "type must be jpg or png";
  if (!payload.spec) return "spec is required";
  if (!payload.bk) return "bk is required";
  if (payload.size && payload.spec !== "12") return "size requires spec to be 12";
  if (payload.beauty_degree !== undefined && (payload.beauty_degree < 1 || payload.beauty_degree > 5)) {
    return "beauty_degree must be in [1.0, 5.0]";
  }
  if (payload.face_ratio !== undefined && (payload.face_ratio <= 0 || payload.face_ratio > 1)) {
    return "face_ratio must be in (0, 1.0]";
  }
  if (
    payload.face_center_y !== undefined &&
    (payload.face_center_y <= 0 || payload.face_center_y >= 1)
  ) {
    return "face_center_y must be in (0, 1.0)";
  }
  return "";
};

async function handleIdPhotoArrangeRequest(
  request: Request,
  env: Record<string, unknown> | undefined,
) {
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
    readEnv(env, "ALIYUN_IDPHOTO_URL") || "https://idp2.market.alicloudapi.com/idphoto/arrange";

  let response: Response;
  try {
    const timeout = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error("Aliyun idphoto arrange request timeout")), 30000);
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
    return json({ error: error?.message || "Aliyun idphoto arrange request failed" }, { status: 502 });
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
    if (url.pathname === "/api/idphoto" || url.pathname === "/idphoto") {
      return handleIdPhotoArrangeRequest(request, env);
    }

    if (!url.pathname.startsWith("/api/")) {
      return fetch(new URL("/index.html", request.url));
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
