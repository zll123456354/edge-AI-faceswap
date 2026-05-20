<template>
  <main class="app-shell">
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">Aliyun ESA Studio</p>
        <h1>证件照制作</h1>
        <p class="summary">
          上传 JPG 或 PNG，自动转成接口要求的原始 Base64，由 ESA 代发到阿里云
          `idphoto/arrange`。同一张图也可以直接复用 `photo_key`，减少重复传输。
        </p>
        <div class="hero-notes">
          <span>浏览器不暴露 AppCode</span>
          <span>支持 photo_key 联动</span>
          <span>可调背景色与尺寸</span>
        </div>
      </div>

      <aside class="hero-card">
        <p class="card-kicker">接口规则</p>
        <ul class="rule-list">
          <li>`photo` 传原始 Base64，不带 `data:image/...` 前缀。</li>
          <li>`photo_key` 模式下，不再传 `photo` 和 `type`。</li>
          <li>使用 `size` 时，`spec` 必须为 `12`。</li>
        </ul>
      </aside>
    </section>

    <section class="workspace">
      <form class="control-panel" @submit.prevent="submit">
        <div class="section-head">
          <div>
            <p class="section-label">输入方式</p>
            <h2>制作参数</h2>
          </div>
          <button class="ghost-button" type="button" @click="applyPreset">常用预设</button>
        </div>

        <div class="mode-switch" role="tablist" aria-label="source mode">
          <button
            :class="['mode-button', { active: sourceMode === 'upload' }]"
            type="button"
            @click="switchMode('upload')"
          >
            上传图片
          </button>
          <button
            :class="['mode-button', { active: sourceMode === 'photo_key' }]"
            type="button"
            @click="switchMode('photo_key')"
          >
            使用 photo_key
          </button>
        </div>

        <div v-if="sourceMode === 'upload'" class="upload-box">
          <label class="upload-button">
            <input accept="image/jpeg,image/png" class="hidden-input" type="file" @change="handleFileChange" />
            <span>{{ uploadedFileName || "选择 JPG / PNG" }}</span>
          </label>
          <p class="field-help">上传后会自动转成原始 Base64，并去掉 data URL 头信息。</p>
        </div>

        <label v-else>
          <span>photo_key</span>
          <input v-model.trim="form.photo_key" placeholder="环境检测接口返回的 photo_key" />
        </label>

        <div class="form-grid">
          <label>
            <span>spec</span>
            <input v-model.trim="form.spec" placeholder="证件照规格 ID，如 1 或 12" />
          </label>

          <label>
            <span>bk</span>
            <input v-model.trim="form.bk" placeholder="blue / red / white / #RRGGBB" />
          </label>
        </div>

        <div class="form-grid">
          <label>
            <span>size</span>
            <input v-model.trim="form.size" placeholder='可选，示例 "480x640"' />
          </label>

          <label>
            <span>dpi</span>
            <input v-model.trim="form.dpi" inputmode="numeric" placeholder="可选，默认 300" />
          </label>
        </div>

        <details class="advanced-panel">
          <summary>更多可选参数</summary>
          <div class="advanced-grid">
            <label>
              <span>beauty_degree</span>
              <input v-model.trim="form.beauty_degree" placeholder="1.0 - 5.0" />
            </label>

            <label>
              <span>file_size</span>
              <input v-model.trim="form.file_size" placeholder='例如 "10,100"' />
            </label>

            <label>
              <span>face_ratio</span>
              <input v-model.trim="form.face_ratio" placeholder="0 - 1.0" />
            </label>

            <label>
              <span>face_center_y</span>
              <input v-model.trim="form.face_center_y" placeholder="默认 0.45" />
            </label>

            <label>
              <span>top_empty</span>
              <input v-model.trim="form.top_empty" placeholder='例如 "10,30"' />
            </label>

            <label class="toggle">
              <input v-model="form.with_photo_key" type="checkbox" />
              <span>返回 photo_key</span>
            </label>

            <label class="toggle">
              <input v-model="form.head_pose_correct" type="checkbox" />
              <span>开启头部正姿</span>
            </label>
          </div>
        </details>

        <div v-if="error" class="message error">{{ error }}</div>

        <button class="primary-button" :disabled="loading || !isReady" type="submit">
          {{ loading ? "制作中..." : "开始制作证件照" }}
        </button>
      </form>

      <div class="preview-stack">
        <section class="preview-card">
          <div class="section-head compact-head">
            <div>
              <p class="section-label">输入预览</p>
              <h2>原始照片</h2>
            </div>
            <span class="mini-note">{{ sourceMode === "upload" ? (form.type || "jpg").toUpperCase() : "photo_key" }}</span>
          </div>

          <div class="image-stage">
            <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="上传预览" />
            <div v-else class="empty-state">
              {{ sourceMode === "upload" ? "等待上传照片" : "photo_key 模式下不展示原图" }}
            </div>
          </div>
        </section>

        <section class="preview-card">
          <div class="section-head compact-head">
            <div>
              <p class="section-label">接口响应</p>
              <h2>制作结果</h2>
            </div>
            <div class="action-row">
              <button v-if="resultImage" class="ghost-button compact" type="button" @click="downloadResult">
                下载图片
              </button>
              <button v-if="result" class="ghost-button compact" type="button" @click="copyResult">
                复制 JSON
              </button>
            </div>
          </div>

          <div class="image-stage result-stage">
            <img v-if="resultImage" :src="resultImage" alt="证件照结果" />
            <div v-else class="empty-state">提交后会在这里展示证件照成品。</div>
          </div>

          <div v-if="returnedPhotoKey" class="meta-chip">返回 photo_key: {{ returnedPhotoKey }}</div>
          <pre v-if="result" class="result-json">{{ formattedResult }}</pre>
        </section>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { createIdPhoto, type IdPhotoArrangeRequest } from "./api/idphoto";

