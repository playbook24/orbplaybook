/**
 * renderer.js
 * Gère le dessin sur le Canvas (V4 avec tous les outils V3)
 */

window.ORB.renderer = {
    
    // NOUVEAU V4 : Fonction utilitaire indispensable pour le responsive et le demi-terrain
    getPixelCoords: function(logicalPoint) {
        if (!window.ORB.canvas) return logicalPoint;
        const rect = window.ORB.canvas.getBoundingClientRect();
        
        // On vérifie le type de terrain sauvegardé dans l'état
        const isHalf = window.ORB.playbookState && window.ORB.playbookState.courtType === 'half';
        
        // NOUVEAU : Dimensions logiques distinctes (150x140 pour le vertical)
        const viewMinX = -10;
        const viewMinY = -10;
        const viewWidth = isHalf ? 170 : 300;
        const viewHeight = isHalf ? 160 : 170;
        
        return {
            x: ((logicalPoint.x - viewMinX) / viewWidth) * rect.width,
            y: ((logicalPoint.y - viewMinY) / viewHeight) * rect.height
        };
    },

    redrawCanvas: function() {
        const { ctx, canvas, playbookState, appState } = window.ORB;
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);

        if (!playbookState.scenes[playbookState.activeSceneIndex]) return;
        
        const elements = playbookState.scenes[playbookState.activeSceneIndex].elements;

        const drawOrder = [
            ['zone'], 
            ['arrow', 'pass', 'dribble', 'screen', 'pencil'],
            ['cone', 'hoop', 'basket'], 
            ['defender', 'player'],
            ['ball'], 
            ['text']
        ];

        drawOrder.forEach(types => {
            elements.filter(el => types.includes(el.type)).forEach(el => {
                if (el.type === 'ball' && el.linkedTo) return;
                
                const isSelected = appState.selectedElement && appState.selectedElement.id === el.id;
                
                if (['arrow', 'pass', 'dribble', 'screen', 'pencil'].includes(el.type)) {
                    this.drawPath(el.points, isSelected, el, ctx);
                } else if (el.type === 'zone') {
                    this.drawZone(el.x, el.y, el.width, el.height, isSelected, el, ctx);
                } else {
                    const methodName = 'draw' + el.type.charAt(0).toUpperCase() + el.type.slice(1);
                    if (this[methodName]) {
                        this[methodName](el.x, el.y, isSelected, el, ctx);
                    }
                }
            });
        });

        if (appState.isDrawing && appState.currentPath.length > 0 && appState.lastMousePos) {
            this.drawPath([...appState.currentPath, appState.lastMousePos], true, { type: appState.currentTool, color: '#FFD700' }, ctx);
        }
        
        if (appState.tempElement && appState.tempElement.type === 'zone') {
            this.drawZone(appState.tempElement.x, appState.tempElement.y, appState.tempElement.width, appState.tempElement.height, true, { color: '#FFD700' }, ctx);
        }
    },

    // --- FONCTIONS DE DESSIN ---

    drawPlayer: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn, animParams = {}) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const isThumb = !!(window.ORB && window.ORB.renderer && window.ORB.renderer.isThumbnailMode);
        const radius = isThumb ? 12 : 10;
        
        let hasBall = false;
        if (animParams.isAnimating) {
            const passRatio = window.ORB.CONSTANTS.PASS_RATIO || 0.5;
            if(animParams.passData && animParams.passData.length > 0) {
                hasBall = animParams.passData.some(pass => 
                    (pass.passerId === options.id && animParams.rawProgress < passRatio) ||
                    (pass.receiverId === options.id && animParams.rawProgress >= passRatio)
                );
            } else {
                 const currentScene = window.ORB.playbookState.scenes[animParams.sceneIndex];
                 if(currentScene) hasBall = currentScene.elements.some(el => el.type === 'ball' && el.linkedTo === options.id);
            }
        } else {
            const currentScene = window.ORB.playbookState.scenes[window.ORB.playbookState.activeSceneIndex];
            if(currentScene) hasBall = currentScene.elements.some(el => el.type === 'ball' && el.linkedTo === options.id);
        }
        
        p_ctx.save();
        p_ctx.translate(x, y);
        if (options.rotation) p_ctx.rotate(options.rotation);
        
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, 0, Math.PI * 2);
        p_ctx.fillStyle = options.color || '#007BFF';
        p_ctx.fill();
        
        if (animParams.isAnimating) {
            p_ctx.beginPath();
            p_ctx.moveTo(radius * 0.3, 0);
            p_ctx.lineTo(radius, 0);
            p_ctx.strokeStyle = '#FFFFFF';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
        
        p_ctx.rotate(-(options.rotation || 0));

        p_ctx.strokeStyle = isSelected ? '#FFD700' : (hasBall ? '#FFA500' : '#FFFFFF');
        p_ctx.lineWidth = hasBall ? 2.5 : 2;
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, 0, Math.PI * 2);
        p_ctx.stroke();
        
        if (options.label) {
            p_ctx.fillStyle = '#FFFFFF';
            p_ctx.font = `bold ${radius + 2}px "Roboto", "Arial", sans-serif`;
            p_ctx.textAlign = 'center';
            p_ctx.textBaseline = 'middle';
            p_ctx.fillText(options.label, 0, 0);
        }
        p_ctx.restore();
    },

    drawDefender: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const isThumb = !!(window.ORB && window.ORB.renderer && window.ORB.renderer.isThumbnailMode);
        const radius = isThumb ? 12 : 10;
        const angle = (options.rotation || 0);
        
        p_ctx.save();
        p_ctx.translate(x, y);
        p_ctx.rotate(angle);
        p_ctx.beginPath();
        p_ctx.arc(0, 0, radius, -Math.PI / 2.5, Math.PI / 2.5);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#D32F2F');
        p_ctx.lineWidth = 3;
        p_ctx.stroke();
        p_ctx.restore();
        
        if (options.label) {
            p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#D32F2F');
            p_ctx.font = `bold ${radius}px "Roboto", "Arial", sans-serif`;
            p_ctx.textAlign = 'center';
            p_ctx.textBaseline = 'bottom';
            p_ctx.fillText(options.label, x, y - radius - 5);
        }
    },

    drawBall: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const radius = 6;
        
        p_ctx.beginPath();
        p_ctx.arc(x, y, radius, 0, Math.PI * 2);
        p_ctx.fillStyle = options.color || '#E65100';
        p_ctx.fill();
        if (isSelected) {
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
    },

    drawCone: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const size = 8;
        
        p_ctx.beginPath();
        p_ctx.moveTo(x - size, y + size);
        p_ctx.lineTo(x + size, y + size);
        p_ctx.lineTo(x, y - size);
        p_ctx.closePath();
        p_ctx.fillStyle = options.color || '#FFA500';
        p_ctx.fill();
        if (isSelected) {
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.stroke();
        }
    },

    drawHoop: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const radius = 8;
        p_ctx.beginPath();
        p_ctx.arc(x, y, radius, 0, Math.PI * 2);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#FF0000');
        p_ctx.lineWidth = 3;
        p_ctx.stroke();
    },

    drawBasket: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const backboardWidth = 18;
        const backboardHeight = 12;
        const hoopRadius = 6;
        
        p_ctx.save();
        p_ctx.fillStyle = '#6C757D';
        p_ctx.fillRect(x - backboardWidth / 2, y - backboardHeight / 2, backboardWidth, backboardHeight);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#E65100');
        p_ctx.lineWidth = 2;
        p_ctx.beginPath();
        p_ctx.arc(x, y + backboardHeight / 2, hoopRadius, 0, Math.PI);
        p_ctx.stroke();
        p_ctx.restore();
    },

    drawZone: function(logicalX, logicalY, width, height, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const p1 = getCoords({ x: logicalX, y: logicalY });
        const p2 = getCoords({ x: logicalX + width, y: logicalY + height });
        
        p_ctx.save();
        p_ctx.fillStyle = options.color || '#FFEB3B';
        p_ctx.globalAlpha = 0.4;
        p_ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        if (isSelected) {
            p_ctx.globalAlpha = 1;
            p_ctx.strokeStyle = '#FFD700';
            p_ctx.lineWidth = 2;
            p_ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
        p_ctx.restore();
    },

    drawText: function(logicalX, logicalY, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        const { x, y } = getCoords({ x: logicalX, y: logicalY });
        const size = options.size || 14;
        
        p_ctx.font = `bold ${size}px "Roboto", "Arial", sans-serif`;
        p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.textAlign = 'center';
        p_ctx.textBaseline = 'middle';
        p_ctx.fillText(options.text, x, y);
    },

    drawPath: function(logicalPoints, isSelected, options = {}, p_ctx, p_getCoordsFn) {
        if (!logicalPoints || logicalPoints.length < 2) return;
        const getCoords = p_getCoordsFn || this.getPixelCoords.bind(this);
        
        const pixelPoints = logicalPoints.map(p => getCoords(p));
        
        p_ctx.save();
        p_ctx.globalAlpha = 1;
        const isThumb = !!(window.ORB && window.ORB.renderer && window.ORB.renderer.isThumbnailMode);
        p_ctx.strokeStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.lineWidth = (options.width || 2.5) * (isThumb ? 1.5 : 1);
        p_ctx.lineCap = 'round';
        p_ctx.lineJoin = 'round';
        
        if (options.type === 'pass') {
            p_ctx.setLineDash(isThumb ? [8, 8] : [5, 5]);
        }
        
        p_ctx.beginPath();
        p_ctx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
        
        if (options.type === 'pencil') {
            for (let i = 1; i < pixelPoints.length - 1; i++) {
                const xc = (pixelPoints[i].x + pixelPoints[i + 1].x) / 2;
                const yc = (pixelPoints[i].y + pixelPoints[i + 1].y) / 2;
                p_ctx.quadraticCurveTo(pixelPoints[i].x, pixelPoints[i].y, xc, yc);
            }
            if (pixelPoints.length > 1) {
                p_ctx.lineTo(pixelPoints[pixelPoints.length - 1].x, pixelPoints[pixelPoints.length - 1].y);
            }
        } else if (options.type === 'dribble') {
            for (let i = 1; i < pixelPoints.length; i++) {
                this.drawZigZagSegment(pixelPoints[i - 1], pixelPoints[i], p_ctx, isThumb);
            }
        } else {
            for (let i = 1; i < pixelPoints.length - 1; i++) {
                const xc = (pixelPoints[i].x + pixelPoints[i + 1].x) / 2;
                const yc = (pixelPoints[i].y + pixelPoints[i + 1].y) / 2;
                p_ctx.quadraticCurveTo(pixelPoints[i].x, pixelPoints[i].y, xc, yc);
            }
             if (pixelPoints.length > 1) {
                p_ctx.lineTo(pixelPoints[pixelPoints.length - 1].x, pixelPoints[pixelPoints.length - 1].y);
            }
        }
        p_ctx.stroke();
        p_ctx.restore();
        
        if (options.type === 'pencil' || options.noHead) return;
        
        p_ctx.save();
        const endPoint = pixelPoints[pixelPoints.length - 1];
        let nearEndPoint = pixelPoints[pixelPoints.length - 2] || pixelPoints[0];
        if (pixelPoints.length > 2 && endPoint.x === nearEndPoint.x && endPoint.y === nearEndPoint.y) {
            nearEndPoint = pixelPoints[pixelPoints.length - 3] || pixelPoints[0];
        }
        const angle = Math.atan2(endPoint.y - nearEndPoint.y, endPoint.x - nearEndPoint.x);
        p_ctx.fillStyle = isSelected ? '#FFD700' : (options.color || '#212121');
        p_ctx.strokeStyle = p_ctx.fillStyle;
        p_ctx.lineWidth = 2;
        
        if (options.type === 'screen') {
            const barLength = isThumb ? 15 : 10;
            const p1x = endPoint.x + barLength * Math.cos(angle + Math.PI / 2);
            const p1y = endPoint.y + barLength * Math.sin(angle + Math.PI / 2);
            const p2x = endPoint.x + barLength * Math.cos(angle - Math.PI / 2);
            const p2y = endPoint.y + barLength * Math.sin(angle - Math.PI / 2);
            p_ctx.beginPath();
            p_ctx.moveTo(p1x, p1y);
            p_ctx.lineTo(p2x, p2y);
            p_ctx.stroke();
        } else {
            const headlen = isThumb ? 16 : 10;
            p_ctx.beginPath();
            p_ctx.moveTo(endPoint.x, endPoint.y);
            p_ctx.lineTo(endPoint.x - headlen * Math.cos(angle - Math.PI / 6), endPoint.y - headlen * Math.sin(angle - Math.PI / 6));
            p_ctx.lineTo(endPoint.x - headlen * Math.cos(angle + Math.PI / 6), endPoint.y - headlen * Math.sin(angle + Math.PI / 6));
            p_ctx.closePath();
            p_ctx.fill();
        }
        p_ctx.restore();
    },

    drawZigZagSegment: function(start, end, p_ctx, isThumb = false) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
            p_ctx.lineTo(end.x, end.y);
            return;
        };
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const segmentCount = Math.ceil(dist / (isThumb ? 20 : 15));
        const amplitude = isThumb ? 6 : 4;
        for (let j = 1; j <= segmentCount; j++) {
            const p = (j - 0.5) / segmentCount;
            const mX = start.x + p * dx;
            const mY = start.y + p * dy;
            const side = (j % 2 === 0) ? -1 : 1;
            const zX = mX - (side * amplitude * Math.cos(perpAngle));
            const zY = mY - (side * amplitude * Math.sin(perpAngle));
            p_ctx.lineTo(zX, zY);
        }
        p_ctx.lineTo(end.x, end.y);
    },

    resizeCanvas: function() {
        return new Promise(resolve => {
            setTimeout(() => {
                const { canvas, ctx } = window.ORB;
                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                this.redrawCanvas();
                resolve();
            }, 450);
        });
    }
};