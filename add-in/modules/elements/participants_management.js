/**
 * Participants Management Shapes Module
 * Handles participant count, area, and list elements in PowerPoint slides
 */

/* global Office, PowerPoint */

import { showError } from '../ui/manager.js';
import { t } from '../i18n/index.js';
import { getVisibleParticipantsData } from '../core/websocket.js';
import { hideParticipants } from '../core/state.js';

// ============================================================================
// AVATAR TEMPLATE — config + helpers
// The participants list is built from on-slide, pre-tagged "preview" entities:
//   • bounding frame   tag: quizngo-content-type = participants-list  (marks the area)
//   • header           tag: quizngo-header = true  (opaque unit; moved as one block)
//   • avatar template  tag: quizngo-avatar-template = true + quizngo-avatar-role = background|icon|name
// The background is a persistent PowerPoint group that contains the visual card/decor.
// It is rendered as a PNG base, while icon/name stay live text shapes.
// Text alignment gotcha: PowerPoint.TextVerticalAlignment.*Centered also centers
// horizontally. Use "Middle" for vertical-only centering, then set paragraph
// alignment separately for icon/name text.
// ============================================================================

const BLACK = '#000000';

const PARTICIPANTS_LAYOUT = {
    gapX: 14,        // horizontal gap between avatar cells
    gapY: 12,        // vertical gap between rows
    headerGap: 14,   // gap between header block and first avatar row
    pad: 16          // inner padding of the bounding frame
};

// Invisible bounds around generated background groups so PowerPoint effects such as
// shadows aren't clipped when the group is rendered as an image.
const TEMPLATE_BACKGROUND_CAPTURE_PAD = 12;
let loggedAvatarImageFallback = false;

// Default geometry used only when first inserting the preview entities.
const PARTICIPANTS_DEFAULTS = {
    bound: { left: 50, top: 90, width: 620, height: 480 },
    headerH: 40
};

// Default template geometry, in PowerPoint points.
const AVATAR_TEMPLATE_DEFAULTS = {
    outer: { leftOffset: 192.2757874015748, topOffset: 74, width: 235.4484251968504, height: 65.94637795275591 },
    iconTile: { dx: 14.238503937007873, dy: 12.7396062992126, width: 40.467086614173226, height: 40.46700787401575 },
    icon: { dx: 18.238503937007873, dy: 16.7396062992126, width: 32.467086614173226, height: 32.46700787401575 },
    name: { dx: 65.19708661417321, dy: 19.48417322834639, width: 156.95913385826772, height: 29.978031496062993 }
};

/** Read a tag value (case-insensitive) from an already-loaded shape. */
function getTag(shape, key) {
    if (!shape.tags || !shape.tags.items) return null;
    const lk = key.toLowerCase();
    for (const tg of shape.tags.items) {
        if (tg.key && tg.key.toLowerCase() === lk) return tg.value;
    }
    return null;
}

function addTagSafe(shape, key, value) {
    try {
        shape.tags.add(key, value);
    } catch (e) {
        console.warn(`Could not add tag ${key}=${value}:`, e);
    }
}

function getAvatarRole(shape) {
    const role = getTag(shape, 'quizngo-avatar-role');
    if (role) return role.toLowerCase();

    const name = (shape.name || '').toLowerCase();
    if (name.includes('avatar background template')) return 'background';
    if (name.includes('avatar icon template')) return 'icon';
    if (name.includes('avatar name template')) return 'name';
    return null;
}

function isPowerPointApiSetSupported(version) {
    try {
        return !!Office.context.requirements.isSetSupported('PowerPointApi', version);
    } catch (e) {
        return false;
    }
}

function isGroupShape(shape) {
    const type = String(shape?.type || '').toLowerCase();
    const groupType = String(PowerPoint.ShapeType?.group || 'Group').toLowerCase();
    return type === 'group' || type === groupType;
}

function getShapeKey(shape) {
    return shape?.id || `${shape?.name || 'shape'}:${shape?.left}:${shape?.top}:${shape?.width}:${shape?.height}`;
}

function uniqueShapes(shapes) {
    const byKey = new Map();
    for (const shape of shapes) {
        if (!shape) continue;
        byKey.set(getShapeKey(shape), shape);
    }
    return Array.from(byKey.values());
}

function getMovableShape(entry) {
    return entry?.rootGroupShape || entry?.shape || null;
}

function isTextReadableShape(shape) {
    return shape && !isGroupShape(shape);
}

async function loadShapeEntries(context, shapeCollection, groupPath = []) {
    shapeCollection.load('items');
    await context.sync();

    const shapes = shapeCollection.items || [];
    for (const shape of shapes) {
        shape.load(['id', 'name', 'type', 'left', 'top', 'width', 'height']);
        shape.tags.load('items/key, items/value');
    }
    await context.sync();

    const entries = [];
    const canReadGroups = isPowerPointApiSetSupported('1.8');
    for (const shape of shapes) {
        const entry = {
            shape,
            groupPath,
            parentGroupShape: groupPath.length ? groupPath[groupPath.length - 1] : null,
            rootGroupShape: groupPath.length ? groupPath[0] : null,
            isGroup: isGroupShape(shape)
        };
        entries.push(entry);

        if (entry.isGroup && canReadGroups) {
            try {
                const childEntries = await loadShapeEntries(context, shape.group.shapes, [...groupPath, shape]);
                entries.push(...childEntries);
            } catch (groupError) {
                console.warn('Could not inspect grouped shapes:', groupError);
            }
        }
    }

    return entries;
}

async function findNumericHeaderCountShapes(context, entries) {
    const headerGroupKeys = new Set();
    for (const entry of entries) {
        if (getTag(entry.shape, 'quizngo-header') !== 'true') continue;
        const movableShape = getMovableShape(entry);
        if (movableShape) headerGroupKeys.add(getShapeKey(movableShape));
    }

    if (headerGroupKeys.size === 0) return [];

    const candidates = [];
    for (const entry of entries) {
        const rootShape = entry.rootGroupShape;
        if (!rootShape || !headerGroupKeys.has(getShapeKey(rootShape))) continue;
        if (getTag(entry.shape, 'quizngo-header') === 'true') continue;
        if (!isTextReadableShape(entry.shape)) continue;
        candidates.push(entry.shape);
    }

    const uniqueCandidates = uniqueShapes(candidates);
    if (uniqueCandidates.length === 0) return [];

    for (const shape of uniqueCandidates) {
        try {
            shape.textFrame.textRange.load('text');
        } catch (e) { /* ignore */ }
    }

    try {
        await context.sync();
    } catch (textLoadError) {
        console.warn('Could not inspect header group text shapes:', textLoadError);
        return [];
    }

    const countShapes = [];
    for (const shape of uniqueCandidates) {
        try {
            const value = String(shape.textFrame.textRange.text || '').trim();
            if (/^\d+$/.test(value)) {
                countShapes.push(shape);
                addTagSafe(shape, 'quizngo-participants-num', 'true');
            }
        } catch (e) { /* ignore */ }
    }

    return countShapes;
}

