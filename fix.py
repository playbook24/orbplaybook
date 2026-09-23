import re

content = open('modules/settings/settings.html', 'r', encoding='utf-8').read()
new_script = r'''
            // --- GESTION DE L'ACCUEIL ---
            const btnToggleCalendar = document.getElementById('hub-toggle-calendar');
            const btnTogglePlans = document.getElementById('hub-toggle-plans');
            
            const isCalendarShown = localStorage.getItem('hubShowCalendar') !== 'false';
            const isPlansShown = localStorage.getItem('hubShowPlans') !== 'false';
            
            if (isCalendarShown) { btnToggleCalendar.textContent = 'Désactiver'; btnToggleCalendar.classList.add('active'); }
            if (isPlansShown) { btnTogglePlans.textContent = 'Désactiver'; btnTogglePlans.classList.add('active'); }

            btnToggleCalendar.addEventListener('click', () => {
                const willShow = btnToggleCalendar.textContent === 'Activer';
                localStorage.setItem('hubShowCalendar', willShow);
                btnToggleCalendar.textContent = willShow ? 'Désactiver' : 'Activer';
                btnToggleCalendar.classList.toggle('active', willShow);
            });

            btnTogglePlans.addEventListener('click', () => {
                const willShow = btnTogglePlans.textContent === 'Activer';
                localStorage.setItem('hubShowPlans', willShow);
                btnTogglePlans.textContent = willShow ? 'Désactiver' : 'Activer';
                btnTogglePlans.classList.toggle('active', willShow);
            });

            // --- TRI DES BOUTONS ---
            const defaultButtonOrder = [
                { id: 'board', label: 'Playbook' },
                { id: 'library', label: 'Bibliothèque' },
                { id: 'planner', label: 'Planificateur' },
                { id: 'sheet', label: 'Fiches' },
                { id: 'calendar', label: 'Calendrier' },
                { id: 'roster', label: 'Effectif' },
                { id: 'archive', label: 'Archives' },
                { id: 'export', label: 'Exporter' },
                { id: 'import', label: 'Restaurer' },
                { id: 'drive', label: 'Google Drive' },
                { id: 'settings', label: 'Paramètres' },
                { id: 'help', label: 'Aide' }
            ];
            
            const savedOrderIds = localStorage.getItem('hubButtonOrder') 
                ? JSON.parse(localStorage.getItem('hubButtonOrder')) 
                : defaultButtonOrder.map(b => b.id);
            
            // Reconstruct array matching saved order but keeping default labels
            let currentOrder = savedOrderIds.map(id => defaultButtonOrder.find(b => b.id === id)).filter(Boolean);
            
            // Add any missing new buttons
            defaultButtonOrder.forEach(btn => {
                if (!currentOrder.some(b => b.id === btn.id)) currentOrder.push(btn);
            });

            const buttonList = document.getElementById('hub-button-list');

            function renderButtonList() {
                buttonList.innerHTML = '';
                currentOrder.forEach((btn, index) => {
                    const li = document.createElement('li');
                    li.className = 'sort-item';
                    li.innerHTML = 
                        <span>. </span>
                        <div class="sort-btns">
                            <button onclick="window.moveButton(, -1)" >?</button>
                            <button onclick="window.moveButton(, 1)" >?</button>
                        </div>
                    ;
                    buttonList.appendChild(li);
                });
                // Save
                localStorage.setItem('hubButtonOrder', JSON.stringify(currentOrder.map(b => b.id)));
            }

            window.moveButton = (index, dir) => {
                const targetIndex = index + dir;
                if (targetIndex >= 0 && targetIndex < currentOrder.length) {
                    const temp = currentOrder[index];
                    currentOrder[index] = currentOrder[targetIndex];
                    currentOrder[targetIndex] = temp;
                    renderButtonList();
                }
            };

            renderButtonList();
        });
    </script>
'''

content = re.sub(r"(?s)// --- GESTION DE L'ACCUEIL ---.*?</script>", new_script, content)
open('modules/settings/settings.html', 'w', encoding='utf-8').write(content)
