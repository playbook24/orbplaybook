/**
 * modules/calendar/calendar.js
 * V4 - Calendrier avec option "Aucune équipe" et icônes Noires.
 */
const CalendarModule = {
    currentDate: new Date(),
    selectedDateStr: null,
    currentEvent: null,
    
    // NOUVEAU : Gestion des dossiers pour le sélecteur
    pickerViewMode: 'FOLDERS',
    currentPickerFolderId: null,
    allPlanFolders: [],
    allPlans: [],

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        
        // Handle URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlDate = urlParams.get('date');
        const urlId = urlParams.get('id');
        
        if (urlDate) {
            this.currentDate = new Date(urlDate);
        }
        
        await this.render();
        
        if (urlDate && urlId) {
            this.openEditor(urlDate, parseInt(urlId, 10));
        }
    },

    getContrastYIQ(hexcolor){
        if (!hexcolor) return '#ffffff';
        hexcolor = hexcolor.replace("#", "");
        if (hexcolor.length === 3) {
            hexcolor = hexcolor.split('').map(c => c+c).join('');
        }
        var r = parseInt(hexcolor.substr(0,2),16);
        var g = parseInt(hexcolor.substr(2,2),16);
        var b = parseInt(hexcolor.substr(4,2),16);
        var yiq = ((r*299)+(g*587)+(b*114))/1000;
        return (yiq >= 128) ? '#000000' : '#ffffff';
    },

    cacheDOM() {
        this.grid = document.getElementById('calendar-grid');
        this.monthDisplay = document.getElementById('cal-month-display');
        this.modal = document.getElementById('event-editor-modal');
        this.teamsContainer = document.getElementById('event-teams-container');
        this.teamsDropdownBtn = document.getElementById('event-teams-dropdown-btn');
        this.teamsDropdownMenu = document.getElementById('event-teams-dropdown-menu');
        this.teamsDropdownLabel = document.getElementById('event-teams-dropdown-label');
        this.eventTypeSelect = document.getElementById('event-type-select');
        this.matchFieldsContainer = document.getElementById('match-fields-container');
        this.trainingPlanContainer = document.getElementById('training-plan-container');
        this.matchOpponent = document.getElementById('match-opponent');
        this.matchScoreUs = document.getElementById('match-score-us');
        this.matchScoreThem = document.getElementById('match-score-them');
        this.eventTitleLabel = document.getElementById('event-title-label');
        
        this.planPickerModal = document.getElementById('plan-picker-modal');
        this.planPickerList = document.getElementById('plan-picker-list');
        this.planPickerTitle = document.getElementById('plan-picker-title');
        this.btnPickerBack = document.getElementById('btn-picker-back');
        this.eventPlanEmpty = document.getElementById('event-plan-empty');
        this.eventPlanSelected = document.getElementById('event-plan-selected');
        
        this.viewerModal = document.getElementById('snapshot-viewer-modal');
        this.viewerList = document.getElementById('viewer-list');
        this.viewerTitle = document.getElementById('viewer-title');
        
        this.attendanceModal = document.getElementById('attendance-modal');
        this.attendanceList = document.getElementById('attendance-list');
        this.attendanceSummary = document.getElementById('attendance-summary');
    },

    bindEvents() {
        document.getElementById('cal-prev-btn').onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.render(); };
        document.getElementById('cal-next-btn').onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.render(); };
        document.getElementById('cal-today-btn').onclick = () => { this.currentDate = new Date(); this.render(); };
        
        document.getElementById('event-modal-close-btn').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('btn-save-event').onclick = () => this.saveEvent();
        document.getElementById('btn-delete-event').onclick = () => this.deleteEvent();

        document.getElementById('btn-open-plan-picker').onclick = () => this.openPlanPicker();
        document.getElementById('plan-picker-close-btn').onclick = () => this.planPickerModal.classList.add('hidden');
        this.btnPickerBack.onclick = () => {
            if (this.pickerViewMode === 'PLANS') {
                this.pickerViewMode = 'FOLDERS';
                this.renderPlanPicker();
            }
        };

        document.getElementById('btn-remove-snapshot').onclick = () => {
            this.currentEvent.planSnapshot = null;
            this.updatePlanUI();
        };

        document.getElementById('btn-view-snapshot-plan').onclick = () => this.viewPlanDetails();
        document.getElementById('viewer-close-btn').onclick = () => this.viewerModal.classList.add('hidden');

        document.getElementById('btn-manage-attendance').onclick = () => this.openAttendanceModal();
        document.getElementById('attendance-close-btn').onclick = () => this.attendanceModal.classList.add('hidden');
        document.getElementById('btn-save-attendance').onclick = () => this.saveAttendance();

        const repeatCheckbox = document.getElementById('event-repeat-checkbox');
        if (repeatCheckbox) {
            repeatCheckbox.onchange = (e) => {
                document.getElementById('event-repeat-until').disabled = !e.target.checked;
            };
        }

        if (this.eventTypeSelect) {
            this.eventTypeSelect.onchange = () => this.updateEventTypeUI();
        }

        if (this.teamsDropdownBtn) {
            this.teamsDropdownBtn.onclick = (e) => {
                e.stopPropagation();
                this.teamsDropdownMenu.classList.toggle('hidden');
            };
            document.addEventListener('click', (e) => {
                if (!this.teamsDropdownBtn.contains(e.target) && !this.teamsDropdownMenu.contains(e.target)) {
                    this.teamsDropdownMenu.classList.add('hidden');
                }
            });
        }
    },

    updateTeamsDropdownLabel() {
        if (!this.teamsDropdownLabel) return;
        const checkboxes = this.teamsContainer.querySelectorAll('.team-checkbox');
        let count = 0;
        let firstCheckedName = '';
        checkboxes.forEach(cb => {
            if (cb.checked) {
                count++;
                if (count === 1) firstCheckedName = cb.nextSibling.textContent;
            }
        });
        if (count === 0) {
            this.teamsDropdownLabel.textContent = "Sélectionner les équipes...";
        } else if (count === 1) {
            this.teamsDropdownLabel.textContent = firstCheckedName;
        } else {
            this.teamsDropdownLabel.textContent = `${count} équipes sélectionnées`;
        }
    },

    updateEventTypeUI() {
        const type = this.eventTypeSelect.value;
        const repeatContainer = document.getElementById('event-repeat-container');
        if (type === 'match') {
            this.matchFieldsContainer.classList.remove('hidden');
            this.trainingPlanContainer.classList.add('hidden');
            this.eventTitleLabel.textContent = "Titre du match";
            if (repeatContainer) repeatContainer.style.display = 'none';
        } else {
            this.matchFieldsContainer.classList.add('hidden');
            this.trainingPlanContainer.classList.remove('hidden');
            this.eventTitleLabel.textContent = "Titre de la séance";
            if (repeatContainer && !this.currentEvent.id) repeatContainer.style.display = 'flex';
        }
    },

    async render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let monthStr = this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        this.monthDisplay.textContent = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
        
        this.grid.innerHTML = '';

        const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        days.forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-header'; h.textContent = d;
            this.grid.appendChild(h);
        });

        let emptyDays = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < emptyDays; i++) {
            this.grid.appendChild(document.createElement('div'));
        }

        const events = await orbDB.getAllCalendarEvents();
        const teams = await orbDB.getAllTeams();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            dayCell.innerHTML = `<div class="day-number" style="${isToday ? 'color:var(--color-primary); font-size:1.2em;' : ''}">${d}</div>`;
            
            events.filter(e => e.date === dateStr).forEach(e => {
                const chip = document.createElement('div');
                chip.className = 'event-chip';
                chip.style.display = 'flex';
                chip.style.justifyContent = 'space-between';
                chip.style.alignItems = 'center';

                let teamColor = '';
                if (e.teamId) {
                    const t = teams.find(t => t.id === e.teamId);
                    if (t && t.color) teamColor = t.color;
                } else if (e.teamIds && e.teamIds.length > 0) {
                    const t = teams.find(t => t.id === e.teamIds[0]);
                    if (t && t.color) teamColor = t.color;
                }

                if (teamColor) {
                    chip.style.backgroundColor = teamColor;
                    chip.style.color = this.getContrastYIQ(teamColor);
                    chip.style.border = '1px solid rgba(0,0,0,0.2)';
                }
                
                const hasPlan = !!(e.planSnapshot);
                const hasAttendance = e.attendance && Object.keys(e.attendance).length > 0;
                
                const isMatch = e.type === 'match';
                let iconsHtml = '';
                if (isMatch) {
                    iconsHtml += `<svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor; flex-shrink:0;" title="Match"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,13.75 19.43,15.38 18.45,16.7L16.5,14.77C16.82,13.92 17,13 17,12A5,5 0 0,0 12,7C11,7 10.08,7.18 9.23,7.5L7.3,5.55C8.62,4.57 10.25,4 12,4M5.55,7.3L7.5,9.23C7.18,10.08 7,11 7,12A5,5 0 0,0 12,17C13,17 13.92,16.82 14.77,16.5L16.7,18.45C15.38,19.43 13.75,20 12,20A8,8 0 0,1 4,12C4,10.25 4.57,8.62 5.55,7.3Z"/></svg>`;
                } else {
                    if (hasPlan) iconsHtml += `<svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor; flex-shrink:0;" title="Entraînement lié"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,9V3.5L18.5,9H13Z"/></svg>`;
                }
                if (hasAttendance) iconsHtml += `<svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor; flex-shrink:0;" title="Appel effectué"><path d="M21.1,12.5L22.5,13.91L15.97,20.5L12.5,17L13.9,15.59L15.97,17.67L21.1,12.5M10,17L13,20H3V18C3,15.79 6.58,14 10.5,14C10.89,14 11.27,14 11.64,14.07L10.59,15.12C10.56,15.11 10.53,15.11 10.5,15.11C8.25,15.11 5.37,16.05 4.88,17H10M10.5,12C8.57,12 6.69,10.43 6.69,8.5C6.69,6.57 8.57,5 10.5,5C12.43,5 14.31,6.57 14.31,8.5C14.31,10.43 12.43,12 10.5,12M10.5,10.11C11.5,10.11 12.41,9.25 12.41,8.5C12.41,7.75 11.5,6.89 10.5,6.89C9.5,6.89 8.59,7.75 8.59,8.5C8.59,9.25 9.5,10.11 10.5,10.11Z"/></svg>`;

                let displayTitle = e.title || 'Séance';
                if (isMatch && e.score) displayTitle += ` (${e.score})`;

                chip.innerHTML = `
                    <span style="flex: 1 1 auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayTitle}</span>
                    <div style="flex: 0 0 auto; display:flex; align-items:center; gap:5px; margin-left: 5px;">${iconsHtml}</div>
                `;
                
                chip.onclick = (event) => { event.stopPropagation(); this.openEditor(dateStr, e.id); };
                dayCell.appendChild(chip);
            });

            dayCell.onclick = () => this.openEditor(dateStr, null);
            this.grid.appendChild(dayCell);
        }
    },

    async openEditor(dateStr, eventId = null) {
        this.selectedDateStr = dateStr;
        const formattedDate = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        document.getElementById('event-date-display').textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        
        const events = await orbDB.getAllCalendarEvents();
        let existingEvent = null;
        if (eventId) {
            existingEvent = events.find(e => e.id === eventId);
        }

        const allTeams = await orbDB.getAllTeams();
        this.teamsContainer.innerHTML = '';
        allTeams.forEach(t => {
            // Afficher l'équipe si elle n'est pas archivée OU si elle est déjà sélectionnée dans cet événement
            const isAssigned = existingEvent && ((existingEvent.teamIds && existingEvent.teamIds.includes(t.id)) || existingEvent.teamId === t.id);
            if (t.archived === true && !isAssigned) return;

            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '8px';
            label.style.cursor = 'pointer';
            if (t.archived === true) label.style.opacity = '0.7'; // Indiquer visuellement qu'elle est archivée
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = t.id;
            cb.className = 'team-checkbox';
            cb.style.accentColor = 'var(--color-primary)';
            
            cb.addEventListener('change', () => this.updateTeamsDropdownLabel());
            
            label.appendChild(cb);
            label.appendChild(document.createTextNode(t.name + (t.archived === true ? " (Archivée)" : "")));
            this.teamsContainer.appendChild(label);
        });

        const repeatContainer = document.getElementById('event-repeat-container');
        const repeatCheckbox = document.getElementById('event-repeat-checkbox');
        const repeatInput = document.getElementById('event-repeat-until');

        if (existingEvent) {
            this.currentEvent = { ...existingEvent };
            if(!this.currentEvent.teamIds) {
                this.currentEvent.teamIds = this.currentEvent.teamId ? [this.currentEvent.teamId] : [];
            }
            if(!this.currentEvent.attendance) this.currentEvent.attendance = {};
            if(!this.currentEvent.type) this.currentEvent.type = 'training';
            if (repeatContainer) repeatContainer.style.display = 'none';
        } else {
            this.currentEvent = {
                id: null, date: dateStr, title: '', type: 'training', teamIds: [], opponent: '', score: '', notes: '', planSnapshot: null, attendance: {}
            };
            if (repeatContainer) {
                repeatContainer.style.display = 'flex';
                repeatCheckbox.checked = false;
                repeatInput.disabled = true;
                repeatInput.value = '';
            }
        }

        const checkboxes = this.teamsContainer.querySelectorAll('.team-checkbox');
        checkboxes.forEach(cb => {
            if (this.currentEvent.teamIds.includes(parseInt(cb.value, 10))) {
                cb.checked = true;
            }
        });
        this.updateTeamsDropdownLabel();

        document.getElementById('event-title').value = this.currentEvent.title;
        document.getElementById('event-notes').value = this.currentEvent.notes || '';
        this.matchOpponent.value = this.currentEvent.opponent || '';
        if (this.currentEvent.score) {
            const parts = this.currentEvent.score.split('-');
            this.matchScoreUs.value = parts[0] ? parts[0].trim() : '';
            this.matchScoreThem.value = parts[1] ? parts[1].trim() : '';
        } else {
            this.matchScoreUs.value = '';
            this.matchScoreThem.value = '';
        }
        
        this.eventTypeSelect.value = this.currentEvent.type;
        this.updateEventTypeUI();

        await this.updatePlanUI();
        this.updateAttendanceSummary();

        this.modal.classList.remove('hidden');
    },

    async updatePlanUI() {
        if (this.currentEvent.planSnapshot) {
            document.getElementById('snapshot-plan-name').textContent = this.currentEvent.planSnapshot.name || "Séance liée";
            this.eventPlanEmpty.classList.add('hidden');
            this.eventPlanSelected.classList.remove('hidden');
        } else {
            this.eventPlanEmpty.classList.remove('hidden');
            this.eventPlanSelected.classList.add('hidden');
        }
    },

    async openPlanPicker() {
        this.allPlans = await orbDB.getAllPlans();
        const pFolders = await orbDB.getAllPlanFolders();
        this.allPlanFolders = ORBReorder.sort(pFolders || [], 'planFolders');
        this.pickerViewMode = 'FOLDERS';
        this.currentPickerFolderId = null;
        this.renderPlanPicker();
        this.planPickerModal.classList.remove('hidden');
    },

    renderPlanPicker() {
        this.planPickerList.innerHTML = '';

        if (this.pickerViewMode === 'FOLDERS') {
            this.planPickerTitle.textContent = "Choisir un dossier";
            this.btnPickerBack.classList.add('hidden');
            this.planPickerList.style.display = 'grid';
            this.planPickerList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(130px, 1fr))';
            this.planPickerList.style.gap = '15px';
            this.planPickerList.style.padding = '5px';

            const createFolderCard = (title, count, isAll, targetId) => {
                const fCard = document.createElement('div');
                fCard.style.cssText = "padding: 20px 10px; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; background: var(--color-container); text-align: center; transition: all 0.2s;";
                fCard.innerHTML = `
                    <svg viewBox="0 0 24 24" style="width:40px;height:40px;fill:var(--color-primary);margin-bottom:10px;">
                        ${isAll ? '<path d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16Z"/>' : '<path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>'}
                    </svg>
                    <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
                    ${count !== null ? `<div style="font-size:0.85em; opacity:0.6; margin-top:5px;">${count} séance(s)</div>` : ''}
                `;
                fCard.onmouseover = () => fCard.style.borderColor = "var(--color-primary)";
                fCard.onmouseout = () => fCard.style.borderColor = "var(--color-border)";
                fCard.onclick = () => {
                    this.pickerViewMode = 'PLANS';
                    this.currentPickerFolderId = targetId;
                    this.renderPlanPicker();
                };
                return fCard;
            };

            this.planPickerList.appendChild(createFolderCard("Toutes les séances", this.allPlans.length, true, 'ALL'));

            this.allPlanFolders.forEach(folder => {
                const count = this.allPlans.filter(p => p.folderIds && p.folderIds.includes(folder.id)).length;
                this.planPickerList.appendChild(createFolderCard(folder.name, count, false, folder.id));
            });

        } else {
            // Vue PLANS
            this.btnPickerBack.classList.remove('hidden');
            let folderName = "Toutes les séances";
            if (this.currentPickerFolderId !== 'ALL') {
                const f = this.allPlanFolders.find(x => x.id === this.currentPickerFolderId);
                if (f) folderName = f.name;
            }
            this.planPickerTitle.textContent = folderName;
            
            this.planPickerList.style.display = 'block';
            this.planPickerList.style.padding = '5px';

            let filteredPlans = this.allPlans;
            if (this.currentPickerFolderId !== 'ALL') {
                filteredPlans = filteredPlans.filter(p => p.folderIds && p.folderIds.includes(this.currentPickerFolderId));
            }

            let fIdSort = (typeof this.currentPickerFolderId === 'number') ? this.currentPickerFolderId : 'root';
            if (this.currentPickerFolderId === 'ALL') fIdSort = 'all';
            filteredPlans = ORBReorder.sort([...filteredPlans], `plans_${fIdSort}`);

            if (filteredPlans.length === 0) {
                this.planPickerList.innerHTML = '<p style="text-align:center; opacity:0.6; padding:20px;">Aucune séance dans ce dossier.</p>';
            } else {
                filteredPlans.forEach(plan => {
                    const div = document.createElement('div');
                    div.style.cssText = "padding: 15px; border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 10px; cursor: pointer; background: var(--color-background); transition: all 0.2s;";
                    div.innerHTML = `<h4 style="margin:0; color:var(--color-primary);">${plan.name}</h4><p style="margin:5px 0 0 0; font-size:0.85em; opacity:0.7;">${plan.playbookIds.length} exercices</p>`;
                    div.onmouseover = () => div.style.borderColor = "var(--color-primary)";
                    div.onmouseout = () => div.style.borderColor = "var(--color-border)";
                    
                    div.onclick = async () => {
                        const fullPlan = await orbDB.getPlan(plan.id);
                        if (fullPlan) {
                            const snapshot = {
                                name: fullPlan.name,
                                notes: fullPlan.notes,
                                playbooks: []
                            };
                            for (let pbId of fullPlan.playbookIds) {
                                const pb = await orbDB.getPlaybook(pbId);
                                if (pb) snapshot.playbooks.push(pb);
                            }
                            this.currentEvent.planSnapshot = snapshot;
                            this.updatePlanUI();
                            this.planPickerModal.classList.add('hidden');
                        }
                    };
                    this.planPickerList.appendChild(div);
                });
            }
        }
    },

    async viewPlanDetails() {
        if (!this.currentEvent.planSnapshot) return;
        const snap = this.currentEvent.planSnapshot;

        this.viewerTitle.textContent = `Détails : ${snap.name}`;
        this.viewerList.innerHTML = '';

        if (!snap.playbooks || snap.playbooks.length === 0) {
            this.viewerList.innerHTML = '<p style="opacity:0.6; text-align:center;">Aucun exercice dans cet entraînement.</p>';
        } else {
            snap.playbooks.forEach((pb, i) => {
                let previewUrl = '';
                if (pb.preview instanceof Blob) {
                    try { previewUrl = URL.createObjectURL(pb.preview); } catch(e){}
                }

                const div = document.createElement('div');
                div.style.cssText = "display: flex; align-items: center; gap: 15px; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; background: rgba(255,255,255,0.02);";
                div.innerHTML = `
                    <div style="font-weight: 900; color: var(--color-primary); font-size: 1.2em; min-width: 25px;">${i + 1}.</div>
                    ${previewUrl ? `<img src="${previewUrl}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--color-border);">` : `<div style="width: 100px; height: 60px; background: var(--color-background); border-radius: 4px; border: 1px solid var(--color-border);"></div>`}
                    <div style="font-weight: bold; font-size: 1.1em; color: var(--color-text);">${pb.name || 'Sans nom'}</div>
                `;
                this.viewerList.appendChild(div);
            });
        }
        this.viewerModal.classList.remove('hidden');
    },

    async openAttendanceModal() {
        const checkboxes = this.teamsContainer.querySelectorAll('.team-checkbox');
        const selectedIds = [];
        checkboxes.forEach(cb => { if(cb.checked) selectedIds.push(parseInt(cb.value, 10)); });
        this.currentEvent.teamIds = selectedIds;

        const teamIds = this.currentEvent.teamIds || [];
        if (teamIds.length === 0) return alert("Veuillez d'abord sélectionner une ou plusieurs équipes pour pouvoir faire l'appel.");

        const players = await orbDB.getAllPlayers();
        const teamPlayers = players.filter(p => teamIds.includes(p.teamId));
        
        this.attendanceList.innerHTML = '';
        
        if(teamPlayers.length === 0) {
            this.attendanceList.innerHTML = '<p style="text-align:center; opacity:0.6;">Aucun joueur dans les équipes sélectionnées. Ajoutez-en via le menu Effectif.</p>';
        } else {
            teamPlayers.forEach(p => {
                const status = this.currentEvent.attendance[p.id] || 'absent'; 
                
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 10px;';
                
                div.innerHTML = `
                    <span style="font-weight: bold; font-size: 1.1em; color: var(--color-text); min-width: 150px;">${p.lastName.toUpperCase()} ${p.firstName}</span>
                    <div style="display: flex; gap: 10px;">
                        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:var(--color-primary); background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:6px; border:1px solid var(--color-border);">
                            <input type="checkbox" class="att-cb-present" data-id="${p.id}" style="width:16px; height:16px; accent-color:var(--color-primary);" ${status === 'present' ? 'checked' : ''}>
                            Présent
                        </label>
                        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:bold; color:#d9534f; background:rgba(255,255,255,0.05); padding:6px 12px; border-radius:6px; border:1px solid var(--color-border);">
                            <input type="checkbox" class="att-cb-injured" data-id="${p.id}" style="width:16px; height:16px; accent-color:#d9534f;" ${status === 'injured' ? 'checked' : ''}>
                            Blessé
                        </label>
                    </div>
                `;
                
                const cbPresent = div.querySelector('.att-cb-present');
                const cbInjured = div.querySelector('.att-cb-injured');
                
                cbPresent.addEventListener('change', () => { if (cbPresent.checked) cbInjured.checked = false; });
                cbInjured.addEventListener('change', () => { if (cbInjured.checked) cbPresent.checked = false; });

                this.attendanceList.appendChild(div);
            });
        }
        this.attendanceModal.classList.remove('hidden');
    },

    saveAttendance() {
        const rows = this.attendanceList.querySelectorAll('.att-cb-present');
        const newAttendance = {};
        
        rows.forEach(cbPresent => {
            const id = cbPresent.dataset.id;
            const cbInjured = this.attendanceList.querySelector(`.att-cb-injured[data-id="${id}"]`);
            
            if (cbPresent.checked) {
                newAttendance[id] = 'present';
            } else if (cbInjured && cbInjured.checked) {
                newAttendance[id] = 'injured';
            } else {
                newAttendance[id] = 'absent';
            }
        });
        
        this.currentEvent.attendance = newAttendance;
        this.updateAttendanceSummary();
        this.attendanceModal.classList.add('hidden');
    },

    updateAttendanceSummary() {
        const att = this.currentEvent.attendance || {};
        const total = Object.keys(att).length;
        if(total === 0) {
            this.attendanceSummary.textContent = "Appel non effectué.";
            return;
        }
        const present = Object.values(att).filter(v => v === 'present').length;
        const absent = Object.values(att).filter(v => v === 'absent').length;
        const injured = Object.values(att).filter(v => v === 'injured').length;
        
        const totalActive = present + absent; // blessés ne comptent pas dans le pourcentage
        let perc = 0;
        if(totalActive > 0) perc = Math.round((present / totalActive) * 100);
        
        this.attendanceSummary.innerHTML = `<span style="color:var(--color-primary); font-weight:bold;">${perc}% présents</span> | ${present} Présent(s) | <span style="opacity:0.6">${absent} Absent(s)</span> | <span style="color:#d9534f">${injured} Blessé(s)</span>`;
    },

    async saveEvent() {
        this.currentEvent.title = document.getElementById('event-title').value;
        
        const checkboxes = this.teamsContainer.querySelectorAll('.team-checkbox');
        const selectedIds = [];
        checkboxes.forEach(cb => { if(cb.checked) selectedIds.push(parseInt(cb.value, 10)); });
        this.currentEvent.teamIds = selectedIds;
        this.currentEvent.teamId = selectedIds.length > 0 ? selectedIds[0] : null; 

        this.currentEvent.type = this.eventTypeSelect.value;
        this.currentEvent.opponent = this.matchOpponent.value;
        
        const us = this.matchScoreUs.value.trim();
        const them = this.matchScoreThem.value.trim();
        if (us || them) {
            this.currentEvent.score = `${us || '0'} - ${them || '0'}`;
        } else {
            this.currentEvent.score = '';
        }
        
        this.currentEvent.notes = document.getElementById('event-notes').value;
        
        if (!this.currentEvent.title) return alert("Le titre est obligatoire.");

        const repeatContainer = document.getElementById('event-repeat-container');
        const repeatCheckbox = document.getElementById('event-repeat-checkbox');
        const repeatUntilValue = document.getElementById('event-repeat-until').value;

        try {
            await orbDB.saveCalendarEvent(this.currentEvent);

            if (repeatContainer && repeatContainer.style.display !== 'none' && repeatCheckbox && repeatCheckbox.checked && repeatUntilValue) {
                const endDate = new Date(repeatUntilValue);
                let nextDate = new Date(this.currentEvent.date);
                nextDate.setDate(nextDate.getDate() + 7); 

                while (nextDate <= endDate) {
                    const nextDateStr = nextDate.toISOString().split('T')[0];
                    const clonedEvent = {
                        ...this.currentEvent,
                        id: null, 
                        date: nextDateStr,
                        attendance: {} 
                    };
                    
                    if (this.currentEvent.planSnapshot) {
                        clonedEvent.planSnapshot = JSON.parse(JSON.stringify(this.currentEvent.planSnapshot));
                    }
                    
                    await orbDB.saveCalendarEvent(clonedEvent);
                    nextDate.setDate(nextDate.getDate() + 7);
                }
            }

            this.modal.classList.add('hidden');
            this.render();
        } catch (error) {
            console.error("Erreur de sauvegarde:", error);
            alert("Erreur lors de la sauvegarde de l'événement.");
        }
    },

    async deleteEvent() {
        if (this.currentEvent.id && confirm("Supprimer cet événement du calendrier ?")) {
            await orbDB.deleteCalendarEvent(this.currentEvent.id);
            this.modal.classList.add('hidden');
            this.render();
        } else if (!this.currentEvent.id) {
            this.modal.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => CalendarModule.init());