/** Tag a freshly created clone shape so existing reset/overflow logic recognizes it. */
function tagAvatarClone(shape, pId, role) {
    addTagSafe(shape, 'quizngo-participant-item', 'true');
    addTagSafe(shape, 'participant-id', pId || '');
    addTagSafe(shape, 'quizngo-avatar-role', role);
}

function tagAvatarVisualClone(shape, pId, role, renderMode, renderKey, partIndex = null) {
    tagAvatarClone(shape, pId, role);
    addTagSafe(shape, 'quizngo-avatar-render-mode', renderMode);
    addTagSafe(shape, 'quizngo-avatar-render-key', renderKey || '');
    if (partIndex !== null && partIndex !== undefined) {
        addTagSafe(shape, 'quizngo-avatar-part-index', String(partIndex));
    }
}

function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return String(hash >>> 0);
}

function normalizeBase64Image(value) {
    const raw = String(value || '').trim();
    const dataUrlMatch = raw.match(/^data:image\/[^;]+;base64,(.+)$/i);
    return dataUrlMatch ? dataUrlMatch[1] : raw;
}

function setShapeAdjustment(shape, index, value) {
    try {
        if (!Office.context.requirements.isSetSupported('PowerPointApi', '1.10')) return;
        if (shape.adjustments && typeof shape.adjustments.set === 'function') {
            shape.adjustments.set(index, value);
        }
    } catch (e) { /* ignore */ }
}

function getPowerPointEnumValue(enumObject, key, fallback) {
    if (enumObject) {
        const upperKey = key.charAt(0).toUpperCase() + key.slice(1);
        for (const candidate of [key, upperKey, key.toLowerCase(), key.toUpperCase()]) {
            if (enumObject[candidate] !== undefined) return enumObject[candidate];
        }
    }
    return fallback;
}

function setParagraphAlignment(textRange, alignment) {
    const fallback = { center: 'Center', left: 'Left', right: 'Right' }[alignment] || alignment;
    textRange.paragraphFormat.alignment = getPowerPointEnumValue(PowerPoint.ParagraphAlignment, alignment, fallback);
}

function setTextFrameVerticalAlignment(textFrame, alignment) {
    const fallback = {
        top: 'Top',
        middle: 'Middle',
        bottom: 'Bottom',
        topCentered: 'TopCentered',
        middleCentered: 'MiddleCentered',
        bottomCentered: 'BottomCentered'
    }[alignment] || alignment;
    textFrame.verticalAlignment = getPowerPointEnumValue(PowerPoint.TextVerticalAlignment, alignment, fallback);
}

function setTextFrameMargins(textFrame, margins) {
    try {
        if (typeof margins.left === 'number') textFrame.marginLeft = margins.left;
        if (typeof margins.right === 'number') textFrame.marginRight = margins.right;
        if (typeof margins.top === 'number') textFrame.marginTop = margins.top;
        if (typeof margins.bottom === 'number') textFrame.marginBottom = margins.bottom;
    } catch (e) { /* ignore */ }
}

async function createTemplateBackgroundGroup(context, slide, backgroundShapes) {
    if (!backgroundShapes.length || typeof slide.shapes.addGroup !== 'function') return null;
    let captureBounds = null;
    try {
        const bounds = backgroundShapes.reduce((acc, shape) => ({
            left: Math.min(acc.left, shape.left),
            top: Math.min(acc.top, shape.top),
            right: Math.max(acc.right, shape.left + shape.width),
            bottom: Math.max(acc.bottom, shape.top + shape.height)
        }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

        captureBounds = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
            left: bounds.left - TEMPLATE_BACKGROUND_CAPTURE_PAD,
            top: bounds.top - TEMPLATE_BACKGROUND_CAPTURE_PAD,
            width: (bounds.right - bounds.left) + 2 * TEMPLATE_BACKGROUND_CAPTURE_PAD,
            height: (bounds.bottom - bounds.top) + 2 * TEMPLATE_BACKGROUND_CAPTURE_PAD
        });
        captureBounds.name = 'QuizNGo Avatar Background Bounds';
        captureBounds.fill.clear();
        captureBounds.lineFormat.visible = false;
        await context.sync();

        const group = slide.shapes.addGroup([captureBounds, ...backgroundShapes]);
        group.name = 'QuizNGo Avatar Background Template';
        addTagSafe(group, 'quizngo-avatar-template', 'true');
        addTagSafe(group, 'quizngo-avatar-role', 'background');
        group.load('left, top, width, height');
        await context.sync();

        return group;
    } catch (groupError) {
        console.warn('Could not create avatar template background group:', groupError);
        try {
            if (captureBounds) {
                captureBounds.delete();
                await context.sync();
            }
        } catch (cleanupError) {
            console.warn('Could not clean up avatar capture bounds:', cleanupError);
        }
        return null;
    }
}

async function renderTemplateBackgroundImage(context, backgroundShape, anchorLeft, anchorTop) {
    if (!backgroundShape || typeof backgroundShape.getImageAsBase64 !== 'function') return null;
    if (!isPowerPointApiSetSupported('1.10')) {
        if (!loggedAvatarImageFallback) {
            console.info('PowerPointApi 1.10 is unavailable; using shape fallback for avatar backgrounds.');
            loggedAvatarImageFallback = true;
        }
        return null;
    }

    try {
        backgroundShape.load('left, top, width, height');
        await context.sync();

        const imageResult = backgroundShape.getImageAsBase64();
        await context.sync();

        const base64 = normalizeBase64Image(imageResult.value);
        if (!base64) return null;

        return {
            base64,
            key: hashString(base64),
            dx: backgroundShape.left - anchorLeft,
            dy: backgroundShape.top - anchorTop,
            w: backgroundShape.width,
            h: backgroundShape.height
        };
    } catch (imageError) {
        console.warn('Could not render avatar template background as image:', imageError);
        return null;
    }
}

function createPictureLikeShape(slide, imageSpec, left, top) {
    if (!imageSpec || !imageSpec.base64) return null;

    // Prefer the production API: a rectangle with picture fill (PowerPointApi 1.8).
    if (isPowerPointApiSetSupported('1.8')) {
        try {
            const imageShape = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left,
                top,
                width: imageSpec.w,
                height: imageSpec.h
            });
            if (!imageShape.fill || typeof imageShape.fill.setImage !== 'function') {
                try { imageShape.delete(); } catch (e) { /* ignore */ }
                throw new Error('ShapeFill.setImage is not available on this host.');
            }
            imageShape.fill.setImage(imageSpec.base64);
            imageShape.lineFormat.visible = false;
            return imageShape;
        } catch (fillImageError) {
            console.warn('Could not create avatar image via shape fill:', fillImageError);
        }
    }

    // addPicture is currently preview-only, but keep it as a fallback for hosts that expose it.
    if (typeof slide.shapes.addPicture !== 'function') return null;
    try {
        return slide.shapes.addPicture(imageSpec.base64, {
            left,
            top,
            width: imageSpec.w,
            height: imageSpec.h
        });
    } catch (addPictureError) {
        console.warn('Could not create avatar image via addPicture:', addPictureError);
        return null;
    }
}

