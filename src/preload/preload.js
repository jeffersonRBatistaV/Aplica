const { contextBridge, ipcRenderer } = require('electron')

const api = {
  // ── File System ──
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),

  // ── Chat CRUD ──
  getConversations: () => ipcRenderer.invoke('chat:getAll'),
  getConversation: (id) => ipcRenderer.invoke('chat:get', id),
  saveConversation: (conversation) => ipcRenderer.invoke('chat:save', conversation),
  deleteConversation: (id) => ipcRenderer.invoke('chat:delete', id),
  renameConversation: (id, title) => ipcRenderer.invoke('chat:rename', id, title),
  archiveConversation: (id) => ipcRenderer.invoke('chat:archive', id),
  searchConversations: (query) => ipcRenderer.invoke('chat:search', query),

  // ── Settings ──
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),

  // ── Investigación en línea ──
  investigate: (userQuery, country, language) => ipcRenderer.invoke('investigate:query', userQuery, country, language),
  investigateHealth: () => ipcRenderer.invoke('investigate:health'),
  investigateDiscover: () => ipcRenderer.invoke('investigate:discover'),

  // ── Profile ──
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (profile) => ipcRenderer.invoke('profile:save', profile),

  // ── LLM Streaming ──
  sendChatMessage: (params) => ipcRenderer.invoke('llm:chat', params),
  abortChat: () => ipcRenderer.invoke('llm:abort'),
  listModels: (params) => ipcRenderer.invoke('llm:listModels', params),
  onToken: (callback) => {
    const handler = (_event, token) => callback(token)
    ipcRenderer.on('llm:token', handler)
    return () => { ipcRenderer.removeListener('llm:token', handler) }
  },
  onDone: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('llm:done', handler)
    return () => { ipcRenderer.removeListener('llm:done', handler) }
  },
  onError: (callback) => {
    const handler = (_event, error) => callback(error)
    ipcRenderer.on('llm:error', handler)
    return () => { ipcRenderer.removeListener('llm:error', handler) }
  },

  // ── Job Hub ──
  getJobs: () => ipcRenderer.invoke('job:getAll'),
  getJob: (id) => ipcRenderer.invoke('job:get', id),
  saveJob: (job) => ipcRenderer.invoke('job:save', job),
  deleteJob: (id) => ipcRenderer.invoke('job:delete', id),
  analyzeVacancy: (vacancyText) => ipcRenderer.invoke('job:analyze', vacancyText),
  correctVacancyText: (rawText) => ipcRenderer.invoke('job:correctVacancy', rawText),
  generateCoverLetters: (vacancyText, atsReport) => ipcRenderer.invoke('job:generateLetters', vacancyText, atsReport),
  generateInterviewQuestions: (vacancyText, atsReport) => ipcRenderer.invoke('job:generateQuestions', vacancyText, atsReport),

  // ── Theme ──
  getSystemTheme: () => ipcRenderer.invoke('system:getTheme'),
  onSystemThemeChange: (callback) => {
    const handler = (_event, isDark) => callback(isDark)
    ipcRenderer.on('system:themeChanged', handler)
    return () => { ipcRenderer.removeListener('system:themeChanged', handler) }
  },

  // ── OCR ──
  imageToText: (base64) => ipcRenderer.invoke('ocr:imageToText', base64),

  // ── CV ──
  generateSummaryOptions: (vacancyText, atsReport) => ipcRenderer.invoke('cv:generateSummaryOptions', vacancyText, atsReport),
  downloadCvPdf: (htmlContent, styleName) => ipcRenderer.invoke('cv:downloadPdf', htmlContent, styleName),
  regenerateCV: (params) => ipcRenderer.invoke('job:regenerateCV', params),
  generateCV: (vacancyText, atsReport, style, customPrompt, chosenSummary) => ipcRenderer.invoke('job:generateCV', vacancyText, atsReport, style, customPrompt, chosenSummary),

  // ── CV Templates ──
  getCvTemplates: () => ipcRenderer.invoke('cv:getTemplates'),
  saveCvTemplate: (template) => ipcRenderer.invoke('cv:saveTemplate', template),
  deleteCvTemplate: (id) => ipcRenderer.invoke('cv:deleteTemplate', id),
  resetCvTemplates: () => ipcRenderer.invoke('cv:resetTemplates'),
  generateSampleCv: (prompt) => ipcRenderer.invoke('cv:generateSample', prompt),

  // ── Job Categories (CV por categoría) ──
  getCategories: (areaId) => ipcRenderer.invoke('category:list', areaId),
  saveCategory: (category) => ipcRenderer.invoke('category:save', category),
  deleteCategory: (id) => ipcRenderer.invoke('category:delete', id),
  generateCategories: (areaId) => ipcRenderer.invoke('category:generate', areaId),

  // ── Career Advice ──
  getCareerAdvice: () => ipcRenderer.invoke('getCareerAdvice'),
  refreshCareerAdvice: () => ipcRenderer.invoke('refreshCareerAdvice'),

  // ── Roadmap ──
  getRoadmap: () => ipcRenderer.invoke('getRoadmap'),
  refreshRoadmap: () => ipcRenderer.invoke('refreshRoadmap'),

  // ── Data Export / Import ──
  exportAll: () => ipcRenderer.invoke('data:exportAll'),
  saveExportFile: (data, format) => ipcRenderer.invoke('data:saveExportFile', data, format),
  importFromFile: () => ipcRenderer.invoke('data:importFromFile'), // returns ImportResult
  processImportData: (fileName, content) => ipcRenderer.invoke('data:processImportData', fileName, content), // returns ImportResult

  // ── Usage ──
  getUsage: () => ipcRenderer.invoke('usage:get'),
  resetUsage: () => ipcRenderer.invoke('usage:reset'),

  // ── Currency Exchange ──
  getExchangeRate: (from, to) => ipcRenderer.invoke('currency:getRate', from, to),

  // ── Clipboard ──
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:copy', text),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),

  // ── Update ──
  startUpdateDownload: () => ipcRenderer.invoke('update:start-download'),
  quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info)
    ipcRenderer.on('update:available', handler)
    return () => { ipcRenderer.removeListener('update:available', handler) }
  },
  onUpdateProgress: (callback) => {
    const handler = (_event, progress) => callback(progress)
    ipcRenderer.on('update:progress', handler)
    return () => { ipcRenderer.removeListener('update:progress', handler) }
  },
  onInvestigatePhase: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('investigate:phase', handler)
    return () => { ipcRenderer.removeListener('investigate:phase', handler) }
  },
  onUpdateDownloaded: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('update:downloaded', handler)
    return () => { ipcRenderer.removeListener('update:downloaded', handler) }
  },
}

contextBridge.exposeInMainWorld('api', api)
