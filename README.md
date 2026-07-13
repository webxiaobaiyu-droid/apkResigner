# APK Resigner

一个基于 Vue 3 与 Electron 开发的本地 APK 二次签名工具。适用于 APK 经梆梆等加固服务处理后，需要使用原应用签名证书重新签名并验证的场景。

> 本项目仅供 Android 安全、应用加固与签名机制的学习和研究使用。请仅处理你本人所有或已获得明确授权的应用。严禁用于篡改、盗版、绕过授权或其他违法用途。使用者应自行承担因不当使用产生的全部责任。

## 功能特性

- 自动查找 Android SDK Build-Tools 中最新版本的 `apksigner`
- 自动检测 `JAVA_HOME`、Android Studio 或 DevEco Studio 自带的 JDK
- 支持选择加固后的 APK、JKS/Keystore、Key Alias 及签名密码
- 同时启用 APK Signature Scheme v1 与 v2
- 输出为新 APK，不覆盖原 APK 或已有文件
- 签名完成后自动运行 `apksigner verify --verbose --print-certs`
- 所有操作均在本机完成，不上传 APK、证书或密码
- 签名密码不持久化，操作完成或失败后立即从界面清空

## 使用场景

典型流程如下：

1. 使用梆梆等服务对本人或已获授权的 APK 进行加固。
2. 获得加固后、需要重新签名的 APK。
3. 在本工具中选择该 APK 和应用原有的签名证书。
4. 填写 Key Alias、证书库密码和私钥密码。
5. 选择新文件作为输出路径，执行签名。
6. 工具自动验证签名并显示证书信息。

## 环境要求

- macOS（当前打包配置）
- Android Studio 与 Android SDK Build-Tools
- Node.js 20 或更高版本（仅开发和构建时需要）
- npm 或 pnpm

如果未自动检测到环境，请确认已安装 Android SDK Build-Tools，并正确配置 `ANDROID_SDK_ROOT`、`ANDROID_HOME` 或 `JAVA_HOME`。

## 本地开发

```bash
pnpm install
pnpm dev
```

也可以使用 npm：

```bash
npm install
npm run dev
```

## 构建 macOS 应用

```bash
pnpm build
```

构建产物默认生成在 `release/`，Web 资源生成在 `dist/`。这两个目录均不会提交到仓库。

## 安全说明

- APK、AAB、JKS、Keystore 及常见私钥文件已加入 `.gitignore`，请勿将真实签名材料提交到 Git。
- 工具通过标准输入向 `apksigner` 提供密码，避免将密码直接放入命令行参数。
- 建议在可信设备上使用，并妥善备份和保管应用签名证书。
- 发布前请自行完成安装、升级兼容性与签名一致性测试。

## 技术栈

- Vue 3
- Vite
- Electron
- electron-builder
- Android SDK `apksigner`

## 免责声明

本项目按“现状”提供，不对适用性、可靠性或使用结果作任何保证。项目作者不对任何数据丢失、证书泄露、应用损坏、账号处罚或法律责任承担责任。下载、修改或使用本项目即表示你理解并同意上述说明。
