"""Full-browser checks, separate from the dependency-free Node adapter tests.
Run: python tests/academy-browser.py (Playwright + Chromium required).
Uses a local server, blocks external network requests and writes no cloud data.
"""
import argparse
import os
import shutil
import functools
import http.server
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', choices=['chromium','webkit','firefox'], default='chromium')
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            options = {}
            if args.browser == 'chromium':
                executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH') or shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
                if executable:
                    options['executable_path'] = executable
            browser = getattr(p, args.browser).launch(**options)
            for entry in ['index.html', 'index-3.html', 'academy-test.html']:
                context = browser.new_context(viewport={'width':390, 'height':844}, service_workers='block')
                context.route('https://**/*', lambda route: route.abort())
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'{url}/{entry}')
                page.locator('#academy[data-academy-ready=true]').wait_for()
                original = page.evaluate("localStorage.getItem('paramount-demo-v1')")
                for subject in ['fire','cctv','electrical','intruder','lighting','skills']:
                    page.locator(f'[data-academy-subject={subject}]').click()
                    assert page.locator('#academy-content h3').is_visible()
                    page.locator('[data-academy-home]').click()
                for lesson, answers in {'fire-basics':[0,2,1], 'fire-ctec':[1,2], 'cctv-basics':[1,2,0], 'cctv-faults':[2,0]}.items():
                    subject = 'fire' if lesson.startswith('fire') else 'cctv'
                    page.locator(f'[data-academy-subject={subject}]').click()
                    page.locator(f'[data-academy-lesson={lesson}]').click()
                    for index, answer in enumerate(answers):
                        page.locator(f'input[name=q{index}][value="{(answer+1)%3}"]').check()
                    page.locator('#academy-quiz button[type=submit]').click()
                    assert 'No new completion' in page.locator('#academy-result').inner_text()
                    for index, answer in enumerate(answers):
                        page.locator(f'input[name=q{index}][value="{answer}"]').check()
                    page.locator('#academy-quiz button[type=submit]').click()
                    assert 'Knowledge check passed' in page.locator('#academy-result').inner_text()
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    page.locator('[data-academy-back]').first.click()
                    page.locator('[data-academy-home]').click()
                for width in [360,390,768,1366]:
                    page.set_viewport_size({'width':width,'height':900})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert original == page.evaluate("localStorage.getItem('paramount-demo-v1')")
                assert not errors, errors
                context.close()
                print(f'PASS ({args.browser}): {entry} cards, four quizzes/retry, responsive widths, no page errors, existing records unchanged')
            browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
