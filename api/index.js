const chromium = require("chrome-aws-lambda");

module.exports = async (req, res) => {
  const id = req.query.id || req.query["0"];
  if (!id) return res.status(400).json({ error: "Missing ID" });

  const pageUrl = `https://mivalyo.com/embed/${id}`;

  let browser = null;
  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle2" });

    // Wait for JWPlayer to load
    await page.waitForFunction(
      "typeof jwplayer !== 'undefined' && jwplayer().getPlaylist",
      { timeout: 5000 }
    ).catch(() => {});

    const link = await page.evaluate(() => {
      try {
        if (typeof jwplayer !== "undefined") {
          const playlist = jwplayer().getPlaylist();
          if (playlist && playlist[0] && playlist[0].file) return playlist[0].file;
        }

        // Fallback: regex search in HTML
        const matches = [...document.documentElement.innerHTML.matchAll(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8)"/g)];
        if (matches.length) return matches[0][1];
        return null;
      } catch {
        return null;
      }
    });

    if (link) res.json({ success: true, link });
    else res.json({ success: false, message: "No m3u8 link found" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.toString() });
  } finally {
    if (browser) await browser.close();
  }
};
      
