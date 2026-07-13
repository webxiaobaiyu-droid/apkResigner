<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

const form = reactive({
  apkPath: '',
  keystorePath: '',
  alias: '',
  storePassword: '',
  keyPassword: '',
  outputPath: '',
})
const environment = ref({ ready: false, apksigner: '', javaHome: '' })
const busy = ref(false)
const result = ref(null)
const error = ref('')

const canSign = computed(() => environment.value.ready && !busy.value && Object.values(form).every((value) => value.trim()))

function suggestedOutput(apkPath) {
  return apkPath.replace(/\.apk$/i, '') + '-resigned.apk'
}

async function selectApk() {
  const selected = await window.apkSigner.chooseApk()
  if (!selected) return
  form.apkPath = selected
  form.outputPath = suggestedOutput(selected)
  clearMessages()
}

async function selectKeystore() {
  const selected = await window.apkSigner.chooseKeystore()
  if (selected) form.keystorePath = selected
  clearMessages()
}

async function selectOutput() {
  const selected = await window.apkSigner.chooseOutput(form.outputPath || suggestedOutput(form.apkPath || 'app.apk'))
  if (selected) form.outputPath = selected
  clearMessages()
}

function clearMessages() {
  result.value = null
  error.value = ''
}

async function signApk() {
  clearMessages()
  busy.value = true
  try {
    result.value = await window.apkSigner.sign({ ...form })
  } catch (reason) {
    error.value = reason?.message || String(reason)
  } finally {
    form.storePassword = ''
    form.keyPassword = ''
    busy.value = false
  }
}

onMounted(async () => {
  environment.value = await window.apkSigner.getEnvironment()
})
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">ANDROID BUILD UTILITY</p>
        <h1>APK Resigner</h1>
      </div>
      <div class="status" :class="environment.ready ? 'ready' : 'missing'">
        <span class="status-dot"></span>
        {{ environment.ready ? '签名环境就绪' : '缺少签名环境' }}
      </div>
    </header>

    <section v-if="!environment.ready" class="notice error-notice">
      未找到 Android SDK Build-Tools 或 Java。请安装 Android Studio，并在 SDK Manager 中安装 Build-Tools。
    </section>

    <section class="workspace">
      <div class="section-heading">
        <span>01</span>
        <div><h2>输入文件</h2><p>选择加固后的 APK 与原应用证书。</p></div>
      </div>
      <div class="field-grid">
        <label class="field wide">
          <span>加固 APK</span>
          <div class="file-control"><input v-model="form.apkPath" readonly placeholder="选择需要重签名的 APK" /><button type="button" @click="selectApk">选择</button></div>
        </label>
        <label class="field wide">
          <span>证书文件</span>
          <div class="file-control"><input v-model="form.keystorePath" readonly placeholder="选择 .keystore 或 .jks 文件" /><button type="button" @click="selectKeystore">选择</button></div>
        </label>
      </div>
    </section>

    <section class="workspace">
      <div class="section-heading">
        <span>02</span>
        <div><h2>证书信息</h2><p>密码仅用于本次签名，完成后立即清空。</p></div>
      </div>
      <div class="field-grid three">
        <label class="field"><span>Key Alias</span><input v-model.trim="form.alias" autocomplete="off" placeholder="例如 release" /></label>
        <label class="field"><span>Store Password</span><input v-model="form.storePassword" type="password" autocomplete="new-password" placeholder="证书库密码" /></label>
        <label class="field"><span>Key Password</span><input v-model="form.keyPassword" type="password" autocomplete="new-password" placeholder="私钥密码" /></label>
      </div>
    </section>

    <section class="workspace">
      <div class="section-heading">
        <span>03</span>
        <div><h2>输出与验证</h2><p>工具不会覆盖原 APK 或已存在的输出文件。</p></div>
      </div>
      <label class="field wide">
        <span>输出文件</span>
        <div class="file-control"><input v-model="form.outputPath" readonly placeholder="选择输出 APK 路径" /><button type="button" @click="selectOutput">选择</button></div>
      </label>
      <button class="primary" type="button" :disabled="!canSign" @click="signApk">
        <span v-if="busy" class="spinner"></span>
        {{ busy ? '正在签名并验证…' : '开始二次签名' }}
      </button>
    </section>

    <section v-if="result" class="notice success-notice">
      <strong>签名验证通过</strong>
      <p>{{ result.outputPath }}</p>
      <pre>{{ result.report }}</pre>
    </section>
    <section v-if="error" class="notice error-notice">
      <strong>签名失败</strong>
      <pre>{{ error }}</pre>
    </section>

    <footer>
      <span>apksigner</span>
      <code>{{ environment.apksigner || '未检测到' }}</code>
    </footer>
  </main>
</template>