/** Apply a captured template style spec onto a clone shape. kind: 'text' | null. */
function applyCloneStyle(shape, st, kind) {
    // Fill: replicate solid color, otherwise clear (covers the "no fill" default).
    try {
        if (st.fillType && String(st.fillType).toLowerCase() === 'solid' && st.fillColor) {
            shape.fill.setSolidColor(st.fillColor);
            if (typeof st.fillTransparency === 'number') {
                try { shape.fill.transparency = st.fillTransparency; } catch (e) { /* ignore */ }
            }
        } else {
            shape.fill.clear();
        }
    } catch (e) { /* ignore */ }
    // Border.
    try {
        if (st.lineVisible) {
            if (st.lineColor) shape.lineFormat.color = st.lineColor;
            if (typeof st.lineWeight === 'number' && st.lineWeight > 0) shape.lineFormat.weight = st.lineWeight;
            if (st.lineDash) { try { shape.lineFormat.dashStyle = st.lineDash; } catch (e) { /* ignore */ } }
        } else {
            shape.lineFormat.visible = false;
        }
    } catch (e) { /* ignore */ }
    // Text.
    if (kind === 'icon' || kind === 'name' || kind === 'text') {
        try {
            shape.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
            setTextFrameVerticalAlignment(shape.textFrame, 'middle');
            if (kind === 'name') setTextFrameMargins(shape.textFrame, { left: 0, right: 0 });
            const r = shape.textFrame.textRange;
            const f = st.font || {};
            if (f.size) r.font.size = f.size;
            if (f.color) r.font.color = f.color;
            if (typeof f.bold === 'boolean') r.font.bold = f.bold;
            if (typeof f.italic === 'boolean') r.font.italic = f.italic;
            if (f.name) r.font.name = f.name;
            setParagraphAlignment(r, kind === 'name' ? 'left' : 'center');
        } catch (e) { /* ignore */ }
    }
}

/** Create the clone shapes for one participant at a cell origin. */
function createAvatarClone(slide, spec, geomName, participant, pId, cellX, cellY) {
    const geomType = (PowerPoint.GeometricShapeType[geomName]) || PowerPoint.GeometricShapeType.roundRectangle;

    if (spec.shadow) {
        const shadow = slide.shapes.addGeometricShape(geomType, {
            left: cellX + spec.shadow.dx, top: cellY + spec.shadow.dy, width: spec.shadow.w, height: spec.shadow.h
        });
        applyCloneStyle(shadow, spec.shadow, null);
        tagAvatarClone(shadow, pId, 'shadow');
    }

    let card = null;
    if (spec.backgroundImage && spec.backgroundImage.base64) {
        try {
            card = createPictureLikeShape(
                slide,
                spec.backgroundImage,
                cellX + spec.backgroundImage.dx,
                cellY + spec.backgroundImage.dy
            );
            if (card) {
                tagAvatarClone(card, pId, 'card');
                addTagSafe(card, 'quizngo-avatar-render-mode', 'image');
                addTagSafe(card, 'quizngo-avatar-render-key', spec.templateKey || spec.backgroundImage.key || '');
            }
        } catch (e) {
            console.warn('Could not create avatar image clone:', e);
            card = null;
        }
    }

    if (!card) {
        if (Array.isArray(spec.backgroundParts) && spec.backgroundParts.length > 0) {
            for (let i = 0; i < spec.backgroundParts.length; i++) {
                const part = spec.backgroundParts[i];
                const partGeomType = PowerPoint.GeometricShapeType[part.geomName] || geomType;
                const partShape = slide.shapes.addGeometricShape(partGeomType, {
                    left: cellX + part.dx,
                    top: cellY + part.dy,
                    width: part.w,
                    height: part.h
                });
                applyCloneStyle(partShape, part, null);
                tagAvatarVisualClone(partShape, pId, part.role || 'decor', 'shape', spec.templateKey, i);
                if (!card && (part.role === 'card' || i === 0)) card = partShape;
            }
        } else {
            card = slide.shapes.addGeometricShape(geomType, {
                left: cellX + spec.card.dx, top: cellY + spec.card.dy, width: spec.card.w, height: spec.card.h
            });
            applyCloneStyle(card, spec.card, null);
            tagAvatarVisualClone(card, pId, 'card', 'shape', spec.templateKey);
        }
    }

    const icon = slide.shapes.addTextBox(participant.icon || '👤', {
        left: cellX + spec.icon.dx, top: cellY + spec.icon.dy, width: spec.icon.w, height: spec.icon.h
    });
    applyCloneStyle(icon, spec.icon, 'icon');
    tagAvatarClone(icon, pId, 'icon');

    const name = slide.shapes.addTextBox(participant.nickname || '', {
        left: cellX + spec.name.dx, top: cellY + spec.name.dy, width: spec.name.w, height: spec.name.h
    });
    applyCloneStyle(name, spec.name, 'name');
    tagAvatarClone(name, pId, 'name');
}

function deleteAvatarCloneShapesForParticipant(shapes, pId, deletedIds) {
    if (!pId) return;
    for (const shape of shapes) {
        if (getTag(shape, 'participant-id') !== pId) continue;
        try {
            shape.delete();
            if (deletedIds && shape.id) deletedIds.add(shape.id);
        } catch (e) { /* ignore */ }
    }
}

/**
 * Reset all participant-related shapes in slides:
 * - Deletes quizngo-participant-item shapes (avatar clones from a previous game)
 * - Clears the quizngo-content-type=participants-list bounding frame text
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function resetParticipantShapesInSlides() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();

            for (const slide of slides.items) {
                const entries = await loadShapeEntries(context, slide.shapes);
                for (const { shape } of entries) {
                    const isParticipantClone = getTag(shape, 'quizngo-participant-item') === 'true';
                    const isLegacyPill = getTag(shape, 'quizngo-participant-pill') === 'true';
                    const isLegacyArea = getTag(shape, 'quizngo-participants-area') === 'true';
                    const contentType = getTag(shape, 'quizngo-content-type');

                    if (isParticipantClone || isLegacyPill) {
                        try { shape.delete(); } catch (e) { /* ignore */ }
                        continue;
                    }

                    if (isLegacyArea) {
                        try {
                            shape.textFrame.textRange.text = 'מחכים למשתתפים...';
                        } catch (e) { /* ignore */ }
                    }

                    if (contentType && contentType.toLowerCase() === 'participants-list') {
                        try {
                            shape.textFrame.textRange.text = '';
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            // Single sync for all updates/deletions
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting participant shapes in slides:', error);
    }
}

