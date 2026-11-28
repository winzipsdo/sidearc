# 生成主页用的字体子集(只含页面上出现的字),放在 assets/fonts/:
#   kai.woff2    中文页用:仓耳今楷02 W04。它只允许个人非商业免费使用,商用要向仓耳字库买授权(https://tsanger.cn);
#                字体文件不放进仓库,从仓耳官网下载后把路径传进来,或者放在 source/fonts/TsangerJinKai02-W04.ttf
#   serif.woff2  英文页用:思源宋体(Noto Serif SC,SIL Open Font License 1.1),字重留 400 到 500 这一段
# 页面的文字改了、多出没见过的字时(source/pages.js 会提醒)重新运行:
#   python source/fonts.py [仓耳今楷02-W04.ttf 的路径] [NotoSerifSC-VF.ttf 的路径]
# 思源宋体默认用 Windows 11 自带的那一份;别的系统从 https://github.com/notofonts/noto-cjk 下载。
# 需要 fonttools 和 brotli:pip install fonttools brotli。先运行 node source/pages.js 生成好两个页面。
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SITE = Path(__file__).resolve().parent.parent
KAI = sys.argv[1] if len(sys.argv) > 1 else SITE / 'source/fonts/TsangerJinKai02-W04.ttf'
SERIF = sys.argv[2] if len(sys.argv) > 2 else 'C:/Windows/Fonts/NotoSerifSC-VF.ttf'
ASCII = {chr(c) for c in range(0x20, 0x7F)}


# 这几个文件里出现的字,加上全部可见的 ASCII(版本号、网址之类随时会变)
def chars_of(*names):
    chars = set(ASCII)
    for name in names:
        chars |= {c for c in (SITE / name).read_text(encoding='utf8') if c > ' '}
    return chars


def build(font, chars, name):
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.desubroutinize = True
    options.layout_features = ['kern', 'liga', 'locl', 'vert']
    sub = subset.Subsetter(options)
    sub.populate(text=''.join(sorted(chars)))
    sub.subset(font)
    out = SITE / 'assets/fonts' / name
    out.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(out)
    have = {chr(c) for c in font.getBestCmap()}
    print(f'{name}: {len(have)} 个字, {out.stat().st_size / 1024:.0f} KB')
    missing = sorted(chars - have - {' '})
    if missing:
        print('  字体里本来就没有这几个符号(页面上用系统字体显示):' + ''.join(missing))


zh = chars_of('index.html', 'main.js')
en = chars_of('en/index.html', 'main.js')
build(TTFont(KAI), zh, 'kai.woff2')
build(instancer.instantiateVariableFont(TTFont(SERIF), {'wght': (400, 500)}), en, 'serif.woff2')
# 这次处理过的字(包括字体里本来就没有的几个符号):pages.js 拿它检查页面上有没有新出现的字
(SITE / 'assets/fonts/chars.txt').write_text(''.join(sorted(zh | en)), encoding='utf8')
