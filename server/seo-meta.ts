import { db } from "./db";
import { sql } from "drizzle-orm";

const BASE = "https://ads-as.com";

const BOT_PATTERNS = [
  "googlebot", "bingbot", "yandexbot", "baiduspider", "duckduckbot",
  "facebookexternalhit", "twitterbot", "linkedinbot", "whatsapp",
  "telegrambot", "applebot", "slurp", "msnbot", "petalbot",
  "sogou", "exabot", "ia_archiver", "semrushbot", "ahrefsbot",
  "rogerbot", "dotbot", "mj12bot", "screaming frog", "seokicks",
];

export function isBot(userAgent: string): boolean {
  const ua = (userAgent || "").toLowerCase();
  return BOT_PATTERNS.some((b) => ua.includes(b));
}

function esc(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imgUrl(raw: string | null | undefined): string {
  if (!raw) return `${BASE}/icons/icon-512.png`;
  if (raw.startsWith("http")) return raw;
  return `${BASE}${raw}`;
}

export async function getAdPageHtml(adId: string): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT a.id, a.title, a.description, a.price_egp, a.media_url, a.media_type,
             a.target_region, a.category, a.status,
             u.first_name, u.last_name
      FROM ads a
      LEFT JOIN users u ON a.user_id = u.telegram_id::text
      WHERE a.id = ${Number(adId)}
      LIMIT 1
    `);
    if (!result.rows.length) return null;
    const ad = result.rows[0] as any;
    if (ad.status !== "active") return null;

    const title = esc(ad.title || "إعلان على شبكة سوق");
    const price = ad.price_egp ? `${Number(ad.price_egp).toLocaleString("ar-EG")} جنيه` : "";
    const region = ad.target_region ? `في ${esc(ad.target_region)}` : "في مصر";
    const category = ad.category ? esc(ad.category) : "";
    const rawDesc = ad.description
      ? String(ad.description).substring(0, 300)
      : `${ad.title || "إعلان"} ${price ? `— ${price}` : ""} ${region}`;
    const description = esc(rawDesc);
    const image = imgUrl(ad.media_type === "image" ? ad.media_url : null);
    const url = `${BASE}/ads/${adId}`;

    const priceTag = price
      ? `<meta property="product:price:amount" content="${esc(ad.price_egp?.toString() || "")}" />
  <meta property="product:price:currency" content="EGP" />`
      : "";

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} ${price ? `— ${price}` : ""} | شبكة سوق للإعلانات</title>
  <meta name="description" content="${description}${price ? ` | السعر: ${price}` : ""} ${region} — شبكة سوق للإعلانات" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="product" />
  <meta property="og:title" content="${title}${price ? ` — ${price}` : ""}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:width" content="800" />
  <meta property="og:image:height" content="600" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:locale" content="ar_EG" />
  <meta property="og:site_name" content="شبكة سوق للإعلانات" />
  ${priceTag}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}${price ? ` — ${price}` : ""}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${esc(image)}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "${title.replace(/"/g, '\\"')}",
    "description": "${description.replace(/"/g, '\\"')}",
    "url": "${url}",
    "image": "${image}",
    ${price ? `"offers": { "@type": "Offer", "price": "${ad.price_egp}", "priceCurrency": "EGP", "availability": "https://schema.org/InStock", "areaServed": "EG" },` : ""}
    "seller": {
      "@type": "Organization",
      "name": "شبكة سوق للإعلانات",
      "url": "${BASE}"
    }
  }
  </script>

  <link rel="icon" type="image/png" href="/favicon.png" />
</head>
<body style="font-family:sans-serif;direction:rtl;padding:20px;max-width:800px;margin:auto">
  <header style="border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:20px">
    <a href="${BASE}" style="text-decoration:none;color:#c0392b;font-weight:bold;font-size:18px">شبكة سوق للإعلانات</a>
    ${category ? `<span style="color:#666;margin-right:10px">← ${category}</span>` : ""}
  </header>
  <main>
    <h1 style="font-size:24px;margin-bottom:10px">${title}</h1>
    ${price ? `<p style="font-size:20px;font-weight:bold;color:#c0392b;margin:10px 0">${price}</p>` : ""}
    ${region ? `<p style="color:#666;margin:5px 0">📍 ${region}</p>` : ""}
    ${ad.media_type === "image" && ad.media_url ? `<img src="${esc(image)}" alt="${title}" style="max-width:100%;border-radius:8px;margin:15px 0" loading="lazy" />` : ""}
    ${ad.description ? `<div style="margin-top:15px;line-height:1.7;white-space:pre-wrap">${esc(ad.description)}</div>` : ""}
    <a href="${esc(url)}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#c0392b;color:white;text-decoration:none;border-radius:6px;font-weight:bold">
      عرض الإعلان كاملاً
    </a>
  </main>
</body>
</html>`;
  } catch {
    return null;
  }
}

export async function getChannelPageHtml(channelId: string): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, name, description, avatar_url, cover_url, status
      FROM channels WHERE id = ${Number(channelId)} LIMIT 1
    `);
    if (!result.rows.length) return null;
    const ch = result.rows[0] as any;

    const title = esc(ch.name || "قناة على شبكة سوق");
    const description = esc(ch.description || `تابع قناة ${ch.name} على شبكة سوق للإعلانات`);
    const image = imgUrl(ch.avatar_url || ch.cover_url);
    const url = `${BASE}/channels/${channelId}`;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | قنوات شبكة سوق للإعلانات</title>
  <meta name="description" content="${description} — قناة رقمية على شبكة سوق للإعلانات" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:locale" content="ar_EG" />
  <meta property="og:site_name" content="شبكة سوق للإعلانات" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "${title.replace(/"/g, '\\"')}",
    "description": "${description.replace(/"/g, '\\"')}",
    "url": "${url}",
    "logo": "${image}"
  }
  </script>
  <link rel="icon" type="image/png" href="/favicon.png" />
</head>
<body style="font-family:sans-serif;direction:rtl;padding:20px;max-width:800px;margin:auto">
  <header style="border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:20px">
    <a href="${BASE}" style="text-decoration:none;color:#c0392b;font-weight:bold;font-size:18px">شبكة سوق للإعلانات</a>
  </header>
  <main style="text-align:center">
    ${ch.avatar_url ? `<img src="${esc(image)}" alt="${title}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;margin-bottom:15px" />` : ""}
    <h1 style="font-size:24px">${title}</h1>
    ${ch.description ? `<p style="color:#555;line-height:1.7;max-width:500px;margin:10px auto">${description}</p>` : ""}
    <a href="${esc(url)}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#c0392b;color:white;text-decoration:none;border-radius:6px;font-weight:bold">
      زيارة القناة
    </a>
  </main>
</body>
</html>`;
  } catch {
    return null;
  }
}
