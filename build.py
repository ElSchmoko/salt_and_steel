"""Builds index.html from the files in src/. Run: python3 build.py"""
SRC = 'src/'
body = open(SRC + 'shell.html').read()
for f in ['core.js', 'art.js', 'render.js', 'ui.js']:
    body += '<script>\n' + open(SRC + f).read() + '\n</script>\n'
head = (open('build_head.html').read())
open('index.html', 'w').write(head + body + '\n</body>\n</html>\n')
print('index.html written')
