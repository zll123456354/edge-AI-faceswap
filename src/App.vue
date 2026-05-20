<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">AI 证件照</p>
        <h1>制作电子证件照</h1>
      </div>
      <div class="trust-strip" aria-label="service highlights">
        <span>JPG / PNG</span>
        <span>标准规格</span>
        <span>高清下载</span>
      </div>
    </header>

    <section class="progress-strip" aria-label="制作流程">
      <div class="progress-item active">
        <strong>1</strong>
        <span>上传照片</span>
      </div>
      <div :class="['progress-item', { active: isReady }]">
        <strong>2</strong>
        <span>选择规格</span>
      </div>
      <div :class="['progress-item', { active: Boolean(resultImage) }]">
        <strong>3</strong>
        <span>下载电子照</span>
      </div>
    </section>

    <section class="workspace">
      <form class="task-panel" @submit.prevent="submit">
        <div class="panel-head">
          <div>
            <p class="section-label">照片来源</p>
            <h2>上传或复用照片</h2>
          </div>
          <button class="text-button" type="button" @click="applyPreset">一寸蓝底</button>
        </div>

        <div class="mode-switch" role="tablist" aria-label="照片来源">
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
            使用照片凭证
          </button>
        </div>

        <div v-if="sourceMode === 'upload'" class="upload-box">
          <label class="upload-button">
            <input accept="image/jpeg,image/png" class="hidden-input" type="file" @change="handleFileChange" />
            <span>{{ uploadedFileName || "选择 JPG / PNG" }}</span>
          </label>
          <p class="field-help">建议使用正面半身照，五官清晰、光线均匀。</p>
        </div>

        <label v-else>
          <span>照片凭证</span>
          <input v-model.trim="form.photo_key" placeholder="输入检测后生成的照片凭证" />
        </label>

        <div class="form-grid">
          <label>
            <span>证件照规格</span>
            <input v-model.trim="form.spec" placeholder="证件照规格 ID，如 1 或 12" />
          </label>

          <label>
            <span>背景颜色</span>
            <input v-model.trim="form.bk" placeholder="blue / red / white / #RRGGBB" />
          </label>
        </div>

        <details class="advanced-panel">
          <summary>更多可选参数</summary>
          <div class="advanced-grid">
            <label>
              <span>美颜强度</span>
              <input v-model.trim="form.beauty_degree" placeholder="可选，1.0 - 5.0" />
            </label>
          </div>
        </details>

        <div v-if="error" class="message error">{{ error }}</div>

        <button class="primary-button" :disabled="loading || !isReady" type="submit">
          {{ loading ? "制作中..." : "开始制作证件照" }}
        </button>

        <div class="checkout-preview">
          <div>
            <p>电子照交付</p>
            <strong>高清文件下载</strong>
          </div>
          <span>待接入支付</span>
        </div>
      </form>

      <section class="preview-panel">
        <div class="preview-column">
          <div class="panel-head compact-head">
            <div>
              <p class="section-label">当前照片</p>
              <h2>原始照片</h2>
            </div>
            <span class="mini-note">{{ sourceMode === "upload" ? (form.type || "jpg").toUpperCase() : "照片凭证" }}</span>
          </div>

          <div class="image-stage">
            <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="上传预览" />
            <div v-else class="empty-state">
              {{ sourceMode === "upload" ? "等待上传照片" : "照片凭证模式下不展示原图" }}
            </div>
          </div>
        </div>

        <div class="preview-column result-column">
          <div class="panel-head compact-head">
            <div>
              <p class="section-label">成品预览</p>
              <h2>电子证件照</h2>
            </div>
            <div class="action-row">
              <button
                v-if="resultImage"
                class="ghost-button compact"
                :disabled="downloading"
                type="button"
                @click="downloadResult"
              >
                {{ downloading ? "下载中..." : "下载电子证件照" }}
              </button>
            </div>
          </div>

          <div class="image-stage result-stage">
            <img v-if="resultImage" :src="resultImage" alt="证件照结果" />
            <div v-else class="empty-state">提交后会在这里展示证件照成品。</div>
          </div>

          <div v-if="resultImage || returnedPhotoKey" class="result-meta">
            <span v-if="resultSize">尺寸 {{ resultSize }}</span>
            <span v-if="returnedPhotoKey">照片凭证 {{ returnedPhotoKey }}</span>
          </div>
          <details v-if="result" class="result-detail">
            <summary>接口明细</summary>
            <button class="text-button compact" type="button" @click="copyResult">复制 JSON</button>
            <pre class="result-json">{{ formattedResult }}</pre>
          </details>
        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { createIdPhoto, type IdPhotoMakeRequest } from "./api/idphoto";