type SourceMode = "upload" | "photo_key";
type FormState = {
  photo_key: string;
  type: "jpg" | "png";
  spec: string;
  bk: string;
  beauty_degree: string;
  size: string;
  file_size: string;
  dpi: string;
  face_ratio: string;
  face_center_y: string;
  top_empty: string;
  with_photo_key: boolean;
  head_pose_correct: boolean;
};

const sourceMode = ref<SourceMode>("upload");
const uploadedFileName = ref("");
const photoBase64 = ref("");
const photoPreviewUrl = ref("");
const result = ref<unknown>(null);
const error = ref("");
const loading = ref(false);

const form = reactive<FormState>({
  photo_key: "",
  type: "jpg",
  spec: "",
  bk: "blue",
  beauty_degree: "",
  size: "",
  file_size: "",
  dpi: "300",
  face_ratio: "",
  face_center_y: "0.45",
  top_empty: "",
  with_photo_key: true,
  head_pose_correct: false,
});

const applyPreset = () => {
  form.spec = "12";
  form.bk = "blue";
  form.size = "480x640";
  form.dpi = "300";
  form.face_center_y = "0.45";
  form.with_photo_key = true;
  form.head_pose_correct = false;
};

const switchMode = (mode: SourceMode) => {
  sourceMode.value = mode;
  error.value = "";
  result.value = null;

  if (mode === "upload") {
    form.photo_key = "";
  } else {
    photoBase64.value = "";
    photoPreviewUrl.value = "";
    uploadedFileName.value = "";
  }
};

const isReady = computed(() => {
  const hasSource = sourceMode.value === "upload" ? Boolean(photoBase64.value) : Boolean(form.photo_key);
  return Boolean(hasSource && form.spec.trim() && form.bk.trim());
});

const formattedResult = computed(() => JSON.stringify(result.value, null, 2));

const resultMimeType = computed(() => {
  const data = result.value as any;
  const candidates = [
    data?.type,
    data?.photo_type,
    data?.data?.type,
    data?.data?.photo_type,
    form.type,
  ];
  const hit = candidates.find((value) => value === "png" || value === "jpg" || value === "jpeg");
  return hit === "png" ? "png" : "jpeg";
});

const normalizeBase64Image = (value: string) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/")) {
    return value;
  }

  const compact = value.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 100) {
    return `data:image/${resultMimeType.value};base64,${compact}`;
  }

  return "";
};

const resultImage = computed(() => {
  const data = result.value as any;
  const candidates = [
    data?.photo,
    data?.image,
    data?.result_photo,
    data?.result_image,
    data?.data?.photo,
    data?.data?.image,
    data?.data?.result_photo,
    data?.data?.result_image,
    data?.url,
    data?.data?.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = normalizeBase64Image(candidate);
      if (normalized) return normalized;
    }
  }

  return "";
});