/**
 * Reset participants number in all slides with the tag
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function resetParticipantsNumInSlides() {
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();

            const shapesToUpdate = [];
            const shapesToClear = [];
            for (const slide of slides.items) {
                const entries = await loadShapeEntries(context, slide.shapes);
                const inferredHeaderCountShapes = await findNumericHeaderCountShapes(context, entries);
                const inferredHeaderCountKeys = new Set(inferredHeaderCountShapes.map(getShapeKey));
                for (const { shape } of entries) {
                    if (getTag(shape, 'quizngo-participants-num') !== 'true') continue;
                    const isStandaloneHeaderCount = (getTag(shape, 'quizngo-header-role') || '').toLowerCase() === 'count'
                        && !inferredHeaderCountKeys.has(getShapeKey(shape))
                        && inferredHeaderCountShapes.length > 0;
                    if (isStandaloneHeaderCount) {
                        shapesToClear.push(shape);
                    } else {
                        shapesToUpdate.push(shape);
                    }
                }
                shapesToUpdate.push(...inferredHeaderCountShapes);
            }

            // Update all shapes at once
            for (const shape of uniqueShapes(shapesToUpdate)) {
                try {
                    shape.textFrame.textRange.text = '0';
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            for (const shape of uniqueShapes(shapesToClear)) {
                try {
                    shape.textFrame.textRange.text = '';
                } catch (e) { /* ignore shapes without textFrame */ }
            }
            
            // Single sync for all updates
            await context.sync();
        });
    } catch (error) {
        console.error('❌ Error resetting participants number in slides:', error);
    }
}

/**
 * Update participants number in all slides with the tag
 */
export async function updateParticipantsNumInSlides(count) {
    console.log(`👥 Starting updateParticipantsNumInSlides with count: ${count}`);
    
    if (count === undefined || count === null) {
        console.error('❌ No count provided to updateParticipantsNumInSlides');
        return;
    }
    
    try {
        await PowerPoint.run(async (context) => {
            const presentation = context.presentation;
            const slides = presentation.slides;
            slides.load('items');
            await context.sync();
            
            console.log(`🔍 Searching for quizngo-participants-num tags in ${slides.items.length} slides...`);
            
            let foundElements = 0;
            
            for (let i = 0; i < slides.items.length; i++) {
                const slide = slides.items[i];
                const entries = await loadShapeEntries(context, slide.shapes);
                const shapesToUpdate = [];
                const shapesToClear = [];
                const inferredHeaderCountShapes = await findNumericHeaderCountShapes(context, entries);
                const inferredHeaderCountKeys = new Set(inferredHeaderCountShapes.map(getShapeKey));

                for (const { shape } of entries) {
                    if (getTag(shape, 'quizngo-participants-num') !== 'true') continue;
                    const isStandaloneHeaderCount = (getTag(shape, 'quizngo-header-role') || '').toLowerCase() === 'count'
                        && !inferredHeaderCountKeys.has(getShapeKey(shape))
                        && inferredHeaderCountShapes.length > 0;
                    if (isStandaloneHeaderCount) {
                        shapesToClear.push(shape);
                    } else {
                        shapesToUpdate.push(shape);
                    }
                }
                shapesToUpdate.push(...inferredHeaderCountShapes);

                const uniqueShapesToUpdate = uniqueShapes(shapesToUpdate);
                if (uniqueShapesToUpdate.length > 0) {
                    for (const shape of uniqueShapesToUpdate) {
                        shape.textFrame.load('textRange');
                    }
                    
                    // Sync once for all textFrames
                    await context.sync();
                    
                    for (const shape of uniqueShapesToUpdate) {
                        try {
                            shape.textFrame.textRange.text = String(count);
                            foundElements++;
                            console.log(`✅ Updated participants number to ${count} in slide ${i + 1}`);
                        } catch (textError) {
                            console.error(`❌ Error updating text in slide ${i + 1}:`, textError);
                        }
                    }
                }
                for (const shape of uniqueShapes(shapesToClear)) {
                    try {
                        shape.textFrame.textRange.text = '';
                    } catch (textError) {
                        console.warn(`Could not clear redundant participants number in slide ${i + 1}:`, textError);
                    }
                }
            }
            
            await context.sync();
            console.log(`✅ Total participants number elements updated: ${foundElements}`);
        });
    } catch (error) {
        console.error('❌ Error updating participants number in slides:', error);
        console.error('Error details:', error.message, error.stack);
        throw error;
    }
}

/**
 * Insert Participants Number button/textbox
 */
export async function insertParticipantsNumButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            
            if (slides.items.length > 0) {
                const slide = slides.items[0];
                
                // Default participants number
                const participantsNum = '99';
                
                // Add a text box with participant count and dynamic tag
                const textBox = slide.shapes.addTextBox(participantsNum, {
                    left: 100,
                    top: 150,
                    width: 250,
                    height: 60
                });
                
                // Load text properties and tags
                textBox.load(['textFrame', 'tags']);
                await context.sync();
                
                // Add tag for dynamic updates
                textBox.tags.add('quizngo-participants-num', 'true');
                
                const textRange = textBox.textFrame.textRange;
                textRange.load(['font']);
                await context.sync();
                
                textRange.font.size = 24;
                textRange.font.color = '#0078d4';
                textRange.font.bold = true;
                
                await context.sync();
                console.log('✅ Dynamic participants number added to slide');
            }
        });
    } catch (error) {
        console.error('Error adding participants number:', error);
        showError(t('errors.addParticipantsCount'));
    }
}

/**
 * Insert the participants list preview entities onto the selected slide:
 * bounding frame + header (title + live count) + avatar template (background/icon/name).
 * Participants are later rendered by cloning the avatar template.
 */
