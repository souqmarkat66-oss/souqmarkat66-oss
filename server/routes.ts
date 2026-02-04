import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerImageRoutes, openai } from "./replit_integrations/image";

// Middleware to check if user owns the ad
async function checkAdOwnership(req: any, res: any, next: any) {
  const id = Number(req.params.id);
  const ad = await storage.getAd(id);
  
  if (!ad) {
    return res.status(404).json({ message: "Ad not found" });
  }

  if (ad.userId !== req.user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register Image Generation Routes
  registerImageRoutes(app);

  // Ad Routes
  app.get(api.ads.list.path, async (req, res) => {
    const language = req.query.language as string | undefined;
    const ads = await storage.getAds(language);
    res.json(ads);
  });

  app.get(api.ads.get.path, async (req, res) => {
    const ad = await storage.getAd(Number(req.params.id));
    if (!ad) {
      return res.status(404).json({ message: "Ad not found" });
    }
    res.json(ad);
  });

  app.post(api.ads.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.ads.create.input.parse(req.body);
      
      // Force userId from authenticated user
      const adData = {
        ...input,
        userId: req.user.claims.sub
      };

      const ad = await storage.createAd(adData);
      res.status(201).json(ad);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.ads.update.path, isAuthenticated, checkAdOwnership, async (req, res) => {
    try {
      const input = api.ads.update.input.parse(req.body);
      const ad = await storage.updateAd(Number(req.params.id), input);
      res.json(ad);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.ads.delete.path, isAuthenticated, checkAdOwnership, async (req, res) => {
    await storage.deleteAd(Number(req.params.id));
    res.status(204).send();
  });

  // AI Ad Copy Generation
  app.post(api.ai.generateAdCopy.path, isAuthenticated, async (req, res) => {
    try {
      const { productName, targetAudience, language } = req.body;
      
      const prompt = language === 'ar' 
        ? `Write a catchy title and description for an advertisement in Arabic. Product: "${productName}". Target Audience: "${targetAudience}". Return JSON with keys "title" and "description".`
        : `Write a catchy title and description for an advertisement in English. Product: "${productName}". Target Audience: "${targetAudience}". Return JSON with keys "title" and "description".`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      res.json(content);
    } catch (error) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ message: "Failed to generate ad copy" });
    }
  });

  return httpServer;
}
