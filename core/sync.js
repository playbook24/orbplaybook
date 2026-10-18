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

    showConnectedIndicator: function() { return; // Removed because redundant with the Drive card
        let indicator = document.getElementById('drive-connected-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'drive-connected-indicator';
            indicator.style.position = 'fixed';
            indicator.style.top = '15px';
            indicator.style.right = '20px';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.gap = '8px';
            indicator.style.background = 'rgba(255,255,255,0.05)';
            indicator.style.padding = '8px 12px';
            indicator.style.borderRadius = '20px';
            indicator.style.border = '1px solid var(--color-primary)';
            indicator.style.color = 'var(--color-primary)';
            indicator.style.fontSize = '0.9em';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '10000';
            indicator.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z"/></svg> Connecté`;
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'flex';
    },

    hideConnectedIndicator: function() {
        let indicator = document.getElementById('drive-connected-indicator');
        if (indicator) indicator.style.display = 'none';
    },

    // 1. INJECTION AUTOMATIQUE DE GOOGLE IDENTITY SERVICES (GIS)
    injectGoogleScripts: function() {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                return resolve();
            }
            const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve());
                const interval = setInterval(() => {
                    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
                setTimeout(() => { clearInterval(interval); resolve(); }, 4000);
            } else {
                const gsi = document.createElement('script');
                gsi.src = 'https://accounts.google.com/gsi/client';
                gsi.async = true;
                gsi.defer = true;
                gsi.onload = () => resolve();
                document.head.appendChild(gsi);
            }
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
        toast.style.background = isSuccess ? '#BB9243' : '#111111';
        toast.style.color = isSuccess ? '#111111' : '#BB9243';
        toast.style.border = '1px solid #BB9243';
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

        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        sessionStorage.setItem('orb_drive_token', this.accessToken);
                        this.onLoginSuccess();
                    } else if (tokenResponse && tokenResponse.error) {
                        console.error("Erreur d'authentification Google:", tokenResponse.error);
                    }
                },
            });
        }

        const savedToken = sessionStorage.getItem('orb_drive_token');
        if (savedToken) {
            this.accessToken = savedToken;
            this.onLoginSuccess();
        }

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
                    if (!this.tokenClient && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.CLIENT_ID,
                            scope: this.SCOPES,
                            callback: (tokenResponse) => {
                                if (tokenResponse && tokenResponse.access_token) {
                                    this.accessToken = tokenResponse.access_token;
                                    sessionStorage.setItem('orb_drive_token', this.accessToken);
                                    this.onLoginSuccess();
                                } else if (tokenResponse && tokenResponse.error) {
                                    console.error("Erreur d'authentification Google:", tokenResponse.error);
                                }
                            },
                        });
                    }
                    if (this.tokenClient) {
                        this.tokenClient.requestAccessToken();
                    } else {
                        console.error("Google Identity Services non disponible.");
                        alert("Le service d'authentification Google n'est pas encore prêt. Veuillez réessayer dans un instant.");
                    }
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
        
        this.showConnectedIndicator();
        await this.findOrCreateBackupFile();

        if (this.isManualLogin) {
            this.isManualLogin = false;
        }
    },

    logout: function() {
        if (this.accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
            try {
                google.accounts.oauth2.revoke(this.accessToken, () => {});
            } catch (e) {
                console.warn("Erreur lors de la révocation du token:", e);
            }
        }
        this.accessToken = null;
        this.fileId = null;
        sessionStorage.removeItem('orb_drive_token');
        this.hideConnectedIndicator();
        
        const loginText = document.getElementById('drive-login-text');
        const actions = document.getElementById('drive-actions');
        
        if(loginText) loginText.textContent = "Google Drive";
        if(actions) actions.style.display = 'none';
    },

    findOrCreateBackupFile: async function() {
        if (!this.accessToken) return null;
        try {
            const listUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=nextPageToken,files(id,name)&pageSize=10';
            const response = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.accessToken
                }
            });

            if (response.status === 401 || response.status === 403) {
                console.error(`Erreur d'authentification Drive API (${response.status})`);
                this.logout();
                return null;
            }

            if (!response.ok) {
                throw new Error(`Drive API list failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const files = data.files;

            if (files && files.length > 0) {
                this.fileId = files[0].id;
            } else {
                const createUrl = 'https://www.googleapis.com/drive/v3/files';
                const fileMetadata = {
                    name: 'orb_tactical_sync.json',
                    parents: ['appDataFolder']
                };
                const createResponse = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + this.accessToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(fileMetadata)
                });

                if (createResponse.status === 401 || createResponse.status === 403) {
                    console.error(`Erreur création fichier Drive API (${createResponse.status})`);
                    this.logout();
                    return null;
                }

                if (!createResponse.ok) {
                    throw new Error(`Drive API create failed: ${createResponse.status} ${createResponse.statusText}`);
                }

                const createdFile = await createResponse.json();
                this.fileId = createdFile.id;
            }
            return this.fileId;
        } catch (err) {
            console.error("Erreur Drive API:", err);
            return null;
        }
    },

    uploadToDrive: async function() {
        if (!this.accessToken) return false;

        if (!this.fileId) {
            await this.findOrCreateBackupFile();
        }
        if (!this.fileId) return false;

        try {
            this.showToast("Sauvegarde en cours...");

            // 🟢 NOUVEAU : Ajout de "folders" à la sauvegarde
            const backupData = {
                playbooks: await orbDB.getAllPlaybooks(true),
                trainingPlans: await orbDB.getAllPlans(),
                tags: await orbDB.getAllTags(),
                folders: await orbDB.getAllFolders(), // <-- ICI
                planFolders: await orbDB.getAllPlanFolders(),
                calendarEvents: await orbDB.getAllCalendarEvents(),
                players: await orbDB.getAllPlayers(),
                teams: await orbDB.getAllTeams(),
                sheets: await orbDB.getAllSheets(),
                sheetTags: await orbDB.getAllSheetTags(),
                sheetFolders: await orbDB.getAllSheetFolders()
            };

            const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': 'Bearer ' + this.accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backupData)
            });

            if (uploadResponse.status === 401 || uploadResponse.status === 403) {
                console.error(`Erreur d'authentification Drive API (${uploadResponse.status})`);
                this.logout();
                this.showToast("Session expirée, veuillez vous reconnecter");
                return false;
            }

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
            }
            
            this.showToast("Sauvegardé sur Drive !", true);
            
            const pushBtn = document.getElementById('btn-drive-push');
            if (pushBtn) {
                let oldText = pushBtn.innerHTML;
                pushBtn.innerHTML = "Sauvegardé !";
                pushBtn.style.background = "#BB9243";
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
            this.showToast("Erreur de sauvegarde");
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
            this.showToast("Téléchargement...");

            const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.accessToken
                }
            });

            if (downloadResponse.status === 401 || downloadResponse.status === 403) {
                console.error(`Erreur d'authentification Drive API (${downloadResponse.status})`);
                this.logout();
                this.showToast("Session expirée, veuillez vous reconnecter");
                return false;
            }

            if (!downloadResponse.ok) {
                throw new Error(`Download failed: ${downloadResponse.status} ${downloadResponse.statusText}`);
            }

            const data = await downloadResponse.json();
            
            if (data && typeof data === 'object') {
                // 🟢 NOUVEAU : Ajout de "folders" dans la transaction de restauration
                const tx = orbDB.db.transaction(['playbooks', 'trainingPlans', 'tags', 'folders', 'planFolders', 'calendarEvents', 'players', 'teams', 'sheets', 'sheetTags', 'sheetFolders'], 'readwrite');
                
                const clearAndAdd = (storeName, items) => {
                    const store = tx.objectStore(storeName);
                    store.clear();
                    if (items && items.length) items.forEach(item => store.add(item));
                };

                clearAndAdd('playbooks', data.playbooks);
                clearAndAdd('trainingPlans', data.trainingPlans);
                clearAndAdd('tags', data.tags);
                clearAndAdd('folders', data.folders); // <-- ICI
                clearAndAdd('planFolders', data.planFolders);
                clearAndAdd('calendarEvents', data.calendarEvents);
                clearAndAdd('players', data.players);
                clearAndAdd('teams', data.teams);
                clearAndAdd('sheets', data.sheets);
                clearAndAdd('sheetTags', data.sheetTags);
                clearAndAdd('sheetFolders', data.sheetFolders);
                
                tx.oncomplete = () => {
                    this.showToast("Restauration réussie !", true);
                    setTimeout(() => window.location.reload(), 1000); 
                };
            }
            return true;
        } catch(e) {
            console.error("Erreur de téléchargement :", e);
            this.showToast("Erreur de téléchargement");
            return false;
        }
    }
};

const originalClear = sessionStorage.clear;
sessionStorage.clear = function() {
    const token = sessionStorage.getItem('orb_drive_token');
    originalClear.apply(sessionStorage);
    if (token) sessionStorage.setItem('orb_drive_token', token);
};

document.addEventListener('DOMContentLoaded', () => {
    ORBSync.init();
});