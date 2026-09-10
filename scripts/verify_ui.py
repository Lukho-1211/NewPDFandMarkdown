from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "verify-ui.png"
PDF = ROOT / "smoke-output.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://localhost:3000", wait_until="networkidle")

    assert page.get_by_text("Ember Maths12").first.is_visible()
    assert page.get_by_text("Drop your scanned PDF here").is_visible()
    page.screenshot(path=str(OUT), full_page=True)
    print("idle_ok", OUT.exists())

    # Upload triggers convert → expect missing API key error
    page.locator('input[type="file"]').set_input_files(str(PDF))
    page.get_by_text("Could not convert").wait_for(timeout=60000)
    err = page.locator("main").inner_text()
    assert "GEMINI_API_KEY" in err or "missing" in err.lower()
    page.screenshot(path=str(ROOT / "verify-error.png"), full_page=True)
    print("error_path_ok")

    page.get_by_role("button", name="Try again").click()
    page.get_by_text("Drop your scanned PDF here").wait_for()
    print("retry_ok")
    browser.close()
