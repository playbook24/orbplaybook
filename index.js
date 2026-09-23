/**
 * index.js
 * Gestion du tableau de bord (Hub) et des widgets.
 */

const DashboardHub = {
    settings: {
        showCalendar: localStorage.getItem('hubShowCalendar') !== 'false', // Default true
        showPlans: localStorage.getItem('hubShowPlans') !== 'false', // Default true
    },

    async init() {
        this.cacheDOM();
        
        if (typeof orbDB === 'undefined') {
            console.error("orbDB is not loaded");
            return;
        }
        await orbDB.open();
        
        this.sortButtons();
        await this.renderWidgets();
    },

    cacheDOM() {
        this.widgetsContainer = document.getElementById('widgets-container');
        this.hubWidgetsColumn = document.getElementById('hub-widgets-column');
        this.hubButtonsColumn = document.getElementById('hub-buttons-column');
        this.dashboardGrid = document.getElementById('dashboard-grid');
    },

    sortButtons() {
        const orderStr = localStorage.getItem('hubButtonOrder');
        if (!orderStr) return;
        
        const order = JSON.parse(orderStr);
        const buttons = Array.from(this.dashboardGrid.querySelectorAll('.nav-card'));
        
        buttons.sort((a, b) => {
            const indexA = order.indexOf(a.getAttribute('data-id'));
            const indexB = order.indexOf(b.getAttribute('data-id'));
            const finalA = indexA !== -1 ? indexA : 999;
            const finalB = indexB !== -1 ? indexB : 999;
            return finalA - finalB;
        });
        
        buttons.forEach(btn => this.dashboardGrid.appendChild(btn));
    },

    async renderWidgets() {
        if (!this.widgetsContainer) return;
        this.widgetsContainer.innerHTML = '';

        if (!this.settings.showCalendar && !this.settings.showPlans) {
            // Hide widgets column, center buttons
            if (this.hubWidgetsColumn) this.hubWidgetsColumn.style.display = 'none';
            if (this.hubButtonsColumn) this.hubButtonsColumn.style.maxWidth = '1000px';
            return;
        } else {
            if (this.hubWidgetsColumn) this.hubWidgetsColumn.style.display = 'flex';
            if (this.hubButtonsColumn) this.hubButtonsColumn.style.maxWidth = '800px';
        }

        const widgetOrderStr = localStorage.getItem('hubWidgetOrder');
        const widgetOrder = widgetOrderStr ? JSON.parse(widgetOrderStr) : ['calendar', 'plans'];

        for (const w of widgetOrder) {
            if (w === 'calendar' && this.settings.showCalendar) {
                await this.renderCalendarWidget();
            } else if (w === 'plans' && this.settings.showPlans) {
                await this.renderPlansWidget();
            }
        }
    },

    async renderCalendarWidget() {
        const events = await orbDB.getAllCalendarEvents();
        
        // Obtenir la date d'aujourd'hui sans les heures
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Séparer les événements passés et futurs/aujourd'hui
        let pastEvents = events.filter(ev => new Date(ev.date) < today);
        let futureEvents = events.filter(ev => new Date(ev.date) >= today);
        
        // Trier les événements
        pastEvents.sort((a, b) => new Date(b.date) - new Date(a.date)); // Les plus récents en premier
        futureEvents.sort((a, b) => new Date(a.date) - new Date(b.date)); // Les plus proches en premier
        
        // Prendre les 2 derniers passés et les 3 prochains
        const lastTwoPast = pastEvents.slice(0, 2).reverse(); // On les remet dans l'ordre chronologique
        const nextThreeFuture = futureEvents.slice(0, 3);
        
        const widgetEvents = [...lastTwoPast, ...nextThreeFuture];
        
        const widget = document.createElement('div');
        widget.className = 'widget-card';
        
        let contentHtml = '';
        if (widgetEvents.length === 0) {
            contentHtml = '<div class="widget-empty">Aucun événement à venir.</div>';
        } else {
            widgetEvents.forEach(ev => {
                const dateObj = new Date(ev.date);
                const isPast = dateObj < today;
                
                // Formater la date sans l'année
                const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
                
                // Vérifier plan et appel
                const hasPlan = !!(ev.planSnapshot);
                const hasAttendance = ev.attendance && Object.keys(ev.attendance).length > 0;
                
                let iconsHtml = '';
                if (hasPlan) {
                    iconsHtml += `<svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:var(--color-primary); margin-right:4px;" title="Séance planifiée"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13,9V3.5L18.5,9H13Z"/></svg>`;
                }
                if (hasAttendance) {
                    iconsHtml += `<svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:var(--color-primary); margin-right:4px;" title="Appel fait"><path d="M21.1,12.5L22.5,13.91L15.97,20.5L12.5,17L13.9,15.59L15.97,17.67L21.1,12.5M10,17L13,20H3V18C3,15.79 6.58,14 10.5,14C10.89,14 11.27,14 11.64,14.07L10.59,15.12C10.56,15.11 10.53,15.11 10.5,15.11C8.25,15.11 5.37,16.05 4.88,17H10M10.5,12C8.57,12 6.69,10.43 6.69,8.5C6.69,6.57 8.57,5 10.5,5C12.43,5 14.31,6.57 14.31,8.5C14.31,10.43 12.43,12 10.5,12M10.5,10.11C11.5,10.11 12.41,9.25 12.41,8.5C12.41,7.75 11.5,6.89 10.5,6.89C9.5,6.89 8.59,7.75 8.59,8.5C8.59,9.25 9.5,10.11 10.5,10.11Z"/></svg>`;
                }
                
                contentHtml += `
                    <a href="modules/calendar/calendar.html?date=${ev.date}&id=${ev.id}" class="widget-item" style="${isPast ? 'opacity: 0.6;' : ''}">
                        <div style="flex-grow:1;">
                            <strong style="${isPast ? 'color: var(--color-text-muted);' : ''}">${ev.title || 'Événement'}</strong><br>
                            <span>${dateStr} - ${ev.type}</span>
                        </div>
                        <div style="display:flex; align-items:center;">
                            ${iconsHtml}
                            <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:var(--color-primary); margin-left: 5px;"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/></svg>
                        </div>
                    </a>
                `;
            });
        }
        
        widget.innerHTML = `
            <div class="widget-header">
                <h3>
                    <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z"/></svg>
                    Événements
                </h3>
            </div>
            <div class="widget-content">
                ${contentHtml}
            </div>
        `;
        
        this.widgetsContainer.appendChild(widget);
    },

    async renderPlansWidget() {
        const plans = await orbDB.getAllPlans();
        
        // Filtrer uniquement les séances épinglées
        const pinnedPlans = plans.filter(p => p.pinned === true);
        
        // Sort by pinnedAt if available
        pinnedPlans.sort((a, b) => {
            const timeA = a.pinnedAt || 0;
            const timeB = b.pinnedAt || 0;
            return timeB - timeA;
        });
        
        const widget = document.createElement('div');
        widget.className = 'widget-card';
        
        let contentHtml = '';
        if (pinnedPlans.length === 0) {
            contentHtml = '<div class="widget-empty">Aucune séance épinglée.<br><span style="font-size:0.8em;">(Épinglez-les depuis le planificateur)</span></div>';
        } else {
            pinnedPlans.forEach(plan => {
                const exoCount = plan.playbookIds ? plan.playbookIds.length : 0;
                contentHtml += `
                    <a href="modules/viewer/viewer.html?type=plan&id=${plan.id}" class="widget-item">
                        <div>
                            <strong>${plan.name || 'Séance'}</strong><br>
                            <span>${exoCount} exercices</span>
                        </div>
                        <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:var(--color-primary);"><path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/></svg>
                    </a>
                `;
            });
        }
        
        widget.innerHTML = `
            <div class="widget-header">
                <h3>
                    <svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z"/></svg>
                    Séances Épinglées
                </h3>
            </div>
            <div class="widget-content">
                ${contentHtml}
            </div>
        `;
        
        this.widgetsContainer.appendChild(widget);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DashboardHub.init();
});
