const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const fsConstants = require('node:fs').constants
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const DEV_URL = 'http://127.0.0.1:5173'

function createWindow() {
  const window = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 640,
    title: 'APK Resigner',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f4f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (!app.isPackaged) {
    window.loadURL(DEV_URL)
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

async function isExecutable(file) {
  try {
    await fs.access(file, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function findNewestBuildTool(sdkRoot, toolName) {
  if (!sdkRoot) return ''
  const buildTools = path.join(sdkRoot, 'build-tools')
  try {
    const versions = await fs.readdir(buildTools)
    const candidates = versions
      .map((version) => ({ version, file: path.join(buildTools, version, toolName) }))
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
    for (const candidate of candidates) {
      if (await isExecutable(candidate.file)) return candidate.file
    }
  } catch {
    return ''
  }
  return ''
}

async function detectEnvironment() {
  const sdkCandidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
  ].filter(Boolean)

  let apksigner = ''
  for (const sdk of sdkCandidates) {
    apksigner = await findNewestBuildTool(sdk, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner')
    if (apksigner) break
  }

  const javaHomes = [
    process.env.JAVA_HOME,
    process.platform === 'darwin' ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : '',
    process.platform === 'darwin' ? '/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home' : '',
  ].filter(Boolean)
  let javaHome = ''
  for (const candidate of javaHomes) {
    const java = path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    if (await isExecutable(java)) {
      javaHome = candidate
      break
    }
  }

  return { apksigner, javaHome, ready: Boolean(apksigner && javaHome) }
}

function run(command, args, env, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, shell: false, windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(input)
  })
}

function validateRequest(request) {
  const required = ['apkPath', 'keystorePath', 'alias', 'storePassword', 'keyPassword', 'outputPath']
  for (const field of required) {
    if (typeof request?.[field] !== 'string' || !request[field].trim()) {
      throw new Error(`缺少必填项：${field}`)
    }
  }
  if (!request.apkPath.toLowerCase().endsWith('.apk')) throw new Error('输入文件必须是 APK')
  if (!request.outputPath.toLowerCase().endsWith('.apk')) throw new Error('输出文件必须以 .apk 结尾')
  if (path.resolve(request.apkPath) === path.resolve(request.outputPath)) throw new Error('输出文件不能覆盖输入 APK')
}

async function registerHandlers() {
  ipcMain.handle('environment:get', detectEnvironment)
  ipcMain.handle('file:choose-apk', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Android APK', extensions: ['apk'] }] })
    return result.canceled ? '' : result.filePaths[0]
  })
  ipcMain.handle('file:choose-keystore', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Keystore', extensions: ['keystore', 'jks', 'ks'] }, { name: 'All files', extensions: ['*'] }] })
    return result.canceled ? '' : result.filePaths[0]
  })
  ipcMain.handle('file:choose-output', async (_event, defaultPath) => {
    const result = await dialog.showSaveDialog({ defaultPath, filters: [{ name: 'Android APK', extensions: ['apk'] }] })
    return result.canceled ? '' : result.filePath
  })
  ipcMain.handle('apk:sign', async (_event, request) => {
    validateRequest(request)
    const environment = await detectEnvironment()
    if (!environment.ready) throw new Error('未找到 apksigner 或 Java，请先安装 Android Studio 与 Android SDK Build-Tools')
    await fs.access(request.apkPath)
    await fs.access(request.keystorePath)
    try {
      await fs.access(request.outputPath)
      throw new Error('输出文件已存在，请换一个文件名')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }

    const env = {
      ...process.env,
      JAVA_HOME: environment.javaHome,
      PATH: `${path.join(environment.javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
    }
    const signArgs = [
      'sign', '--ks', request.keystorePath,
      '--ks-key-alias', request.alias,
      '--ks-pass', 'stdin',
      '--key-pass', 'stdin',
      '--v1-signing-enabled', 'true',
      '--v2-signing-enabled', 'true',
      '--out', request.outputPath,
      request.apkPath,
    ]
    const signed = await run(
      environment.apksigner,
      signArgs,
      env,
      `${request.storePassword}\n${request.keyPassword}\n`,
    )
    if (signed.code !== 0) {
      await fs.rm(request.outputPath, { force: true })
      throw new Error((signed.stderr || signed.stdout || '签名失败').trim())
    }

    const verified = await run(environment.apksigner, ['verify', '--verbose', '--print-certs', request.outputPath], env)
    if (verified.code !== 0) {
      await fs.rm(request.outputPath, { force: true })
      throw new Error((verified.stderr || verified.stdout || '签名验证失败').trim())
    }
    const report = `${verified.stdout}\n${verified.stderr}`.trim()
    return { outputPath: request.outputPath, report }
  })
}

app.whenReady().then(async () => {
  await registerHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
