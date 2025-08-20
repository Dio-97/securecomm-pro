# 🚀 Guida Deploy GitHub Actions

## ✅ Sistema Configurato

GitHub Actions è stato configurato per **build automatico APK Android** ogni volta che fai push del codice!

### 🎯 Cosa Succede Automaticamente

1. **Push codice** → GitHub Actions si attiva
2. **Build web app** → Genera versione ottimizzata  
3. **Sync Capacitor** → Prepara progetto Android
4. **Genera APK** → Crea file installabili
5. **Upload automatico** → APK disponibili per download

## 📋 Come Usare

### **1. Setup Iniziale**
```bash
# Inizializza repository Git (se non fatto)
git init
git add .
git commit -m "Initial SecureComm Pro setup"

# Crea repository su GitHub e collega
git remote add origin https://github.com/TUO_USERNAME/securecomm-pro.git
git push -u origin main
```

### **2. Push per Build Automatico**
```bash
# Ogni volta che modifichi il codice:
git add .
git commit -m "Nuove funzionalità aggiunte"
git push

# ✨ GitHub Actions builderà automaticamente l'APK!
```

### **3. Download APK Generati**

#### **Opzione A: Artifacts (Build Ogni Push)**
1. Vai su **GitHub → Actions tab**
2. Click sull'ultimo **workflow completato**
3. Scorri giù → **Artifacts**
4. Download **securecomm-debug** o **securecomm-release**

#### **Opzione B: Releases (Build con Tag)**
```bash
# Crea release con tag
git tag v1.0.0
git push origin v1.0.0

# ✨ Crea automaticamente GitHub Release con APK!
```

### **4. Installazione APK**
1. **Trasferisci** APK su dispositivo Android
2. **Abilita** "Origini sconosciute" in Impostazioni
3. **Installa** APK toccandolo
4. **Avvia** SecureComm Pro!

## 🔧 Configurazioni Avanzate

### **Firma APK (Opzionale)**
Per APK firmati per distribuzione:

1. **Genera keystore**:
```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias securecomm
```

2. **Aggiungi secrets GitHub**:
   - `KEYSTORE_FILE` (file base64)
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

### **Deploy Web Automatico**
Il workflow include anche deploy automatico della versione web su GitHub Pages!

### **Personalizzazioni**
- **Modifiche**: Cambia versioni, aggiungi test, personalizza nomi
- **Triggers**: Aggiungi trigger per branch specifici
- **Notifiche**: Configura notifiche Discord/Slack

## 🎯 Workflow Tipico

```
📝 Sviluppi funzionalità localmente
    ↓
🔄 git push → GitHub Actions si attiva
    ↓  
⚙️ Build automatico (web + Android)
    ↓
📱 APK pronti per download
    ↓
📲 Installi su dispositivi Android
```

## 💡 Vantaggi

- ✅ **Zero configurazione** dopo setup iniziale
- ✅ **Build automatici** ad ogni modifica
- ✅ **APK sempre aggiornati** con latest features
- ✅ **Versioning automatico** con tags
- ✅ **Distribution pronta** via GitHub Releases
- ✅ **CI/CD professionale** per team development

**L'app si builderà automaticamente e sarà sempre disponibile per download!** 🚀