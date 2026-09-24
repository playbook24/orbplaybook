/**
 * modules/viewer/viewer.js
 * Logique du module de visualisation en lecture seule.
 */

window.ORB = window.ORB || {};

const Viewer = {
    type: null,
    id: null,
    
    async init() {
        this.cacheDOM();
        this.bindEvents();
        
        // Appliquer les thèmes si existants
        if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');
        if (localStorage.getItem('teamMode') === 'crab') document.body.classList.add('crab-mode');
        
        await orbDB.open();
        
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.type = urlParams.get('type');
        this.id = parseInt(urlParams.get('id'), 10);
        
        if (!this.type || isNaN(this.id)) {
            this.title.textContent = "Erreur";
            this.emptyMessage.textContent = "Paramètres invalides.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.loadContent();
    },

    cacheDOM() {
        this.btnBack = document.getElementById('btn-back');
        this.title = document.getElementById('viewer-title');
        
        this.sidebarPlan = document.getElementById('sidebar-plan');
        this.planTitle = document.getElementById('plan-title');
        this.planNotes = document.getElementById('plan-notes');
        this.planExoList = document.getElementById('plan-exo-list');
        
        this.emptyMessage = document.getElementById('empty-message');
        this.scenesContainer = document.getElementById('scenes-container');
        this.sheetContainer = document.getElementById('sheet-container');
    },

    bindEvents() {
        this.btnBack.addEventListener('click', () => {
            window.history.back();
        });
        
        // Gérer le redimensionnement pour les fiches (Sheet)
        window.addEventListener('resize', () => {
            if (this.type === 'sheet') {
                this.scalePages();
            }
        });
    },

    async loadContent() {
        try {
            if (this.type === 'playbook') {
                await this.loadPlaybook(this.id);
            } else if (this.type === 'plan') {
                await this.loadPlan(this.id);
            } else if (this.type === 'sheet') {
                await this.loadSheet(this.id);
            } else {
                this.title.textContent = "Erreur";
                this.emptyMessage.textContent = "Type non reconnu.";
                this.emptyMessage.style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            this.emptyMessage.textContent = "Une erreur s'est produite lors du chargement.";
            this.emptyMessage.style.display = 'block';
        }
    },

    async loadPlaybook(id) {
        const playbook = await orbDB.getPlaybook(id);
        if (!playbook) {
            this.emptyMessage.textContent = "schema introuvable.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.title.textContent = playbook.name || "schema sans nom";
        await this.renderPlaybookScenes(playbook);
    },

    async loadPlan(id) {
        const plan = await orbDB.getPlan(id);
        if (!plan) {
            this.emptyMessage.textContent = "Séance introuvable.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.title.textContent = plan.name || "Séance sans nom";
        this.sidebarPlan.classList.add('active');
        this.planTitle.textContent = plan.name || "Séance sans nom";
        
        if (plan.notes) {
            this.planNotes.textContent = plan.notes;
            this.planNotes.style.display = 'block';
        }

        this.planExoList.innerHTML = '';
        
        if (!plan.playbookIds || plan.playbookIds.length === 0) {
            this.planExoList.innerHTML = '<p style="opacity:0.6; padding: 10px;">Aucun exercice dans cette séance.</p>';
            this.emptyMessage.textContent = "Séance vide.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        let firstPlaybookLoaded = false;

        for (let i = 0; i < plan.playbookIds.length; i++) {
            const pbId = plan.playbookIds[i];
            const pb = await orbDB.getPlaybook(pbId);
            if (!pb) continue;

            const btn = document.createElement('button');
            btn.className = 'exo-btn';
            btn.innerHTML = `<span style="color:var(--color-primary); font-weight:900; width:20px;">${i+1}.</span> <span>${pb.name || 'Sans nom'}</span>`;
            
            btn.onclick = async () => {
                document.querySelectorAll('.exo-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.scenesContainer.style.display = 'none';
                this.sheetContainer.style.display = 'none';
                this.emptyMessage.style.display = 'none';

                this.emptyMessage.textContent = "Chargement...";
                this.emptyMessage.style.display = 'block';
                
                await this.renderPlaybookScenes(pb);
            };

            this.planExoList.appendChild(btn);

            if (!firstPlaybookLoaded) {
                btn.click();
                firstPlaybookLoaded = true;
            }
        }
    },

    async renderPlaybookScenes(playbookData) {
        this.scenesContainer.innerHTML = '';
        this.emptyMessage.style.display = 'none';

        const pbData = playbookData.playbookData || playbookData;

        if (!pbData.scenes || pbData.scenes.length === 0) {
            this.emptyMessage.textContent = "Ce schéma ne contient aucune scène.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.scenesContainer.style.display = 'flex';

        for (let i = 0; i < pbData.scenes.length; i++) {
            const scene = pbData.scenes[i];
            
            // Générer l'image de la scene
            const base64Image = await this.generateSceneImage(pbData, i);
            
            const sceneEl = document.createElement('div');
            sceneEl.className = 'scene-item';
            
            sceneEl.innerHTML = `
                <h2 style="font-family: 'Anton', sans-serif; text-transform: uppercase; color: var(--color-primary); margin-top: 0; font-size: 1.3em; letter-spacing: 2px; margin-bottom: 20px; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    ${pbData.name || 'schéma'} - Scène ${i + 1}
                </h2>
                <img src="${base64Image}" class="scene-image">
                ${scene.comments ? `
                    <div class="scene-comment" style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-left: 4px solid var(--color-primary); border-radius: 4px; width: 80%; max-width: 800px; text-align: left; background: var(--color-container); box-shadow: var(--shadow-soft);">
                        <strong style="color: var(--color-primary); display: block; margin-bottom: 5px;">Notes :</strong>
                        ${scene.comments}
                    </div>
                ` : ''}
            `;
            
            this.scenesContainer.appendChild(sceneEl);
        }

        this.scalePages();
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
            const primaryColor = isCrab ? '#72243D' : '#121212';
            const secondaryColor = isCrab ? '#F9AB00' : '#BB9243';

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

    async loadSheet(id) {
        const sheet = await orbDB.getSheet(id);
        if (!sheet) {
            this.emptyMessage.textContent = "Fiche introuvable.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.title.textContent = sheet.name || "Fiche sans nom";
        this.sheetContainer.style.display = 'flex';

        if (!sheet.pages || sheet.pages.length === 0) {
            this.emptyMessage.textContent = "Cette fiche est vide.";
            this.emptyMessage.style.display = 'block';
            return;
        }

        this.sheetContainer.innerHTML = '';
        sheet.pages.forEach((pageData, index) => {
            const pageEl = document.createElement('div');
            pageEl.className = 'a4-page';
            pageEl.id = `page-${index}`;
            
            pageData.forEach(data => {
                const el = document.createElement('div');
                el.className = 'a4-element';
                el.style.position = 'absolute';
                el.style.left = data.left || '0px';
                el.style.top = data.top || '0px';
                el.style.width = data.width || 'auto';
                el.style.height = data.height || 'auto';
                el.style.pointerEvents = 'none';

                if (data.type === 'text') {
                    const textContent = document.createElement('div');
                    textContent.style.width = '100%';
                    textContent.style.height = '100%';
                    textContent.style.fontSize = data.fontSize || '24px';
                    textContent.style.fontWeight = data.fontWeight || 'normal';
                    textContent.style.textAlign = data.textAlign || 'left';
                    textContent.style.fontFamily = 'var(--font-body), sans-serif';
                    if (!data.noBorder) {
                        textContent.style.border = '2px solid var(--color-primary)';
                        textContent.style.borderRadius = '6px';
                        textContent.style.padding = '10px';
                        textContent.style.boxSizing = 'border-box';
                        textContent.style.background = 'white';
                    }
                    textContent.innerHTML = data.content || '';
                    el.appendChild(textContent);
                } else if (data.type === 'image') {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.width = '100%';
                    imgContainer.style.height = '100%';
                    imgContainer.style.overflow = 'hidden';
                    imgContainer.style.position = 'relative';

                    const img = document.createElement('img');
                    img.src = data.content;
                    img.style.position = 'absolute';
                    img.style.left = data.imgX || '0px';
                    img.style.top = data.imgY || '0px';
                    img.style.width = data.imgW || '100%';
                    img.style.height = data.imgH || '100%';
                    
                    imgContainer.appendChild(img);
                    el.appendChild(imgContainer);
                }
                pageEl.appendChild(el);
            });
            this.sheetContainer.appendChild(pageEl);
        });

        this.scalePages();
    },

    scalePages() {
        const pages = document.querySelectorAll('.a4-page');
        if (pages.length === 0) return;
        
        const contentArea = document.querySelector('.viewer-content');
        const availableWidth = contentArea.clientWidth - 40; // 40px padding
        const scale = Math.min(1, availableWidth / 794);
        
        pages.forEach(page => {
            page.style.transform = `scale(${scale})`;
            page.style.marginBottom = `-${1123 * (1 - scale)}px`; // Ajuster la marge pour compenser le scale
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Viewer.init());
