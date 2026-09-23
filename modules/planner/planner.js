/**
 * modules/planner/planner.js
 * V5 - Planificateur avec Navigation par Dossiers
 */
const PlannerModule = {
    currentPlan: { id: null, name: '', notes: '', playbookIds: [] },
    allPlaybooks: [],
    allTags: [], 
    allFolders: [],
    allPlanFolders: [], // NOUVEAU: Dossiers pour les séances
    allPlanTags: [],    // NOUVEAU: Tags pour les séances
    allPlans: [],       // NOUVEAU: Stocker les séances chargées

    activePlanTagId: null, // Filtre actif
    plannerViewMode: sessionStorage.getItem('plannerViewMode') || 'FOLDERS',
    currentPlanFolderId: sessionStorage.getItem('plannerFolderId') && sessionStorage.getItem('plannerFolderId') !== 'ALL' ? parseInt(sessionStorage.getItem('plannerFolderId')) : (sessionStorage.getItem('plannerFolderId') || null),
    currentPlanToAssign: null,

    libViewMode: 'FOLDERS', // 'FOLDERS' ou 'PLAYBOOKS'
    currentFolderId: null,
    currentTagId: null,

    // Icônes SVG
    iconFolder: `<svg viewBox="0 0 24 24" style="width:30px;height:30px;fill:var(--color-primary);"><path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/></svg>`,
    iconAll: `<svg viewBox="0 0 24 24" style="width:30px;height:30px;fill:var(--color-primary);"><path d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16Z"/></svg>`,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        this.loadGrid();
    },

    cacheDOM() {
        this.grid = document.getElementById('planner-grid');
        this.mainView = document.getElementById('planner-main-view');
        this.editorView = document.getElementById('planner-editor-view');
        
        this.selectorList = document.getElementById('plan-selector-list');
        this.planList = document.getElementById('plan-playbooks-list');
        this.exoCount = document.getElementById('exo-count');
        
        this.libTitle = document.getElementById('planner-lib-title');
        this.btnLibBack = document.getElementById('btn-planner-lib-back');
        this.filterContainer = document.getElementById('plan-selector-filters');
        this.searchInput = document.getElementById('plan-selector-search');

        this.plannerTitleText = document.getElementById('planner-title-text');
        this.btnBackPlanFolders = document.getElementById('btn-back-plan-folders');
        this.btnCreatePlanFolder = document.getElementById('btn-create-plan-folder');
        this.assignPlanModal = document.getElementById('assign-plan-modal');
        this.plannerFilters = document.getElementById('planner-filters');
        
        this.managePlanTagsModal = document.getElementById('manage-plan-tags-modal');
    },

    bindEvents() {
        document.getElementById('global-back-btn').addEventListener('click', () => {
            if (!this.editorView.classList.contains('hidden')) {
                this.closeEditor();
            } else if (this.plannerViewMode === 'PLANS') {
                this.plannerViewMode = 'FOLDERS';
                this.currentPlanFolderId = null;
                this.loadGrid();
            } else {
                window.location.href = '../../index.html';
            }
        });

        document.getElementById('plan-editor-cancel-btn').onclick = () => this.closeEditor();
        document.getElementById('plan-editor-create-btn').onclick = () => this.createPlan();
        document.getElementById('plan-editor-update-btn').onclick = () => this.updatePlan();
        
        this.btnLibBack.onclick = () => {
            this.libViewMode = 'FOLDERS';
            this.currentFolderId = null;
            this.currentTagId = null;
            this.searchInput.value = '';
            this.renderLibView();
        };

        this.searchInput.oninput = (e) => this.renderLibPlaybooks(e.target.value);

        // NOUVELLES ACTIONS Planificateur
        this.btnBackPlanFolders.onclick = () => {
            this.plannerViewMode = 'FOLDERS';
            this.currentPlanFolderId = null;
            this.loadGrid();
        };

        this.btnCreatePlanFolder.onclick = async () => {
            const name = prompt("Entrez le nom du nouveau dossier (ex: U13, Janvier...) :");
            if (name && name.trim() !== '') {
                await orbDB.addPlanFolder(name.trim());
                this.loadGrid();
            }
        };

        document.getElementById('assign-plan-close-btn').onclick = () => this.assignPlanModal.classList.add('hidden');
        document.getElementById('btn-save-plan-assignment').onclick = () => this.savePlanAssignment();

        document.getElementById('btn-reorder-plans').onclick = () => {
            if (this.plannerViewMode === 'FOLDERS') {
                if (this.allPlanFolders.length === 0) return alert("Aucun dossier à réorganiser.");
                ORBReorder.open("Ordre des Dossiers", "planFolders", this.allPlanFolders, () => this.loadGrid());
            } else {
                let fIdSort = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : 'root';
                if (this.currentPlanFolderId === 'ALL') fIdSort = 'all';
                let items = this.allPlans.filter(p => {
                    if (this.currentPlanFolderId === 'ALL') return true;
                    if (fIdSort === 'root') return !p.folderIds || p.folderIds.length === 0;
                    return p.folderIds && p.folderIds.includes(fIdSort);
                });
                if (items.length === 0) return alert("Aucune séance à réorganiser ici.");
                ORBReorder.open("Ordre des Séances", `plans_${fIdSort}`, items, () => this.loadGrid());
            }
        };

        // Modal Tags
        document.getElementById('btn-manage-plan-tags').onclick = () => this.openManagePlanTagsModal();
        document.getElementById('manage-plan-tags-close-btn').onclick = () => this.managePlanTagsModal.classList.add('hidden');
        document.getElementById('btn-add-new-plan-tag').onclick = () => this.addPlanTag();
    },

    async loadGrid() {
        const [plans, pFolders, pTags] = await Promise.all([
            orbDB.getAllPlans(), orbDB.getAllPlanFolders(), orbDB.getAllPlanTags()
        ]);
        this.allPlans = plans || [];
        this.allPlanFolders = ORBReorder.sort(pFolders || [], 'planFolders');
        this.allPlanTags = ORBReorder.sort(pTags || [], 'planTags');
        
        sessionStorage.setItem('plannerViewMode', this.plannerViewMode);
        if (this.currentPlanFolderId !== null) sessionStorage.setItem('plannerFolderId', this.currentPlanFolderId);
        else sessionStorage.removeItem('plannerFolderId');

        if (this.plannerViewMode === 'FOLDERS') {
            this.renderPlanFolders();
        } else {
            this.renderPlansGrid();
        }
    },

    renderPlanFolders() {
        this.plannerTitleText.textContent = "Vos Dossiers de Séances";
        this.btnBackPlanFolders.style.display = 'none';
        this.btnCreatePlanFolder.style.display = 'inline-block';
        this.plannerFilters.innerHTML = '';
        this.grid.innerHTML = '';

        // Dossier "TOUTES LES SÉANCES"
        this.grid.appendChild(this.createPlanFolderCard('ALL', 'Toutes les séances', this.iconAll, this.allPlans.length));

        // Dossiers créés
        this.allPlanFolders.forEach(folder => {
            const count = this.allPlans.filter(p => p.folderIds && p.folderIds.includes(folder.id)).length;
            this.grid.appendChild(this.createPlanFolderCard(folder.id, folder.name, this.iconFolder, count, true));
        });
    },

    createPlanFolderCard(id, name, icon, count, isDeletable = false) {
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.innerHTML = `
            <div class="folder-icon" style="transform: scale(1.5); margin: 0 15px;">${icon}</div>
            <div class="folder-info">
                <h3 style="font-size: 1.4em;">${name}</h3>
                <p style="font-size: 1.1em;">${count} séance${count > 1 ? 's' : ''}</p>
            </div>
            ${isDeletable ? `<button class="folder-btn-delete" title="Supprimer ce dossier"><svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>` : ''}
        `;
        card.onclick = async (e) => {
            if (e.target.closest('.folder-btn-delete')) {
                e.stopPropagation();
                if(confirm(`Voulez-vous vraiment supprimer le dossier "${name}" ?\n(Les séances ne seront pas supprimées)`)) {
                    await orbDB.deletePlanFolder(id);
                    // Retirer le dossier de toutes les séances
                    this.allPlans.forEach(p => {
                        if (p.folderIds && p.folderIds.includes(id)) {
                            p.folderIds = p.folderIds.filter(fid => fid !== id);
                            orbDB.assignFoldersToPlan(p.id, p.folderIds); 
                        }
                    });
                    this.loadGrid();
                }
                return;
            }
            this.plannerViewMode = 'PLANS';
            this.currentPlanFolderId = id;
            this.plannerTitleText.textContent = name;
            this.loadGrid();
        };
        return card;
    },

    renderPlansGrid() {
        this.btnBackPlanFolders.style.display = 'inline-flex';
        this.btnCreatePlanFolder.style.display = 'none';

        let filteredPlans = this.allPlans;
        if (this.currentPlanFolderId !== 'ALL') {
            filteredPlans = filteredPlans.filter(p => p.folderIds && p.folderIds.includes(this.currentPlanFolderId));
        }
        
        if (this.activePlanTagId !== null) {
            filteredPlans = filteredPlans.filter(p => p.tagIds && p.tagIds.includes(this.activePlanTagId));
        }
        
        let fIdSort = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : 'root';
        if (this.currentPlanFolderId === 'ALL') fIdSort = 'all';
        filteredPlans = ORBReorder.sort([...filteredPlans], `plans_${fIdSort}`);

        this.renderPlanFilters(fIdSort);

        this.grid.innerHTML = `
            <div class="card-new-plan" id="btn-new-plan">
                <svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                Créer une Séance
            </div>`;
        
        filteredPlans.forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h3 style="margin-top:0; color:var(--color-primary); font-size:1.4em; border-bottom:1px solid var(--color-border); padding-bottom:10px; flex-grow:1;">${plan.name || 'Séance sans nom'}</h3>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-icon" title="${plan.pinned ? 'Désépingler du Hub' : 'Épingler au Hub'}" onclick="PlannerModule.togglePin(${plan.id})" style="color:${plan.pinned ? 'var(--color-primary)' : 'var(--color-text-muted)'}; margin-left:10px;">
                            <svg viewBox="0 0 24 24" style="width:24px; fill:currentColor;"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z"/></svg>
                        </button>
                        <button class="btn-icon" title="Classer la séance" onclick="PlannerModule.openAssignPlanModal(${plan.id})" style="color:var(--color-primary);">
                            <svg viewBox="0 0 24 24" style="width:24px; fill:currentColor;"><path d="M21.41 11.58L12.41 2.58C12.05 2.22 11.55 2 11 2H4C2.9 2 2 2.9 2 4V11C2 11.55 2.22 12.05 2.59 12.41L11.58 21.41C11.95 21.77 12.45 22 13 22C13.55 22 14.05 21.77 14.41 21.41L21.41 14.41C21.78 14.05 22 13.55 22 13C22 12.45 21.77 11.95 21.41 11.58M13 20L4 11V4H11L20 13L13 20M6.5 5C7.33 5 8 5.67 8 6.5S7.33 8 6.5 8 5 7.33 5 6.5 5.67 5 6.5 5Z"/></svg>
                        </button>
                    </div>
                </div>
                <p style="opacity:0.8; font-size:1em; margin: 15px 0;"><strong style="color:var(--color-text)">${plan.playbookIds.length}</strong> exercices inclus</p>
                <div style="margin-top:20px; display:flex; flex-wrap: wrap; gap:10px;">
                    <button class="btn-primary" style="flex:1; padding:10px;" onclick="window.location.href='../viewer/viewer.html?type=plan&id=${plan.id}'">Visionner</button>
                    <button class="btn-primary" style="flex:1; padding:10px; background:transparent; border:1px solid var(--color-primary); color:var(--color-primary);" onclick="PlannerModule.editPlan(${plan.id})">Modifier</button>
                    <button class="btn-primary" style="flex:1; padding:10px; background:transparent; border:1px solid var(--color-text); color:var(--color-text);" onclick="PlannerModule.exportPDF(${plan.id})">PDF</button>
                    <button class="danger" style="padding:10px; border-radius:6px;" onclick="PlannerModule.deletePlan(${plan.id})">
                        <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:currentColor;"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2 2 0 0,0 8,21H16A2 2 0 0,0 18,19V7H6V19Z"/></svg>
                    </button>
                </div>
            `;
            this.grid.appendChild(card);
        });

        document.getElementById('btn-new-plan').onclick = () => this.openEditor();
    },

    async togglePin(planId) {
        try {
            const plan = this.allPlans.find(p => p.id === planId);
            if (!plan) return;
            plan.pinned = !plan.pinned;
            if (plan.pinned) {
                plan.pinnedAt = Date.now();
            } else {
                delete plan.pinnedAt;
            }
            await orbDB.savePlan(plan, plan.id);
            this.allPlans = await orbDB.getAllPlans();
            this.renderPlansGrid();
        } catch (e) {
            console.error("Erreur lors de l'épinglage", e);
        }
    },

    openAssignPlanModal(planId) {
        const plan = this.allPlans.find(p => p.id === planId);
        if (!plan) return;
        this.currentPlanToAssign = plan;
        document.getElementById('assign-plan-title').textContent = `Classer : ${plan.name}`;
        
        const planFolderIds = new Set(plan.folderIds || []);
        const planTagIds = new Set(plan.tagIds || []);
        
        const fList = document.getElementById('assign-plan-folders-list');
        fList.innerHTML = '';
        if (this.allPlanFolders.length === 0) fList.innerHTML = '<p style="font-size:0.9em; opacity:0.7;">Aucun dossier créé.</p>';
        else {
            this.allPlanFolders.forEach(folder => {
                const isChecked = planFolderIds.has(folder.id);
                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; gap:10px; cursor:pointer; font-size:1.1em;';
                label.innerHTML = `<input type="checkbox" class="plan-folder-checkbox" value="${folder.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary);"><span>${folder.name}</span>`;
                label.querySelector('input').addEventListener('change', () => this.renderAssignPlanTags(planTagIds));
                fList.appendChild(label);
            });
        }
        
        this.renderAssignPlanTags(planTagIds);
        this.assignPlanModal.classList.remove('hidden');
    },

    renderAssignPlanTags(planTagIds) {
        const tList = document.getElementById('assign-plan-tags-list');
        tList.innerHTML = '';
        const selectedFolderIds = Array.from(document.querySelectorAll('.plan-folder-checkbox:checked')).map(cb => parseInt(cb.value, 10));
        let hasTags = false;
        
        const appendGroup = (title, tags) => {
            const groupTitle = document.createElement('div');
            groupTitle.style.cssText = 'font-weight:bold; margin-top:10px; margin-bottom:5px; color:var(--color-primary); font-size:0.9em;';
            groupTitle.textContent = title;
            tList.appendChild(groupTitle);
            tags.forEach(tag => {
                const isChecked = planTagIds.has(tag.id);
                const label = document.createElement('label');
                label.style.cssText = 'display:flex; align-items:center; gap:10px; cursor:pointer; font-size:1.1em;';
                label.innerHTML = `<input type="checkbox" class="plan-tag-checkbox" value="${tag.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary);"><span>${tag.name}</span>`;
                tList.appendChild(label);
            });
        };

        const globalTags = this.allPlanTags.filter(t => t.folderId == null);
        if (globalTags.length > 0) { hasTags = true; appendGroup("Tags Globaux", globalTags); }

        selectedFolderIds.forEach(fId => {
            const folder = this.allPlanFolders.find(f => f.id === fId);
            const fTags = this.allPlanTags.filter(t => t.folderId === fId);
            if (fTags.length > 0 && folder) { hasTags = true; appendGroup(`Tags : ${folder.name}`, fTags); }
        });

        if (!hasTags) tList.innerHTML = '<p style="font-size:0.9em; opacity:0.7;">Aucun tag disponible pour les dossiers sélectionnés.</p>';
    },

    async savePlanAssignment() {
        if (!this.currentPlanToAssign) return;
        const selectedFIds = Array.from(document.querySelectorAll('.plan-folder-checkbox:checked')).map(cb => parseInt(cb.value, 10));
        const selectedTIds = Array.from(document.querySelectorAll('.plan-tag-checkbox:checked')).map(cb => parseInt(cb.value, 10));
        try {
            await orbDB.assignFoldersToPlan(this.currentPlanToAssign.id, selectedFIds);
            await orbDB.assignTagsToPlan(this.currentPlanToAssign.id, selectedTIds);
            this.assignPlanModal.classList.add('hidden');
            this.loadGrid();
        } catch(e) { console.error(e); }
    },

    renderPlanFilters(fIdSort) {
        this.plannerFilters.style.display = 'flex';
        this.plannerFilters.innerHTML = '';
        
        const reorderBtn = document.createElement('div');
        reorderBtn.className = 'tag-chip';
        reorderBtn.style.cssText = 'display:flex; align-items:center; justify-content:center; padding: 4px 8px;';
        reorderBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M3,13H21V11H3V13M3,17H21V15H3V17M3,9H21V7H3V9Z" /></svg>`;
        reorderBtn.title = "Ordre d'affichage des tags";
        reorderBtn.onclick = () => {
            let fId = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : null;
            const currentTags = this.allPlanTags.filter(t => t.folderId == fId);
            if(currentTags.length === 0) return alert("Aucun tag ici.");
            ORBReorder.open("Ordre des Tags", `planTags_${fIdSort}`, currentTags, () => this.loadGrid());
        };
        this.plannerFilters.appendChild(reorderBtn);

        const allBtn = document.createElement('div');
        allBtn.className = `tag-chip ${this.activePlanTagId === null ? 'active' : ''}`;
        allBtn.textContent = "Tous les tags";
        allBtn.onclick = () => { this.activePlanTagId = null; this.loadGrid(); };
        this.plannerFilters.appendChild(allBtn);

        let fId = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : null;
        const currentTags = this.allPlanTags.filter(t => t.folderId == fId);
        currentTags.forEach(tag => {
            const tagBtn = document.createElement('div');
            tagBtn.className = `tag-chip ${this.activePlanTagId === tag.id ? 'active' : ''}`;
            tagBtn.textContent = tag.name;
            tagBtn.onclick = () => { this.activePlanTagId = tag.id; this.loadGrid(); };
            this.plannerFilters.appendChild(tagBtn);
        });
    },

    openManagePlanTagsModal() {
        const title = document.getElementById('manage-plan-tags-title');
        if (this.currentPlanFolderId === null || this.currentPlanFolderId === 'ALL') {
            title.textContent = "Gérer les Tags Globaux";
        } else {
            const folder = this.allPlanFolders.find(f => f.id === this.currentPlanFolderId);
            title.textContent = folder ? `Tags : ${folder.name}` : "Gérer les Tags";
        }
        this.renderMasterPlanTagList();
        this.managePlanTagsModal.classList.remove('hidden');
    },

    renderMasterPlanTagList() {
        const list = document.getElementById('master-plan-tag-list');
        list.innerHTML = '';
        let fId = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : null;
        const currentTags = this.allPlanTags.filter(t => t.folderId == fId);
        
        if (currentTags.length === 0) return list.innerHTML = '<li style="justify-content:center; opacity:0.6;">Aucun tag créé ici.</li>';
        currentTags.forEach(tag => {
            list.innerHTML += `<li data-id="${tag.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--color-border);"><span style="font-weight:bold;">${tag.name}</span><button class="btn-icon danger" onclick="PlannerModule.deletePlanTag(${tag.id})" style="color:#ff4444;" title="Supprimer ce tag"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button></li>`;
        });
    },

    async addPlanTag() {
        const name = document.getElementById('new-plan-tag-name').value.trim();
        if (name) {
            try {
                let fId = (typeof this.currentPlanFolderId === 'number') ? this.currentPlanFolderId : null;
                await orbDB.addPlanTag(name, fId);
                document.getElementById('new-plan-tag-name').value = '';
                await this.loadGrid();
                this.renderMasterPlanTagList();
            } catch (e) { alert("Ce tag existe déjà."); }
        }
    },

    async deletePlanTag(tagId) {
        if (confirm("Voulez-vous vraiment supprimer ce tag ?")) {
            await orbDB.deletePlanTag(tagId);
            this.allPlans.forEach(p => {
                if (p.tagIds && p.tagIds.includes(tagId)) {
                    p.tagIds = p.tagIds.filter(id => id !== tagId);
                    orbDB.assignTagsToPlan(p.id, p.tagIds);
                }
            });
            await this.loadGrid();
            this.renderMasterPlanTagList();
        }
    },

    closeEditor() {
        this.editorView.classList.add('hidden');
        this.mainView.classList.remove('hidden');
        window.scrollTo(0, 0);
    },

    async openEditor(plan = null) {
        // CHARGE TOUT
        [this.allPlaybooks, this.allTags, this.allFolders] = await Promise.all([
            orbDB.getAllPlaybooks(), orbDB.getAllTags(), orbDB.getAllFolders()
        ]);
        
        this.currentPlan = plan ? { ...plan } : { id: null, name: '', notes: '', playbookIds: [] };
        
        document.getElementById('editor-main-title').innerHTML = plan ? `ÉDITION <span class="highlight">SÉANCE</span>` : `NOUVELLE <span class="highlight">SÉANCE</span>`;
        
        if (plan) {
            document.getElementById('plan-editor-create-btn').classList.add('hidden');
            document.getElementById('plan-editor-update-btn').classList.remove('hidden');
        } else {
            document.getElementById('plan-editor-create-btn').classList.remove('hidden');
            document.getElementById('plan-editor-update-btn').classList.add('hidden');
        }
        
        this.renderPlanExos();

        // Réinitialise la bibliothèque à droite
        this.libViewMode = 'FOLDERS';
        this.currentFolderId = null;
        this.currentTagId = null;
        this.searchInput.value = '';
        this.renderLibView();
        
        this.mainView.classList.add('hidden');
        this.editorView.classList.remove('hidden');
        window.scrollTo(0, 0);
    },

    // --- NAVIGATION DANS LA BIBLIOTHÈQUE ---
    renderLibView() {
        if (this.libViewMode === 'FOLDERS') {
            this.renderLibFolders();
        } else {
            this.renderLibPlaybooks(this.searchInput.value);
        }
    },

    renderLibFolders() {
        this.libTitle.textContent = "Dossiers";
        this.btnLibBack.classList.add('hidden');
        this.filterContainer.classList.add('hidden');
        this.searchInput.classList.add('hidden');
        this.selectorList.innerHTML = '';

        // Dossier: Tous
        const allItem = document.createElement('div');
        allItem.className = 'selector-item';
        allItem.innerHTML = `
            <div class="preview-placeholder">
                <div style="background:rgba(0,0,0,0.2); width:50px; height:50px; border-radius:8px; display:flex; align-items:center; justify-content:center;">${this.iconAll}</div>
            </div>
            <div class="selector-item-content">
                <span class="selector-item-title">Tous les schémas</span>
                <span class="selector-item-add">${this.allPlaybooks.length} exos</span>
            </div>`;
        allItem.onclick = () => { this.libViewMode = 'PLAYBOOKS'; this.currentFolderId = 'ALL'; this.renderLibView(); };
        this.selectorList.appendChild(allItem);

        // Dossiers créés
        this.allFolders.forEach(folder => {
            const count = this.allPlaybooks.filter(pb => pb.folderIds && pb.folderIds.includes(folder.id)).length;
            const item = document.createElement('div');
            item.className = 'selector-item';
            item.innerHTML = `
                <div class="preview-placeholder">
                    <div style="background:rgba(0,0,0,0.2); width:50px; height:50px; border-radius:8px; display:flex; align-items:center; justify-content:center;">${this.iconFolder}</div>
                </div>
                <div class="selector-item-content">
                    <span class="selector-item-title">${folder.name}</span>
                    <span class="selector-item-add">${count} exos</span>
                </div>`;
            item.onclick = () => { this.libViewMode = 'PLAYBOOKS'; this.currentFolderId = folder.id; this.libTitle.textContent = folder.name; this.renderLibView(); };
            this.selectorList.appendChild(item);
        });
    },

    renderLibPlaybooks(filterText = '') {
        this.btnLibBack.classList.remove('hidden');
        this.filterContainer.classList.remove('hidden');
        this.searchInput.classList.remove('hidden');
        this.selectorList.innerHTML = '';

        // 1. Génération des Tags Spécifiques au dossier
        this.filterContainer.innerHTML = '';
        const btnAll = document.createElement('button');
        btnAll.className = `tag-filter-btn ${this.currentTagId === null ? 'active' : ''}`;
        btnAll.textContent = 'Tous';
        btnAll.onclick = () => { this.currentTagId = null; this.renderLibPlaybooks(this.searchInput.value); };
        this.filterContainer.appendChild(btnAll);

        let fId = (typeof this.currentFolderId === 'number') ? this.currentFolderId : null;
        const currentTags = this.allTags.filter(t => t.folderId == fId);
        currentTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = `tag-filter-btn ${this.currentTagId === tag.id ? 'active' : ''}`;
            btn.textContent = tag.name;
            btn.onclick = () => { this.currentTagId = this.currentTagId === tag.id ? null : tag.id; this.renderLibPlaybooks(this.searchInput.value); };
            this.filterContainer.appendChild(btn);
        });

        // 2. Filtrage des Playbooks
        let filtered = this.allPlaybooks;
        if (this.currentFolderId !== 'ALL') {
            filtered = filtered.filter(pb => pb.folderIds && pb.folderIds.includes(this.currentFolderId));
        }
        if (this.currentTagId !== null) {
            filtered = filtered.filter(pb => pb.tagIds && pb.tagIds.includes(this.currentTagId));
        }

        const searchLower = filterText.toLowerCase();
        filtered = filtered.filter(pb => (pb.name || '').toLowerCase().includes(searchLower));

        if (filtered.length === 0) {
            this.selectorList.innerHTML = '<p style="text-align:center; opacity:0.5; padding:20px;">Aucun exercice trouvé.</p>';
            return;
        }

        // 3. Affichage
        filtered.reverse().forEach(pb => {
            const item = document.createElement('div');
            item.className = 'selector-item';
            
            let previewUrl = '';
            if (pb.preview instanceof Blob) {
                try { previewUrl = URL.createObjectURL(pb.preview); } catch(e){}
            }

            item.innerHTML = `
                ${previewUrl ? `<img src="${previewUrl}" alt="Aperçu">` : `<div class="preview-placeholder"><span style="color:#000; font-weight:bold;">Aperçu</span></div>`}
                <div class="selector-item-content">
                    <span class="selector-item-title">${pb.name || 'Sans nom'}</span>
                    <span class="selector-item-add">+ Ajouter</span>
                </div>
            `;
            item.onclick = () => {
                this.currentPlan.playbookIds.push(pb.id);
                this.renderPlanExos();
            };
            this.selectorList.appendChild(item);
        });
    },

    // --- GESTION DE LA SÉANCE ---
    renderPlanExos() {
        this.planList.innerHTML = '';
        this.exoCount.textContent = this.currentPlan.playbookIds.length;

        if (this.currentPlan.playbookIds.length === 0) {
            this.planList.innerHTML = `
                <li style="opacity: 0.6; font-style: italic; border: 2px dashed var(--color-border); background: transparent; justify-content:center; padding: 40px; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:10px;">
                    <svg viewBox="0 0 24 24" style="width:40px; fill:var(--color-primary);"><path d="M13 19C13 15.69 15.69 13 19 13C20.1 13 21.12 13.3 22 13.81V6C22 4.89 21.1 4 20 4H4C2.89 4 2 4.89 2 6V18C2 19.11 2.9 20 4 20H13.09C13.04 19.67 13 19.34 13 19M4 18V6H20V11.81C19.68 11.66 19.35 11.53 19 11.43V8H5V18H13.09C13.3 18.67 13.58 19.3 13.93 19.87L13.81 20H4M18 15V18H15V20H18V23H20V20H23V18H20V15H18Z" /></svg>
                    Piochez des exercices dans la bibliothèque à droite.
                </li>`;
            return;
        }

        this.currentPlan.playbookIds.forEach((id, index) => {
            const pb = this.allPlaybooks.find(p => p.id === id);
            if (!pb) return;
            
            const li = document.createElement('li');
            li.className = 'plan-item';
            li.draggable = true; 
            
            let previewUrl = '';
            if (pb.preview instanceof Blob) {
                try { previewUrl = URL.createObjectURL(pb.preview); } catch(e){}
            }

            li.innerHTML = `
                <div class="plan-item-left">
                    <span class="drag-handle" title="Maintenir pour déplacer">⣿</span>
                    <span style="font-weight:900; color:var(--color-primary); width:20px;">${index + 1}.</span>
                    ${previewUrl ? `<img src="${previewUrl}">` : `<div style="width:130px; height:80px; background:var(--color-background); border-radius:6px;"></div>`}
                    <span style="font-weight:bold; font-size:1.1em;">${pb.name || 'Sans nom'}</span>
                </div>
                <button class="btn-icon danger" onclick="PlannerModule.removeExo(${index})" style="padding:8px;" title="Retirer">
                    <svg viewBox="0 0 24 24" style="width:24px;"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>
                </button>
            `;

            li.ondragstart = (e) => { e.dataTransfer.setData('text/plain', index); li.style.opacity = '0.4'; };
            li.ondragend = () => { li.style.opacity = '1'; };
            li.ondragover = (e) => { e.preventDefault(); };
            li.ondrop = (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    const item = this.currentPlan.playbookIds.splice(fromIndex, 1)[0];
                    this.currentPlan.playbookIds.splice(toIndex, 0, item);
                    this.renderPlanExos(); 
                }
            };
            this.planList.appendChild(li);
        });
    },

    removeExo(index) {
        this.currentPlan.playbookIds.splice(index, 1);
        this.renderPlanExos();
    },

    async createPlan() {
        try {
            const planName = prompt("Entrez le nom de la séance (ex: Focus Défense U15...):");
            if (planName === null) return; // User cancelled
            
            const planToSave = {
                name: planName.trim() || "Séance du " + new Date().toLocaleDateString(),
                notes: "",
                playbookIds: this.currentPlan.playbookIds,
                folderIds: this.currentPlan.folderIds || (this.currentPlanFolderId !== 'ALL' && this.currentPlanFolderId ? [this.currentPlanFolderId] : [])
            };

            await orbDB.savePlan(planToSave, null);
            this.closeEditor();
            this.loadGrid();
        } catch (error) {
            console.error("Erreur de création:", error);
            alert("Erreur technique lors de la création.");
        }
    },

    async updatePlan() {
        try {
            const planToSave = {
                id: this.currentPlan.id,
                name: this.currentPlan.name || "Séance du " + new Date().toLocaleDateString(),
                notes: this.currentPlan.notes || "",
                playbookIds: this.currentPlan.playbookIds,
                folderIds: this.currentPlan.folderIds || (this.currentPlanFolderId !== 'ALL' && this.currentPlanFolderId ? [this.currentPlanFolderId] : [])
            };

            await orbDB.savePlan(planToSave, this.currentPlan.id);
            this.closeEditor();
            this.loadGrid();
        } catch (error) {
            console.error("Erreur de mise à jour:", error);
            alert("Erreur technique lors de la mise à jour.");
        }
    },

    async editPlan(id) {
        const plan = await orbDB.getPlan(id);
        this.openEditor(plan);
    },

    async deletePlan(id) {
        if(confirm("Supprimer définitivement cette séance ?")) {
            await orbDB.deletePlan(id);
            this.loadGrid();
        }
    },

    async exportPDF(id) {
        if (typeof window.jspdf === 'undefined') return alert("Erreur: jsPDF non chargé.");
        
        const plan = await orbDB.getPlan(id);
        if (!plan) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFillColor('#BFA98D'); 
        doc.rect(0, 0, 210, 25, 'F');
        doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor('#000000');
        doc.text((plan.name || 'Séance').toUpperCase(), 105, 16, { align: 'center' });

        doc.setFontSize(11); doc.setTextColor('#333333');
        if (plan.notes) {
            doc.text("OBJECTIFS :", 20, 35);
            doc.setFont("helvetica", "normal");
            doc.text(doc.splitTextToSize(plan.notes, 170), 20, 42);
        }

        let yPos = plan.notes ? 60 : 35;
        
        for (let i = 0; i < plan.playbookIds.length; i++) {
            const pbId = plan.playbookIds[i];
            const pb = await orbDB.getPlaybook(pbId);
            if (!pb) continue;

            if (yPos > 240) { doc.addPage(); yPos = 20; } 

            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor('#000000');
            doc.text(`${i + 1}. ${pb.name || 'Exercice'}`, 20, yPos);
            yPos += 8;

            if (pb.preview instanceof Blob) {
                const base64Img = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(pb.preview);
                });
                doc.addImage(base64Img, 'JPEG', 20, yPos, 100, 53); 
                yPos += 65;
            } else {
                yPos += 10;
            }
        }

        doc.save(`${plan.name || 'Plan_ORB'}.pdf`);
    }
};

window.PlannerModule = PlannerModule;
document.addEventListener('DOMContentLoaded', () => PlannerModule.init());