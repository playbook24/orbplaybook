/**
 * core/db.js
 * VERSION V5 - Ajout du système de Dossiers et Tags spécifiques
 */

class ORBDatabase {
    constructor() {
        this.dbName = 'ORB_Playbook_Reset_v4';
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            if (this.db) { resolve(this.db); return; }
            const request = indexedDB.open(this.dbName, 13); 
            request.onerror = (e) => { console.error("Erreur d'ouverture BDD", e); reject("Erreur BDD"); };
            request.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('playbooks')) db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('trainingPlans')) db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('calendarEvents')) db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('players')) db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('teams')) db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('sheets')) db.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('sheetTags')) db.createObjectStore('sheetTags', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('planFolders')) db.createObjectStore('planFolders', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('sheetFolders')) db.createObjectStore('sheetFolders', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('archiveTags')) db.createObjectStore('archiveTags', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('planTags')) db.createObjectStore('planTags', { keyPath: 'id', autoIncrement: true });
            };
        });
    }

    _triggerSync() {
        if (typeof ORBSync !== 'undefined' && ORBSync.accessToken) { 
            ORBSync.uploadToDrive(); 
        }
    }

    _base64ToBlob(dataURI) {
        if (!dataURI || typeof dataURI !== 'string' || !dataURI.startsWith('data:image')) return dataURI;
        try {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            return new Blob([ab], {type: mimeString});
        } catch(e) { return null; }
    }

    // --- DOSSIERS (FOLDERS) ---
    async getAllFolders() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['folders'], 'readonly').objectStore('folders').getAll().onsuccess = e => res(e.target.result); }); }
    async addFolder(name) { if (!this.db) await this.open(); return new Promise((res, rej) => { const req = this.db.transaction(['folders'], 'readwrite').objectStore('folders').add({name}); req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; req.onerror = e => rej(e);}); }
    async deleteFolder(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['folders'], 'readwrite').objectStore('folders').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- ARCHIVE TAGS ---
    async getAllArchiveTags() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['archiveTags'], 'readonly').objectStore('archiveTags').getAll().onsuccess = e => res(e.target.result); }); }
    async saveArchiveTag(tag) { 
        if (!this.db) await this.open(); 
        return new Promise((res, rej) => { 
            const req = this.db.transaction(['archiveTags'], 'readwrite').objectStore('archiveTags').put(tag); 
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        }); 
    }
    async deleteArchiveTag(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['archiveTags'], 'readwrite').objectStore('archiveTags').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- PLAYBOOKS ---
    async savePlaybook(data, preview, id = null) { 
        if (!this.db) await this.open(); 
        let existingTagIds = [];
        let existingFolderIds = [];
        let createdAt = new Date().toISOString();
        if (id) {
            try {
                const existing = await this.getPlaybook(id, true);
                if (existing) { 
                    existingTagIds = data.tagIds !== undefined ? data.tagIds : (existing.tagIds || []); 
                    existingFolderIds = data.folderIds !== undefined ? data.folderIds : (existing.folderIds || []); 
                    createdAt = existing.createdAt || createdAt; 
                }
            } catch(e) {}
        } else {
            if (data.tagIds) existingTagIds = data.tagIds; 
            if (data.folderIds) existingFolderIds = data.folderIds; 
        }

        return new Promise((res) => { 
            const s = this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks'); 
            const r = { name: data.name || 'Sans nom', playbookData: data, preview: preview, createdAt: createdAt, tagIds: existingTagIds, folderIds: existingFolderIds }; 
            if (id) r.id = id; 
            const req = id ? s.put(r) : s.add(r); 
            req.onsuccess = e => { 
                this._triggerSync(); 
                res(e.target.result); 
            }; 
        }); 
    }
    
    async getAllPlaybooks(raw = false) { 
        if (!this.db) await this.open(); 
        return new Promise(res => { 
            this.db.transaction(['playbooks'], 'readonly').objectStore('playbooks').getAll().onsuccess = e => {
                let results = e.target.result || [];
                if (!raw) {
                    results = results.map(pb => {
                        let pbCopy = { ...pb };
                        if (pbCopy.preview && typeof pbCopy.preview === 'string') {
                            pbCopy.preview = this._base64ToBlob(pbCopy.preview);
                        }
                        return pbCopy;
                    });
                }
                res(results);
            }; 
        }); 
    }
    
    async getPlaybook(id, raw = false) { 
        if (!this.db) await this.open(); 
        return new Promise(res => { 
            this.db.transaction(['playbooks'], 'readonly').objectStore('playbooks').get(id).onsuccess = e => {
                let pb = e.target.result;
                if (!pb) return res(null);
                
                let pbCopy = { ...pb };
                if (!raw && pbCopy.preview && typeof pbCopy.preview === 'string') {
                    pbCopy.preview = this._base64ToBlob(pbCopy.preview);
                }
                res(pbCopy);
            }; 
        }); 
    }
    
    async deletePlaybook(id) { 
        if (!this.db) await this.open(); 
        return new Promise(res => { 
            this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks').delete(id).onsuccess = () => { 
                this._triggerSync(); 
                res(true); 
            }; 
        }); 
    }
    
    // --- SÉANCES (PLANNER) ---
    async savePlan(data, id = null) { 
        if (!this.db) await this.open(); 
        let existingFolderIds = [];
        let existingTagIds = [];
        if (id) {
            try {
                const existing = await this.getPlan(id);
                if (existing) {
                    existingFolderIds = data.folderIds !== undefined ? data.folderIds : (existing.folderIds || []);
                }
            } catch(e) {}
        } else {
            if (data.folderIds) existingFolderIds = data.folderIds;
        }

        return new Promise((res, rej) => { 
            const s = this.db.transaction(['trainingPlans'], 'readwrite').objectStore('trainingPlans'); 
            const dataToSave = { ...data, folderIds: existingFolderIds };
            if (id) dataToSave.id = id; else delete dataToSave.id; 
            const req = id ? s.put(dataToSave) : s.add(dataToSave); 
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        }); 
    }
    async getAllPlans() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['trainingPlans'], 'readonly').objectStore('trainingPlans').getAll().onsuccess = e => res(e.target.result); }); }
    async getPlan(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['trainingPlans'], 'readonly').objectStore('trainingPlans').get(id).onsuccess = e => res(e.target.result); }); }
    async deletePlan(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['trainingPlans'], 'readwrite').objectStore('trainingPlans').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }
    async assignFoldersToPlan(planId, folderIds) { if (!this.db) await this.open(); return new Promise(async (res, rej) => { const plan = await this.getPlan(planId); if (!plan) return rej("Introuvable"); plan.folderIds = folderIds; this.db.transaction(['trainingPlans'], 'readwrite').objectStore('trainingPlans').put(plan).onsuccess = () => { this._triggerSync(); res(true); }; }); }
    async assignTagsToPlan(planId, tagIds) { if (!this.db) await this.open(); return new Promise(async (res, rej) => { const plan = await this.getPlan(planId); if (!plan) return rej("Introuvable"); plan.tagIds = tagIds; this.db.transaction(['trainingPlans'], 'readwrite').objectStore('trainingPlans').put(plan).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- DOSSIERS DE SÉANCES ET TAGS (PLANNER) ---
    async getAllPlanFolders() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['planFolders'], 'readonly').objectStore('planFolders').getAll().onsuccess = e => res(e.target.result); }); }
    async addPlanFolder(name) { if (!this.db) await this.open(); return new Promise((res, rej) => { const req = this.db.transaction(['planFolders'], 'readwrite').objectStore('planFolders').add({name}); req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; req.onerror = e => rej(e);}); }
    async deletePlanFolder(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['planFolders'], 'readwrite').objectStore('planFolders').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    async getAllPlanTags() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['planTags'], 'readonly').objectStore('planTags').getAll().onsuccess = e => res(e.target.result); }); }
    async addPlanTag(name, folderId = null) { if (!this.db) await this.open(); return new Promise(async (res, rej) => { const tags = await this.getAllPlanTags(); if (tags.find(t => t.name.toLowerCase() === name.toLowerCase() && t.folderId == folderId)) return rej("Tag existe déjà"); const req = this.db.transaction(['planTags'], 'readwrite').objectStore('planTags').add({name, folderId}); req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; req.onerror = e => rej(e);}); }
    async deletePlanTag(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['planTags'], 'readwrite').objectStore('planTags').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- TAGS ---
    async getAllTags() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['tags'], 'readonly').objectStore('tags').getAll().onsuccess = e => res(e.target.result); }); }
    // 🟢 NOUVEAU : Ajout de folderId
    async addTag(name, folderId = null) { if (!this.db) await this.open(); return new Promise((res, rej) => { const req = this.db.transaction(['tags'], 'readwrite').objectStore('tags').add({name, folderId}); req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; req.onerror = e => rej(e);}); }
    async deleteTag(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['tags'], 'readwrite').objectStore('tags').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }
    
    async assignTagsToPlaybook(playbookId, tagIds) { if (!this.db) await this.open(); return new Promise(async (res, rej) => { const playbook = await this.getPlaybook(playbookId, true); if (!playbook) return rej("Introuvable"); playbook.tagIds = tagIds; this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks').put(playbook).onsuccess = () => { this._triggerSync(); res(true); }; }); }
    async assignFoldersToPlaybook(playbookId, folderIds) { if (!this.db) await this.open(); return new Promise(async (res, rej) => { const playbook = await this.getPlaybook(playbookId, true); if (!playbook) return rej("Introuvable"); playbook.folderIds = folderIds; this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks').put(playbook).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- CALENDRIER ---
    async saveCalendarEvent(data) {
        if (!this.db) await this.open();
        return new Promise((res, rej) => {
            const s = this.db.transaction(['calendarEvents'], 'readwrite').objectStore('calendarEvents');
            const dataToSave = { ...data };
            if (!dataToSave.id) delete dataToSave.id; 
            const req = dataToSave.id ? s.put(dataToSave) : s.add(dataToSave);
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        });
    }
    async getAllCalendarEvents() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['calendarEvents'], 'readonly').objectStore('calendarEvents').getAll().onsuccess = e => res(e.target.result); }); }
    async deleteCalendarEvent(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['calendarEvents'], 'readwrite').objectStore('calendarEvents').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- EFFECTIFS - ÉQUIPES ---
    async saveTeam(data) {
        if (!this.db) await this.open();
        return new Promise((res, rej) => {
            const s = this.db.transaction(['teams'], 'readwrite').objectStore('teams');
            const dataToSave = { ...data };
            if (!dataToSave.id) delete dataToSave.id; 
            const req = dataToSave.id ? s.put(dataToSave) : s.add(dataToSave);
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        });
    }
    async getAllTeams() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['teams'], 'readonly').objectStore('teams').getAll().onsuccess = e => res(e.target.result); }); }
    async deleteTeam(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['teams'], 'readwrite').objectStore('teams').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }

    // --- EFFECTIFS - JOUEURS ---
    async savePlayer(data) {
        if (!this.db) await this.open();
        return new Promise((res, rej) => {
            const s = this.db.transaction(['players'], 'readwrite').objectStore('players');
            const dataToSave = { ...data };
            if (!dataToSave.id) delete dataToSave.id; 
            const req = dataToSave.id ? s.put(dataToSave) : s.add(dataToSave);
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        });
    }
    async getAllPlayers() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['players'], 'readonly').objectStore('players').getAll().onsuccess = e => { let p = e.target.result || []; p.sort((a,b) => (a.lastName||'').localeCompare(b.lastName||'')); res(p); }; }); }
    async deletePlayer(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['players'], 'readwrite').objectStore('players').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }
    
    // --- FICHES PDF (SHEETS) ---
    async saveSheet(data, id = null) {
        if (!this.db) await this.open();
        let existingFolderIds = [];
        if (id) {
            try {
                const existing = await new Promise(resolve => {
                    this.db.transaction(['sheets'], 'readonly').objectStore('sheets').get(id).onsuccess = e => resolve(e.target.result);
                });
                if (existing) {
                    existingFolderIds = data.folderIds !== undefined ? data.folderIds : (existing.folderIds || []);
                }
            } catch(e) {}
        } else {
            if (data.folderIds) existingFolderIds = data.folderIds;
        }

        return new Promise((res, rej) => {
            const s = this.db.transaction(['sheets'], 'readwrite').objectStore('sheets');
            const dataToSave = { ...data, folderIds: existingFolderIds };
            if (id) dataToSave.id = id; else delete dataToSave.id;
            const req = id ? s.put(dataToSave) : s.add(dataToSave);
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        });
    }
    
    async getAllSheets() { 
        if (!this.db) await this.open(); 
        return new Promise(res => { 
            this.db.transaction(['sheets'], 'readonly').objectStore('sheets').getAll().onsuccess = e => res(e.target.result); 
        }); 
    }

    // --- TAGS DES FICHES PDF (SHEET TAGS) ---
    async addSheetTag(name) { 
        if (!this.db) await this.open(); 
        return new Promise((res, rej) => { 
            const req = this.db.transaction(['sheetTags'], 'readwrite').objectStore('sheetTags').add({name}); 
            req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; 
            req.onerror = e => rej(e);
        }); 
    }
    
    async getAllSheetTags() { 
        if (!this.db) await this.open(); 
        return new Promise(res => { 
            this.db.transaction(['sheetTags'], 'readonly').objectStore('sheetTags').getAll().onsuccess = e => res(e.target.result); 
        }); 
    }

    // --- DOSSIERS DES FICHES PDF (SHEETFOLDERS) ---
    async getAllSheetFolders() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['sheetFolders'], 'readonly').objectStore('sheetFolders').getAll().onsuccess = e => res(e.target.result); }); }
    async addSheetFolder(name) { if (!this.db) await this.open(); return new Promise((res, rej) => { const req = this.db.transaction(['sheetFolders'], 'readwrite').objectStore('sheetFolders').add({name}); req.onsuccess = e => { this._triggerSync(); res(e.target.result); }; req.onerror = e => rej(e);}); }
    async deleteSheetFolder(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['sheetFolders'], 'readwrite').objectStore('sheetFolders').delete(id).onsuccess = () => { this._triggerSync(); res(true); }; }); }
}
const orbDB = new ORBDatabase();