type SourceMode = "upload" | "photo_key";
type FormState = {
  photo_key: string;
  type: "jpg" | "png";
  spec: string;
  bk: string;
  beauty_degree: string;
};

const sourceMode = ref<SourceMode>("upload");
const uploadedFileName = ref("");
const photoBase64 = ref("");
const photoPreviewUrl = ref("");
const result = ref<unknown>(null);
const error = ref("");
const loading = ref(false);
const downloading = ref(false);

const form = reactive<FormState>({
  photo_key: "",
  type: "jpg",
  spec: "",
  bk: "blue",
  beauty_degree: "",
});

const applyPreset = () => {
  form.spec = "12";
  form.bk = "blue";
  form.beauty_degree = "1.5";
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
    data?.data?.result,
    data?.data?.type,
    data?.data?.photo_type,
    form.type,
  ];
  const hit = candidates.find((value) => typeof value === "string" && /(png|jpe?g)(?:$|\?)/i.test(value));
  return hit && /png/i.test(hit) ? "png" : "jpeg";
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
    data?.result,
    data?.data?.photo,
    data?.data?.image,
    data?.data?.result_photo,
    data?.data?.result_image,
    data?.data?.result,
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

const resultSize = computed(() => {
  const data = result.value as any;
  const size = data?.size || data?.data?.size;
  if (!Array.isArray(size) || size.length < 2) return "";
  const [width, height] = size;
  return Number.isFinite(Number(width)) && Number.isFinite(Number(height)) ? `${width} x ${height}` : "";
});

const parseFloatField = (value: string) => {
  if (!value.trim()) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const validateForm = () => {
  if (sourceMode.value === "upload" && !photoBase64.value) return "请先上传一张 JPG 或 PNG 图片。";
  if (sourceMode.value === "photo_key" && !form.photo_key.trim()) return "请填写 photo_key。";
  if (!form.spec.trim()) return "spec 为必填项。";
  if (!form.bk.trim()) return "bk 为必填项。";

  const beautyDegree = parseFloatField(form.beauty_degree);
  if (beautyDegree !== undefined && (beautyDegree < 1 || beautyDegree > 5)) {
    return "beauty_degree 需要在 1.0 到 5.0 之间。";
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
  const payload: IdPhotoMakeRequest = {
    spec: form.spec.trim(),
    bk: form.bk.trim(),
  };

  if (sourceMode.value === "upload") {
    payload.photo = photoBase64.value;
    payload.type = form.type;
  } else {
    payload.photo_key = form.photo_key.trim();
  }

  const beautyDegree = parseFloatField(form.beauty_degree);

  if (beautyDegree !== undefined) payload.beauty_degree = beautyDegree;

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

const triggerBrowserDownload = (href: string) => {
  const extension = resultMimeType.value === "png" ? "png" : "jpg";
  const link = document.createElement("a");
  link.href = href;
  link.download = `idphoto-result.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadResult = async () => {
  if (!resultImage.value) return;

  if (!resultImage.value.startsWith("http")) {
    triggerBrowserDownload(resultImage.value);
    return;
  }

  downloading.value = true;
  try {
    const response = await fetch(`/api/idphoto/download?url=${encodeURIComponent(resultImage.value)}`);
    if (!response.ok) throw new Error(`下载失败 (${response.status})`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl);
    URL.revokeObjectURL(objectUrl);
  } catch (downloadError: any) {
    error.value = downloadError?.message || "下载电子证件照失败。";
    window.open(resultImage.value, "_blank", "noopener,noreferrer");
  } finally {
    downloading.value = false;
  }
};
</script>
