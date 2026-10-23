"""The credit line for the post caption, from <project>/SOURCES.md, for pictures the carousel actually USES.

  scripts/py scripts/credits.py <project>

CC BY / CC BY-SA pictures need their author + licence in the caption; public domain, CC0, NASA and Mixkit need
nothing (listed once as a courtesy). A capture with a fair-use portrait is flagged so the creator knows.
"""
import re, sys
from pathlib import Path


def used_names(P):
    """treated names referenced by the slides (card_/ _gN folded in), mapped back to raw names by prep's naming rule"""
    names = set()
    for f in (P / 'slides').glob('*/index.html'):
        for n in re.findall(r'src="media/(?:use|clips)/([^"/]+)\.(?:jpg|png|mp4)"', f.read_text()):
            names.add(re.sub(r'^card_|_g\d$', '', n))
    return names


def main():
    P = Path(sys.argv[1]); src = P / 'SOURCES.md'
    if not src.exists(): sys.exit(f'no SOURCES.md in {P}')
    used = used_names(P)
    rows = []
    for line in src.read_text().splitlines():
        c = [x.strip() for x in line.strip().strip('|').split('|')]
        if len(c) < 5 or c[0] in ('file', '---') or set(c[0]) <= set('-'): continue
        name = c[0].replace(' (capture)', '')
        # clips are named after their raw file (v_taxi → taxi), so accept either spelling
        if used and name not in used and re.sub(r'^v_', '', name) not in used and not name.endswith('.svg'):
            continue
        rows.append({'name': name, 'title': c[1], 'author': c[2] or 'unknown', 'licence': c[3], 'capture': '(capture)' in c[0]})
    attrib = [r for r in rows if re.search(r'CC BY', r['licence'], re.I) and not r['capture']]
    free = sorted({'Wikimedia Commons (public domain / CC0)' if re.search(r'public domain|cc0', r['licence'], re.I) and 'NASA' not in r['licence'] else
                   'NASA' if 'NASA' in r['licence'] else 'Mixkit' if 'Mixkit' in r['licence'] else '' for r in rows} - {''})
    fair = [r for r in rows if 'fair use' in r['licence'].lower()]
    parts = []
    if attrib:
        parts.append('Photos: ' + '; '.join(f"{r['author']} ({r['licence']})" for r in attrib) + ', via Wikimedia Commons.')
    if free:
        parts.append('Also: ' + ', '.join(free) + '.')
    if any(r['capture'] for r in rows):
        parts.append('Screens: Wikipedia (CC BY-SA 4.0) and the companies\' own pages.')
    parts.append('Voice: Kokoro (open source).')
    print(' '.join(parts))
    if fair:
        print('\nnote: ' + ', '.join(r['name'] for r in fair) + ' show a fair-use image (shown as evidence/commentary).', file=sys.stderr)


if __name__ == '__main__':
    main()
