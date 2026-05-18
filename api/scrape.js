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

async function mlItem(id) {
  try {
    const r = await fetch(`https://api.mercadolibre.com/items/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.title || d.title.toLowerCase().startsWith("mercado")) return null;
    return {
      title: d.title,
      price: mlFmt(d.price),
      original_price: d.original_price && d.original_price !== d.price ? mlFmt(d.original_price) : "",
      image: (d.pictures?.[0]?.url || d.thumbnail || "").replace(/-[IV]\.jpg/, "-O.jpg"),
    };
  } catch { return null; }
}

async function fetchML(url) {
  // 1. wid= param in URL (real item ID, present in affiliate/recommendation links)
  const widMatch = url.match(/[?&#]wid=(MLB\d+)/i);
  if (widMatch) { const r = await mlItem(widMatch[1]); if (r) return r; }

  // 2. Direct item ID in path (MLB-1741338063)
  const pathMatch = url.match(/\/MLB-(\d{8,})/i);
  if (pathMatch) { const r = await mlItem(`MLB${pathMatch[1]}`); if (r) return r; }

  // 3. Catalog product ID (/p/MLB17413380) — try products endpoint server-side
  const catalogMatch = url.match(/\/p\/(MLB\d+)/i);
  if (catalogMatch) {
    try {
      const r = await fetch(`https://api.mercadolibre.com/products/${catalogMatch[1]}`);
      if (r.ok) {
        const d = await r.json();
        if (d.name && !d.name.toLowerCase().startsWith("mercado")) {
          const img = d.pictures?.[0]?.url?.replace(/-[IV]\.jpg/, "-O.jpg") || "";
          const price = d.buy_box_winner?.price ? mlFmt(d.buy_box_winner.price) : "";
          return { title: d.name, price, original_price: "", image: img };
        }
      }
    } catch {}

    // 4. Search by catalog_product_id
    try {
      const r = await fetch(`https://api.mercadolibre.com/sites/MLB/search?catalog_product_id=${catalogMatch[1]}&limit=1`);
      if (r.ok) {
        const d = await r.json();
        const item = d.results?.[0];
        if (item?.title && !item.title.toLowerCase().startsWith("mercado")) {
          return {
            title: item.title,
            price: mlFmt(item.price),
            original_price: item.original_price && item.original_price !== item.price ? mlFmt(item.original_price) : "",
            image: (item.thumbnail || "").replace("-I.jpg", "-O.jpg"),
          };
        }
      }
    } catch {}
  }

  // 5. Slug text search — strip IDs, use product name words
  const slugMatch = url.match(/mercadolibre?\.com\.br\/([^/?#]+)/i);
  if (slugMatch) {
    const query = slugMatch[1].replace(/MLB-?\d+/gi, "").replace(/-+/g, " ").trim();
    if (query.length >= 10) {
      try {
        const r = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=3`);
        if (r.ok) {
          const d = await r.json();
          for (const item of d.results || []) {
            if (item?.title && !item.title.toLowerCase().startsWith("mercado")) {
              return {
                title: item.title,
                price: mlFmt(item.price),
                original_price: item.original_price && item.original_price !== item.price ? mlFmt(item.original_price) : "",
                image: (item.thumbnail || "").replace("-I.jpg", "-O.jpg"),
              };
            }
          }
        }
      } catch {}
    }
  }

  return null;
}

async function fetchShopee(url) {
  const m = url.match(/[-]i\.(\d+)\.(\d+)/);
  if (!m) return null;
  const [, shopId, itemId] = m;
  try {
    const r = await fetch(
      `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
      { headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://shopee.com.br/",
        "X-Shopee-Language": "pt-BR",
        "x-api-source": "pc",
        "af-ac-enc-dat": "null",
      }}
    );
    if (!r.ok) return null;
    const d = await r.json();
    const item = d?.data?.item;
    if (!item?.name) return null;
    const price = item.price ? `R$ ${(item.price / 100000).toFixed(2).replace(".", ",")}` : "";
    const origPrice = item.price_before_discount && item.price_before_discount !== item.price
      ? `R$ ${(item.price_before_discount / 100000).toFixed(2).replace(".", ",")}` : "";
    const imgHash = item.image || item.images?.[0];
    const image = imgHash ? `https://down-br.img.susercontent.com/file/${imgHash}` : "";
    return { title: item.name, price, original_price: origPrice, image };
  } catch { return null; }
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

    if (platform === "shopee") {
      const sh = await fetchShopee(url);
      if (sh) return res.json({ ...sh, platform });
    }

    const html = await fetchHTML(url);
    const data = extractFromHTML(html);
    return res.json({ ...data, platform });
  } catch (e) {
    return res.json({ ...empty, error: e.message });
  }
}
