import { db } from "./db";
import { users, ads } from "@shared/schema";
import { storage } from "./storage";

async function seed() {
  // Create a dummy user for seeding ads
  const [user] = await db.insert(users).values({
    email: "demo@example.com",
    firstName: "Demo",
    lastName: "User",
  }).returning();

  console.log("Seeding ads...");
  
  await storage.createAd({
    title: "موبايل جديد للبيع",
    description: "أحدث موديل، استعمال خفيف، سعر مغري جداً.",
    mediaUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
    mediaType: "image",
    language: "ar",
    status: "active",
    userId: user.id,
  });

  await storage.createAd({
    title: "Luxury Watch",
    description: "Authentic Swiss watch, mint condition.",
    mediaUrl: "https://images.unsplash.com/photo-1524592094714-0f0654e20314",
    mediaType: "image",
    language: "en",
    status: "active",
    userId: user.id,
  });

  await storage.createAd({
    title: "شقة للإيجار",
    description: "شقة مفروشة في وسط المدينة، قريبة من جميع الخدمات.",
    mediaUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
    mediaType: "image",
    language: "ar",
    status: "active",
    userId: user.id,
  });

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
