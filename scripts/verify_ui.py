from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "verify-ui.png"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://localhost:3000", wait_until="networkidle")

    assert "/login" in page.url
    assert page.get_by_text("Ember Maths12").first.is_visible()
    assert page.get_by_role("heading", name="Sign in").is_visible()
    assert page.get_by_text("Teachers and admins upload worksheets.").is_visible()
    page.screenshot(path=str(OUT), full_page=True)
    print("login_ok", OUT.exists())

    response = page.request.post("http://localhost:3000/api/convert")
    assert response.status == 401
    print("convert_unauthorized_ok")

    browser.close()
