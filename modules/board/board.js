/**
 * V4/modules/board/board.js
 * Cœur de l'éditeur tactique : Initialisation et gestion globale.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // =========================================================
    // 1. SÉCURITÉ ET INITIALISATION DE L'ÉTAT (window.ORB)
    // =========================================================
    if (!window.ORB) window.ORB = {};
    if (!window.ORB.history) window.ORB.history = [];
    if (!window.ORB.redoStack) window.ORB.redoStack = [];
    
    if (!window.ORB.commitState) {
        window.ORB.commitState = function() {
            window.ORB.history.push(JSON.parse(JSON.stringify(window.ORB.playbookState)));
        }
    }

    // =========================================================
    // 2. CONFIGURATION DU TERRAIN (Canvas)
    // =========================================================
    window.ORB.canvas = document.getElementById('basketball-court');
    window.ORB.ctx = window.ORB.canvas.getContext('2d');
    window.ORB.animCanvas = document.getElementById('animation-canvas');
    if (window.ORB.animCanvas) window.ORB.animCtx = window.ORB.animCanvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = window.ORB.canvas.getBoundingClientRect();
    window.ORB.canvas.width = rect.width * dpr;
    window.ORB.canvas.height = rect.height * dpr;
    window.ORB.ctx.scale(dpr, dpr);

    // =========================================================
    // 3. LANCEMENT DES SYSTÈMES ET MODULES
    // =========================================================
    if (typeof orbDB !== 'undefined' && typeof orbDB.open === 'function') {
        try { await orbDB.open(); } catch (e) { console.error("Erreur DB:", e); }
    }

    if (window.ORB.ui && typeof window.ORB.ui.init === 'function') window.ORB.ui.init();
    if (window.ORB.interactions && typeof window.ORB.interactions.init === 'function') window.ORB.interactions.init();

    window.ORB.commitState();
    
    const selectTool = document.getElementById("tool-select");
    if(selectTool) selectTool.click();
    
    if (window.ORB.renderer && typeof window.ORB.renderer.redrawCanvas === 'function') {
        window.ORB.renderer.redrawCanvas();
    }

    // =========================================================
    // 4. CONNEXION AVEC LA BIBLIOTHÈQUE (Chargement & Sauvegarde)
    // =========================================================
    window.addEventListener('loadPlaybook', (e) => {
        const playbookRecord = e.detail;
        let dataToLoad = playbookRecord.playbookData || playbookRecord; 

        if (dataToLoad && dataToLoad.scenes) {
            
            if (window.ORB.normalizePlaybook) {
                window.ORB.playbookState = window.ORB.normalizePlaybook(dataToLoad);
            } else {
                window.ORB.playbookState = JSON.parse(JSON.stringify(dataToLoad));
            }
            
            // FORCER LE TERRAIN EXACT (Sécurité anti-cache)
            const savedCourtType = dataToLoad.courtType || 'full';
            window.ORB.playbookState.courtType = savedCourtType;
            
            window.ORB.appState.currentLoadedPlaybookId = playbookRecord.id || null;
            
            const nameInput = document.getElementById('play-name-input');
            if(nameInput) nameInput.value = window.ORB.playbookState.name || "";
            
            // APPLIQUER LA VUE DU TERRAIN *AVANT* LE DESSIN
            if (window.ORB.ui && typeof window.ORB.ui.setView === 'function') {
                const tempCommit = window.ORB.commitState;
                window.ORB.commitState = function(){}; // Bloque l'historique pendant le setup
                window.ORB.ui.setView(savedCourtType);
                window.ORB.commitState = tempCommit;
            }

            window.ORB.history = [];
            window.ORB.redoStack = [];
            window.ORB.commitState();
            
            if(window.ORB.ui) {
                window.ORB.ui.updateSceneListUI();
                // On bascule sur la scène (ce qui déclenche le dessin final)
                window.ORB.ui.switchToScene(0, true);
            }
        }
    });

    // =========================================================
    // 5. GESTION DES FICHIERS LOCAUX (.JSON) ET EXPORTS
    // =========================================================
    const saveFileBtn = document.getElementById('save-file-btn');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(window.ORB.playbookState, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (window.ORB.playbookState.name || "Playbook") + ".json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    const loadFileBtn = document.getElementById('load-file-btn');
    const importFileInput = document.getElementById('import-file-input');
    if (loadFileBtn && importFileInput) {
        loadFileBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let parsedData = JSON.parse(event.target.result);
                    if (parsedData.playbookData) parsedData = parsedData.playbookData;

                    if (parsedData.scenes) {
                        if (window.ORB.normalizePlaybook) {
                            window.ORB.playbookState = window.ORB.normalizePlaybook(parsedData);
                        } else {
                            window.ORB.playbookState = parsedData;
                        }

                        // FORCER LE TERRAIN EXACT
                        const savedCourtType = parsedData.courtType || 'full';
                        window.ORB.playbookState.courtType = savedCourtType;
                        
                        window.ORB.appState.currentLoadedPlaybookId = null; 
                        document.getElementById('play-name-input').value = window.ORB.playbookState.name || "";
                        
                        // APPLIQUER LA VUE DU TERRAIN *AVANT* LE DESSIN
                        if (window.ORB.ui && typeof window.ORB.ui.setView === 'function') {
                            const tempCommit = window.ORB.commitState;
                            window.ORB.commitState = function(){};
                            window.ORB.ui.setView(savedCourtType);
                            window.ORB.commitState = tempCommit;
                        }

                        window.ORB.history = [];
                        window.ORB.redoStack = [];
                        window.ORB.commitState();
                        window.ORB.ui.updateSceneListUI();
                        window.ORB.ui.switchToScene(0, true);
                        
                        const managerContainer = document.getElementById('play-manager-container');
                        if (managerContainer) managerContainer.classList.add('hidden');
                    } else {
                        alert("Ce fichier n'est pas un playbook valide.");
                    }
                } catch (err) {
                    alert("Erreur de format du fichier JSON.");
                }
            };
            reader.readAsText(file);
            e.target.value = ''; 
        });
    }

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            if (window.ORB_UTILS && window.ORB_UTILS.exportToPDF) window.ORB_UTILS.exportToPDF();
            // L'export réel est géré dans ui.js, ce listener est un fallback
        });
    }

    const exportVideoBtn = document.getElementById('export-video-btn');
    if (exportVideoBtn) {
        exportVideoBtn.addEventListener('click', () => {
            if (window.ORB_UTILS && window.ORB_UTILS.exportToVideo) window.ORB_UTILS.exportToVideo();
            // L'export réel est géré dans ui.js et animation.js
        });
    }

    // =========================================================
    // 6. AUTO-LOAD DEPUIS LE DASHBOARD (index.html)
    // =========================================================
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('bulkUpdate') === '1') {
        setTimeout(async () => {
            try {
                const allPlaybooks = await orbDB.getAllPlaybooks(true);
                for (let pb of allPlaybooks) {
                    if (window.ORB.normalizePlaybook) {
                        window.ORB.playbookState = window.ORB.normalizePlaybook(pb.playbookData);
                    } else {
                        window.ORB.playbookState = pb.playbookData;
                    }
                    window.ORB.playbookState.activeSceneIndex = 0;
                    const savedCourtType = window.ORB.playbookState.courtType || 'full';
                    window.ORB.playbookState.courtType = savedCourtType;
                    if (window.ORB.ui && typeof window.ORB.ui.setView === 'function') {
                        const tempCommit = window.ORB.commitState;
                        window.ORB.commitState = function(){};
                        window.ORB.ui.setView(savedCourtType);
                        window.ORB.commitState = tempCommit;
                    }
                    window.ORB.renderer.redrawCanvas();
                    
                    const newPreview = await window.ORB.ui.getSnapshot(false, true);
                    const r = { id: pb.id, name: pb.name, playbookData: pb.playbookData, preview: newPreview, createdAt: pb.createdAt, tagIds: pb.tagIds, folderIds: pb.folderIds };
                    await new Promise(res => {
                        const req = orbDB.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks').put(r);
                        req.onsuccess = res;
                    });
                }
                alert("✅ Tous les aperçus ont été regénérés avec succès !");
            } catch (e) {
                console.error(e);
                alert("❌ Erreur pendant la mise à jour massive.");
            }
            window.location.href = '../library/library.html';
        }, 800);
        return;
    }

    const pendingLoadId = localStorage.getItem('orb_pending_load_id');
    if (pendingLoadId) {
        localStorage.removeItem('orb_pending_load_id'); 
        setTimeout(async () => {
            try {
                const playbookRecord = await orbDB.getPlaybook(parseInt(pendingLoadId, 10));
                if (playbookRecord) {
                    const loadEvent = new CustomEvent('loadPlaybook', { detail: playbookRecord });
                    window.dispatchEvent(loadEvent);
                }
            } catch (e) {
                console.error("Erreur lors de l'auto-load:", e);
            }
        }, 300);
    }
});

window.addEventListener('resize', () => {
    if (window.ORB && window.ORB.renderer && typeof window.ORB.renderer.resizeCanvas === 'function') {
        window.ORB.renderer.resizeCanvas();
    }
});