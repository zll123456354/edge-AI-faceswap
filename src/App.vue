<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">AI 证件照</p>
        <h1>制作电子证件照</h1>
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

        <section class="choice-section" aria-label="证件照规格">
          <div class="choice-head">
            <span>证件照规格</span>
            <small>{{ selectedSpecLabel }}</small>
          </div>
          <div class="choice-grid">
            <button
              v-for="option in specOptions"
              :key="option.id"
              :class="['choice-card', { active: form.spec === option.id }]"
              type="button"
              @click="selectSpec(option.id)"
            >
              <strong>{{ option.name }}</strong>
              <span>{{ option.size }}</span>
            </button>
          </div>
        </section>

        <section class="choice-section" aria-label="背景颜色">
          <div class="choice-head">
            <span>背景颜色</span>
            <small>{{ selectedBackgroundLabel }}</small>
          </div>
          <div class="swatch-row">
            <button
              v-for="option in backgroundOptions"
              :key="option.value"
              :class="['swatch-button', { active: form.bk === option.value }]"
              type="button"
              @click="selectBackground(option.value)"
            >
              <i :style="{ background: option.color }" />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </section>

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

        <div class="delivery-card">
          <div>
            <p>下载权益</p>
            <strong>当前可免费下载电子照</strong>
          </div>
          <span>付费功能后续开启</span>
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
            <span :class="['status-pill', resultImage ? 'success' : 'idle']">
              {{ resultImage ? "已生成" : "待生成" }}
            </span>
          </div>

          <div class="image-stage result-stage">
            <img v-if="resultImage" :src="resultImage" alt="证件照结果" />
            <div v-else class="empty-state">提交后会在这里展示证件照成品。</div>
          </div>

          <div v-if="resultImage" class="download-panel">
            <div>
              <p>高清电子版</p>
              <strong>{{ selectedSpecLabel }} · {{ selectedBackgroundLabel }}</strong>
            </div>
            <div class="download-actions">
              <button
                class="text-button download-button"
                :disabled="arranging || !returnedPhotoKey"
                type="button"
                @click="arrangeResult"
              >
                {{ arranging ? "排版中..." : "生成排版照" }}
              </button>
              <button
                class="primary-button download-button"
                :disabled="downloading"
                type="button"
                @click="downloadResult"
              >
                {{ downloading ? "下载中..." : "下载电子证件照" }}
              </button>
            </div>
          </div>

          <div v-if="resultImage || returnedPhotoKey" class="result-meta">
            <span v-if="resultSize">尺寸 {{ resultSize }}</span>
            <span>格式 {{ resultMimeType === "png" ? "PNG" : "JPG" }}</span>
            <span v-if="returnedPhotoKey">照片凭证 {{ returnedPhotoKey }}</span>
          </div>

          <div v-if="resultImage" class="next-actions">
            <button class="text-button compact" type="button" @click="resetResult">重新生成</button>
            <button class="text-button compact" type="button" @click="clearPhoto">换一张照片</button>
          </div>

          <section v-if="arrangeImage" class="arrange-panel">
            <div class="choice-head">
              <span>打印排版照</span>
              <small>多张拼版</small>
            </div>
            <div class="image-stage arrange-stage">
              <img :src="arrangeImage" alt="证件照排版结果" />
            </div>
            <button
              class="primary-button download-button arrange-download"
              :disabled="downloadingArrange"
              type="button"
              @click="downloadArrangeResult"
            >
              {{ downloadingArrange ? "下载中..." : "下载排版照" }}
            </button>
          </section>

        </div>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { arrangeIdPhoto, createIdPhoto, type IdPhotoMakeRequest } from "./api/idphoto";

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
const arrangedResult = ref<unknown>(null);
const error = ref("");
const loading = ref(false);
const downloading = ref(false);
const arranging = ref(false);
const downloadingArrange = ref(false);

const specOptions = [
  { id: "12", name: "一寸照", size: "571 x 800" },
  { id: "1", name: "常用证件照", size: "按接口规格" },
  { id: "2", name: "二寸照", size: "常用尺寸" },
];

