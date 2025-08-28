import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda";

const app = express();

app.get("/ext/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Missing ID" });

  // Construct the actual page URL using the video ID
  const pageUrl = `https://example.com/watch/${id}`;

  let browser = null;
  try {
    // Launch Puppeteer with AWS Lambda compatible Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle2" });

    // Wait a bit for JWPlayer to initialize
    await page.waitForTimeout(2000);

    // First, try to get the m3u8 from JWPlayer
    let link = await page.evaluate(() => {
      try {
        if (typeof jwplayer !== "undefined") {
          const playlist = jwplayer().getPlaylist();
          if (playlist && playlist[0] && playlist[0].file) {
            return playlist[0].file;
          }
        }
        return null;
      } catch (e) {
        return null;
      }
    });

    // Fallback: regex search in the page HTML for file: "..." links
    if (!link) {
      const html = await page.content();
      const matches = [...html.matchAll(/file\s*:\s*"(https?:\/\/[^"]+\.m3u8)"/g)];
      if (matches.length) link = matches[0][1];
    }

    if (link) {
      res.json({ success: true, link });
    } else {
      res.json({ success: false, message: "No m3u8 link found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.toString() });
  } finally {
    if (browser) await browser.close();
  }
});

export default app;
      
