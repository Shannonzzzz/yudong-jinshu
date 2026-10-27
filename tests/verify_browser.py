from pathlib import Path
import json
import os
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
APP = HERE.parent
QA = APP / '.test-output'
QA.mkdir(exist_ok=True)
data = json.loads((APP / 'src' / 'data.json').read_text(encoding='utf-8'))
checks = []

with sync_playwright() as p:
    browser_path = os.environ.get('YUDONG_BROWSER_EXECUTABLE')
    browser = p.chromium.launch(headless=True, timeout=20000, **({'executable_path': browser_path} if browser_path else {}))
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, accept_downloads=True,
                                  timezone_id='America/New_York')
    context.set_offline(True)
    page = context.new_page()
    errors = []
    requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.goto((APP / 'docs' / 'index.html').as_uri())
    page.wait_for_selector('#hour-preview')
    assert page.locator('#empty-state').is_visible()
    assert page.locator('#result').is_hidden()
    assert page.locator('.topic-button').count() == 12
    assert page.locator('.topic-button[aria-pressed="true"]').count() == 1
    assert page.locator('#empty-ring .branch-node').count() == 12
    page.screenshot(path=str(QA / '新版首页.png'), full_page=True, animations='disabled')
    # 手动主题切换可覆盖系统主题，随后恢复自动跟随以验证系统深色模式。
    page.locator('#theme-toggle').click()
    assert page.locator('html').get_attribute('data-theme') == 'dark'
    page.locator('#theme-toggle').click()
    assert page.locator('html').get_attribute('data-theme') == 'light'
    page.locator('html').evaluate('(el) => delete el.dataset.theme')
    page.locator('#open-library').click()
    assert page.locator('#reference').get_attribute('open') is not None
    page.locator('#reference').evaluate('(el) => { el.open = false; }')
    # 新增事项按钮可通过键盘触发，并同步原有字段。
    page.locator('.topic-button[data-value="寅"]').focus()
    page.keyboard.press('Enter')
    assert page.locator('#topic').input_value() == '寅'
    assert page.locator('.topic-button[data-value="寅"]').get_attribute('aria-pressed') == 'true'
    checks.append('十二事项点选与键盘操作、空盘图、手动主题切换和导航展开索引通过')
    # 浏览器刻意设为美国时区，当前时间仍必须用北京时间。
    expected_now = page.evaluate("""() => {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Shanghai',
        year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
      return {date:`${p.year}-${p.month}-${p.day}`,clock:`${p.hour}:${p.minute}`};
    }""")
    assert page.locator('#date').input_value() == expected_now['date']
    assert page.locator('#clock').input_value() == expected_now['clock']
    checks.append('离线 file 页面可启动；跨浏览器时区仍按北京时间取当前时间')

    page.get_by_text('手选时辰', exact=True).click()
    page.locator('#hour').select_option('子')
    page.locator('.topic-button[data-value="寅"]').click()
    page.locator('#date').fill('2026-10-27')
    question = '<img src=x onerror="window.__injected=true"> 这次婚事如何？'
    page.locator('#question').fill(question)
    page.locator('#submit').click()
    assert page.locator('#result-key').inner_text() == '丙寅子'
    assert page.locator('.step').all_text_contents() == ['01子甲', '02丑乙', '03寅丙']
    assert question in page.locator('#print-meta').inner_text()
    assert page.evaluate('window.__injected') is None
    with page.expect_download() as pending:
        page.locator('#export').click()
    download = pending.value
    assert download.suggested_filename == '玉洞金书_丙寅子_2026-10-27.md'
    target = QA / '导出记录验证.md'
    download.save_as(str(target))
    record = target.read_text(encoding='utf-8')
    entry = next(item for item in data['entries'] if item['key'] == '丙寅子')
    assert entry['poem'] in record and entry['judgment'] in record and question in record
    assert '手动指定' in record
    checks.append('手选起盘、逐步推算、安全显示问事文字、Markdown 实际下载内容正确')

    page.locator('.topic-button[data-value="戌"]').click()
    assert page.locator('#result').is_hidden()
    assert '重新起盘' in page.locator('#result-status').inner_text()
    page.locator('#submit').click()
    assert page.locator('#result-key').inner_text() == '甲戌子'
    assert page.locator('.step').count() == 11
    page.get_by_text('钟点换算', exact=True).click()
    assert page.locator('#result').is_hidden()
    for clock, expected in [('00:59','子'), ('01:00','丑'), ('22:59','亥'), ('23:00','子')]:
        page.locator('#clock').fill(clock)
        assert page.locator('#hour-preview').inner_text() == expected + '时'
    page.locator('.topic-button[data-value="寅"]').click()
    page.locator('#submit').click()
    assert page.locator('#result-key').inner_text() == '丙寅子'
    with page.expect_download() as pending:
        page.locator('#export').click()
    pending.value.save_as(str(QA / '钟点记录验证.md'))
    assert '23:00（北京时间 UTC+08:00' in (QA / '钟点记录验证.md').read_text(encoding='utf-8')
    checks.append('输入更改使旧结果失效；第十一位回甲；午夜钟点边界及钟点记录通过')

    # 对发布页逐个事项/时辰调用真实表单，核对原书全部 144 个标题及正文。
    evidence = page.evaluate("""entries => {
      const form = document.getElementById('cast-form');
      document.querySelector('input[value="branch"]').checked = true;
      for (const entry of entries) {
        document.getElementById('hour').value = entry.key[2];
        document.getElementById('topic').value = entry.key[1];
        form.dispatchEvent(new Event('change', {bubbles:true}));
        form.requestSubmit();
        for (const [id, expected] of [['result-key',entry.key],['poem',entry.poem],['judgment',entry.judgment],['result-grade',entry.grade],['tune',entry.tune]]) {
          if(document.getElementById(id).textContent !== expected) throw new Error(`${entry.key}: ${id} 不一致`);
        }
      }
      return entries.length;
    }""", data['entries'])
    assert evidence == 144
    checks.append('144 种组合经真实表单逐个排盘，标题、词句、简断、等级、词牌全部正确')

    page.locator('#reference').evaluate('(el) => { el.open = true; }')
    page.locator('#search').fill('乙午未')
    assert page.locator('.library-button').count() == 1
    page.locator('.library-button').click()
    assert page.locator('#result-key').inner_text() == '乙午未'
    assert page.locator('#original-note').is_visible()
    assert '庚申' in page.locator('#original-note').inner_text()
    page.locator('#search').fill('完全不匹配的检索内容XYZ')
    assert page.locator('.library-button').count() == 0
    assert page.locator('.no-results').is_visible()
    page.locator('#search').fill('')
    assert page.locator('.library-button').count() == 144
    checks.append('全文索引检索、零结果状态、点击起盘及原文分歧提示通过')

    page.locator('#reference').evaluate('(el) => { el.open = false; }')
    page.locator('#hour').select_option('子')
    page.locator('.topic-button[data-value="寅"]').click()
    page.locator('#question').fill('这段姻缘是否相宜？')
    page.locator('#submit').click()
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(QA / '桌面排盘.png'), full_page=True, animations='disabled')
    for width in [390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert page.locator('#result-key').is_visible()
        for selector in ['#cast-form', '#result', '#result .chart', '.steps', '.poem-section']:
            assert page.locator(selector).evaluate('(el) => el.getBoundingClientRect().right <= window.innerWidth + 1')
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#question').fill('这段姻缘是否相宜？希望顺其自然，也心存诚意。')
    page.locator('#submit').click()
    assert page.locator('#result-heading').evaluate('(el) => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < 80')
    assert page.locator('#result-heading').evaluate('(el) => document.activeElement === el')
    checks.append('手机起盘后自动定位结果并转移键盘焦点')
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(QA / '手机排盘.png'), full_page=True, animations='disabled')
    page.emulate_media(color_scheme='dark')
    page.screenshot(path=str(QA / '深色模式.png'), full_page=True, animations='disabled')
    page.emulate_media(color_scheme='light')
    checks.append('390 与 320 像素宽度无横向溢出，完成浅色/深色模式截图')
    page.set_viewport_size({'width':1440,'height':1100})
    page.emulate_media(media='print')
    assert page.locator('.input-panel').is_hidden()
    assert page.locator('.reference').is_hidden()
    assert page.locator('#result').is_visible()
    page.pdf(path=str(QA / '打印验证.pdf'), format='A4', print_background=True,
             margin={'top':'15mm','bottom':'15mm','left':'15mm','right':'15mm'})
    checks.append('打印样式隐藏输入和索引，保留结果与问事记录，已实际生成 PDF')
    assert not errors, errors
    assert not [url for url in requests if url.startswith(('http://','https://'))], requests
    checks.append('浏览器无脚本错误、无网络请求')
    browser.close()

(QA / '浏览器验证结果.json').write_text(json.dumps({'checks': checks, 'page_errors': errors,
    'network_requests': requests}, ensure_ascii=False, indent=2), encoding='utf-8')
for item in checks:
    print('PASS', item, flush=True)
