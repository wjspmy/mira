# 发版流程（维护者）

推 `vX.Y.Z` tag 会触发 [`.github/workflows/release.yml`](../.github/workflows/release.yml)，在 Windows 上打包并创建 Draft Release。

## 产物

| 文件 | 用途 |
|------|------|
| `Mira_X.Y.Z_x64-portable.exe` | 免安装，用户双击即可运行 |
| `Mira_X.Y.Z_x64-setup.exe` | NSIS 安装包 |
| `Mira_X.Y.Z_x64_en-US.msi` | MSI 安装包 |

## 步骤

1. 同时修改三处版本号为 `X.Y.Z`：
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
2. 提交并推送 `main`
3. 打 tag 并推送
4. 等 Actions 成功，到 Releases 检查 Draft 中的资产
5. 确认无误后 **Publish release**

```powershell
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: release vX.Y.Z"
git push origin main

git tag vX.Y.Z
git push origin vX.Y.Z
```

## 注意

- Actions 用的是 **tag 指向的提交**，不是 `main` 最新。只对旧 tag 点 Re-run 不会带上新代码。
- 发版相关改动若要重打：先推到 `main`，再更新 tag：

```powershell
git tag -f vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git push origin vX.Y.Z
```

- MSI 描述不能含中文等非 Latin-1 字符（WiX code page 1252），否则 `light.exe` 失败。见 `src-tauri/tauri.conf.json` 的 `fileAssociations.description`。
- Draft Release 只有仓库有写权限的账号可见；Publish 后所有人才能下载。
