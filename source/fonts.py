# 生成主页用的字体子集:assets/fonts/serif.woff2,只含页面上出现的字。
# 字体是思源宋体(Noto Serif SC,SIL Open Font License 1.1,可以再分发),字重留 400 到 600 这一段。
# 页面的文字改了、多出没见过的字时(source/pages.js 会提醒)重新运行:
#   python source/fonts.py [NotoSerifSC-VF.ttf 的路径]
# 默认用 Windows 11 自带的那一份;别的系统从 https://github.com/notofonts/noto-cjk 下载后把路径传进来。
# 需要 fonttools 和 brotli:pip install fonttools brotli。先运行 node source/pages.js 生成好两个页面。
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SITE = Path(__file__).resolve().parent.parent
FONT = sys.argv[1] if len(sys.argv) > 1 else 'C:/Windows/Fonts/NotoSerifSC-VF.ttf'
PAGES = ['index.html', 'en/index.html', 'main.js']

# 页面上出现的字,加上全部可见的 ASCII(版本号、网址之类随时会变)
chars = {chr(c) for c in range(0x20, 0x7F)}
for name in PAGES:
    chars |= {c for c in (SITE / name).read_text(encoding='utf8') if c > ' '}
text = ''.join(sorted(chars))

font = TTFont(FONT)
font = instancer.instantiateVariableFont(font, {'wght': (400, 600)})
options = subset.Options()
options.flavor = 'woff2'
options.hinting = False
options.desubroutinize = True
options.layout_features = ['kern', 'liga', 'locl', 'vert']
sub = subset.Subsetter(options)
sub.populate(text=text)
sub.subset(font)
out = SITE / 'assets/fonts/serif.woff2'
out.parent.mkdir(parents=True, exist_ok=True)
font.flavor = 'woff2'
font.save(out)
# 这次处理过的字(包括字体里本来就没有的几个符号):pages.js 拿它检查页面上有没有新出现的字
have = {chr(c) for c in font.getBestCmap()}
(SITE / 'assets/fonts/chars.txt').write_text(text, encoding='utf8')
print(f'{out.name}: {len(have)} 个字, {out.stat().st_size / 1024:.0f} KB')
missing = sorted(chars - have - {' '})
if missing:
    print('字体里本来就没有这几个符号(页面上用系统字体显示):' + ''.join(missing))
