# 把源码推到 GitHub（10 分钟）

推上去之后你能得到三样东西：

1. **一个公开仓库** —— 比赛要求交「源代码，或可运行版本」，仓库本身就满足
2. **队友能 clone** —— 不用再微信互传压缩包
3. **可以挂自动部署** —— 以后 push 一次，网站自动更新

---

## 第 1 步：建一个空仓库

打开 <https://github.com/new>：

| 字段 | 填什么 |
| --- | --- |
| Repository name | `empty-classroom` |
| Description | 校园空教室查询 · Axiom 黑客松 2026 |
| Visibility | **Public**（评委要能看；不想公开就选 Private，提交时单独给权限） |
| Add a README file | **不要勾** |
| .gitignore / license | **都不要选** |

点 `Create repository`。**一定要建成空仓库**，否则推送时会冲突。

---

## 第 2 步：改成本人的提交身份

先在终端里跑这两行（换成你自己的）：

```bash
cd C:\Users\22170\Desktop\qq-bridge-main\axiom-starter
git config user.name "你的GitHub用户名"
git config user.email "你注册GitHub用的邮箱"
```

> 现在仓库里的提交用的是占位身份 `Axiom Team`。改了之后新提交就是你自己的名字；
> 想把之前两条也改成你的，再跑一次：
> `git rebase -r --root --exec "git commit --amend --no-edit --reset-author"`

---

## 第 3 步：关联远程仓库并推送

把 `你的用户名` 换成 GitHub 用户名：

```bash
git remote add origin https://github.com/你的用户名/empty-classroom.git
git push -u origin main
```

**如果提示 `remote origin already exists`**（之前加过），改成：

```bash
git remote set-url origin https://github.com/你的用户名/empty-classroom.git
git push -u origin main
```

第一次推送会弹窗让你登录 GitHub —— 选 **Sign in with your browser**，在浏览器里点授权就行，不用输密码。

---

## 第 4 步：确认

打开 `https://github.com/你的用户名/empty-classroom`，应该能看到：

```
assets/       app.js  core.js  style.css
tests/        test_core.cjs
tools/        make_docs.py  build_deploy.py
参赛包/        （手册、答辩包、部署包）
index.html
README.md      ← 顶部有演示地址
协作规则.md
```

---

## 推上去之后，可选的两件事

**A. 让 Netlify 自动部署**（以后改完 push 就更新）

Netlify 站点 → `Site configuration` → `Build & deploy` → `Link repository`
→ 选 `empty-classroom` → Build command **留空**，Publish directory 填 `/` → 保存

**B. 开 GitHub Pages 当备用链接**（大陆偶尔打不开，多一个总没错）

仓库 → `Settings` → `Pages` → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)` → Save
两分钟后得到 `https://你的用户名.github.io/empty-classroom/`

> 注意：Pages 用的是**多文件版**（index.html + assets/），它能正确处理目录，
> 不会像拖 zip 那样丢文件。但保险起见，还是先测一下样式有没有加载。

---

## 常见问题

**推送被拒（rejected / fetch first）**
说明远程仓库不是空的。删掉那个仓库重建，或者先 `git pull --rebase origin main` 再推。

**要求输密码**
GitHub 早就不支持密码了。装 Git for Windows 的话会自动弹浏览器授权；没有的话去
`Settings → Developer settings → Personal access tokens` 生成一个，当密码用。

**文件太大推不上去**
这个仓库总共约 300 KB，不会超。如果以后加了视频，别提交进 git，传到网盘贴链接。
