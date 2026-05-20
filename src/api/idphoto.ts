export type IdPhotoArrangeRequest = {
  photo?: string;
  type?: "jpg" | "png";
  photo_key?: string;
  with_photo_key?: 0 | 1;
  spec: string;
  bk: string;
  beauty_degree?: number;
  size?: string;
  file_size?: string;
  dpi?: number;
  face_ratio?: number;
  face_center_y?: number;
  top_empty?: string;
  head_pose_correct?: boolean;
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

export async function createIdPhoto(payload: IdPhotoArrangeRequest) {
  const response = await fetch("/api/idphoto", {
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
