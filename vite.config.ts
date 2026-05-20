import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

declare const Buffer: any;
declare const Request: any;
declare const URL: any;
declare const console: any;
declare const process: { env: Record<string, string | undefined> };

const edgeMiddleware = () => {
  return {
    name: "edge-middleware",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith("/api/")) {
          next();
          return;
        }

        try {
          const url = new URL(req.url, "http://localhost");
          const handlerName = url.pathname.startsWith("/api/idphoto")
            ? "idphoto"
            : url.pathname.replace("/api/", "");
          const modulePath = `./edge/api/${handlerName}.ts`;
          const module = await server.ssrLoadModule(modulePath);
          const handler = module.default;

          if (!handler || typeof handler.fetch !== "function") {
            next();
            return;
          }

          const chunks: any[] = [];
          req.on("data", (chunk: any) => chunks.push(chunk));
          req.on("end", async () => {
            const body = Buffer.concat(chunks);
            const request = new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers: req.headers,
              body: ["GET", "HEAD"].includes(req.method) ? null : body,
            });

            const response = await handler.fetch(request, {
              ALIYUN_IDPHOTO_APPCODE: process.env.ALIYUN_IDPHOTO_APPCODE || "",
              ALIYUN_IDPHOTO_URL: process.env.ALIYUN_IDPHOTO_URL || "",
              ALIYUN_IDPHOTO_ARRANGE_URL: process.env.ALIYUN_IDPHOTO_ARRANGE_URL || "",
            });

            res.statusCode = response.status;
            response.headers.forEach((value: string, key: string) => {
              res.setHeader(key, value);
            });
            res.end(await response.text());
          });
        } catch (error) {
          console.error("Edge execution error:", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), edgeMiddleware()],
})
