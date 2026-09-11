import type { Express, Request, Response, RequestHandler } from "express";
import { openai } from "./client";

type ImageClient = {
  images: {
    generate(input: {
      model: string;
      prompt: string;
      n: number;
      size: "1024x1024" | "512x512" | "256x256";
    }): Promise<{ data?: Array<{ url?: string | null; b64_json?: string | null }> }>;
  };
};

export type ImageRouteOptions = {
  authenticate: RequestHandler;
  checkAiCredits: RequestHandler;
  settleAiCredit: (req: Request, userId: string, usageType: string, description: string) => Promise<boolean>;
  imageClient?: ImageClient;
};

const VALID_IMAGE_SIZES = new Set(["1024x1024", "512x512", "256x256"]);

export function registerImageRoutes(app: Express, options: ImageRouteOptions): void {
  const imageClient = options.imageClient ?? openai;

  app.post("/api/generate-image", options.authenticate, options.checkAiCredits, async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body ?? {};

      if (typeof prompt !== "string" || !prompt.trim() || prompt.trim().length > 4_000) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (typeof size !== "string" || !VALID_IMAGE_SIZES.has(size)) {
        return res.status(400).json({ error: "Invalid image size" });
      }

      const response = await imageClient.images.generate({
        model: "gpt-image-1",
        prompt: prompt.trim(),
        n: 1,
        size: size as "1024x1024" | "512x512" | "256x256",
      });

      const imageData = response.data?.[0];
      if (!imageData) {
        throw new Error("Image API returned no image data");
      }
      const userId = (req as any).user?.claims?.sub;
      if (!userId || !(await options.settleAiCredit(req, userId, "image", "رسوم توليد صورة بالذكاء الاصطناعي"))) {
        return res.status(402).json({ error: "insufficient_credits" });
      }
      res.json({
        url: imageData.url,
        b64_json: imageData.b64_json,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}

