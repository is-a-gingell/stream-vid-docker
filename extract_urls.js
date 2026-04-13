const { chromium } = require('playwright');

async function extractVideoUrl(postUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(postUrl, { waitUntil: 'networkidle' });

    // Wait for video element or player to load
    await page.waitForSelector('video, .player, [data-src]', { timeout: 10000 });

    // Try to find the video source URL
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        return video.src || video.querySelector('source')?.src;
      }

      // If no direct video, look for data-src or similar attributes
      const player = document.querySelector('.player, .video-player');
      if (player) {
        return player.getAttribute('data-src') || player.getAttribute('data-video');
      }

      // Look for any element with a .vid URL
      const links = Array.from(document.querySelectorAll('a[href*=".vid"], source[src*=".vid"]'));
      if (links.length > 0) {
        return links[0].href || links[0].src;
      }

      return null;
    });

    if (!videoSrc) return null;

    // Follow redirects to get the final URL
    try {
      const response = await page.request.get(videoSrc, { maxRedirects: 5 });
      const finalUrl = response.url();
      return finalUrl;
    } catch (redirectError) {
      console.error(`Error following redirect for ${videoSrc}:`, redirectError.message);
      return videoSrc; // Fallback to original if redirect fails
    }
  } catch (error) {
    console.error(`Error extracting URL from ${postUrl}:`, error.message);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  const postUrl = process.argv[2];
  if (!postUrl) {
    console.error('Usage: node extract_urls.js "https://sxyprn.net/post/<id>"');
    process.exit(2);
  }

  const url = await extractVideoUrl(postUrl);
  if (!url) {
    console.error('No video URL found.');
    process.exit(1);
  }

  process.stdout.write(`${url}\n`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