const backgroundOptions = [
  { value: "blue", label: "蓝底", color: "#3d97e8" },
  { value: "white", label: "白底", color: "#ffffff" },
  { value: "red", label: "红底", color: "#df3e4f" },
];

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

const selectSpec = (spec: string) => {
  form.spec = spec;
};

const selectBackground = (background: string) => {
  form.bk = background;
};

const switchMode = (mode: SourceMode) => {
  sourceMode.value = mode;
  error.value = "";
  result.value = null;
  arrangedResult.value = null;

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

const selectedSpecLabel = computed(() => {
  const option = specOptions.find((item) => item.id === form.spec);
  return option ? option.name : "自定义规格";
});

const selectedBackgroundLabel = computed(() => {
  const option = backgroundOptions.find((item) => item.value === form.bk);
  return option ? option.label : "自定义背景";
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

const extractImageFromResponse = (data: any) => {
  const candidates = [
    data?.photo,
    data?.image,
    data?.result_photo,
    data?.result_image,
    data?.arrange_photo,
    data?.arrange_image,
    data?.layout_photo,
    data?.layout_image,
    data?.print_photo,
    data?.print_image,
    data?.result,
    data?.data?.photo,
    data?.data?.image,
    data?.data?.result_photo,
    data?.data?.result_image,
    data?.data?.arrange_photo,
    data?.data?.arrange_image,
    data?.data?.layout_photo,
    data?.data?.layout_image,
    data?.data?.print_photo,
    data?.data?.print_image,
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
};

const resultImage = computed(() => {
  return extractImageFromResponse(result.value as any);
});

const arrangeImage = computed(() => {
  return extractImageFromResponse(arrangedResult.value as any);
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

const resetResult = () => {
  result.value = null;
  arrangedResult.value = null;
  error.value = "";
};

const clearPhoto = () => {
  resetResult();
  photoBase64.value = "";
  photoPreviewUrl.value = "";
  uploadedFileName.value = "";
  form.photo_key = "";
  sourceMode.value = "upload";
};

const copyResult = async () => {
  if (!result.value) return;
  await navigator.clipboard.writeText(formattedResult.value);
};

const arrangeResult = async () => {
  if (!returnedPhotoKey.value) {
    error.value = "当前结果缺少 photo_key，无法生成排版照。";
    return;
  }

  arranging.value = true;
  error.value = "";
  arrangedResult.value = null;

  try {
    arrangedResult.value = await arrangeIdPhoto({ photo_key: returnedPhotoKey.value });
  } catch (requestError: any) {
    error.value = requestError?.message || "证件照排版失败，请稍后重试。";
  } finally {
    arranging.value = false;
  }
};

const triggerBrowserDownload = (href: string, filenamePrefix = "idphoto-result") => {
  const extension = resultMimeType.value === "png" ? "png" : "jpg";
  const link = document.createElement("a");
  link.href = href;
  link.download = `${filenamePrefix}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const downloadImage = async (
  imageUrl: string,
  filenamePrefix: string,
  setDownloading: (value: boolean) => void,
  fallbackMessage: string,
) => {
  if (!imageUrl) return;

  if (!imageUrl.startsWith("http")) {
    triggerBrowserDownload(imageUrl, filenamePrefix);
    return;
  }

  setDownloading(true);
  try {
    const response = await fetch(`/api/idphoto/download?url=${encodeURIComponent(imageUrl)}`);
    if (!response.ok) throw new Error(`下载失败 (${response.status})`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, filenamePrefix);
    URL.revokeObjectURL(objectUrl);
  } catch (downloadError: any) {
    error.value = downloadError?.message || fallbackMessage;
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  } finally {
    setDownloading(false);
  }
};

const downloadResult = async () => {
  await downloadImage(resultImage.value, "idphoto-result", (value) => {
    downloading.value = value;
  }, "下载电子证件照失败。");
};

const downloadArrangeResult = async () => {
  await downloadImage(arrangeImage.value, "idphoto-arrange", (value) => {
    downloadingArrange.value = value;
  }, "下载排版照失败。");
};
</script>
