<template>
  <main class="app-shell">
    <section class="workspace">
      <div class="intro">
        <p class="eyebrow">Aliyun ESA Edge AI</p>
        <h1>AI 人像换装</h1>
        <p class="summary">
          传入图片 URL 或美图 Check ID 其中一种方式，由 ESA 边缘函数安全转发到阿里云美图 AI 人像换脸接口。
        </p>
        <div class="trust-row">
          <span>AppCode 不进入浏览器</span>
          <span>边缘节点代理请求</span>
          <span>支持自定义水印</span>
        </div>
      </div>

      <form class="control-panel" @submit.prevent="submit">
        <div class="panel-header">
          <div>
            <p class="section-label">生成参数</p>
            <h2>创建换装任务</h2>
          </div>
          <button class="ghost-button" type="button" @click="fillDemo">示例</button>
        </div>

        <label>
          <span>用户图片 URL</span>
          <input
            v-model.trim="form.img_url"
            :disabled="Boolean(form.mt_check_id)"
            placeholder="和 Check ID 二选一"
            type="url"
          />
        </label>

        <div class="form-grid">
          <label>
            <span>模板 ID</span>
            <input v-model.number="form.template_id" min="1" step="1" type="number" />
          </label>

          <label>
            <span>美图 Check ID</span>
            <input
              v-model.trim="form.mt_check_id"
              :disabled="Boolean(form.img_url)"
              placeholder="和图片 URL 二选一"
            />
          </label>
        </div>

        <label>
          <span>外部请求唯一 ID</span>
          <div class="inline-input">
            <input v-model.trim="form.out_request_id" placeholder="每张图片唯一" />
            <button class="icon-button" type="button" title="生成请求 ID" @click="regenerateRequestId">
              ↻
            </button>
          </div>
        </label>

        <label>
          <span>水印图片 URL</span>
          <input v-model.trim="form.custom_watermark" placeholder="可选" type="url" />
        </label>

        <div v-if="error" class="message error">{{ error }}</div>

        <button class="primary-button" :disabled="loading || !isReady" type="submit">
          {{ loading ? "生成中..." : "开始 AI 换装" }}
        </button>
      </form>
    </section>

    <section class="preview-grid">
      <div class="preview-pane">
        <div class="pane-header">
          <p class="section-label">输入预览</p>
          <span v-if="form.template_id">Template #{{ form.template_id }}</span>
        </div>
        <div class="image-frame">
          <img
            v-if="form.img_url"
            :src="form.img_url"
            alt="用户上传图片预览"
            @error="imageFailed = true"
            @load="imageFailed = false"
          />
          <div v-else class="empty-state">等待图片 URL</div>
          <div v-if="imageFailed" class="image-warning">图片无法加载，请检查 URL 是否可公开访问。</div>
        </div>
      </div>

      <div class="preview-pane">
        <div class="pane-header">
          <p class="section-label">接口响应</p>
          <button v-if="result" class="ghost-button compact" type="button" @click="copyResult">复制 JSON</button>
        </div>

        <div v-if="resultImage" class="image-frame">
          <img :src="resultImage" alt="AI 换装结果" />
        </div>

        <pre v-if="result" class="result-json">{{ formattedResult }}</pre>
        <div v-else class="empty-state tall">
          提交后将在这里展示阿里云返回的完整 JSON 和可识别的结果图片。
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { createFaceSwap, type FaceSwapRequest } from "./api/faceswap";

const createRequestId = () => {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const form = reactive<FaceSwapRequest>({
  img_url: "",
  template_id: 66,
  custom_watermark: "",
  out_request_id: createRequestId(),
  mt_check_id: "",
});

const loading = ref(false);
const error = ref("");
const result = ref<unknown>(null);
const imageFailed = ref(false);

const isReady = computed(() => {
  const hasImgUrl = Boolean(form.img_url);
  const hasCheckId = Boolean(form.mt_check_id);
  return Boolean(
    (hasImgUrl || hasCheckId) &&
      !(hasImgUrl && hasCheckId) &&
      Number.isInteger(Number(form.template_id)) &&
      Number(form.template_id) > 0 &&
      form.out_request_id,
  );
});

const formattedResult = computed(() => JSON.stringify(result.value, null, 2));

const resultImage = computed(() => {
  const data = result.value as any;
  const candidates = [
    data?.result_url,
    data?.image_url,
    data?.img_url,
    data?.data?.result_url,
    data?.data?.image_url,
    data?.data?.img_url,
    data?.data?.url,
  ];
  return candidates.find((item) => typeof item === "string" && /^https?:\/\//.test(item)) || "";
});

const regenerateRequestId = () => {
  form.out_request_id = createRequestId();
};

const fillDemo = () => {
  form.img_url = "https://biz-idphoto-pre.meitudata.com/idphoto-public/1718612664021438042-135353.png";
  form.template_id = 66;
  form.custom_watermark = "";
  form.out_request_id = createRequestId();
  form.mt_check_id = "";
  error.value = "";
  result.value = null;
};

const submit = async () => {
  if (!isReady.value) {
    error.value = "请填写模板 ID、请求 ID，并在图片 URL 和 mt_check_id 中二选一。";
    return;
  }

  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    const payload: FaceSwapRequest = {
      template_id: Number(form.template_id),
      out_request_id: form.out_request_id,
    };

    if (form.img_url) {
      payload.img_url = form.img_url;
    }

    if (form.mt_check_id) {
      payload.mt_check_id = form.mt_check_id;
    }

    if (form.custom_watermark) {
      payload.custom_watermark = form.custom_watermark;
    }

    result.value = await createFaceSwap(payload);
  } catch (err: any) {
    error.value = err?.message || "生成失败，请稍后重试。";
  } finally {
    loading.value = false;
  }
};

const copyResult = async () => {
  if (!result.value) return;
  await navigator.clipboard.writeText(formattedResult.value);
};
</script>