export async function insertParticipantsListButton() {
    try {
        await PowerPoint.run(async (context) => {
            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();

            if (slides.items.length === 0) return;
            const slide = slides.items[0];

            const { pad } = PARTICIPANTS_LAYOUT;
            const { bound, headerH } = PARTICIPANTS_DEFAULTS;
            const avatar = AVATAR_TEMPLATE_DEFAULTS;

            // 1) Bounding frame — marks the participant area. Found later by this tag.
            const frame = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left: bound.left, top: bound.top, width: bound.width, height: bound.height
            });
            frame.name = 'QuizNGo Participants Area';
            addTagSafe(frame, 'quizngo-content-type', 'participants-list');

            // 2) Header — opaque unit (one tag). Title + live count both ride together.
            //    The count also carries quizngo-participants-num so existing logic updates it.
            const title = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left: bound.left + pad, top: bound.top + pad, width: bound.width - 2 * pad, height: headerH
            });
            title.name = 'QuizNGo Participants Header Title';
            addTagSafe(title, 'quizngo-header', 'true');
            addTagSafe(title, 'quizngo-header-role', 'title');

            const count = slide.shapes.addTextBox('0', {
                left: bound.left + bound.width - pad - 70, top: bound.top + pad, width: 70, height: headerH
            });
            addTagSafe(count, 'quizngo-header', 'true');
            addTagSafe(count, 'quizngo-header-role', 'count');
            addTagSafe(count, 'quizngo-participants-num', 'true');

            // 3) Avatar template — a persistent background group plus live icon/name templates.
            const tplLeft = bound.left + avatar.outer.leftOffset;
            const tplTop = bound.top + avatar.outer.topOffset;

            const captureBounds = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle, {
                left: tplLeft - TEMPLATE_BACKGROUND_CAPTURE_PAD,
                top: tplTop - TEMPLATE_BACKGROUND_CAPTURE_PAD,
                width: avatar.outer.width + 2 * TEMPLATE_BACKGROUND_CAPTURE_PAD,
                height: avatar.outer.height + 2 * TEMPLATE_BACKGROUND_CAPTURE_PAD
            });
            captureBounds.name = 'QuizNGo Avatar Background Bounds';

            const card = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.roundRectangle, {
                left: tplLeft,
                top: tplTop,
                width: avatar.outer.width,
                height: avatar.outer.height
            });
            card.name = 'QuizNGo Avatar Card';

            const iconTile = slide.shapes.addGeometricShape(PowerPoint.GeometricShapeType.roundRectangle, {
                left: tplLeft + avatar.iconTile.dx,
                top: tplTop + avatar.iconTile.dy,
                width: avatar.iconTile.width,
                height: avatar.iconTile.height
            });
            iconTile.name = 'QuizNGo Avatar Icon Tile';

            await context.sync();

            // Styling. Each block is isolated so a single PowerPoint API failure doesn't leave
            // the avatar template half-built in default theme colors.
            try {
                frame.fill.clear();
                frame.lineFormat.color = BLACK;
                frame.lineFormat.weight = 1.5;
            } catch (styleError) {
                console.warn('Could not style participants list frame:', styleError);
            }

            try {
                title.textFrame.textRange.text = 'מחכים למשתתפים...';
            } catch (styleError) {
                console.warn('Could not set participants list header title text:', styleError);
            }

            try {
                for (const h of [title, count]) {
                    h.fill.clear();
                    h.lineFormat.visible = false;
                    h.textFrame.verticalAlignment = PowerPoint.TextVerticalAlignment.middleCentered;
                    const r = h.textFrame.textRange;
                    r.font.color = BLACK;
                    r.font.bold = true;
                    setParagraphAlignment(r, 'center');
                }
                title.textFrame.textRange.font.size = 20;
                count.textFrame.textRange.font.size = 16;
            } catch (styleError) {
                console.warn('Could not style participants list header:', styleError);
            }

            try {
                captureBounds.fill.clear();
                captureBounds.lineFormat.visible = false;
            } catch (styleError) {
                console.warn('Could not style avatar capture bounds:', styleError);
            }

            try {
                card.fill.setSolidColor('#FFFFFF');
                card.lineFormat.color = '#1A0A2E';
                card.lineFormat.weight = 3.75;
                setShapeAdjustment(card, 0, 0.20471);
            } catch (styleError) {
                console.warn('Could not style avatar card:', styleError);
            }

            try {
                iconTile.fill.clear();
                iconTile.lineFormat.color = '#1A0A2E';
                iconTile.lineFormat.weight = 1.25;
                setShapeAdjustment(iconTile, 0, 0.22240);
            } catch (styleError) {
                console.warn('Could not style avatar icon tile:', styleError);
            }
            await context.sync();

            try {
                const background = slide.shapes.addGroup([captureBounds, card, iconTile]);
                background.name = 'QuizNGo Avatar Background Template';
                addTagSafe(background, 'quizngo-avatar-template', 'true');
                addTagSafe(background, 'quizngo-avatar-role', 'background');
                await context.sync();
            } catch (groupError) {
                console.warn('Could not group avatar background template; leaving editable parts ungrouped:', groupError);
                addTagSafe(card, 'quizngo-avatar-template', 'true');
                addTagSafe(card, 'quizngo-avatar-role', 'card');
                addTagSafe(card, 'quizngo-avatar-geom', 'roundRectangle');
                addTagSafe(iconTile, 'quizngo-avatar-template', 'true');
                addTagSafe(iconTile, 'quizngo-avatar-role', 'decor');
                await context.sync();
            }

            const icon = slide.shapes.addTextBox('👤', {
                left: tplLeft + avatar.icon.dx,
                top: tplTop + avatar.icon.dy,
                width: avatar.icon.width,
                height: avatar.icon.height
            });
            icon.name = 'QuizNGo Avatar Icon Template';
            addTagSafe(icon, 'quizngo-avatar-template', 'true');
            addTagSafe(icon, 'quizngo-avatar-role', 'icon');

            const name = slide.shapes.addTextBox('Preview', {
                left: tplLeft + avatar.name.dx,
                top: tplTop + avatar.name.dy,
                width: avatar.name.width,
                height: avatar.name.height
            });
            name.name = 'QuizNGo Avatar Name Template';
            addTagSafe(name, 'quizngo-avatar-template', 'true');
            addTagSafe(name, 'quizngo-avatar-role', 'name');

            await context.sync();

            try {
                icon.fill.clear();
                icon.lineFormat.visible = false;
                icon.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                setTextFrameVerticalAlignment(icon.textFrame, 'middle');
                const iconRange = icon.textFrame.textRange;
                iconRange.font.size = 20;
                iconRange.font.color = '#1A0A2E';
                iconRange.font.bold = true;
                iconRange.font.name = 'Segoe UI Emoji';
                setParagraphAlignment(iconRange, 'center');

                name.fill.clear();
                name.lineFormat.visible = false;
                name.textFrame.autoSizeSetting = PowerPoint.ShapeAutoSize.autoSizeNone;
                setTextFrameVerticalAlignment(name.textFrame, 'middle');
                setTextFrameMargins(name.textFrame, { left: 0, right: 0 });
                const nameRange = name.textFrame.textRange;
                nameRange.font.size = 22.5;
                nameRange.font.color = '#1A0A2E';
                nameRange.font.bold = true;
                nameRange.font.name = 'Arial';
                setParagraphAlignment(nameRange, 'left');

                await context.sync();
            } catch (styleError) {
                console.warn('Could not apply icon/name styling to participants list:', styleError);
            }

            console.log('✅ Participants list inserted (frame + header + avatar template)');
        });
    } catch (error) {
        showError(t('errors.addParticipantsList'), error);
    }
}

/**
 * Link the LIVE participant count to a numeric text element inside whatever the
 * user has selected — typically a custom-designed "Waiting for players… N in"
 * group — WITHOUT making the object part of the participants-list layout.
 *
 * The numeric-only text shape(s) get tagged quizngo-participants-num=true, so
 * updateParticipantsNumInSlides() refreshes them in place on every participant
 * change. The object is deliberately NOT tagged quizngo-header, so the
 * participants-list layout never moves, centers, or otherwise absorbs it — it
 * stays exactly where the designer placed it (see the guard in
 * updateParticipantsListInSlides that ignores standalone count shapes).
 */
