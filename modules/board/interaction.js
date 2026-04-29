/**
 * interaction.js
 * Gère les entrées utilisateurs (Souris/Tactile) et tous les outils V3.
 */

window.ORB.interactions = {
    
    init: function() {
        const canvas = window.ORB.canvas;
        
        // Souris
        canvas.addEventListener("mousedown", this.handleStart.bind(this));
        window.addEventListener("mousemove", this.handleMove.bind(this));
        window.addEventListener("mouseup", this.handleEnd.bind(this));

        // Tactile (On garde passive: false pour empêcher le scroll quand on dessine)
        canvas.addEventListener("touchstart", this.handleStart.bind(this), { passive: false });
        window.addEventListener("touchmove", this.handleMove.bind(this), { passive: false });
        window.addEventListener("touchend", this.handleEnd.bind(this));
        
        canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
        window.addEventListener("keydown", this.handleKeyDown.bind(this));
    },

    getEventPos: function(e) {
        // CORRECTION V4 : Synchronisation parfaite avec les dimensions du renderer
        const canvas = window.ORB.canvas;
        const rect = canvas.getBoundingClientRect();
        
        const isHalf = window.ORB.playbookState && window.ORB.playbookState.courtType === 'half';
        const viewMinX = -10;
        const viewMinY = -10;
        const viewWidth = isHalf ? 170 : 300;
        const viewHeight = isHalf ? 160 : 170;

        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        // On calcule directement ici pour garantir que le ratio correspond à 100% au renderer
        return {
            x: ((clientX - rect.left) / rect.width) * viewWidth + viewMinX,
            y: ((clientY - rect.top) / rect.height) * viewHeight + viewMinY
        };
    },

    // --- DÉBUT DE L'ACTION ---
    handleStart: function(e) {
        if (e.type === 'touchstart') e.preventDefault();
        if (e.button === 2) return; 

        const appState = window.ORB.appState;
        const logicalPos = this.getEventPos(e);
        
        appState.isMouseDown = true;
        appState.startDragPos = logicalPos;
        appState.lastMousePos = logicalPos;

        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];
        const dragTools = ['zone'];
        // TOUS LES OUTILS INCLUS :
        const singleClickTools = ['player', 'defender', 'ball', 'cone', 'hoop', 'basket'];

        if (appState.inputMode === 'stylus' && pathTools.includes(appState.currentTool)) {
            this.finalizeCurrentPath(); 
            appState.isDrawing = true;
            appState.currentPath = [logicalPos];
            window.ORB.renderer.redrawCanvas();
            return; 
        }

        if (appState.inputMode === 'mouse' && pathTools.includes(appState.currentTool)) {
            if (!appState.isDrawing) {
                appState.isDrawing = true;
                appState.currentPath = [logicalPos];
            } else {
                appState.currentPath.push(logicalPos);
            }
        } 
        else if (dragTools.includes(appState.currentTool)) {
            appState.tempElement = {
                type: appState.currentTool,
                x: logicalPos.x, y: logicalPos.y, width: 0, height: 0, color: '#FFEB3B'
            };
        } 
        else {
            this.finalizeCurrentPath(); 
            
            if (appState.currentTool === "select") {
                appState.selectedScene = null;
                appState.selectedElement = this.getElementAtPosition(logicalPos);
                if(appState.selectedElement) {
                    appState.dragStartElementState = JSON.stringify(appState.selectedElement);
                }
            } 
            else if (appState.currentTool === "text") {
                const text = prompt("Entrez votre texte :");
                if (text) {
                    window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({
                        id: Date.now(),
                        type: "text",
                        x: logicalPos.x,
                        y: logicalPos.y,
                        text: text,
                        size: 14,
                        color: "#212121"
                    });
                    window.ORB.commitState();
                }
            }
            else if (singleClickTools.includes(appState.currentTool)) {
                this.addSingleElement(logicalPos);
            }
        }
        window.ORB.ui.updatePropertiesPanel();
        window.ORB.renderer.redrawCanvas();
    },

    // --- MOUVEMENT ---
    handleMove: function(e) {
        const appState = window.ORB.appState;
        
        if (e.type === 'touchmove') {
            if (!appState.isMouseDown) return;
            e.preventDefault();
        }

        if (!appState.isMouseDown && appState.inputMode !== 'mouse') return; 

        const logicalPos = this.getEventPos(e);
        appState.lastMousePos = logicalPos;

        if (appState.inputMode === 'stylus' && appState.isDrawing && appState.isMouseDown) {
            const lastP = appState.currentPath[appState.currentPath.length - 1];
            if (lastP) {
                const dist = Math.hypot(logicalPos.x - lastP.x, logicalPos.y - lastP.y);
                if (dist > (appState.smoothingDistance || 2)) {
                    appState.currentPath.push(logicalPos);
                }
            }
        }

        if (appState.currentTool === 'select' && appState.selectedElement && appState.isMouseDown) {
            if (!appState.isDragging) {
                if (Math.hypot(logicalPos.x - appState.startDragPos.x, logicalPos.y - appState.startDragPos.y) > 3) {
                    appState.isDragging = true;
                }
            }
            if (appState.isDragging) {
                const dx = logicalPos.x - appState.startDragPos.x;
                const dy = logicalPos.y - appState.startDragPos.y;
             
                if (dx !== 0 || dy !== 0) {
                    if (appState.selectedElement.points) {
                        appState.selectedElement.points.forEach(p => { p.x += dx; p.y += dy; });
                    } else {
                        appState.selectedElement.x += dx;
                        appState.selectedElement.y += dy;
                    }
                    appState.startDragPos = logicalPos; 
                }
            }
        }
        
        if (appState.tempElement && appState.tempElement.type === 'zone') {
            appState.tempElement.width = logicalPos.x - appState.tempElement.x;
            appState.tempElement.height = logicalPos.y - appState.tempElement.y;
        }

        window.ORB.renderer.redrawCanvas();
    },

    // --- FIN DE L'ACTION ---
    handleEnd: function(e) {
        const appState = window.ORB.appState;
        if (!appState.isMouseDown) return;

        if (appState.inputMode === 'stylus' && appState.isDrawing) {
            this.finalizeCurrentPath();
        }

        if (appState.tempElement && appState.tempElement.type === 'zone') {
            if (appState.tempElement.width < 0) { appState.tempElement.x += appState.tempElement.width; appState.tempElement.width *= -1; }
            if (appState.tempElement.height < 0) { appState.tempElement.y += appState.tempElement.height; appState.tempElement.height *= -1; }
            if (appState.tempElement.width > 2 && appState.tempElement.height > 2) {
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({ id: Date.now(), ...appState.tempElement });
                window.ORB.commitState();
            }
            appState.tempElement = null;
        }

        if (appState.isDragging) {
            if(appState.dragStartElementState && JSON.stringify(appState.selectedElement) !== appState.dragStartElementState) {
                window.ORB.commitState();
            }
            
            const currentPos = appState.lastMousePos;
            
            // CORRECTION V4 : Vérification de la zone de suppression selon le type de terrain
            const isHalf = window.ORB.playbookState && window.ORB.playbookState.courtType === 'half';
            const viewWidth = isHalf ? 150 : window.ORB.CONSTANTS.LOGICAL_WIDTH;
            const viewHeight = isHalf ? 140 : window.ORB.CONSTANTS.LOGICAL_HEIGHT;
            
            // Si on sort l'élément du terrain, on le supprime (marges de -30 / +30 pour l'espace hors terrain)
            if (currentPos.x < -30 || currentPos.x > viewWidth + 30 || currentPos.y < -30 || currentPos.y > viewHeight + 30) {
                let elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
                if (appState.selectedElement.type === 'player') {
                    const balls = elements.filter(b => b.type === 'ball' && b.linkedTo === appState.selectedElement.id);
                    balls.forEach(ball => ball.linkedTo = null);
                }
                window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== appState.selectedElement.id);
                appState.selectedElement = null;
                window.ORB.commitState();
                window.ORB.ui.updatePropertiesPanel();
            }
            else if (appState.selectedElement && appState.selectedElement.type === 'ball') {
                const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
                const playerBelow = elements.find(el => el.type === 'player' && Math.hypot(el.x - currentPos.x, el.y - currentPos.y) < 10);
                const oldLinkedTo = appState.selectedElement.linkedTo;
                if (playerBelow) appState.selectedElement.linkedTo = playerBelow.id;
                else appState.selectedElement.linkedTo = null;
                if(oldLinkedTo !== appState.selectedElement.linkedTo) window.ORB.commitState();
            }
        }

        appState.isMouseDown = false;
        appState.isDragging = false;
        appState.dragStartElementState = null;
        
        window.ORB.renderer.redrawCanvas();
    },

    // --- UTILS ---
    addSingleElement: function(logicalPos) {
        const appState = window.ORB.appState;
        const newElement = { id: Date.now(), type: appState.currentTool, x: logicalPos.x, y: logicalPos.y };
        
        if (appState.currentTool === "player") {
            newElement.label = appState.playerCounter.toString();
            newElement.color = "#007BFF";
            appState.playerCounter++;
        } else if (appState.currentTool === "defender") {
            newElement.label = appState.defenderCounter.toString();
            newElement.color = "#D32F2F";
            newElement.rotation = 0;
            appState.defenderCounter++;
            const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
            let closestPlayer = null;
            let minDistance = Infinity;
            players.forEach(p => {
                const dist = Math.hypot(p.x - newElement.x, p.y - newElement.y);
                if (dist < minDistance) { minDistance = dist; closestPlayer = p; }
            });
            if (closestPlayer) {
                const angle = Math.atan2(closestPlayer.y - newElement.y, closestPlayer.x - newElement.x);
                newElement.rotation = angle * 180 / Math.PI + 90;
            }
        } else if (appState.currentTool === "ball") {
            newElement.color = "#E65100";
            const players = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.filter(el => el.type === 'player');
            const playerBelow = players.find(p => Math.hypot(p.x - newElement.x, p.y - newElement.y) < 10);
            if (playerBelow) newElement.linkedTo = playerBelow.id;
        } else if (appState.currentTool === "cone") newElement.color = "#ff7f50";
        else if (appState.currentTool === "hoop") newElement.color = "#ff0000";
        else if (appState.currentTool === "basket") newElement.color = "#E65100";

        window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push(newElement);
        window.ORB.commitState();
    },

    getElementAtPosition: function(logicalPoint) {
        const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
        const CLICK_RADIUS = 15; 
        const pathTools = ['arrow', 'pass', 'dribble', 'screen', 'pencil'];
        const selectionOrder = [['text'], ['ball'], ['player', 'defender'], ['cone', 'hoop', 'basket'], pathTools, ['zone']];
        
        const utils = window.ORB_UTILS || window.ORB.utils;

        for (const types of selectionOrder) {
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                if (!types.includes(el.type)) continue;
                if (el.type === 'ball' && el.linkedTo) continue;
                
                if (el.type === 'zone') {
                    if (logicalPoint.x >= el.x && logicalPoint.x <= el.x + el.width && logicalPoint.y >= el.y && logicalPoint.y <= el.y + el.height) return el;
                } else if (pathTools.includes(el.type) && utils && utils.getDistanceToSegment) {
                    for (let j = 0; j < el.points.length - 1; j++) {
                        if (utils.getDistanceToSegment(logicalPoint, el.points[j], el.points[j + 1]) < 8) return el;
                    }
                } else {
                    if (Math.hypot(logicalPoint.x - el.x, logicalPoint.y - el.y) < CLICK_RADIUS) return el;
                }
            }
        }
        return null;
    },

    finalizeCurrentPath: function() {
        const appState = window.ORB.appState;
        if (appState.isDrawing && appState.currentPath.length > 1) {
            window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements.push({
                id: Date.now(),
                type: appState.currentTool,
                points: appState.currentPath,
                width: 2.5,
                color: '#212121'
            });
            window.ORB.commitState(); 
        }
        appState.isDrawing = false;
        appState.currentPath = [];
    },

    handleDoubleClick: function(e) {
        e.preventDefault();
        const appState = window.ORB.appState;

        if (appState.isDrawing) {
            if (appState.currentPath.length > 1) appState.currentPath.pop();
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
            return; 
        }
        
        const logicalPos = this.getEventPos(e);
        const clickedElement = this.getElementAtPosition(logicalPos);
        if (clickedElement && clickedElement.type === 'player') {
            const elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
            const linkedBall = elements.find(b => b.type === 'ball' && b.linkedTo === clickedElement.id);
            if (linkedBall) {
                linkedBall.linkedTo = null;
                linkedBall.x = clickedElement.x + 15;
                linkedBall.y = clickedElement.y;
                window.ORB.commitState();
                window.ORB.renderer.redrawCanvas();
            }
        }
    },

    handleKeyDown: function(e) {
        const appState = window.ORB.appState;
        if (e.ctrlKey || e.metaKey) {
            const tag = e.target.tagName.toLowerCase();
            if (tag === "input" || tag === "textarea") return;
            if (e.key === 'z') { e.preventDefault(); window.ORB.undo(); }
            else if (e.key === 'y') { e.preventDefault(); window.ORB.redo(); }
        }

        const tag = e.target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        if (e.key === "Enter" && appState.isDrawing) {
            this.finalizeCurrentPath();
            window.ORB.renderer.redrawCanvas();
        } else if ((e.key === "Delete" || e.key === "Backspace") && appState.selectedElement) {
            let elements = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements;
            if (appState.selectedElement.type === 'player') {
                const balls = elements.filter(b => b.type === 'ball' && b.linkedTo === appState.selectedElement.id);
                balls.forEach(ball => ball.linkedTo = null);
            }
            window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex].elements = elements.filter(el => el.id !== appState.selectedElement.id);
            appState.selectedElement = null;
            window.ORB.commitState();
            window.ORB.ui.updatePropertiesPanel();
            window.ORB.renderer.redrawCanvas();
        }
    }
};