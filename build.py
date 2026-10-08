#!/usr/bin/env python3
"""アプリ公開キット: apps/*.py の設定から、公開用のページと App Store 申請用のメモを作る。

    python3 build.py            … docs/ にサイト、申請メモ/ に申請用メモを出力
    python3 build.py --draft    … 連絡先が未設定でも出力する（確認用）

Python 3.8 以上の標準ライブラリだけで動く。
"""
import html, importlib.util, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from kit_config import SITE, EXTERNAL_APPS  # noqa: E402
from parts import PARTS  # noqa: E402

DRAFT = "--draft" in sys.argv
DOCS, MEMO = ROOT / "docs", ROOT / "申請メモ"


def load_apps():
    apps = []
    for path in sorted((ROOT / "apps").glob("*.py")):
        spec = importlib.util.spec_from_file_location(path.stem, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        app = dict(mod.APP)
        unknown = [f for f in app.get("features", []) if f not in PARTS]
        if unknown:
            sys.exit(f"エラー: {path.name} の features に不明なキー {unknown}（parts.py を確認）")
        app["email"] = app.get("contact_email") or SITE.get("contact_email") or ""
        if not app["email"] and not DRAFT:
            sys.exit(f"エラー: {path.name} の連絡先メールアドレスが未設定です（kit_config.py か apps/{path.name}）")
        apps.append(app)
    return apps


def esc(text):
    """HTML エスケープし、URL とメールアドレスをリンクにする"""
    s = html.escape(text)
    s = re.sub(r"(https?://[^\s）)、。]+)", r'<a href="\1">\1</a>', s)
    return re.sub(r"([\w.+-]+@[\w-]+\.[\w.]+)", r'<a href="mailto:\1">\1</a>', s)


def page(title, app_name, body, rel=""):
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}{' | ' + html.escape(app_name) if app_name else ''}</title>
<link rel="stylesheet" href="{rel}style.css">
</head>
<body>
<main>
{body}
</main>
<footer><a href="{rel}index.html">{html.escape(SITE['title'])}</a></footer>
</body>
</html>
"""


def operator():
    return SITE.get("operator") or "運営者"


def collect(app):
    feats = [PARTS[k] for k in app.get("features", [])]
    rows = list(app.get("data_rows", [])) + [r for f in feats for r in f.get("rows", [])]
    sections = [s for f in feats for s in f.get("sections", [])] + list(app.get("extra_sections", []))
    parties = [p for f in feats for p in f.get("parties", [])] + list(app.get("extra_parties", []))
    labels = [l for f in feats for l in f.get("labels", [])] + list(app.get("extra_labels", []))
    notes = [n for f in feats for n in f.get("notes", [])]
    external = any(f.get("external") for f in feats) or app.get("external", False)
    return rows, sections, parties, labels, notes, external


def privacy_html(app):
    rows, sections, parties, _, _, external = collect(app)
    n = app["name"]
    out = [f"<h1>プライバシーポリシー</h1>", f'<p class="date">最終更新日：{esc(app["updated"])}</p>',
           f"<p>本プライバシーポリシーは、{esc(n)}（以下「本アプリ」）における利用者の情報の取り扱いについて定めるものです。</p>"]
    sec = 0

    def h(title):
        nonlocal sec
        sec += 1
        out.append(f"<h2>{sec}. {esc(title)}</h2>")

    h("基本方針")
    if external:
        out.append(f"<p>{operator()}は、本アプリに入力された情報を利用者の端末内に保存することを原則とし、本ポリシーに定める場合を除き、外部に送信または第三者へ提供することはありません。</p>")
    else:
        out.append(f"<p>本アプリに入力された情報は利用者の端末内で扱い、{operator()}が外部に送信・収集することはありません。</p>")

    h("取得する情報と利用目的")
    out.append("<table><thead><tr><th>情報の種類</th><th>利用目的</th><th>保存場所</th></tr></thead><tbody>")
    for kind, purpose, place in rows:
        out.append(f"<tr><td>{esc(kind)}</td><td>{esc(purpose)}</td><td>{esc(place)}</td></tr>")
    out.append("</tbody></table>")
    if not app.get("account"):
        out.append("<p>本アプリは、氏名・メールアドレス・電話番号・住所など、個人を直接特定する情報を取得しません。アカウント登録も不要です。</p>")

    for title, paras in sections:
        h(title)
        out += [f"<p>{esc(p)}</p>" for p in paras]

    h("第三者提供")
    out.append(f"<p>{operator()}は、法令に基づく場合を除き、利用者の情報を第三者に提供しません。</p>")
    if parties:
        out.append("<p>本アプリが利用する外部サービスは次のとおりです。</p><ul>")
        for company, service, purpose, url in parties:
            out.append(f"<li>{esc(service)}（{esc(company)}）：{esc(purpose)}　{esc(url)}</li>")
        out.append("</ul>")

    h("データの削除")
    txt = "本アプリのデータは端末内に保存されているため、本アプリを端末から削除することにより、すべての記録が削除されます。削除されたデータは復元できません。"
    if "icloud_sync" in app.get("features", []):
        txt += "iCloud 同期を利用していた場合は、iPhone の「設定」→ 利用者の名前 →「iCloud」→「アカウントのストレージを管理」から、本アプリのデータを削除できます。"
    out.append(f"<p>{esc(txt)}</p>")

    h("お子様の利用について")
    out.append(f"<p>本アプリは、{app.get('min_age', 13)}歳未満の方の利用を想定していません。</p>")
    h("本ポリシーの変更")
    out.append("<p>本ポリシーの内容は、法令の変更または本アプリの機能追加等に応じて変更されることがあります。重要な変更を行う場合は、本アプリまたは本ページにてお知らせします。</p>")
    h("お問い合わせ")
    out.append(f"<p>本ポリシーに関するお問い合わせは、以下までご連絡ください。<br>連絡先：{esc(app['email']) or '（未設定）'}</p>")
    return "\n".join(out)


def terms_html(app):
    n = esc(app["name"])
    disclaimer = ([esc(app["disclaimer"])] if app.get("disclaimer") else []) + [
        f"{operator()}は、本アプリの内容の正確性・完全性・有用性について保証しません。本アプリの利用により生じた損害について、{operator()}の故意または重大な過失による場合を除き、責任を負いません。",
        "端末の故障・紛失、アプリの削除、iCloud の設定などによりデータが失われた場合の復元には対応できません。定期的なバックアップをおすすめします。",
    ]
    items = [
        ("適用", [f"本規約は、{n}（以下「本アプリ」）の利用に関する条件を定めるものです。利用者は、本規約に同意したうえで本アプリを利用するものとします。"]),
        ("利用料金", [f"本アプリの料金は「{esc(app.get('price', '無料'))}」です。アプリ内課金がある場合、その決済と返金は Apple Inc. の App Store の規約に従います。"]),
        ("禁止事項", ["利用者は、本アプリの利用にあたり、法令または公序良俗に違反する行為、本アプリの運営を妨げる行為、本アプリの解析・改変・再配布、その他運営者が不適切と判断する行為をしてはなりません。"]),
        ("免責", disclaimer),
        ("サービスの変更・終了", [f"{operator()}は、利用者への事前の通知なく、本アプリの内容を変更し、または提供を終了することがあります。"]),
        ("規約の変更", [f"{operator()}は、必要に応じて本規約を変更できるものとします。変更後の規約は、本ページに掲載した時点から効力を生じます。"]),
        ("準拠法・管轄", ["本規約は日本法に準拠します。本アプリに関して紛争が生じた場合は、運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。"]),
    ]
    out = ["<h1>利用規約</h1>", f'<p class="date">最終更新日：{esc(app["updated"])}</p>']
    for i, (title, paras) in enumerate(items, 1):
        out.append(f"<h2>第{i}条（{title}）</h2>")
        out += [f"<p>{p}</p>" for p in paras]
    return "\n".join(out)


def support_html(app):
    n = esc(app["name"])
    out = [f"<h1>{n} サポート</h1>", f"<p>{esc(app['summary'])}</p>",
           "<dl>", f"<dt>動作環境</dt><dd>{esc(app.get('requirements', ''))}</dd>",
           f"<dt>料金</dt><dd>{esc(app.get('price', '無料'))}</dd>", "</dl>"]
    if app.get("faq"):
        out.append("<h2>よくある質問</h2>")
        for q, a in app["faq"]:
            out.append(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>")
    out.append("<h2>お問い合わせ</h2>")
    out.append(f"<p>不具合のご報告やご要望は、以下までご連絡ください。お使いの iPhone の機種と iOS のバージョン、アプリのバージョンを書き添えていただくと、確認がスムーズです。<br>連絡先：{esc(app['email']) or '（未設定）'}</p>")
    out.append('<h2>規約など</h2><ul><li><a href="privacy.html">プライバシーポリシー</a></li><li><a href="terms.html">利用規約</a></li></ul>')
    return "\n".join(out)


def memo_md(app):
    _, _, _, labels, notes, _ = collect(app)
    base = SITE["base_url"].rstrip("/") + "/" + app["slug"]
    lines = [f"# {app['name']} の App Store 申請メモ", "",
             "## App Store Connect に入力する URL", "",
             "| 項目 | URL |", "|---|---|",
             f"| プライバシーポリシー URL（必須） | {base}/privacy.html |",
             f"| サポート URL（必須） | {base}/support.html |",
             f"| 利用規約（説明文やアプリ内に載せる場合） | {base}/terms.html |", "",
             "## 「App のプライバシー」の回答", ""]
    if not labels:
        lines += ["**「データを収集しない」** を選びます。", "",
                  "本アプリが端末の外へ送るデータは、運営者やその提携先がアクセスできる形では存在しないためです。"]
    else:
        lines += ["**「データを収集する」** を選び、次の項目を申告します。", "",
                  "| 区分 | データの種類 | 目的 | ユーザーに紐づく | トラッキングに使う |", "|---|---|---|---|---|"]
        lines += [f"| {c} | {t} | {p} | {l} | {tr} |" for c, t, p, l, tr in labels]
    if notes:
        lines += ["", "## 注意", ""] + [f"- {x}" for x in notes]
    return "\n".join(lines) + "\n"


STYLE = """:root{color-scheme:light dark;--fg:#1d1d1f;--sub:#6e6e73;--line:#d2d2d7;--bg:#fff;--card:#f5f5f7;--link:#0066cc}
@media(prefers-color-scheme:dark){:root{--fg:#f5f5f7;--sub:#a1a1a6;--line:#424245;--bg:#000;--card:#1c1c1e;--link:#2997ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.8 -apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 16px}h1{font-size:1.7em;line-height:1.3;margin:0 0 8px}h2{font-size:1.15em;margin:2em 0 .6em;padding-top:.6em;border-top:1px solid var(--line)}
a{color:var(--link);word-break:break-all}.date{color:var(--sub);font-size:.9em}
table{width:100%;border-collapse:collapse;font-size:.92em;margin:1em 0}th,td{border:1px solid var(--line);padding:8px 10px;vertical-align:top;text-align:left}th{background:var(--card)}
details{background:var(--card);border-radius:10px;padding:10px 14px;margin:8px 0}summary{cursor:pointer;font-weight:600}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px}dt{color:var(--sub)}dd{margin:0}
.apps{list-style:none;padding:0}.apps li{background:var(--card);border-radius:12px;padding:14px 16px;margin:10px 0}.apps .name{font-weight:700;font-size:1.1em}
footer{max-width:760px;margin:0 auto;padding:24px 20px 40px;color:var(--sub);font-size:.9em;border-top:1px solid var(--line)}
@media(max-width:560px){table,thead,tbody,tr,th,td{display:block}thead{display:none}td{border:none;padding:2px 0}tr{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0}td:nth-child(1){font-weight:600}td:nth-child(2)::before{content:"利用目的：";color:var(--sub)}td:nth-child(3)::before{content:"保存場所：";color:var(--sub)}}
"""


def copy_landing(src, dst, app):
    """landing/<slug>/ を docs/<slug>/ にコピー。HTML の {{CONTACT_EMAIL}} は連絡先に置き換える"""
    for f in src.rglob("*"):
        if f.is_dir():
            continue
        out = dst / f.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        if f.suffix == ".html":
            out.write_text(f.read_text(encoding="utf-8").replace("{{CONTACT_EMAIL}}", app["email"]), encoding="utf-8")
        else:
            out.write_bytes(f.read_bytes())


def main():
    apps = load_apps()
    # 上書きで出力する（アプリをやめた場合は docs/<slug>/ を手で消す）
    DOCS.mkdir(exist_ok=True)
    MEMO.mkdir(exist_ok=True)
    (DOCS / ".nojekyll").write_text("")
    (DOCS / "style.css").write_text(STYLE, encoding="utf-8")

    for app in apps:
        d = DOCS / app["slug"]
        d.mkdir(exist_ok=True)
        (d / "privacy.html").write_text(page("プライバシーポリシー", app["name"], privacy_html(app), "../"), encoding="utf-8")
        (d / "terms.html").write_text(page("利用規約", app["name"], terms_html(app), "../"), encoding="utf-8")
        (d / "support.html").write_text(page("サポート", app["name"], support_html(app), "../"), encoding="utf-8")
        landing = ROOT / "landing" / app["slug"]
        if landing.is_dir():
            # 専用のトップページ（LP）があれば、それを index.html として使う（landing/<slug>/ を丸ごとコピー）
            copy_landing(landing, d, app)
        else:
            (d / "index.html").write_text(page("サポート", app["name"], support_html(app), "../"), encoding="utf-8")
        (MEMO / f"{app['name']}.md").write_text(memo_md(app), encoding="utf-8")

    items = []
    for app in apps:
        s = app["slug"]
        items.append(f'<li><div class="name">{esc(app["name"])}</div><div>{esc(app["summary"])}</div>'
                     f'<a href="{s}/support.html">サポート</a>　<a href="{s}/privacy.html">プライバシーポリシー</a>　<a href="{s}/terms.html">利用規約</a></li>')
    for ext in EXTERNAL_APPS:
        items.append(f'<li><div class="name">{esc(ext["name"])}</div><a href="{html.escape(ext["url"])}">公式サイト</a></li>')
    body = f"<h1>{esc(SITE['title'])}</h1><ul class=\"apps\">{''.join(items)}</ul>"
    (DOCS / "index.html").write_text(page(SITE["title"], "", body), encoding="utf-8")

    print(f"出力しました: docs/（{len(apps)} アプリ）、申請メモ/")
    for app in apps:
        base = SITE["base_url"].rstrip("/") + "/" + app["slug"]
        print(f"  {app['name']}: {base}/privacy.html , {base}/support.html"
              + ("　※連絡先が未設定（--draft）" if not app["email"] else ""))


if __name__ == "__main__":
    main()