export async function linkLiveParticipantsCount() {
    try {
        await PowerPoint.run(async (context) => {
            const selectedShapes = context.presentation.getSelectedShapes();
            selectedShapes.load('items/id');
            await context.sync();

            if (!selectedShapes.items || selectedShapes.items.length === 0) {
                showError(t('errors.selectShapeFirst'));
                return;
            }
            const selectedIds = new Set(selectedShapes.items.map(s => s.id).filter(Boolean));

            const slides = context.presentation.getSelectedSlides();
            slides.load('items');
            await context.sync();
            if (slides.items.length === 0) return;

            // Scan the slide (incl. inside groups) and keep the shapes that are the
            // selection itself or live inside a selected group.
            const entries = await loadShapeEntries(context, slides.items[0].shapes);
            const candidates = entries
                .filter(e => selectedIds.has(e.shape.id) || (e.rootGroupShape && selectedIds.has(e.rootGroupShape.id)))
                .map(e => e.shape)
                .filter(isTextReadableShape);

            for (const shape of candidates) {
                try { shape.textFrame.textRange.load('text'); } catch (e) { /* ignore */ }
            }
            await context.sync();

            // Tag every numeric-only text element as the live count.
            let taggedCount = 0;
            for (const shape of candidates) {
                let text = '';
                try { text = String(shape.textFrame.textRange.text || '').trim(); } catch (e) { continue; }
                if (/^\d+$/.test(text)) {
                    addTagSafe(shape, 'quizngo-participants-num', 'true');
                    taggedCount++;
                }
            }
            await context.sync();

            if (taggedCount === 0) {
                showError(t('errors.noNumericCount'));
                return;
            }
            console.log(`✅ Linked live participant count to ${taggedCount} numeric element(s); object left in place.`);
        });
    } catch (error) {
        showError(t('errors.linkLiveCount'), error);
    }
}

/**
 * Update the participants list in all slides
 * Creates avatar template clones for each participant
 * OPTIMIZED: Batch loading with minimal context.sync() calls
 */
