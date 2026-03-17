/**
 * modules/planner/planner.js
 * V5 - Planificateur avec Navigation par Dossiers
 */
const PlannerModule = {
    currentPlan: { id: null, name: '', notes: '', playbookIds: [] },
    allPlaybooks: [],
    allTags: [], 
    allFolders: [],
    
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
    },

    bindEvents() {
        document.getElementById('plan-editor-cancel-btn').onclick = () => this.closeEditor();
        document.getElementById('plan-editor-save-btn').onclick = () => this.savePlan();
        
        this.btnLibBack.onclick = () => {
            this.libViewMode = 'FOLDERS';
            this.currentFolderId = null;
            this.currentTagId = null;
            this.searchInput.value = '';
            this.renderLibView();
        };

        this.searchInput.oninput = (e) => this.renderLibPlaybooks(e.target.value);
    },

    async loadGrid() {
        const plans = await orbDB.getAllPlans();
        this.grid.innerHTML = `
            <div class="card-new-plan" id="btn-new-plan">
                <svg viewBox="0 0 24 24"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
                Créer une Séance
            </div>`;
        
        plans.reverse().forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card';
            card.innerHTML = `
                <h3 style="margin-top:0; color:var(--color-primary); font-size:1.4em; border-bottom:1px solid var(--color-border); padding-bottom:10px;">${plan.name || 'Séance sans nom'}</h3>
                <p style="opacity:0.8; font-size:1em; margin: 15px 0;"><strong style="color:var(--color-text)">${plan.playbookIds.length}</strong> exercices inclus</p>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <button class="btn-primary" style="flex:2; padding:10px;" onclick="PlannerModule.editPlan(${plan.id})">Modifier</button>
                    <button class="btn-primary" style="flex:1; padding:10px; background:transparent; border:1px solid var(--color-primary); color:var(--color-primary);" onclick="PlannerModule.exportPDF(${plan.id})">PDF</button>
                    <button class="danger" style="padding:10px; border-radius:6px;" onclick="PlannerModule.deletePlan(${plan.id})">
                        <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:currentColor;"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2 2 0 0,0 8,21H16A2 2 0 0,0 18,19V7H6V19Z"/></svg>
                    </button>
                </div>
            `;
            this.grid.appendChild(card);
        });

        document.getElementById('btn-new-plan').onclick = () => this.openEditor();
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
        document.getElementById('plan-editor-name').value = this.currentPlan.name;
        document.getElementById('plan-editor-notes').value = this.currentPlan.notes;
        
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
                    ${previewUrl ? `<img src="${previewUrl}">` : `<div style="width:140px; height:90px; background:var(--color-background); border-radius:6px;"></div>`}
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

    async savePlan() {
        try {
            const planToSave = {
                name: document.getElementById('plan-editor-name').value || "Séance du " + new Date().toLocaleDateString(),
                notes: document.getElementById('plan-editor-notes').value,
                playbookIds: this.currentPlan.playbookIds
            };
            
            if (this.currentPlan.id !== null && this.currentPlan.id !== undefined) {
                planToSave.id = this.currentPlan.id;
            }

            await orbDB.savePlan(planToSave, this.currentPlan.id);
            this.closeEditor();
            this.loadGrid();
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            alert("Erreur technique lors de la sauvegarde.");
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

document.addEventListener('DOMContentLoaded', () => PlannerModule.init());