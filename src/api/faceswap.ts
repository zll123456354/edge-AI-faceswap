export type FaceSwapRequest = {
  img_url?: string;
  template_id: number;
  custom_watermark?: string;
  out_request_id: string;
  mt_check_id?: string;
};

const readJsonOrText = async (response: Response) => {
  const text = await response.text();
  if (!text) return { json: null as unknown, text: "" };

  try {
    return { json: JSON.parse(text) as unknown, text };
  } catch {
    return { json: null as unknown, text };
  }
};

export async function createFaceSwap(payload: FaceSwapRequest) {
  const response = await fetch("/api/faceswap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const parsed = await readJsonOrText(response);
  if (!response.ok) {
    const body = parsed.json as any;
    const details = [
      body?.error || body?.message || `Request failed (${response.status})`,
      body?.upstreamStatus ? `upstreamStatus: ${body.upstreamStatus}` : "",
      body?.upstreamUrl ? `upstreamUrl: ${body.upstreamUrl}` : "",
      body?.upstreamBody
        ? `upstreamBody: ${
            typeof body.upstreamBody === "string"
              ? body.upstreamBody
              : JSON.stringify(body.upstreamBody)
          }`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    throw new Error(details || parsed.text || `Request failed (${response.status})`);
  }

  return parsed.json;
}
