/**
 * state.js
 * État global et historique. Indispensable pour le fonctionnement des outils.
 */
window.ORB = {
    CONSTANTS: {
        LOGICAL_WIDTH: 280,
        LOGICAL_HEIGHT: 150,
        PROXIMITY_THRESHOLD: 20,
        DEFAULT_ANIMATION_SPEED: 50,
        DEFAULT_ANTICIPATION_RATIO: 0.3,
        MIN_SCENE_DURATION: 1000,
        COLORS: { primary: '#BB9243', secondary: '#BB9243', crabPrimary: '#72243D', crabSecondary: '#F9AB00' }
    },

    // --- NOUVEAUTÉ V4 : Normalisation pour accepter les backups V3 ---
    normalizePlaybook: function(importedData) {
        if (!importedData) return null;
        
        // Si c'est une V3, on met à jour la structure
        const normalizedData = {
            name: importedData.name || "Playbook Importé",
            version: 4, // On force la version V4
            courtType: importedData.courtType || 'full', // Sauvegarde du type de terrain
            animationSettings: importedData.animationSettings || { speed: 50, ratio: 0.3 },
            scenes: importedData.scenes || [],
            tagIds: importedData.tagIds || []
        };

        // Sécurité : au moins une scène
        if (normalizedData.scenes.length === 0) {
            normalizedData.scenes.push({ name: "Scène 1", elements: [], durationOverride: null, comments: '' });
        }

        // Nettoyage et sécurisation de toutes les scènes/éléments
        normalizedData.scenes.forEach((scene, index) => {
            if (!scene.name) scene.name = `Scène ${index + 1}`;
            if (!scene.elements) scene.elements = [];
            if (typeof scene.comments === 'undefined') scene.comments = '';
            
            scene.elements.forEach(el => {
                // Compatibilité V3 -> V4 (ex: rotations, couleurs)
                if ((el.type === 'defender' || el.type === 'player') && typeof el.rotation === 'undefined') el.rotation = 0;
                if (el.type === 'zone' && !el.color) el.color = '#FFEB3B';
                if (!el.id) el.id = Date.now() + Math.random(); // Assure un ID unique
                if (el.color === '#212121') el.color = '#BB9243';
                if (el.color === '#212121') el.color = '#BB9243';
            });
        });

        return normalizedData;
    },

    // Remplace complètement le state actuel par un nouveau (pour l'importation)
    loadState: function(importedData) {
        this.playbookState = this.normalizePlaybook(importedData);
        this.playbookState.activeSceneIndex = 0;
        this.history = [];
        this.redoStack = [];
        this.isRestoringState = false;
        this.commitState();
    },

    playbookState: {
        name: "Nouveau Playbook",
        version: 4,
        courtType: 'full', // Terrain par défaut
        scenes: [{ name: "Scène 1", elements: [], comments: '', durationOverride: null }],
        activeSceneIndex: 0,
        animationSettings: { speed: 50, ratio: 0.3 }
    },

    appState: {
        currentLoadedPlaybookId: null,
        currentTool: 'select',
        inputMode: 'mouse', 
        selectedElement: null,
        selectedScene: null,
        isDrawing: false,
        isMouseDown: false,
        currentPath: [],
        playerCounter: 1,
        defenderCounter: 1,
        startDragPos: {x:0, y:0},
        lastMousePos: {x:0, y:0}
    },

    animationState: { isPlaying: false, isFinished: false, startTime: 0, elapsedOffset: 0, storyboard: [], view: 'full', activeHalf: 'left' },

    history: [], redoStack: [], isRestoringState: false,
    canvas: null, ctx: null, animCanvas: null, animCtx: null,
    
    commitState: function() {
        if (this.isRestoringState) return;
        const stateCopy = JSON.parse(JSON.stringify(this.playbookState));
        this.history.push(stateCopy);
        this.redoStack = [];
        if (this.history.length > 50) this.history.shift();
        if (this.ui && typeof this.ui.updateUndoRedoButtons === 'function') {
            this.ui.updateUndoRedoButtons();
        }
    },

    undo: function() {
        if (this.history.length <= 1) return;
        this.isRestoringState = true;
        const currentState = this.history.pop();
        this.redoStack.push(currentState);
        const prevState = this.history[this.history.length - 1];
        this.playbookState = JSON.parse(JSON.stringify(prevState));
        if (this.ui && typeof this.ui.switchToScene === 'function') {
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
        }
        this.isRestoringState = false;
    },

    redo: function() {
        if (this.redoStack.length === 0) return;
        this.isRestoringState = true;
        const nextState = this.redoStack.pop();
        this.history.push(nextState);
        this.playbookState = JSON.parse(JSON.stringify(nextState));
        if (this.ui && typeof this.ui.switchToScene === 'function') {
            this.ui.switchToScene(this.playbookState.activeSceneIndex, true);
        }
        this.isRestoringState = false;
    }
};