const returnedPhotoKey = computed(() => {
  const data = result.value as any;
  const candidates = [data?.photo_key, data?.data?.photo_key];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
});

const parseFloatField = (value: string) => {
  if (!value.trim()) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseIntField = (value: string) => {
  if (!value.trim()) return undefined;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const validateForm = () => {
  if (sourceMode.value === "upload" && !photoBase64.value) return "请先上传一张 JPG 或 PNG 图片。";
  if (sourceMode.value === "photo_key" && !form.photo_key.trim()) return "请填写 photo_key。";
  if (!form.spec.trim()) return "spec 为必填项。";
  if (!form.bk.trim()) return "bk 为必填项。";
  if (form.size.trim() && form.spec.trim() !== "12") return "使用 size 时，spec 必须设置为 12。";

  const beautyDegree = parseFloatField(form.beauty_degree);
  if (beautyDegree !== undefined && (beautyDegree < 1 || beautyDegree > 5)) {
    return "beauty_degree 需要在 1.0 到 5.0 之间。";
  }

  const faceRatio = parseFloatField(form.face_ratio);
  if (faceRatio !== undefined && (faceRatio <= 0 || faceRatio > 1)) {
    return "face_ratio 需要在 0 到 1.0 之间。";
  }

  const faceCenterY = parseFloatField(form.face_center_y);
  if (faceCenterY !== undefined && (faceCenterY <= 0 || faceCenterY >= 1)) {
    return "face_center_y 需要在 0 到 1.0 之间。";
  }

  return "";
};

const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!["image/jpeg", "image/png"].includes(file.type)) {
    error.value = "只支持 JPG 和 PNG 图片。";
    input.value = "";
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const [prefix, rawBase64] = dataUrl.split(",");
    photoBase64.value = rawBase64 || "";
    photoPreviewUrl.value = dataUrl;
    uploadedFileName.value = file.name;
    form.type = prefix.includes("png") ? "png" : "jpg";
    error.value = "";
    result.value = null;
  } catch (readError: any) {
    error.value = readError?.message || "读取图片失败。";
  } finally {
    input.value = "";
  }
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("无法读取图片文件"));
    reader.readAsDataURL(file);
  });

const buildPayload = () => {
  const payload: IdPhotoArrangeRequest = {
    spec: form.spec.trim(),
    bk: form.bk.trim(),
    with_photo_key: form.with_photo_key ? 1 : 0,
  };

  if (sourceMode.value === "upload") {
    payload.photo = photoBase64.value;
    payload.type = form.type;
  } else {
    payload.photo_key = form.photo_key.trim();
  }

  if (form.size.trim()) payload.size = form.size.trim();
  if (form.file_size.trim()) payload.file_size = form.file_size.trim();

  const beautyDegree = parseFloatField(form.beauty_degree);
  const dpi = parseIntField(form.dpi);
  const faceRatio = parseFloatField(form.face_ratio);
  const faceCenterY = parseFloatField(form.face_center_y);

  if (beautyDegree !== undefined) payload.beauty_degree = beautyDegree;
  if (dpi !== undefined) payload.dpi = dpi;
  if (faceRatio !== undefined) payload.face_ratio = faceRatio;
  if (faceCenterY !== undefined) payload.face_center_y = faceCenterY;
  if (form.top_empty.trim()) payload.top_empty = form.top_empty.trim();
  if (form.head_pose_correct) payload.head_pose_correct = true;

  return payload;
};

const submit = async () => {
  const validationError = validateForm();
  if (validationError) {
    error.value = validationError;
    return;
  }

  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    result.value = await createIdPhoto(buildPayload());
  } catch (requestError: any) {
    error.value = requestError?.message || "证件照制作失败，请稍后重试。";
  } finally {
    loading.value = false;
  }
};

const copyResult = async () => {
  if (!result.value) return;
  await navigator.clipboard.writeText(formattedResult.value);
};

const downloadResult = () => {
  if (!resultImage.value) return;
  const link = document.createElement("a");
  link.href = resultImage.value;
  link.download = `idphoto-result.${resultMimeType.value === "png" ? "png" : "jpg"}`;
  link.click();
};
</script>
