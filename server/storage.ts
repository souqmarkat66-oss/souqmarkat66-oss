import { db } from "./db";
import { ads, type Ad, type InsertAd, users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Ads
  getAds(language?: string): Promise<Ad[]>;
  getAd(id: number): Promise<Ad | undefined>;
  createAd(ad: InsertAd): Promise<Ad>;
  updateAd(id: number, ad: Partial<InsertAd>): Promise<Ad | undefined>;
  deleteAd(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAds(language?: string): Promise<Ad[]> {
    let query = db.select().from(ads).orderBy(desc(ads.createdAt));
    
    if (language) {
      // @ts-ignore - dynamic where clause
      query = query.where(eq(ads.language, language));
    }
    
    return await query;
  }

  async getAd(id: number): Promise<Ad | undefined> {
    const [ad] = await db.select().from(ads).where(eq(ads.id, id));
    return ad;
  }

  async createAd(insertAd: InsertAd): Promise<Ad> {
    const [ad] = await db.insert(ads).values(insertAd).returning();
    return ad;
  }

  async updateAd(id: number, updates: Partial<InsertAd>): Promise<Ad | undefined> {
    const [updated] = await db
      .update(ads)
      .set(updates)
      .where(eq(ads.id, id))
      .returning();
    return updated;
  }

  async deleteAd(id: number): Promise<void> {
    await db.delete(ads).where(eq(ads.id, id));
  }
}

export const storage = new DatabaseStorage();
