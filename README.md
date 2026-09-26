# アプリ公開キット

アプリごとの **プライバシーポリシー・利用規約・サポートページ** と、App Store Connect に入力する **URL と「App のプライバシー」の回答** を、設定ファイル1つから作ります。GitHub Pages で無料公開します。

```
アプリ公開キット/
├── kit_config.py     共通設定（公開URL・連絡先・運営者表記）
├── parts.py          機能・外部サービスごとの文面の部品（iCloud、通知、AdMob、課金、HealthKit…）
├── apps/
│   └── hensai.py     アプリごとの設定（1アプリ1ファイル）
├── build.py          生成スクリプト（Python 標準ライブラリのみ）
├── docs/             ← 生成されたサイト（GitHub Pages で公開される）
└── 申請メモ/          ← App Store Connect に入力する内容（公開はされない）
```

## 最初の1回だけ

### 1. 連絡先を決める

`kit_config.py` の `contact_email` に、問い合わせ用のメールアドレスを入れます。ページに公開されるので、**本名が入らない専用のアドレス**をおすすめします（Gmail で新しく作るなど）。

### 2. 生成する

```bash
cd ~/Desktop/Claude\ Project/アプリ公開キット
python3 build.py
```

### 3. GitHub に置いて公開する

1. GitHub で新しいリポジトリを作る
   - 名前：`apps`（変える場合は `kit_config.py` の `base_url` も合わせる）
   - **Public** を選ぶ（無料プランの GitHub Pages は Public が必要）
   - README などは追加しない
2. ターミナルで送る

   ```bash
   cd ~/Desktop/Claude\ Project/アプリ公開キット
   git init
   git add .
   git commit -m "アプリ公開キット"
   git branch -M main
   git remote add origin https://github.com/baochiyan-bit/apps.git
   git push -u origin main
   ```

3. GitHub のリポジトリ画面 →「Settings」→ 左の「Pages」
   - Source：**Deploy from a branch**
   - Branch：**main**、フォルダ：**/docs** →「Save」
4. 1〜2分後に `https://baochiyan-bit.github.io/apps/` を開いて確認

> URL に GitHub のユーザー名（baochiyan-bit）が入ります。これも出したくない場合は、公開用に別の GitHub アカウントか Organization を作り、そこにリポジトリを置いてください。

## 新しいアプリを追加するとき

Claude に「このアプリのプライバシーポリシーを作って」と頼めば、スキル（app-privacy-kit）が以下を自動で行います。手でやる場合は:

1. `apps/hensai.py` をコピーして `apps/<英字の名前>.py` を作る
2. アプリ名・説明・取得する情報・`features`（`parts.py` にあるキー）・よくある質問を書き換える
3. `python3 build.py`
4. `申請メモ/<アプリ名>.md` を見て、App Store Connect に URL と「App のプライバシー」を入力
5. `git add . && git commit -m "<アプリ名>を追加" && git push`（1〜2分で公開に反映）

## 機能を足したとき（例：広告を入れた）

`apps/<アプリ>.py` の `features` に `"admob"` を足して、`updated`（最終更新日）を変え、`python3 build.py` → push。
ポリシーに広告の節が加わり、申請メモの「App のプライバシー」も広告の申告内容に変わります。

## 部品の一覧（parts.py）

| キー | 内容 |
|---|---|
| `local_only` | データは端末内だけに保存 |
| `icloud_sync` | iCloud（CloudKit）で同期 |
| `backup_file` | バックアップの書き出し |
| `notifications` | ローカル通知 |
| `biometric_lock` | Face ID などのロック |
| `widget` | ウィジェット |
| `camera` / `photos` | カメラ・写真ライブラリ |
| `healthkit` | ヘルスケアのデータ |
| `in_app_purchase` | アプリ内課金 |
| `admob` | Google AdMob の広告 |
| `own_analytics` | 自前サーバーでの利用状況の計測 |

部品に無いもの（AI への送信内容、アカウント登録など）は、アプリの設定ファイルの `extra_sections`・`extra_parties`・`extra_labels` に書けます。

## 注意

- 生成される文面は一般的なひな形です。法的な確認が必要な場合は専門家に相談してください
- アプリをやめた場合は `docs/<名前>/` を手で消してから push してください（`build.py` は上書きのみで削除はしません）
- CalLog とスパ単は、それぞれの公式サイトで公開中のページをそのまま使っています（移すと App Store Connect の URL 変更が必要になるため）。CalLog はトップページからリンクしています。スパ単も載せる場合は `kit_config.py` の `EXTERNAL_APPS` に追加してください
