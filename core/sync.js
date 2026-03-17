/**
 * core/sync.js
 * Gestion de la synchronisation avec Google Drive (appDataFolder)
 */

const ORBSync = {
    // ⚠️ REMPLACEZ CECI PAR VOTRE VRAI CLIENT ID
    CLIENT_ID: '644339703996-3jk3jo3ih55oauvmkmt30kosf46d6a18.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.appdata',
    tokenClient: null,
    accessToken: null,
    fileId: null,
    isManualLogin: false,

    // 1. INJECTION AUTOMATIQUE DES OUTILS GOOGLE
    injectGoogleScripts: function() {
        return new Promise((resolve) => {
            let loaded = 0;
            const checkDone = () => { loaded++; if(loaded === 2) resolve(); };

            if (typeof google === 'undefined') {
                const gsi = document.createElement('script');
                gsi.src = 'https://accounts.google.com/gsi/client';
                gsi.async = true; gsi.defer = true;
                gsi.onload = checkDone;
                document.head.appendChild(gsi);
            } else { loaded++; }

            if (typeof gapi === 'undefined') {
                const gapiScript = document.createElement('script');
                gapiScript.src = 'https://apis.google.com/js/api.js';
                gapiScript.onload = checkDone;
                document.head.appendChild(gapiScript);
            } else { loaded++; }

            if(loaded === 2) resolve();
        });
    },

    // 2. NOTIFICATION VISUELLE FLOTTANTE (NOIRE ET OR)
    showToast: function(message, isSuccess = false) {
        let toast = document.getElementById('orb-sync-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'orb-sync-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '8px';
            toast.style.fontWeight = 'bold';
            toast.style.zIndex = '10000';
            toast.style.transition = 'all 0.3s ease';
            toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
            toast.style.opacity = '0';
            toast.style.pointerEvents = 'none'; 
            document.body.appendChild(toast);
        }
        toast.innerHTML = message;
        toast.style.background = isSuccess ? '#BFA98D' : '#111111';
        toast.style.color = isSuccess ? '#111111' : '#BFA98D';
        toast.style.border = '1px solid #BFA98D';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        if (isSuccess) {
            this.toastTimeout = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
            }, 2500);
        }
    },

    init: async function() {
        await this.injectGoogleScripts();

        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    this.accessToken = tokenResponse.access_token;
                    sessionStorage.setItem('orb_drive_token', this.accessToken);
                    this.onLoginSuccess();
                }
            },
        });

        const savedToken = sessionStorage.getItem('orb_drive_token');
        if (savedToken) {
            this.accessToken = savedToken;
        }

        gapi.load('client', () => {
            gapi.client.init({}).then(() => {
                gapi.client.load('drive', 'v3').then(() => {
                    if (this.accessToken) {
                        this.onLoginSuccess();
                    }
                });
            });
        });

        this.bindUI();
    },

    bindUI: function() {
        const loginBtn = document.getElementById('btn-drive-login');
        const pushBtn = document.getElementById('btn-drive-push');
        const pullBtn = document.getElementById('btn-drive-pull');

        if (loginBtn) {
            loginBtn.onclick = () => {
                if (!this.accessToken) {
                    this.isManualLogin = true;
                    this.tokenClient.requestAccessToken();
                } else {
                    this.logout();
                }
            };
        }

        if (pushBtn) {
            pushBtn.onclick = async () => {
                await this.uploadToDrive();
            };
        }

        if (pullBtn) {
            pullBtn.onclick = async () => {
                if(confirm("Attention, cela va remplacer vos données locales par celles du Cloud. Continuer ?")) {
                    await this.downloadFromDrive();
                }
            };
        }
    },

    onLoginSuccess: async function() {
        const loginText = document.getElementById('drive-login-text');
        const actions = document.getElementById('drive-actions');
        
        if(loginText) loginText.textContent = "Drive (Connecté)";
        if(actions) actions.style.display = 'flex';
        
        await this.findOrCreateBackupFile();

        if (this.isManualLogin) {
            this.isManualLogin = false;
            setTimeout(() => {
                if (confirm("☁️ Connexion Drive réussie !\n\nVoulez-vous charger la base de données sauvegardée sur votre Cloud vers cet appareil ?\n\n(Attention : Vos données locales actuelles seront écrasées)")) {
                    const pullBtn = document.getElementById('btn-drive-pull');
                    if (pullBtn) pullBtn.click();
                    else this.downloadFromDrive();
                }
            }, 500);
        }
    },

    logout: function() {
        this.accessToken = null;
        this.fileId = null;
        sessionStorage.removeItem('orb_drive_token');
        
        const loginText = document.getElementById('drive-login-text');
        const actions = document.getElementById('drive-actions');
        
        if(loginText) loginText.textContent = "Google Drive";
        if(actions) actions.style.display = 'none';
    },

    findOrCreateBackupFile: async function() {
        try {
            gapi.client.setToken({ access_token: this.accessToken });
            const response = await gapi.client.drive.files.list({
                spaces: 'appDataFolder',
                fields: 'nextPageToken, files(id, name)',
                pageSize: 10
            });

            const files = response.result.files;
            if (files && files.length > 0) {
                this.fileId = files[0].id;
            } else {
                const fileMetadata = {
                    'name': 'orb_tactical_sync.json',
                    'parents': ['appDataFolder']
                };
                const file = await gapi.client.drive.files.create({
                    resource: fileMetadata,
                    fields: 'id'
                });
                this.fileId = file.result.id;
            }
        } catch (err) {
            console.error("Erreur Drive API:", err);
            if (err.status === 401 || err.status === 403) {
                this.logout();
            }
        }
    },

    uploadToDrive: async function() {
        if (!this.accessToken) return false;

        if (!this.fileId) {
            await this.findOrCreateBackupFile();
        }
        if (!this.fileId) return false;

        try {
            this.showToast("☁️ Sauvegarde en cours...");

            // 🟢 NOUVEAU : Ajout de "folders" à la sauvegarde
            const backupData = {
                playbooks: await orbDB.getAllPlaybooks(true),
                trainingPlans: await orbDB.getAllPlans(),
                tags: await orbDB.getAllTags(),
                folders: await orbDB.getAllFolders(), // <-- ICI
                calendarEvents: await orbDB.getAllCalendarEvents(),
                players: await orbDB.getAllPlayers(),
                teams: await orbDB.getAllTeams(),
                sheets: await orbDB.getAllSheets(),
                sheetTags: await orbDB.getAllSheetTags()
            };

            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: new Headers({ 
                    'Authorization': 'Bearer ' + this.accessToken,
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(backupData)
            });
            
            this.showToast("✅ Sauvegardé sur Drive !", true);
            
            const pushBtn = document.getElementById('btn-drive-push');
            if (pushBtn) {
                let oldText = pushBtn.innerHTML;
                pushBtn.innerHTML = "✅ Sauvegardé !";
                pushBtn.style.background = "#BFA98D";
                pushBtn.style.color = "#111111";
                setTimeout(() => {
                    pushBtn.innerHTML = oldText.includes("Sauvegardé") ? "↑ Forcer l'envoi" : oldText;
                    pushBtn.style.background = "";
                    pushBtn.style.color = "";
                }, 2500);
            }
            
            return true;
        } catch(e) {
            console.error("Erreur d'upload :", e);
            this.showToast("❌ Erreur de sauvegarde");
            return false;
        }
    },

    downloadFromDrive: async function() {
        if (!this.accessToken) return false;
        
        if (!this.fileId) {
            await this.findOrCreateBackupFile();
        }
        if (!this.fileId) return false;

        try {
            this.showToast("☁️ Téléchargement...");

            const response = await gapi.client.drive.files.get({
                fileId: this.fileId,
                alt: 'media'
            });

            const data = response.result;
            
            if (data && typeof data === 'object') {
                // 🟢 NOUVEAU : Ajout de "folders" dans la transaction de restauration
                const tx = orbDB.db.transaction(['playbooks', 'trainingPlans', 'tags', 'folders', 'calendarEvents', 'players', 'teams', 'sheets', 'sheetTags'], 'readwrite');
                
                const clearAndAdd = (storeName, items) => {
                    const store = tx.objectStore(storeName);
                    store.clear();
                    if (items && items.length) items.forEach(item => store.add(item));
                };

                clearAndAdd('playbooks', data.playbooks);
                clearAndAdd('trainingPlans', data.trainingPlans);
                clearAndAdd('tags', data.tags);
                clearAndAdd('folders', data.folders); // <-- ICI
                clearAndAdd('calendarEvents', data.calendarEvents);
                clearAndAdd('players', data.players);
                clearAndAdd('teams', data.teams);
                clearAndAdd('sheets', data.sheets);
                clearAndAdd('sheetTags', data.sheetTags);
                
                tx.oncomplete = () => {
                    this.showToast("✅ Restauration réussie !", true);
                    setTimeout(() => window.location.reload(), 1000); 
                };
            }
            return true;
        } catch(e) {
            console.error("Erreur de téléchargement :", e);
            this.showToast("❌ Erreur de téléchargement");
            return false;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ORBSync.init();
});