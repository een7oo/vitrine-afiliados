function detectPlatform(url) {
  if (url.includes("shopee")) return "shopee";
  if (url.includes("mercadolivre") || url.includes("mercadolibre")) return "mercadolivre";
  if (url.includes("amazon")) return "amazon";
  return "unknown";
}

function decodeHTML(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function mlFmt(val) {
  return val ? `R$ ${Number(val).toFixed(2).replace(".", ",")}` : "";
}

async function fetchML(url) {
  // Full item ID (10+ digits)
  const itemMatch = url.match(/MLB-(\d{10,})/i);
  if (itemMatch) {
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/MLB${itemMatch[1]}`);
      if (r.ok) {
        const d = await r.json();
        if (d.title) return {
          title: d.title,
          price: mlFmt(d.price),
          original_price: d.original_price && d.original_price !== d.price ? mlFmt(d.original_price) : "",
          image: (d.pictures?.[0]?.url || d.thumbnail || "").replace(/-[IV]\.jpg/, "-O.jpg"),
        };
      }
    } catch {}
  }

  // Slug-based text search (works for /p/ catalog URLs too)
  const slugMatch = url.match(/mercadolibre?\.com\.br\/([^/?#]+)/i);
  if (slugMatch) {
    const query = slugMatch[1].replace(/MLB-?\d+/gi, "").replace(/-+/g, " ").trim();
    if (query.length >= 5) {
      try {
        const r = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=1`);
        if (r.ok) {
          const d = await r.json();
          const item = d.results?.[0];
          if (item?.title) return {
            title: item.title,
            price: mlFmt(item.price),
            original_price: item.original_price && item.original_price !== item.price ? mlFmt(item.original_price) : "",
            image: (item.thumbnail || "").replace("-I.jpg", "-O.jpg"),
          };
        }
      } catch {}
    }
  }

  return null;
}

async function fetchHTML(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function extractFromHTML(html) {
  const getTag = (...patterns) => {
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return decodeHTML(m[1].trim());
    }
    return "";
  };

  // JSON-LD Product schema
  const ldBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of ldBlocks) {
    try {
      let ld = JSON.parse(raw);
      if (Array.isArray(ld)) ld = ld.find(x => x?.["@type"] === "Product");
      if (!ld || ld["@type"] !== "Product") continue;
      const imgRaw = ld.image;
      const img = imgRaw ? (Array.isArray(imgRaw) ? imgRaw[0] : typeof imgRaw === "string" ? imgRaw : imgRaw?.url) : "";
      let price = "", origPrice = "";
      const offers = ld.offers ? (Array.isArray(ld.offers) ? ld.offers : [ld.offers]) : [];
      if (offers.length) {
        const prices = offers.map(o => parseFloat(o.price)).filter(Boolean).sort((a, b) => a - b);
        if (prices.length) price = `R$ ${prices[0].toFixed(2).replace(".", ",")}`;
        if (prices.length > 1) origPrice = `R$ ${prices[prices.length - 1].toFixed(2).replace(".", ",")}`;
      }
      if (ld.name) return { title: ld.name, image: img || "", price, original_price: origPrice };
    } catch {}
  }

  // OG tags
  const title = getTag(
    /property=["']og:title["'][^>]*content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    /<title[^>]*>([^<|]+)/i
  );
  const image = getTag(
    /property=["']og:image["'][^>]*content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i
  );

  // Price pattern
  let price = "";
  const pm = html.match(/["']price["']\s*:\s*["']?([\d.]+)/) || html.match(/R\$\s*([\d]+[.,][\d]{2})/);
  if (pm) price = `R$ ${parseFloat(pm[1].replace(",", ".")).toFixed(2).replace(".", ",")}`;

  return { title, image, price, original_price: "" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  let { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });
  if (!url.startsWith("http")) url = "https://" + url;

  const platform = detectPlatform(url);
  const empty = { title: "", price: "", image: "", original_price: "", platform };

  try {
    if (platform === "mercadolivre") {
      const ml = await fetchML(url);
      if (ml) return res.json({ ...ml, platform });
    }

    const html = await fetchHTML(url);
    const data = extractFromHTML(html);
    return res.json({ ...data, platform });
  } catch (e) {
    return res.json({ ...empty, error: e.message });
  }
}