export async function updateParticipantsListInSlides() {
    try {
        // VISIBLE participants only (excludes permanently hidden / overflowed ones)
        const visibleParticipantsData = getVisibleParticipantsData();
        const participants = Array.from(visibleParticipantsData.values());

        await PowerPoint.run(async (context) => {
            const { gapX, gapY, headerGap, pad } = PARTICIPANTS_LAYOUT;
            const slides = context.presentation.slides;
            slides.load('items');
            await context.sync();

            for (const slide of slides.items) {
                const entries = await loadShapeEntries(context, slide.shapes);

                // --- Identify the entities on this slide ---
                let boundingShape = null;
                const tpl = { background: null, shadow: null, card: null, icon: null, name: null };
                const templateBackgroundShapes = [];
                const templateBackgroundGroups = new Map();
                const headerEntities = new Map();
                let tplCardGeom = null;
                const existingClones = new Map(); // pId -> { shadow, card, icon, name }
                const allCloneShapes = [];
                const inferredHeaderCountShapes = await findNumericHeaderCountShapes(context, entries);
                const inferredHeaderCountKeys = new Set(inferredHeaderCountShapes.map(getShapeKey));

                const addHeaderEntity = (entry, forcedRole = null) => {
                    const movableShape = getMovableShape(entry);
                    if (!movableShape) return;

                    const key = getShapeKey(movableShape);
                    if (!headerEntities.has(key)) {
                        headerEntities.set(key, { shape: movableShape, hasTitle: false, hasCount: false });
                    }

                    const record = headerEntities.get(key);
                    const headerRole = (forcedRole || getTag(entry.shape, 'quizngo-header-role') || '').toLowerCase();
                    const isCountShape = headerRole === 'count' || forcedRole === 'count' || getTag(entry.shape, 'quizngo-participants-num') === 'true';
                    if (entry.rootGroupShape && entry.rootGroupShape !== entry.shape && !isCountShape) {
                        addTagSafe(entry.rootGroupShape, 'quizngo-header', 'true');
                        addTagSafe(entry.rootGroupShape, 'quizngo-header-role', headerRole || 'title');
                    }
                    if (isCountShape) {
                        record.hasCount = true;
                    }
                    if (headerRole === 'title' || (getTag(entry.shape, 'quizngo-header') === 'true' && !isCountShape)) {
                        record.hasTitle = true;
                    }
                };

                for (const entry of entries) {
                    const { shape } = entry;
                    const ct = getTag(shape, 'quizngo-content-type');
                    if (ct && ct.toLowerCase() === 'participants-list') boundingShape = shape;

                    // Only true header shapes (or numeric counts inferred inside a tagged
                    // header group) participate in header layout/movement. A standalone
                    // quizngo-participants-num shape — e.g. the live "2" inside a custom
                    // "Waiting for players…" object linked via linkLiveParticipantsCount() —
                    // is updated in place by updateParticipantsNumInSlides() and must NOT be
                    // moved or absorbed into the participants-list header here.
                    const isInferredHeaderCount = inferredHeaderCountKeys.has(getShapeKey(shape));
                    if (getTag(shape, 'quizngo-header') === 'true' || isInferredHeaderCount) {
                        addHeaderEntity(entry, isInferredHeaderCount ? 'count' : null);
                    }

                    const role = getAvatarRole(shape);
                    if (getTag(shape, 'quizngo-avatar-template') === 'true') {
                        if (role === 'background') {
                            tpl.background = shape;
                        } else if (role !== 'icon' && role !== 'name') {
                            templateBackgroundShapes.push(shape);
                            if (entry.parentGroupShape) {
                                const groupKey = getShapeKey(entry.parentGroupShape);
                                if (!templateBackgroundGroups.has(groupKey)) {
                                    templateBackgroundGroups.set(groupKey, { shape: entry.parentGroupShape, roles: new Set() });
                                }
                                templateBackgroundGroups.get(groupKey).roles.add(role || 'decor');
                            }
                        }
                        if (role && role in tpl) {
                            tpl[role] = shape;
                            if (role === 'card') tplCardGeom = getTag(shape, 'quizngo-avatar-geom');
                        }

                        if ((role === 'icon' || role === 'name') && entry.parentGroupShape) {
                            const groupKey = getShapeKey(entry.parentGroupShape);
                            if (!templateBackgroundGroups.has(groupKey)) {
                                templateBackgroundGroups.set(groupKey, { shape: entry.parentGroupShape, roles: new Set() });
                            }
                            templateBackgroundGroups.get(groupKey).roles.add(role);
                        }
                    }

                    if (getTag(shape, 'quizngo-participant-item') === 'true') {
                        allCloneShapes.push(shape);
                        const pid = getTag(shape, 'participant-id');
                        if (pid) {
                            if (!existingClones.has(pid)) existingClones.set(pid, {});
                            if (role) {
                                const existing = existingClones.get(pid);
                                existing[role] = shape;
                                if (role === 'card' || role === 'decor' || role === 'background') {
                                    const partIndex = Number(getTag(shape, 'quizngo-avatar-part-index'));
                                    if (Number.isFinite(partIndex)) {
                                        if (!existing.backgroundParts) existing.backgroundParts = [];
                                        existing.backgroundParts[partIndex] = shape;
                                    }
                                }
                                if (role === 'card') {
                                    existing.cardRenderMode = getTag(shape, 'quizngo-avatar-render-mode') || 'shape';
                                    existing.cardRenderKey = getTag(shape, 'quizngo-avatar-render-key') || '';
                                }
                            }
                        }
                    }
                }

                if (!boundingShape) continue; // not a participants slide

                const boxLeft = boundingShape.left, boxTop = boundingShape.top;
                const boxW = boundingShape.width, boxH = boundingShape.height;

                const getShapeBounds = (shapes) => {
                    if (!shapes.length) return null;
                    return shapes.reduce((acc, shape) => ({
                        left: Math.min(acc.left, shape.left),
                        top: Math.min(acc.top, shape.top),
                        right: Math.max(acc.right, shape.left + shape.width),
                        bottom: Math.max(acc.bottom, shape.top + shape.height)
                    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
                };
                const moveShapesBy = (shapes, dx, dy) => {
                    if (Math.abs(dx) <= 0.01 && Math.abs(dy) <= 0.01) return;
                    for (const h of shapes) {
                        if (Math.abs(dx) > 0.01) h.left = h.left + dx;
                        if (Math.abs(dy) > 0.01) h.top = h.top + dy;
                    }
                };

                const headerRecords = Array.from(headerEntities.values());
                const headerShapes = headerRecords.map(record => record.shape);
                const hasHeader = headerShapes.length > 0;
                const titleHeaderHasEmbeddedCount = headerRecords.some(record => record.hasTitle && record.hasCount);
                const redundantCountShapes = titleHeaderHasEmbeddedCount
                    ? headerRecords.filter(record => record.hasCount && !record.hasTitle).map(record => record.shape)
                    : [];
                for (const shape of redundantCountShapes) {
                    try { shape.textFrame.textRange.text = ''; } catch (e) { /* ignore */ }
                }
                const countHeaderShapes = headerRecords
                    .filter(record => record.hasCount && !record.hasTitle && !titleHeaderHasEmbeddedCount)
                    .map(record => record.shape);
                const titleHeaderShapes = headerRecords
                    .filter(record => record.hasTitle || (!record.hasTitle && !record.hasCount))
                    .map(record => record.shape);
                const primaryHeaderShapes = uniqueShapes(titleHeaderShapes.length > 0 ? titleHeaderShapes : headerShapes);
                const primaryHeaderBounds = getShapeBounds(primaryHeaderShapes);
                const countHeaderBounds = getShapeBounds(countHeaderShapes);
                const headerH = hasHeader ? Math.max(
                    primaryHeaderBounds ? primaryHeaderBounds.bottom - primaryHeaderBounds.top : 0,
                    countHeaderBounds ? countHeaderBounds.bottom - countHeaderBounds.top : 0
                ) : 0;
                const moveHeaderTo = (targetTop) => {
                    if (!hasHeader) return;
                    if (primaryHeaderBounds) {
                        const headerW = primaryHeaderBounds.right - primaryHeaderBounds.left;
                        const targetLeft = boxLeft + (boxW - headerW) / 2;
                        moveShapesBy(primaryHeaderShapes, targetLeft - primaryHeaderBounds.left, targetTop - primaryHeaderBounds.top);
                    }
                    const currentCountBounds = getShapeBounds(countHeaderShapes);
                    if (currentCountBounds) {
                        const countW = currentCountBounds.right - currentCountBounds.left;
                        const countTargetLeft = boxLeft + boxW - pad - countW;
                        moveShapesBy(countHeaderShapes, countTargetLeft - currentCountBounds.left, targetTop - currentCountBounds.top);
                    }
                };

                // --- Empty state: clear clones, center the header, blank the frame ---
                if (participants.length === 0) {
                    for (const s of allCloneShapes) { try { s.delete(); } catch (e) { /* ignore */ } }
                    moveHeaderTo(boxTop + Math.max(pad, (boxH - headerH) / 2));
                    try { boundingShape.textFrame.textRange.text = ''; } catch (e) { /* ignore */ }
                    await context.sync();
                    continue;
                }

                const hasTemplate = (tpl.background || tpl.card) && tpl.icon && tpl.name;
                if (!hasTemplate) {
                    console.warn('⚠️ Participants area found but avatar template is incomplete — skipping render.');
                    continue;
                }

                // --- Read the template style spec (readable subset only) ---
                const templateRoleShapes = ['shadow', 'card', 'icon', 'name']
                    .filter(role => tpl[role])
                    .map(role => tpl[role]);
                const templateStyleShapes = uniqueShapes([...templateRoleShapes, ...templateBackgroundShapes]);
                for (const s of templateStyleShapes) {
                    s.fill.load('type, foregroundColor, transparency');
                    s.lineFormat.load('color, weight, dashStyle, visible');
                }
                for (const role of ['icon', 'name']) {
                    if (tpl[role]) tpl[role].textFrame.textRange.font.load('size, color, bold, italic, name');
                }
                await context.sync();

                const readStyle = (s) => {
                    const st = { fillType: null, fillColor: null, fillTransparency: null, lineVisible: false, lineColor: BLACK, lineWeight: 1, lineDash: null, font: {} };
                    try {
                        st.fillType = s.fill.type;
                        if (st.fillType && String(st.fillType).toLowerCase() === 'solid') st.fillColor = s.fill.foregroundColor;
                        if (typeof s.fill.transparency === 'number') st.fillTransparency = s.fill.transparency;
                    } catch (e) { /* ignore */ }
                    try {
                        st.lineVisible = (s.lineFormat.visible !== false);
                        st.lineColor = s.lineFormat.color || BLACK;
                        st.lineWeight = (typeof s.lineFormat.weight === 'number') ? s.lineFormat.weight : 1;
                        st.lineDash = s.lineFormat.dashStyle;
                    } catch (e) { /* ignore */ }
                    try {
                        const f = s.textFrame.textRange.font;
                        st.font = { size: f.size, color: f.color, bold: f.bold, italic: f.italic, name: f.name };
                    } catch (e) { /* ignore */ }
                    return st;
                };

                let backgroundShape = tpl.background;
                if (!backgroundShape) {
                    for (const candidate of templateBackgroundGroups.values()) {
                        if (!candidate.roles.has('icon') && !candidate.roles.has('name')) {
                            backgroundShape = candidate.shape;
                            break;
                        }
                    }
                }
                const canRenderBackgroundImage = isPowerPointApiSetSupported('1.10');
                if (!backgroundShape && templateBackgroundShapes.length > 0 && canRenderBackgroundImage) {
                    backgroundShape = await createTemplateBackgroundGroup(context, slide, templateBackgroundShapes);
                }

                const templateBase = backgroundShape || tpl.card;
                if (!templateBase) {
                    console.warn('⚠️ Participants avatar template has no renderable background — skipping render.');
                    continue;
                }

                const baseLeft = templateBase.left, baseTop = templateBase.top;
                const cardStyle = tpl.card ? readStyle(tpl.card) : {};
                const backgroundImage = await renderTemplateBackgroundImage(context, backgroundShape || tpl.card, baseLeft, baseTop);
                if (!backgroundImage && !tpl.card) {
                    console.warn('⚠️ Could not render avatar background image and no card fallback exists — skipping render.');
                    continue;
                }

                const geomName = tplCardGeom || 'roundRectangle';
                const backgroundParts = (!backgroundImage && templateBackgroundShapes.length > 0)
                    ? templateBackgroundShapes.map((shape, index) => {
                        const partRole = getAvatarRole(shape) === 'card' ? 'card' : 'decor';
                        return Object.assign({
                            role: partRole,
                            partIndex: index,
                            geomName: partRole === 'card' ? geomName : 'roundRectangle',
                            dx: shape.left - baseLeft,
                            dy: shape.top - baseTop,
                            w: shape.width,
                            h: shape.height
                        }, readStyle(shape));
                    })
                    : null;

                const spec = {
                    shadow: backgroundImage ? null : (tpl.shadow ? Object.assign({ dx: tpl.shadow.left - baseLeft, dy: tpl.shadow.top - baseTop, w: tpl.shadow.width, h: tpl.shadow.height }, readStyle(tpl.shadow)) : null),
                    backgroundImage,
                    backgroundParts,
                    card: Object.assign({ dx: tpl.card ? (tpl.card.left - baseLeft) : 0, dy: tpl.card ? (tpl.card.top - baseTop) : 0, w: tpl.card ? tpl.card.width : templateBase.width, h: tpl.card ? tpl.card.height : templateBase.height }, cardStyle),
                    icon: Object.assign({ dx: tpl.icon.left - baseLeft, dy: tpl.icon.top - baseTop, w: tpl.icon.width, h: tpl.icon.height }, readStyle(tpl.icon)),
                    name: Object.assign({ dx: tpl.name.left - baseLeft, dy: tpl.name.top - baseTop, w: tpl.name.width, h: tpl.name.height }, readStyle(tpl.name))
                };
                spec.templateKey = hashString(JSON.stringify({
                    backgroundImageKey: backgroundImage?.key || '',
                    backgroundParts,
                    shadow: spec.shadow,
                    card: spec.card,
                    icon: spec.icon,
                    name: spec.name
                }));
                const cellW = templateBase.width, cellH = templateBase.height;

                // --- Layout: items per row + overflow capacity ---
                const innerW = boxW - 2 * pad;
                const itemsPerRow = Math.max(1, Math.floor((innerW + gapX) / (cellW + gapX)));
                const headerBlock = hasHeader ? headerH + headerGap : 0;
                const availForRows = boxH - 2 * pad - headerBlock;
                const maxRows = Math.max(1, Math.floor((availForRows + gapY) / (cellH + gapY)));

                // Overflow: hide the top row(s) permanently (same model as before).
                let toDisplay = participants;
                const deletedIds = new Set();
                const totalRows = Math.ceil(participants.length / itemsPerRow);
                if (totalRows > maxRows) {
                    const hideCount = (totalRows - maxRows) * itemsPerRow;
                    const hideIds = participants.slice(0, hideCount).map(p => p.userId || p.id);
                    hideParticipants(hideIds);
                    for (const hid of hideIds) {
                        deleteAvatarCloneShapesForParticipant(allCloneShapes, hid, deletedIds);
                        existingClones.delete(hid);
                    }
                    toDisplay = participants.slice(hideCount);
                }

                // --- Vertical centering (this IS the "rise by half a row" behavior) ---
                const rowsNeeded = Math.max(1, Math.ceil(toDisplay.length / itemsPerRow));
                const rowsHeight = rowsNeeded * cellH + (rowsNeeded - 1) * gapY;
                const blockH = headerBlock + rowsHeight;
                const blockTop = boxTop + Math.max(pad, (boxH - blockH) / 2);

                moveHeaderTo(blockTop);
                const rowsTop = blockTop + headerBlock;

                // --- Place avatars: reuse existing clones by id, else clone from template ---
                const keptIds = new Set();
                for (let k = 0; k < toDisplay.length; k++) {
                    const p = toDisplay[k];
                    const pId = p.userId || p.id;
                    const row = Math.floor(k / itemsPerRow);
                    const col = k % itemsPerRow;

                    const itemsThisRow = Math.min(toDisplay.length - row * itemsPerRow, itemsPerRow);
                    const rowWidth = itemsThisRow * cellW + (itemsThisRow - 1) * gapX;
                    const rowStartX = boxLeft + (boxW - rowWidth) / 2;
                    const cellX = rowStartX + col * (cellW + gapX);
                    const cellY = rowsTop + row * (cellH + gapY);

                    keptIds.add(pId);
                    const existing = existingClones.get(pId);

                    const expectedRenderMode = spec.backgroundImage ? 'image' : 'shape';
                    const cardRenderMatches = existing
                        && existing.cardRenderMode === expectedRenderMode
                        && existing.cardRenderKey === spec.templateKey;
                    const needsBackgroundParts = !spec.backgroundImage && Array.isArray(spec.backgroundParts) && spec.backgroundParts.length > 0;
                    const backgroundPartsMatch = !needsBackgroundParts || (
                        existing
                        && existing.backgroundParts
                        && existing.backgroundParts.length === spec.backgroundParts.length
                        && spec.backgroundParts.every((_, index) => !!existing.backgroundParts[index])
                    );
                    const canReuseExisting = existing && existing.card && existing.icon && existing.name && (!spec.shadow || existing.shadow) && cardRenderMatches && backgroundPartsMatch;

                    if (canReuseExisting) {
                        // Reuse: reposition the participant's existing clone shapes.
                        if (existing.shadow && spec.shadow) {
                            existing.shadow.left = cellX + spec.shadow.dx; existing.shadow.top = cellY + spec.shadow.dy;
                        }
                        if (needsBackgroundParts) {
                            for (let i = 0; i < spec.backgroundParts.length; i++) {
                                const part = spec.backgroundParts[i];
                                const partShape = existing.backgroundParts[i];
                                partShape.left = cellX + part.dx; partShape.top = cellY + part.dy;
                                partShape.width = part.w; partShape.height = part.h;
                            }
                        } else {
                            const cardVisual = spec.backgroundImage || spec.card;
                            existing.card.left = cellX + cardVisual.dx; existing.card.top = cellY + cardVisual.dy;
                            existing.card.width = cardVisual.w; existing.card.height = cardVisual.h;
                        }
                        existing.icon.left = cellX + spec.icon.dx; existing.icon.top = cellY + spec.icon.dy;
                        existing.name.left = cellX + spec.name.dx; existing.name.top = cellY + spec.name.dy;
                    } else {
                        deleteAvatarCloneShapesForParticipant(allCloneShapes, pId, deletedIds);
                        createAvatarClone(slide, spec, geomName, p, pId, cellX, cellY);
                    }
                }

                // Delete orphans (participants no longer present).
                for (const sh of allCloneShapes) {
                    if (deletedIds.has(sh.id)) continue;
                    const pid = getTag(sh, 'participant-id');
                    if (!pid || !keptIds.has(pid)) { try { sh.delete(); } catch (e) { /* ignore */ } }
                }

                try { boundingShape.textFrame.textRange.text = ''; } catch (e) { /* ignore */ }
                await context.sync();
            }
        });
    } catch (error) {
        console.error('❌ Error updating participants list:', error);
    }
}
