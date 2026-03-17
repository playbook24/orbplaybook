/**
 * modules/sheet/sheet.js
 * V5 - Studio PDF avec Navigation par Dossiers
 */

const SheetStudio = {
    allPlaybooks: [], allPlans: [], allSheets: [], allTags: [], allSheetTags: [], allFolders: [],
    currentMode: null, currentPlanId: null, currentSheetId: null,
    
    exoViewMode: 'FOLDERS', 
    currentExoFolderId: null,
    activeTagExo: null, 
    activeTagStorage: null,
    
    selectedElement: null, isDragging: false, isResizing: false,
    offsetX: 0, offsetY: 0, startW: 0, startH: 0, startLeft: 0, startTop: 0,
    startImgW: 0, startImgH: 0, startImgX: 0, startImgY: 0,
    resizeMode: null, aspectRatio: 1, spawnOffset: 0,

    history: [], historyIndex: -1,

    iconFolder: `<svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:var(--color-primary);"><path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/></svg>`,
    iconAll: `<svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:var(--color-primary);"><path d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16Z"/></svg>`,

    async init() {
        try {
            this.cacheDOM();
            this.bindEvents();
            await orbDB.open();
            
            window.ORB = window.ORB || {};
            window.ORB.canvas = document.getElementById('basketball-court');
            window.ORB.ctx = window.ORB.canvas.getContext('2d');
            window.ORB.appState = { selectedElement: null };

            await this.loadData();
        } catch(err) {
            console.error("Erreur critique:", err);
        }
    },

    cacheDOM() {
        this.views = {
            hub: document.getElementById('view-hub'),
            selectExo: document.getElementById('view-select-exo'),
            selectPlan: document.getElementById('view-select-plan'),
            storage: document.getElementById('view-storage'),
            editor: document.getElementById('view-editor')
        };
        this.listExo = document.getElementById('list-select-exo');
        this.listPlan = document.getElementById('list-select-plan');
        this.listStorage = document.getElementById('list-storage');
        this.pagesContainer = document.getElementById('pages-container');
        this.workspace = document.getElementById('workspace');
        
        this.exoTitle = document.getElementById('sheet-exo-title');
        this.btnExoBack = document.getElementById('btn-sheet-exo-back');
        this.filterTagsExo = document.getElementById('filter-tags-exo');
        this.searchExo = document.getElementById('search-exo');
    },

    bindEvents() {
        document.getElementById('nav-new-exo').onclick = () => { 
            this.currentSheetId = null; 
            this.exoViewMode = 'FOLDERS'; 
            this.currentExoFolderId = null;
            this.activeTagExo = null;
            this.searchExo.value = '';
            this.switchView('selectExo'); 
            this.renderSelectExoView();
        };

        document.getElementById('nav-new-plan').onclick = () => { this.currentSheetId = null; this.switchView('selectPlan'); };
        document.getElementById('nav-storage').onclick = () => { this.switchView('storage'); };
        
        this.searchExo.oninput = (e) => this.renderExoPlaybooks(e.target.value);

        this.btnExoBack.onclick = () => {
            if (this.exoViewMode === 'PLAYBOOKS') {
                this.exoViewMode = 'FOLDERS';
                this.currentExoFolderId = null;
                this.activeTagExo = null;
                this.searchExo.value = '';
                this.renderSelectExoView();
            } else {
                this.switchView('hub');
            }
        };

        document.getElementById('btn-back-menu').onclick = () => {
            if(confirm("Avez-vous bien sauvegardé vos modifications ? Les éléments non enregistrés seront perdus.")) {
                this.switchView('hub');
            }
        };

        document.getElementById('btn-add-page').onclick = () => this.addPage();
        document.getElementById('btn-export-pdf').onclick = () => this.exportToPDF();
        document.getElementById('btn-add-text').onclick = () => {
            this.spawnOffset = (this.spawnOffset + 30) % 150;
            this.addTextElement("Nouveau texte", `${50 + this.spawnOffset}px`, `${50 + this.spawnOffset}px`);
        };
        document.getElementById('btn-text-larger').onclick = () => this.formatText('larger');
        document.getElementById('btn-text-smaller').onclick = () => this.formatText('smaller');
        document.getElementById('btn-text-bold').onclick = () => this.formatText('bold');
        document.getElementById('btn-text-align-left').onclick = () => this.formatText('left');
        document.getElementById('btn-text-align-center').onclick = () => this.formatText('center');
        document.getElementById('btn-text-toggle-border').onclick = () => this.formatText('border');

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
            else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
            else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedElement) {
                if (this.selectedElement.querySelector('.drag-text') && document.activeElement === this.selectedElement.querySelector('.drag-text')) return;
                this.selectedElement.remove();
                this.selectedElement = null;
                this.clearGuides();
                this.commitState();
            }
        });

        document.getElementById('btn-undo').onclick = () => this.undo();
        document.getElementById('btn-redo').onclick = () => this.redo();

        document.getElementById('btn-save-sheet').onclick = () => this.openSaveModal();
        document.getElementById('cancel-save-sheet').onclick = () => document.getElementById('save-sheet-modal').classList.add('hidden');
        document.getElementById('confirm-save-sheet').onclick = () => this.saveSheet();
        
        document.getElementById('btn-add-sheet-tag').onclick = async () => {
            const val = document.getElementById('new-sheet-tag-input').value.trim();
            if(val) {
                await orbDB.addSheetTag(val);
                this.allSheetTags = await orbDB.getAllSheetTags();
                document.getElementById('new-sheet-tag-input').value = '';
                this.renderSaveModalTags();
                const lastCb = document.querySelector('#sheet-tags-checkboxes label:last-child input');
                if(lastCb) lastCb.checked = true;
                this.renderStorageTagsManager();
            }
        };

        document.getElementById('btn-storage-add-tag').onclick = async () => {
            const val = document.getElementById('storage-new-tag-input').value.trim();
            if(val) {
                await orbDB.addSheetTag(val);
                this.allSheetTags = await orbDB.getAllSheetTags();
                document.getElementById('storage-new-tag-input').value = '';
                this.renderStorageTagsManager();
                this.renderTagsFilterStorage();
            }
        };

        this.workspace.addEventListener('mousedown', (e) => {
            if (e.target === this.workspace || e.target.classList.contains('a4-page') || e.target.id === 'pages-container') this.deselectAll();
        });
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
    },

    commitState() {
        const activeSel = this.selectedElement;
        this.deselectAll(); 
        const state = JSON.stringify(this.serializePages());
        if (this.historyIndex < this.history.length - 1) this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        if(activeSel) this.selectElement(activeSel);
    },

    undo() { if (this.historyIndex > 0) { this.historyIndex--; this.loadPagesFromData(JSON.parse(this.history[this.historyIndex]), true); } },
    redo() { if (this.historyIndex < this.history.length - 1) { this.historyIndex++; this.loadPagesFromData(JSON.parse(this.history[this.historyIndex]), true); } },

    switchView(viewName) {
        Object.values(this.views).forEach(v => v.classList.remove('active', 'hidden'));
        Object.values(this.views).forEach(v => v.classList.add('hidden'));
        this.views[viewName].classList.remove('hidden');
        this.views[viewName].classList.add('active');
        document.getElementById('editor-top-actions').classList.toggle('hidden', viewName !== 'editor');
        if (viewName !== 'editor') { this.pagesContainer.innerHTML = ''; }
        if (viewName === 'storage') { this.renderStorageTagsManager(); }
    },

    async loadData() {
        try {
            [this.allPlaybooks, this.allPlans, this.allSheets, this.allTags, this.allSheetTags, this.allFolders] = await Promise.all([
                orbDB.getAllPlaybooks(), orbDB.getAllPlans(), orbDB.getAllSheets(), orbDB.getAllTags(), orbDB.getAllSheetTags(), orbDB.getAllFolders()
            ]);
        } catch(e) {
            console.warn("Base de données en cours de mise à jour, fallback activé.");
            this.allSheetTags = [];
            this.allFolders = [];
        }
        this.renderTagsFilterStorage();
        this.renderSelectPlanList();
        this.renderStorageList();
    },

    renderSelectExoView() {
        if (this.exoViewMode === 'FOLDERS') {
            this.renderExoFolders();
        } else {
            this.renderExoPlaybooks(this.searchExo.value);
        }
    },

    renderExoFolders() {
        this.exoTitle.textContent = "Vos Dossiers";
        this.filterTagsExo.classList.add('hidden');
        this.searchExo.classList.add('hidden');
        this.listExo.innerHTML = '';

        const divAll = document.createElement('div'); 
        divAll.className = 'grid-card';
        divAll.innerHTML = `<div style="height:110px; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:10px; display:flex; align-items:center; justify-content:center;">${this.iconAll}</div> <strong>Tous les schémas</strong>`;
        divAll.onclick = () => { this.exoViewMode = 'PLAYBOOKS'; this.currentExoFolderId = 'ALL'; this.renderSelectExoView(); };
        this.listExo.appendChild(divAll);

        this.allFolders.forEach(folder => {
            const count = this.allPlaybooks.filter(pb => pb.folderIds && pb.folderIds.includes(folder.id)).length;
            const div = document.createElement('div'); 
            div.className = 'grid-card';
            div.innerHTML = `<div style="height:110px; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:10px; display:flex; align-items:center; justify-content:center;">${this.iconFolder}</div> <strong>${folder.name}</strong><span style="font-size:0.85em; opacity:0.6;">${count} exos</span>`;
            div.onclick = () => { this.exoViewMode = 'PLAYBOOKS'; this.currentExoFolderId = folder.id; this.exoTitle.textContent = folder.name; this.renderSelectExoView(); };
            this.listExo.appendChild(div);
        });
    },

    renderExoPlaybooks(searchText = '') {
        this.filterTagsExo.classList.remove('hidden');
        this.searchExo.classList.remove('hidden');
        this.listExo.innerHTML = '';

        this.filterTagsExo.innerHTML = '';
        const allBtn = document.createElement('div');
        allBtn.className = `tag-chip ${this.activeTagExo === null ? 'active' : ''}`;
        allBtn.textContent = "Tous les tags";
        allBtn.onclick = () => { this.activeTagExo = null; this.renderExoPlaybooks(this.searchExo.value); };
        this.filterTagsExo.appendChild(allBtn);

        let fId = (typeof this.currentExoFolderId === 'number') ? this.currentExoFolderId : null;
        const currentTags = this.allTags.filter(t => t.folderId == fId);
        
        currentTags.forEach(t => {
            const btn = document.createElement('div');
            btn.className = `tag-chip ${this.activeTagExo === t.id ? 'active' : ''}`;
            btn.textContent = t.name;
            btn.onclick = () => { this.activeTagExo = this.activeTagExo === t.id ? null : t.id; this.renderExoPlaybooks(this.searchExo.value); };
            this.filterTagsExo.appendChild(btn);
        });

        let filtered = this.allPlaybooks;
        if (this.currentExoFolderId !== 'ALL') {
            filtered = filtered.filter(pb => pb.folderIds && pb.folderIds.includes(this.currentExoFolderId));
        }
        if (this.activeTagExo !== null) {
            filtered = filtered.filter(pb => pb.tagIds && pb.tagIds.includes(this.activeTagExo));
        }
        
        const searchLower = searchText.toLowerCase();
        filtered = filtered.filter(pb => (pb.name || '').toLowerCase().includes(searchLower));

        if (filtered.length === 0) {
            this.listExo.innerHTML = '<p style="grid-column: 1/-1; text-align:center; opacity:0.6; padding: 20px;">Aucun exercice trouvé.</p>';
            return;
        }

        filtered.reverse().forEach(pb => {
            let src = ''; if (pb.preview instanceof Blob) { try { src = URL.createObjectURL(pb.preview); } catch(e){} }
            const div = document.createElement('div'); div.className = 'grid-card';
            div.innerHTML = `${src ? `<img src="${src}">` : `<div style="height:110px; background:#BFA98D; border-radius:4px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; color:#000; font-weight:bold;">Aperçu</div>`} <strong>${pb.name || 'Sans nom'}</strong>`;
            div.onclick = () => this.startEditor('exo', pb.id);
            this.listExo.appendChild(div);
        });
    },

    renderTagsFilterStorage() {
        const container = document.getElementById('filter-tags-storage');
        container.innerHTML = '';
        const allBtn = document.createElement('div');
        allBtn.className = `tag-chip ${this.activeTagStorage === null ? 'active' : ''}`;
        allBtn.textContent = "Toutes les fiches";
        allBtn.onclick = () => { this.activeTagStorage = null; this.renderStorageList(); this.renderTagsFilterStorage(); };
        container.appendChild(allBtn);

        this.allSheetTags.forEach(t => {
            const btn = document.createElement('div');
            btn.className = `tag-chip ${this.activeTagStorage === t.id ? 'active' : ''}`;
            btn.textContent = t.name;
            btn.onclick = () => { this.activeTagStorage = t.id; this.renderStorageList(); this.renderTagsFilterStorage(); };
            container.appendChild(btn);
        });
    },

    renderSelectPlanList() {
        this.listPlan.innerHTML = '';
        this.allPlans.reverse().forEach(plan => {
            const div = document.createElement('div'); div.className = 'grid-card';
            div.innerHTML = `<div style="height:110px; display:flex; align-items:center; justify-content:center; background:#2a2a2a; border-radius:4px; margin-bottom:10px;"><span style="color:var(--color-primary); font-size:2em; font-weight:bold;">${plan.playbookIds.length} Exos</span></div> <strong>${plan.name || 'Sans nom'}</strong>`;
            div.onclick = () => this.startEditor('plan', plan.id);
            this.listPlan.appendChild(div);
        });
    },

    renderStorageList() {
        this.listStorage.innerHTML = '';
        let filtered = this.allSheets;
        if(this.activeTagStorage) filtered = filtered.filter(s => s.tagIds && s.tagIds.includes(this.activeTagStorage));

        if(filtered.length === 0) return this.listStorage.innerHTML = '<p style="opacity:0.6;">Aucune fiche trouvée.</p>';
        filtered.forEach(sheet => {
            const div = document.createElement('div'); div.className = 'storage-item';
            const tagsHtml = (sheet.tagIds || []).map(id => {
                const t = this.allSheetTags.find(tag => tag.id === id);
                return t ? `<span style="font-size:0.75em; background:var(--color-primary); color:#000; padding:2px 6px; border-radius:4px; margin-right:5px; font-weight:bold;">${t.name}</span>` : '';
            }).join('');

            div.innerHTML = `<div><strong>${sheet.name}</strong><div style="margin-top:6px;">${tagsHtml}</div></div> <button class="btn-icon danger" style="padding:0; width:30px; height:30px;"><svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2 2 0 0,0 8,21H16A2 2 0 0,0 18,19V7H6V19Z"/></svg></button>`;
            
            div.querySelector('button').onclick = async (e) => {
                e.stopPropagation();
                if(confirm("Supprimer cette fiche ?")) {
                    await orbDB.db.transaction(['sheets'], 'readwrite').objectStore('sheets').delete(sheet.id);
                    await this.loadData();
                }
            };
            div.onclick = () => {
                this.currentSheetId = sheet.id;
                this.switchView('editor');
                this.loadPagesFromData(sheet.pages, true);
                this.history = []; this.historyIndex = -1;
                this.commitState(); 
            };
            this.listStorage.appendChild(div);
        });
    },

    renderStorageTagsManager() {
        const container = document.getElementById('storage-tags-manager-list');
        container.innerHTML = '';
        this.allSheetTags.forEach(t => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px;";
            row.innerHTML = `
                <span style="color:var(--color-primary); font-weight:bold;">${t.name}</span>
                <button class="btn-icon danger" style="padding:2px; width:22px; height:22px;" title="Supprimer définitivement"><svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>
            `;
            row.querySelector('button').onclick = async () => {
                if(confirm(`Supprimer le tag "${t.name}" de la base de données ?`)) {
                    await orbDB.db.transaction(['sheetTags'], 'readwrite').objectStore('sheetTags').delete(t.id);
                    this.allSheetTags = await orbDB.getAllSheetTags();
                    this.renderStorageTagsManager();
                    this.renderTagsFilterStorage();
                }
            };
            container.appendChild(row);
        });
    },

    startEditor(mode, id) {
        this.currentMode = mode;
        this.pagesContainer.innerHTML = '';
        this.history = []; this.historyIndex = -1;
        this.spawnOffset = 0;
        
        const firstPage = this.addPage(true);
        this.switchView('editor');

        let titleName = "Fiche Sans Nom";

        if (mode === 'exo') {
            const pb = this.allPlaybooks.find(p => p.id === id);
            if(pb) titleName = pb.name;
            document.getElementById('sidebar-plan-list').classList.add('hidden');
            document.getElementById('sidebar-exo-detail').classList.remove('hidden');
            document.getElementById('btn-back-to-plan').classList.add('hidden');
            this.loadExoDetail(id);
        } else if (mode === 'plan') {
            const plan = this.allPlans.find(p => p.id === id);
            if(plan) titleName = plan.name;
            this.currentPlanId = id;
            document.getElementById('sidebar-plan-list').classList.remove('hidden');
            document.getElementById('sidebar-exo-detail').classList.add('hidden');
            this.loadPlanSidebar(id);
        }

        this.addTextElement(`<div style="text-align:center;"><strong>${titleName.toUpperCase()}</strong></div>`, '50px', '40px', '694px', 'auto', '24px', 'bold', firstPage, true, true);
        this.commitState();
    },

    loadPlanSidebar(planId) {
        const plan = this.allPlans.find(p => p.id === planId);
        const container = document.getElementById('plan-exos-container');
        container.innerHTML = '';
        
        plan.playbookIds.forEach((pbId, index) => {
            const pb = this.allPlaybooks.find(p => p.id === pbId);
            if(!pb) return;
            const btn = document.createElement('button');
            btn.className = 'studio-tool-btn exo-btn-list';
            btn.textContent = `${index+1}. ${pb.name}`;
            btn.onclick = () => {
                document.getElementById('sidebar-plan-list').classList.add('hidden');
                document.getElementById('btn-back-to-plan').classList.remove('hidden');
                document.getElementById('btn-back-to-plan').onclick = () => {
                    document.getElementById('sidebar-exo-detail').classList.add('hidden');
                    document.getElementById('sidebar-plan-list').classList.remove('hidden');
                };
                document.getElementById('sidebar-exo-detail').classList.remove('hidden');
                this.loadExoDetail(pb.id);
            };
            container.appendChild(btn);
        });
    },

   async generateSceneImage(playbookData, sceneIndex) {
        return new Promise((resolve) => {
            const originalState = window.ORB.playbookState;
            const originalCanvas = window.ORB.canvas;
            const originalCtx = window.ORB.ctx;

            window.ORB.playbookState = playbookData;
            window.ORB.playbookState.activeSceneIndex = sceneIndex;

            const isHalf = playbookData.courtType === 'half';
            
            const drawW = isHalf ? 450 : 840;
            const drawH = isHalf ? 420 : 450;
            
            const baseW = isHalf ? 450 : 840;
            const baseH = isHalf ? 420 : 450;

            const tempC = document.createElement('canvas');
            tempC.width = drawW;
            tempC.height = drawH;
            const tCtx = tempC.getContext('2d');

            const isCrab = document.body.classList.contains('crab-mode');
            const primaryColor = isCrab ? '#72243D' : '#BFA98D';
            const secondaryColor = isCrab ? '#F9AB00' : '#212121';

            tCtx.fillStyle = primaryColor;
            tCtx.fillRect(0, 0, drawW, drawH);

            const courtSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            courtSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            courtSvg.setAttribute('width', drawW);
            courtSvg.setAttribute('height', drawH);
            courtSvg.setAttribute('viewBox', isHalf ? '0 0 150 140' : '0 0 280 150');
            courtSvg.setAttribute('preserveAspectRatio', 'none');
            
            if (isHalf) {
                courtSvg.innerHTML = `
                    <rect x="0" y="0" width="150" height="140" fill="${primaryColor}"/>
                    <g class="court-lines" stroke="${secondaryColor}" stroke-width="0.6" fill="none">
                        <rect x="0" y="0" width="150" height="140"/>
                        <rect x="46" y="0" width="58" height="50.5" />
                        <path d="M 46 50.5 A 18 18 0 0 0 104 50.5" />
                        <path d="M 6 0 L 6 29.1 A 67.5 67.5 0 0 0 144 29.1 L 144 0" />
                    </g>
                    <g class="court-lines" stroke="${secondaryColor}" fill="none" transform="translate(75, 15.75)">
                        <line x1="-9" y1="-3.75" x2="9" y2="-3.75" stroke-width="0.8"/>
                        <circle cx="0" cy="0" r="2.25" stroke-width="0.5"/>
                        <path d="M -12.5 0 A 12.5 12.5 0 0 0 12.5 0" stroke-width="0.6"/>
                    </g>
                    <path class="court-lines" d="M 57 140 A 18 18 0 0 1 93 140" stroke="${secondaryColor}" stroke-width="0.6" fill="none"/>
                `;
            } else {
                courtSvg.innerHTML = `
                    <rect x="0" y="0" width="280" height="150" fill="${primaryColor}"/>
                    <g class="court-lines" stroke="${secondaryColor}" stroke-width="0.6" fill="none"><rect x="0" y="0" width="280" height="150"/><line x1="140" y1="0" x2="140" y2="150"/><rect x="0" y="50.5" width="58" height="49" /><path d="M 58 50.5 A 18 18 0 0 1 58 99.5" /><path d="M 0 6 L 29.1 6 A 67.5 67.5 0 0 1 29.1 144 L 0 144" /><rect x="222" y="50.5" width="58" height="49" /><path d="M 222 50.5 A 18 18 0 0 0 222 99.5" /><path d="M 280 6 L 250.9 6 A 67.5 67.5 0 0 0 250.9 144 L 280 144" /></g>
                    <g class="center-court-logo">
                        <circle cx="140" cy="75" r="18" fill="${primaryColor}" />
                        <circle class="court-lines" cx="140" cy="75" r="18" fill="none" stroke="${secondaryColor}" stroke-width="0.6"/>
                        ${!isCrab ? `<text class="court-text-orb" x="140" y="76" font-family="Impact, 'Arial Black', sans-serif" font-size="15" fill="${secondaryColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.5">ORB</text>` : ''}
                        ${isCrab ? `<text class="court-text-crab" x="140" y="76" font-family="Impact, 'Arial Black', sans-serif" font-size="15" fill="${secondaryColor}" text-anchor="middle" dominant-baseline="middle" letter-spacing="0.5">CRAB</text>` : ''}
                    </g>
                    <g class="court-lines" stroke="${secondaryColor}" fill="none"><g transform="translate(15.75, 75)"><line x1="-3.75" y1="-9" x2="-3.75" y2="9" stroke-width="0.8"/><circle cx="0" cy="0" r="2.25" stroke-width="0.5"/><path d="M 0 -12.5 A 12.5 12.5 0 0 1 0 12.5" stroke-width="0.6"/></g><g transform="translate(264.25, 75)"><line x1="3.75" y1="-9" x2="3.75" y2="9" stroke-width="0.8"/><circle cx="0" cy="0" r="2.25" stroke-width="0.5"/><path d="M 0 -12.5 A 12.5 12.5 0 0 0 0 12.5" stroke-width="0.6"/></g></g>
                `;
            }

            let xml = new XMLSerializer().serializeToString(courtSvg);
            
            xml = xml.replace(/stroke-width="0\.6"/g, 'stroke-width="1.0"');
            xml = xml.replace(/stroke-width="0\.5"/g, 'stroke-width="0.9"');
            xml = xml.replace(/stroke-width="0\.8"/g, 'stroke-width="1.3"');

            const img = new Image();
            img.onload = () => {
                tCtx.drawImage(img, 0, 0, drawW, drawH); 
                
                const drawC = document.createElement('canvas');
                drawC.width = drawW;
                drawC.height = drawH;
                const dCtx = drawC.getContext('2d');
                
                dCtx.scale(drawW / baseW, drawH / baseH);
                drawC.getBoundingClientRect = () => ({ width: baseW, height: baseH, left: 0, top: 0 });

                window.ORB.canvas = drawC;
                window.ORB.ctx = dCtx;

                window.ORB.renderer.isThumbnailMode = true;
                window.ORB.renderer.redrawCanvas(); 
                window.ORB.renderer.isThumbnailMode = false;

                tCtx.drawImage(drawC, 0, 0, drawW, drawH); 
                
                window.ORB.canvas = originalCanvas;
                window.ORB.ctx = originalCtx;
                window.ORB.playbookState = originalState;

                resolve(tempC.toDataURL('image/jpeg', 0.95));
            };
            img.onerror = () => {
                resolve(tempC.toDataURL('image/jpeg', 0.5));
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
        });
    },

    async loadExoDetail(pbId) {
        const pb = this.allPlaybooks.find(p => p.id === pbId);
        document.getElementById('active-exo-title').textContent = pb.name;
        const gallery = document.getElementById('exo-scenes-gallery');
        gallery.innerHTML = '<p style="text-align:center;">Génération...</p>'; 

        setTimeout(async () => {
            gallery.innerHTML = '';
            const generatedImages = [];
            if(!pb.playbookData || !pb.playbookData.scenes) return;

            for (let i = 0; i < pb.playbookData.scenes.length; i++) {
                const scene = pb.playbookData.scenes[i];
                const dataUrl = await this.generateSceneImage(pb.playbookData, i);
                generatedImages.push(dataUrl);
                
                const hasComment = scene.comments && scene.comments.trim() !== "";
                const card = document.createElement('div'); 
                card.className = 'scene-list-item';
                
                card.innerHTML = `
                    <div class="scene-col-img" title="Insérer le schéma">
                        <img src="${dataUrl}">
                        <span>Scène ${i+1}</span>
                    </div>
                    <div class="scene-col-note ${!hasComment ? 'disabled' : ''}" title="${hasComment ? 'Insérer la note' : 'Aucune note'}">
                        <svg viewBox="0 0 24 24"><path d="M9,4V7H11V19H13V7H15V4H9M18.5,11L15.5,18H17.5L18,16.8H21L18.5,11Z"/></svg>
                        <span>${hasComment ? 'Texte' : 'Vide'}</span>
                    </div>
                `;
                
                card.querySelector('.scene-col-img').onclick = () => {
                    this.spawnOffset = (this.spawnOffset + 20) % 150;
                    this.addImageElement(dataUrl, null, `${50 + this.spawnOffset}px`, `${150 + this.spawnOffset}px`, '400px');
                };
                
                if (hasComment) {
                    card.querySelector('.scene-col-note').onclick = () => {
                        this.spawnOffset = (this.spawnOffset + 20) % 150;
                        this.addTextElement(`<strong>Scène ${i+1} :</strong><br>${scene.comments.replace(/\n/g, '<br>')}`, `${50 + this.spawnOffset}px`, `${200 + this.spawnOffset}px`, '400px', 'auto');
                    };
                }
                
                gallery.appendChild(card);
            }

            document.getElementById('btn-add-all-scenes').onclick = () => {
                let page = this.pagesContainer.lastElementChild || this.addPage();
                let currentY = 120;

                pb.playbookData.scenes.forEach((scene, index) => {
                    if (currentY > 800) { page = this.addPage(true); currentY = 50; }
                    this.addImageElement(generatedImages[index], page, '50px', `${currentY}px`, '450px', null, null, null, '0px', '0px', true);
                    currentY += 260; 

                    if (scene.comments && scene.comments.trim() !== "") {
                        this.addTextElement(`<strong>Scène ${index+1} :</strong><br>${scene.comments.replace(/\n/g, '<br>')}`, '50px', `${currentY}px`, '450px', 'auto', '16px', 'normal', page, true);
                        currentY += 120; 
                    } else { currentY += 20; }
                });
                this.commitState();
            };
        }, 50);
    },

    addPage(skipHistory = false) {
        const page = document.createElement('div'); page.className = 'a4-page';
        const delBtn = document.createElement('button'); delBtn.className = 'page-delete-btn';
        delBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2 2 0 0,0 8,21H16A2 2 0 0,0 18,19V7H6V19Z"/></svg>';
        delBtn.onclick = () => { if(confirm("Supprimer cette page ?")) { page.remove(); this.clearGuides(); this.commitState(); }};
        page.appendChild(delBtn);
        this.pagesContainer.appendChild(page);
        if(!skipHistory) this.commitState();
        return page;
    },

    addHandles(wrapper, isImage) {
        const cropR = document.createElement('div'); cropR.className = 'crop-handle right';
        cropR.onmousedown = (e) => this.initResize(e, wrapper, 'crop-right');
        const cropB = document.createElement('div'); cropB.className = 'crop-handle bottom';
        cropB.onmousedown = (e) => this.initResize(e, wrapper, 'crop-bottom');
        wrapper.append(cropR, cropB);

        if (isImage) {
            const resizeH = document.createElement('div'); resizeH.className = 'resize-handle';
            resizeH.onmousedown = (e) => this.initResize(e, wrapper, 'proportional');
            const cropL = document.createElement('div'); cropL.className = 'crop-handle left';
            cropL.onmousedown = (e) => this.initResize(e, wrapper, 'crop-left');
            const cropT = document.createElement('div'); cropT.className = 'crop-handle top';
            cropT.onmousedown = (e) => this.initResize(e, wrapper, 'crop-top');
            wrapper.append(resizeH, cropL, cropT);
        } else {
            const moveH = document.createElement('div'); moveH.className = 'move-handle';
            moveH.innerHTML = '⋮⋮⋮';
            moveH.onmousedown = (e) => {
                e.stopPropagation();
                this.selectElement(wrapper);
                this.isDragging = true;
                const rect = wrapper.getBoundingClientRect();
                this.offsetX = e.clientX - rect.left;
                this.offsetY = e.clientY - rect.top;
            };
            wrapper.appendChild(moveH);
        }
    },

    addTextElement(content = "Texte...", left = '50px', top = '150px', width = '300px', height = 'auto', fontSize = '16px', fontWeight = 'normal', targetPage = null, skipHistory = false, noBorder = false) {
        const page = targetPage || this.pagesContainer.lastElementChild || this.addPage(true);
        const wrapper = document.createElement('div');
        wrapper.className = 'draggable-element text-wrapper';
        wrapper.style.left = left; wrapper.style.top = top;
        wrapper.style.width = width; wrapper.style.height = height;
        
        const el = document.createElement('div');
        el.className = 'drag-text'; 
        if(noBorder) el.classList.add('no-border');
        el.contentEditable = true; el.innerHTML = content;
        el.style.fontSize = fontSize; el.style.fontWeight = fontWeight;
        el.onblur = () => this.commitState(); 
        
        wrapper.appendChild(el);
        this.addHandles(wrapper, false);
        
        wrapper.addEventListener('mousedown', (e) => {
            if(e.target.classList.contains('crop-handle') || e.target.classList.contains('move-handle')) return;
            this.selectElement(wrapper);
        });

        page.appendChild(wrapper);
        this.selectElement(wrapper);
        if(!skipHistory) this.commitState();
    },

    addImageElement(src, targetPage = null, left = '100px', top = '150px', width = '400px', height = null, imgW = null, imgH = null, imgX = '0px', imgY = '0px', skipHistory = false) {
        const page = targetPage || this.pagesContainer.lastElementChild || this.addPage(true);
        const wrapper = document.createElement('div');
        wrapper.className = 'draggable-element';
        wrapper.style.left = left; wrapper.style.top = top; wrapper.style.width = width;
        if(height) wrapper.style.height = height;

        const cropBox = document.createElement('div');
        cropBox.className = 'crop-box';
        
        const img = document.createElement('img');
        img.src = src; img.className = 'drag-image';
        img.style.left = imgX; img.style.top = imgY;
        if(imgW && imgH) { img.style.width = imgW; img.style.height = imgH; }
        
        cropBox.appendChild(img);
        wrapper.appendChild(cropBox);

        img.onload = () => {
            if(!height) {
                const h = (img.naturalHeight / img.naturalWidth) * parseInt(width);
                wrapper.style.height = h + 'px';
                img.style.width = width; img.style.height = h + 'px';
            } else if (!imgW) {
                img.style.width = width; img.style.height = height;
            }
            if(!skipHistory) this.commitState();
        };

        this.addHandles(wrapper, true);
        
        wrapper.addEventListener('mousedown', (e) => {
            if(e.target.classList.contains('resize-handle') || e.target.classList.contains('crop-handle')) return;
            this.selectElement(wrapper);
            this.isDragging = true;
            const rect = wrapper.getBoundingClientRect();
            this.offsetX = e.clientX - rect.left; this.offsetY = e.clientY - rect.top;
            e.stopPropagation();
        });

        page.appendChild(wrapper);
        this.selectElement(wrapper);
    },

    selectElement(el) { this.deselectAll(); this.selectedElement = el; el.classList.add('selected'); },
    deselectAll() { document.querySelectorAll('.draggable-element').forEach(e => e.classList.remove('selected')); this.selectedElement = null; this.clearGuides(); },

    clearGuides() { document.querySelectorAll('.align-guide').forEach(el => el.remove()); },

    checkAlignment() {
        this.clearGuides();
        if (!this.selectedElement) return;

        const page = this.selectedElement.parentElement;
        if (!page || !page.classList.contains('a4-page')) return;

        const activeRect = this.selectedElement.getBoundingClientRect();
        const pageRect = page.getBoundingClientRect();
        
        const relRect = {
            left: activeRect.left - pageRect.left, top: activeRect.top - pageRect.top,
            right: activeRect.right - pageRect.left, bottom: activeRect.bottom - pageRect.top,
            centerX: (activeRect.left - pageRect.left) + (activeRect.width / 2),
            centerY: (activeRect.top - pageRect.top) + (activeRect.height / 2),
            width: activeRect.width, height: activeRect.height
        };

        const siblings = Array.from(page.querySelectorAll('.draggable-element')).filter(el => el !== this.selectedElement);
        const tolerance = 4;

        const drawGuide = (type, pos) => {
            const guide = document.createElement('div');
            guide.className = `align-guide guide-${type}`;
            if (type === 'v') { guide.style.left = pos + 'px'; } 
            else { guide.style.top = pos + 'px'; }
            page.appendChild(guide);
        };

        let matchedV = new Set(); let matchedH = new Set();

        const checkV = (val) => {
            if (matchedV.has(val)) return;
            if (Math.abs(val - 397) < tolerance) { drawGuide('v', 397); matchedV.add(val); return; }
            siblings.forEach(sib => {
                const sRect = sib.getBoundingClientRect();
                const sl = sRect.left - pageRect.left; const sr = sRect.right - pageRect.left; const scx = sl + sRect.width / 2;
                if (Math.abs(val - sl) < tolerance || Math.abs(val - sr) < tolerance || Math.abs(val - scx) < tolerance) {
                    drawGuide('v', val); matchedV.add(val);
                }
            });
        };

        const checkH = (val) => {
            if (matchedH.has(val)) return;
            if (Math.abs(val - 561.5) < tolerance) { drawGuide('h', 561.5); matchedH.add(val); return; }
            siblings.forEach(sib => {
                const sRect = sib.getBoundingClientRect();
                const st = sRect.top - pageRect.top; const sb = sRect.bottom - pageRect.top; const scy = st + sRect.height / 2;
                if (Math.abs(val - st) < tolerance || Math.abs(val - sb) < tolerance || Math.abs(val - scy) < tolerance) {
                    drawGuide('h', val); matchedH.add(val);
                }
            });
        };

        checkV(relRect.left); checkV(relRect.right); checkV(relRect.centerX);
        checkH(relRect.top); checkH(relRect.bottom); checkH(relRect.centerY);
    },

    initResize(e, el, mode) {
        e.stopPropagation(); this.selectElement(el);
        this.isResizing = true; this.resizeMode = mode;
        this.startX = e.clientX; this.startY = e.clientY;
        this.startW = el.offsetWidth; this.startH = el.offsetHeight;
        this.startLeft = el.offsetLeft; this.startTop = el.offsetTop;
        this.aspectRatio = this.startW / this.startH;

        const img = el.querySelector('img');
        if(img) {
            this.startImgW = parseFloat(img.style.width) || this.startW;
            this.startImgH = parseFloat(img.style.height) || this.startH;
            this.startImgX = parseFloat(img.style.left) || 0;
            this.startImgY = parseFloat(img.style.top) || 0;
        }
    },

    onMouseMove(e) {
        if (this.isDragging && this.selectedElement) {
            if (Math.abs(e.clientX - this.startX) > 3 || Math.abs(e.clientY - this.startY) > 3) {
                const pageRect = this.selectedElement.parentElement.getBoundingClientRect();
                this.selectedElement.style.left = `${e.clientX - pageRect.left - this.offsetX}px`;
                this.selectedElement.style.top = `${e.clientY - pageRect.top - this.offsetY}px`;
                this.checkAlignment();
            }
        } 
        else if (this.isResizing && this.selectedElement) {
            const dx = e.clientX - this.startX; const dy = e.clientY - this.startY;
            const img = this.selectedElement.querySelector('img');

            if (this.resizeMode === 'proportional') {
                const newW = Math.max(50, this.startW + dx);
                const ratio = newW / this.startW;
                this.selectedElement.style.width = newW + 'px';
                this.selectedElement.style.height = (this.startH * ratio) + 'px';
                if(img) {
                    img.style.width = (this.startImgW * ratio) + 'px';
                    img.style.height = (this.startImgH * ratio) + 'px';
                    img.style.left = (this.startImgX * ratio) + 'px';
                    img.style.top = (this.startImgY * ratio) + 'px';
                }
            } else if (this.resizeMode === 'crop-right') {
                this.selectedElement.style.width = Math.max(50, this.startW + dx) + 'px';
            } else if (this.resizeMode === 'crop-bottom') {
                this.selectedElement.style.height = Math.max(30, this.startH + dy) + 'px';
            } else if (this.resizeMode === 'crop-left') {
                const newW = Math.max(50, this.startW - dx);
                const actualDx = this.startW - newW; 
                this.selectedElement.style.width = newW + 'px';
                this.selectedElement.style.left = (this.startLeft + actualDx) + 'px';
                if (img) img.style.left = (this.startImgX - actualDx) + 'px';
            } else if (this.resizeMode === 'crop-top') {
                const newH = Math.max(50, this.startH - dy);
                const actualDy = this.startH - newH;
                this.selectedElement.style.height = newH + 'px';
                this.selectedElement.style.top = (this.startTop + actualDy) + 'px';
                if (img) img.style.top = (this.startImgY - actualDy) + 'px';
            }
            this.checkAlignment();
        }
    },
    
    onMouseUp() { 
        if(this.isDragging || this.isResizing) this.commitState(); 
        this.isDragging = false; this.isResizing = false; 
        this.clearGuides();
    },

    formatText(action) {
        if (!this.selectedElement || !this.selectedElement.classList.contains('text-wrapper')) return;
        const textNode = this.selectedElement.querySelector('.drag-text');
        
        if (action === 'larger') textNode.style.fontSize = `${parseInt(window.getComputedStyle(textNode).fontSize) + 2}px`;
        else if (action === 'smaller') textNode.style.fontSize = `${Math.max(10, parseInt(window.getComputedStyle(textNode).fontSize) - 2)}px`;
        else if (action === 'bold') textNode.style.fontWeight = window.getComputedStyle(textNode).fontWeight >= 600 ? 'normal' : 'bold';
        else if (action === 'left') textNode.style.textAlign = 'left';
        else if (action === 'center') textNode.style.textAlign = 'center';
        else if (action === 'border') textNode.classList.toggle('no-border');
        
        this.commitState();
    },

    serializePages() {
        return Array.from(this.pagesContainer.children).map(page => {
            return Array.from(page.querySelectorAll('.draggable-element')).map(el => {
                const img = el.querySelector('img');
                const isImg = img !== null;
                const txt = el.querySelector('.drag-text');
                return {
                    type: isImg ? 'image' : 'text',
                    content: isImg ? img.src : txt.innerHTML,
                    left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height,
                    imgW: isImg ? img.style.width : null, imgH: isImg ? img.style.height : null,
                    imgX: isImg ? img.style.left : null, imgY: isImg ? img.style.top : null,
                    fontSize: isImg ? null : txt.style.fontSize,
                    fontWeight: isImg ? null : txt.style.fontWeight,
                    textAlign: isImg ? null : txt.style.textAlign,
                    noBorder: isImg ? false : txt.classList.contains('no-border')
                };
            });
        });
    },

    loadPagesFromData(pagesData, skipHistory = false) {
        this.pagesContainer.innerHTML = '';
        if(pagesData && pagesData.length > 0) {
            pagesData.forEach(pageData => {
                const pageNode = this.addPage(true);
                pageData.forEach(data => {
                    if (data.type === 'text') {
                        this.addTextElement(data.content, data.left, data.top, data.width, data.height, data.fontSize, data.fontWeight, pageNode, true, data.noBorder);
                        if(data.textAlign) pageNode.lastElementChild.querySelector('.drag-text').style.textAlign = data.textAlign;
                    }
                    else this.addImageElement(data.content, pageNode, data.left, data.top, data.width, data.height, data.imgW, data.imgH, data.imgX, data.imgY, true);
                });
            });
        }
        if(!skipHistory) this.commitState();
    },

    openSaveModal() {
        this.renderSaveModalTags();
        document.getElementById('save-sheet-modal').classList.remove('hidden');
    },

    renderSaveModalTags() {
        const container = document.getElementById('sheet-tags-checkboxes');
        container.innerHTML = '';
        this.allSheetTags.forEach(t => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
            row.innerHTML = `
                <label style="display:flex; gap:10px; cursor:pointer; color:var(--color-text);">
                    <input type="checkbox" value="${t.id}"> ${t.name}
                </label>
                <button class="btn-icon danger" style="padding:2px; width:22px; height:22px;" title="Supprimer définitivement le tag"><svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>
            `;
            row.querySelector('button').onclick = async (e) => {
                e.preventDefault();
                if(confirm(`Supprimer le tag "${t.name}" ?`)) {
                    await orbDB.db.transaction(['sheetTags'], 'readwrite').objectStore('sheetTags').delete(t.id);
                    this.allSheetTags = await orbDB.getAllSheetTags();
                    this.renderSaveModalTags();
                    this.renderStorageTagsManager();
                    this.loadData(); 
                }
            };
            container.appendChild(row);
        });
    },

    async saveSheet() {
        const name = document.getElementById('sheet-name-input').value || "Nouvelle Fiche";
        const tagIds = Array.from(document.querySelectorAll('#sheet-tags-checkboxes input:checked')).map(cb => parseInt(cb.value, 10));
        await orbDB.saveSheet({ name, tagIds, pages: this.serializePages() }, this.currentSheetId);
        
        document.getElementById('save-sheet-modal').classList.add('hidden');
        await this.loadData();
    },

    async exportToPDF() {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') return alert("Erreur librairies PDF.");
        this.deselectAll(); 
        document.querySelectorAll('.page-delete-btn').forEach(b => b.style.display = 'none');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4'); 
        const pages = document.querySelectorAll('.a4-page');

        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
        }

        document.querySelectorAll('.page-delete-btn').forEach(b => b.style.display = 'block');
        pdf.save('ORB_Fiche.pdf');
    }
};

document.addEventListener('DOMContentLoaded', () => SheetStudio.init());