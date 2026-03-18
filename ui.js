class UiHelper {

    static fileInput = null;

    static openFile(callback) {
        if (UiHelper.fileInput === null) {
            let el = document.createElement("input");
            el.type = "file";
            el.style.display = "none";
            document.body.appendChild(el);
            console.log(el);
            UiHelper.fileInput = el;
        }
        UiHelper.fileInput.onchange = (ev) => {
            if (ev.target.files.length !== 1)
                return;
            callback(ev.target.files[0]);
        };
        UiHelper.fileInput.click();
    }

    static loadImage(url, cb) {
        let image = new Image();
        image.onload = () => {
            cb(image);
        };
        image.src = url;
    }

    static saveBlob(blob, name) {
        let url = URL.createObjectURL(blob);
        let link = document.createElement("a"); // Or maybe get it from the current document
        link.href = url;
        link.download = name;
        link.innerHTML = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 20000);
    }

    // https://stackoverflow.com/a/8472700
    static generateUUID =
        (typeof (window.crypto) != 'undefined' && typeof (window.crypto.getRandomValues) != 'undefined')
            ? () => {
                let buf = new Uint16Array(8);
                window.crypto.getRandomValues(buf);
                let pad4 = function (num) {
                    let ret = num.toString(16);
                    while (ret.length < 4)
                        ret = "0" + ret;
                    return ret;
                };
                return (pad4(buf[0]) + pad4(buf[1]) + "-" + pad4(buf[2]) + "-" + pad4(buf[3]) + "-" + pad4(buf[4]) + "-" + pad4(buf[5]) + pad4(buf[6]) + pad4(buf[7]));
            }
            : () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            };

    // https://stackoverflow.com/questions/5666222/3d-line-plane-intersection
    static linePlaneIntersection(planePoint, planeNormal, linePoint, lineDirection) {
        if (vec3.dot(planeNormal, lineDirection) === 0)
            return null;
        let t = (vec3.dot(planeNormal, planePoint) - vec3.dot(planeNormal, linePoint)) / vec3.dot(planeNormal, lineDirection);
        let ret = vec3.create();
        vec3.scale(ret, lineDirection, t);
        vec3.add(ret, linePoint, ret);
        return ret;
    }

}

class PropertyEditor {

    constructor() {
        this.container = document.getElementById("inspector");
    }

    clear() {
        let defaultActions = document.getElementById("inspectDefaultActions");
        while (this.container.firstChild)
            this.container.removeChild(this.container.lastChild);
        this.container.appendChild(defaultActions);
    }

    addVecF(name, initialValue, cb) {
        let li = document.createElement("li");
        li.classList.add("prop-vec" + initialValue.length);
        let nameDom = document.createElement("span");
        nameDom.textContent = name;
        li.appendChild(nameDom);
        let value = [...initialValue];
        let tbs = [];
        for (let i = 0; i < initialValue.length; i++) {
            let tb = document.createElement("input");
            tb.type = "text";
            tb.value = value[i];
            tb.addEventListener("change", () => {
                value[i] = parseFloat(tb.value);
                cb([...value]);
            });
            li.appendChild(tb);
            tbs.push(tb);

            let leftArrow = document.createElement("span");
            leftArrow.classList.add("drag-arrow", "left");
            leftArrow.textContent = "◀";
            li.appendChild(leftArrow);
            this.setupDragArrow(leftArrow, tb, value, i, cb, -1);

            let rightArrow = document.createElement("span");
            rightArrow.classList.add("drag-arrow", "right");
            rightArrow.textContent = "▶";
            li.appendChild(rightArrow);
            this.setupDragArrow(rightArrow, tb, value, i, cb, 1);
        }
        this.container.appendChild(li);
        return (v) => {
            for (let i = 0; i < tbs.length; i++) {
                value[i] = v[i];
                tbs[i].value = v[i];
            }
        };
    }

    addDropDown(name, values, displayValues, defaultValue, cb) {
        let li = document.createElement("li");
        let nameDom = document.createElement("span");
        nameDom.textContent = name;
        li.appendChild(nameDom);
        let selectDom = document.createElement("select");
        for (let i = 0; i < values.length; i++) {
            let el = document.createElement("option");
            el.textContent = displayValues[i];
            el.value = values[i];
            selectDom.appendChild(el);
        }
        selectDom.value = defaultValue;
        selectDom.addEventListener("change", () => {
            cb(selectDom.value);
        });
        li.appendChild(selectDom);
        this.container.appendChild(li);
    }

    setupDragArrow(arrow, tb, value, index, cb, direction) {
        let capturedPointerId = -1;
        let dragging = false;
        let startX = 0;
        let startValue = 0;
        arrow.addEventListener("pointerdown", (ev) => {
            ev.preventDefault();
            capturedPointerId = ev.pointerId;
            arrow.setPointerCapture(ev.pointerId);
            dragging = true;
            startX = ev.clientX;
            startValue = value[index];
        });
        const onPointerMove = (ev) => {
            if (!dragging || ev.pointerId !== capturedPointerId) return;
            let deltaX = ev.clientX - startX;
            let sensitivity = 0.1;
            value[index] = startValue + deltaX * sensitivity * direction;
            tb.value = value[index];
            cb([...value]);
        };
        const onPointerUp = (ev) => {
            if (ev.pointerId !== capturedPointerId) return;
            dragging = false;
            capturedPointerId = -1;
            arrow.releasePointerCapture(ev.pointerId);
        };
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
    }

}

class PrimaryCanvas {

    constructor() {
        this.canvas = document.getElementById("primaryCanvas");
        this.context = this.canvas.getContext("webgl");
        this.renderer = new Renderer(this.canvas, this.context);
        this.renderer.bgColor = [0x10 / 256, 0x1f / 256, 0x27 / 256, 1];
        this.renderer.draw();
        this.canvas.addEventListener("mousemove", (ev) => {
            if (ev.buttons & 1)
                this.rotateByMouseDelta(ev.movementX, ev.movementY);
        });

        window.addEventListener('resize', () => this.draw(), false);
        this.drawCallbacks = [];
    }

    setModel(model) {
        this.renderer.setModel(model);
        this.draw();
    }

    setTexture(image) {
        this.renderer.setTexture(image);
        this.draw();
    }

    setSelectedGroup(group) {
        if (group !== null) {
            this.renderer.highlightedVertexStart = group.vertexStart;
            this.renderer.highlightedVertexEnd = group.vertexEnd;
        } else {
            this.renderer.highlightedVertexStart = -1;
            this.renderer.highlightedVertexEnd = -1;
        }
        this.draw();
    }

    rotateByMouseDelta(dx, dy) {
        this.renderer.rotationX += dx * 0.01;
        this.renderer.rotationY += dy * 0.01;
        this.draw();
    }

    draw() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

        this.renderer.draw();
        for (let cb of this.drawCallbacks)
            cb();
    }

}

class Point3DMover {

    constructor(primaryCanvas) {
        this.container = document.getElementById("point3DMover");
        this.axisX = document.getElementById("point3DMoverX");
        this.axisY = document.getElementById("point3DMoverY");
        this.axisZ = document.getElementById("point3DMoverZ");
        this.primaryCanvas = primaryCanvas;
        this.relativeTo = this.primaryCanvas.canvas;
        this.point = null;
        this.callback = null;
        this.primaryCanvas.drawCallbacks.push(() => this.setPoint(this.point, this.callback));
        this.setupAxis(this.axisX, 0);
        this.setupAxis(this.axisY, 1);
        this.setupAxis(this.axisZ, 2);
    }

    setupAxis(dom, axisNo) {
        let findWorldPosition = (x, y) => {
            let sp = this.primaryCanvas.renderer.sceneToScreen(this.point);
            let spb1 = this.primaryCanvas.renderer.screenToScene([sp[0], sp[1], -1]);
            let spb2 = this.primaryCanvas.renderer.screenToScene([sp[0], sp[1], 1]);
            vec4.sub(spb2, spb2, spb1);
            vec4.normalize(spb2, spb2);

            let p1 = this.primaryCanvas.renderer.screenToScene([x, y, -1]);
            let p2 = this.primaryCanvas.renderer.screenToScene([x, y, 1]);
            vec4.sub(p2, p2, p1);
            vec4.normalize(p2, p2);
            return UiHelper.linePlaneIntersection(this.point, spb2, p1, p2);
        };
        let offset = [0, 0, 0];
        let capturedPointerId = -1;
        dom.addEventListener("pointerdown", (ev) => {
            capturedPointerId = ev.pointerId;
            dom.setPointerCapture(ev.pointerId);

            let x = ev.pageX - this.relativeTo.offsetLeft;
            let y = ev.pageY - this.relativeTo.offsetTop;
            offset = findWorldPosition(x, y);
            vec3.sub(offset, offset, this.point);
        });
        dom.addEventListener("pointermove", (ev) => {
            if (this.callback !== null && ev.pointerId === capturedPointerId) {
                let x = ev.pageX - this.relativeTo.offsetLeft;
                let y = ev.pageY - this.relativeTo.offsetTop;
                let p = findWorldPosition(x, y);
                vec3.sub(p, p, offset);
                this.point[axisNo] = p[axisNo];

                this.callback(this.point);
                this.setPoint(this.point, this.callback);
            }
        });
        dom.addEventListener("pointerup", (ev) => {
            capturedPointerId = -1;
            dom.releasePointerCapture(ev.pointerId);
        });
    }

    setAxis(dom, sp, spDir, depth) {
        let diff = vec2.create();
        vec2.sub(diff, spDir, sp);
        let angle = Math.atan2(diff[1], diff[0]);
        dom.style.transform = "rotate(" + (angle / Math.PI * 180) + "deg)";
        dom.style.width = vec2.length(diff) + "px";
        dom.style.zIndex = depth + 100;
    }

    setPoint(p, cb) {
        this.point = p;
        this.callback = cb;
        if (p === null) {
            this.container.style.display = "none";
            return;
        }
        this.container.style.display = "block";
        this.container.style.pointerEvents = "none";
        let sp = this.primaryCanvas.renderer.sceneToScreen(p);
        let spX = this.primaryCanvas.renderer.sceneToScreen([p[0] + 3, p[1], p[2]]);
        let spY = this.primaryCanvas.renderer.sceneToScreen([p[0], p[1] + 3, p[2]]);
        let spZ = this.primaryCanvas.renderer.sceneToScreen([p[0], p[1], p[2] + 3]);
        let depthTmp = [[spX[2], 0], [spY[2], 1], [spZ[2], 2]];
        depthTmp.sort();
        let depth = [0, 1, 2];
        for (let i = 0; i < 3; i++)
            depth[depthTmp[i][1]] = 2 - i;

        this.setAxis(this.axisX, sp, spX, depth[0]);
        this.setAxis(this.axisY, sp, spY, depth[1]);
        this.setAxis(this.axisZ, sp, spZ, depth[2]);

        sp[0] += this.relativeTo.offsetLeft;
        sp[1] += this.relativeTo.offsetTop;
        this.container.style.left = sp[0] + "px";
        this.container.style.top = sp[1] + "px";
    }

}

class GroupList {

    static TYPE_BONE = "bone";
    static TYPE_GROUP = "group";

    constructor(selectCallback) {
        this.container = document.getElementById("groupTree");
        this.container.tabIndex = 0; // allow keyboard focus for shortcuts
        this.container.addEventListener("click", (ev) => {
            if (ev.target === this.container)
                this.clearSelection();
            this.container.focus();
        });
        this.container.addEventListener("keydown", (ev) => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
                ev.preventDefault();
                this.selectAll();
            } else if (ev.key === "Escape") {
                this.clearSelection();
            }
        });

        this.selectCallback = selectCallback;
        this.selectionType = null;
        this.selection = null;
        this.selectionMap = {};
        this.selectionMap[GroupList.TYPE_BONE] = new Map();
        this.selectionMap[GroupList.TYPE_GROUP] = new Map();
        this.elementToItem = new Map();
        this.selectedElements = new Set();
        this.selectedElement = null;
        this.lastSelectedIndex = null;

        this.objects = [];
        this.bones = [];
        this.collapsedBones = new Set();
    }

    setObjects(objects, bones) {
        this.objects = objects;
        this.bones = bones;

        // Clear old groups
        while (this.container.firstChild)
            this.container.removeChild(this.container.lastChild);
        this.selectedElements.clear();
        this.selectedElement = null;
        this.elementToItem.clear();

        this.selectionMap[GroupList.TYPE_BONE].clear();
        this.selectionMap[GroupList.TYPE_GROUP].clear();

        // Build bone map and depth
        let boneMap = new Map();
        for (let bone of bones) {
            boneMap.set(bone.name, bone);
        }
        let depthMap = new Map();
        for (let bone of bones) {
            depthMap.set(bone.name, this.getDepth(bone, boneMap));
        }

        let index = 0;
        for (let boneIdx = 0; boneIdx < bones.length; boneIdx++) {
            let bone = bones[boneIdx];
            let depth = depthMap.get(bone.name);
            let boneEl = this.createBoneDOM(bone, boneIdx, index++, depth);
            this.selectionMap[GroupList.TYPE_BONE].set(bone, boneEl);
            this.container.appendChild(boneEl);

            const collapsed = this.collapsedBones.has(bone);
            for (let groupIdx = 0; groupIdx < bone.groups.length; groupIdx++) {
                let groupRef = bone.groups[groupIdx];
                let group = objects[groupRef[0]].groups[groupRef[1]];
                let groupEl = this.createGroupDOM(group, boneIdx, groupIdx, index++, depth + 1);
                this.selectionMap[GroupList.TYPE_GROUP].set(group, groupEl);
                groupEl.style.paddingLeft = ((depth + 1) * 20) + "px";
                groupEl.style.display = collapsed ? "none" : "";
                this.container.appendChild(groupEl);
            }
        }
        this.setSelection(this.selectionType, this.selection);
    }

    getDepth(bone, boneMap, visited = new Set()) {
        if (visited.has(bone.name)) return 0;
        visited.add(bone.name);
        if (!bone.parent) return 0;
        const parent = boneMap.get(bone.parent);
        if (!parent) return 0;
        return this.getDepth(parent, boneMap, visited) + 1;
    }

    setSelection(type, object) {
        this.selectedElements.clear();
        this.selectedElement = null;
        this.lastSelectedIndex = null;

        this.selectionType = type;
        this.selection = object;

        if (type !== null && object !== null) {
            const el = this.selectionMap[type].get(object);
            if (el !== undefined && el !== null) {
                this.selectedElements.add(el);
                this.selectedElement = el;
                const info = this.elementToItem.get(el);
                if (info)
                    this.lastSelectedIndex = info.index;
            }
        }

        this.updateSelectionVisuals();
        const primary = this.selectedElement ? this.elementToItem.get(this.selectedElement) : null;
        this.selectCallback(primary ? primary.type : null, primary ? primary.object : null, this.getSelectedItems());
    }

    clearSelection() {
        this.selectedElements.clear();
        this.selectedElement = null;
        this.lastSelectedIndex = null;
        this.updateSelectionVisuals();
        this.selectCallback(null, null, []);
    }

    selectAll() {
        this.selectedElements.clear();
        let first = null;
        for (let [el] of this.elementToItem) {
            this.selectedElements.add(el);
            if (!first)
                first = el;
        }
        this.selectedElement = first;
        if (first) {
            const info = this.elementToItem.get(first);
            this.lastSelectedIndex = info ? info.index : null;
        }
        this.updateSelectionVisuals();
        const primary = this.selectedElement ? this.elementToItem.get(this.selectedElement) : null;
        this.selectCallback(primary ? primary.type : null, primary ? primary.object : null, this.getSelectedItems());
    }

    updateSelectionVisuals() {
        for (let child of this.container.children) {
            child.classList.toggle("selected", this.selectedElements.has(child));
        }
    }

    getSelectedItems() {
        let items = [];
        for (let el of this.selectedElements) {
            const info = this.elementToItem.get(el);
            if (info)
                items.push(info);
        }
        return items;
    }

    toggleBoneCollapse(bone) {
        if (this.collapsedBones.has(bone))
            this.collapsedBones.delete(bone);
        else
            this.collapsedBones.add(bone);

        // Re-render to apply collapse changes
        this.setObjects(this.objects, this.bones);
    }

    createBoneDOM(bone, boneIndex, index, depth) {
        let e = document.createElement("li");
        e.classList.add("bone");
        e.dataset.boneIndex = boneIndex;
        e.dataset.index = index;
        e.style.paddingLeft = (depth * 20) + "px";

        let expander = document.createElement("span");
        expander.classList.add("expander");
        const hasChildren = bone.groups && bone.groups.length > 0;
        expander.textContent = hasChildren ? (this.collapsedBones.has(bone) ? "▶" : "▼") : "";
        if (!hasChildren)
            expander.classList.add("expander-empty");
        e.appendChild(expander);

        let folder = document.createElement("span");
        folder.classList.add("folderIcon");
        e.appendChild(folder);

        let text = document.createElement("span");
        text.textContent = bone.name;
        e.appendChild(text);

        this.elementToItem.set(e, { type: GroupList.TYPE_BONE, object: bone, index });

        e.addEventListener("click", (ev) => this.onItemClick(ev, e));

        e.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            e.classList.add("drop-target");
        });

        e.addEventListener("dragleave", () => {
            e.classList.remove("drop-target");
        });

        e.addEventListener("drop", (ev) => {
            ev.preventDefault();
            e.classList.remove("drop-target");
            const payload = ev.dataTransfer.getData("application/json");
            if (!payload)
                return;
            let data;
            try {
                data = JSON.parse(payload);
            } catch (err) {
                return;
            }
            if (data.type !== "groups")
                return;
            const toBone = bone;
            // Sort groups by groupIdx descending to remove from highest first
            data.groups.sort((a, b) => b.groupIdx - a.groupIdx);
            for (let g of data.groups) {
                const fromBone = this.bones[g.boneIndex];
                if (!fromBone || fromBone === toBone)
                    continue;
                const groupRef = fromBone.groups[g.groupIdx];
                if (!groupRef)
                    continue;
                fromBone.groups.splice(g.groupIdx, 1);
                if (!toBone.groups)
                    toBone.groups = [];
                toBone.groups.push(groupRef);
                // update group.bone
                const group = this.objects[groupRef[0]].groups[groupRef[1]];
                if (group) group.bone = toBone;
            }
            this.setObjects(this.objects, this.bones);
            this.selectCallback(GroupList.TYPE_BONE, toBone, []);
        });

        return e;
    }

    createGroupDOM(group, boneIndex, groupIdx, index, depth) {
        let e = document.createElement("li");
        e.classList.add("group");
        e.dataset.boneIndex = boneIndex;
        e.dataset.groupIndex = groupIdx;
        e.dataset.index = index;

        let icon = document.createElement("span");
        icon.classList.add("groupIcon");
        e.appendChild(icon);

        let text = document.createElement("span");
        text.textContent = group.displayName;
        e.appendChild(text);

        this.elementToItem.set(e, { type: GroupList.TYPE_GROUP, object: group, index, boneIndex, groupIdx, bone: this.bones[boneIndex] });

        e.addEventListener("click", (ev) => this.onItemClick(ev, e));

        e.setAttribute("draggable", "true");
        e.addEventListener("dragstart", (ev) => {
            let groups = [];
            for (let selEl of this.selectedElements) {
                const info = this.elementToItem.get(selEl);
                if (info && info.type === GroupList.TYPE_GROUP) {
                    groups.push({ boneIndex: info.boneIndex, groupIdx: info.groupIdx });
                }
            }
            if (groups.length === 0) {
                // if none selected, drag this one
                groups = [{ boneIndex, groupIdx }];
            }
            ev.dataTransfer.setData("application/json", JSON.stringify({
                type: "groups",
                groups
            }));
            ev.dataTransfer.effectAllowed = "move";
        });

        return e;
    }

    onItemClick(ev, el) {
        const info = this.elementToItem.get(el);
        if (!info)
            return;

        // If clicking expander on bone, just toggle collapse
        if (info.type === GroupList.TYPE_BONE && ev.target.classList.contains("expander")) {
            this.toggleBoneCollapse(info.object);
            return;
        }

        const ctrl = ev.ctrlKey || ev.metaKey;
        const shift = ev.shiftKey;

        if (shift && this.lastSelectedIndex !== null) {
            const from = Math.min(this.lastSelectedIndex, info.index);
            const to = Math.max(this.lastSelectedIndex, info.index);
            this.selectedElements.clear();
            for (let [itemEl, itemInfo] of this.elementToItem) {
                if (itemInfo.index >= from && itemInfo.index <= to)
                    this.selectedElements.add(itemEl);
            }
            this.selectedElement = el;
        } else if (ctrl) {
            if (this.selectedElements.has(el))
                this.selectedElements.delete(el);
            else
                this.selectedElements.add(el);
            this.selectedElement = el;
        } else {
            this.selectedElements.clear();
            this.selectedElements.add(el);
            this.selectedElement = el;
        }

        this.lastSelectedIndex = info.index;
        this.updateSelectionVisuals();
        const primary = this.selectedElement ? this.elementToItem.get(this.selectedElement) : null;
        this.selectCallback(primary ? primary.type : null, primary ? primary.object : null, this.getSelectedItems());
    }

    createElementDOM(type, object, name, index) {
        let e = document.createElement("li");
        let text = document.createElement("span");
        text.textContent = name;
        this.elementToItem.set(e, { type, object, index });
        e.addEventListener("click", (ev) => this.onItemClick(ev, e));
        e.appendChild(text);
        return e;
    }

}

class Skin {

    constructor(index) {
        this.index = index;
        this.image = null;
        this.imageUrl = null;
        this.model = null;
        this.modelStr = null;
        this.bones = [];
        this.updateCb = new Set();
        this.savePropertiesRequested = false;
    }

    loadFromLS() {
        this.setImage(localStorage.getItem("skin." + this.index + ".image"));
        this.modelStr = localStorage.getItem("skin." + this.index + ".model");
        this.model = this.modelStr ? ObjModel.parse(this.modelStr) : null;

        this.bones = JSON.parse(localStorage.getItem("skin." + this.index + ".bones"));
        if (this.bones === null || this.bones.length === 0)
            this.resetBones();
        else if (this.model !== null)
            this.assignBoneInfoToGroups();

        this.onUpdated();
    }

    setImage(url) {
        this.imageUrl = url;
        if (url == null) {
            this.image = null;
            return;
        }
        UiHelper.loadImage(url, (img) => {
            if (this.imageUrl !== url)
                return;
            this.image = img;
            this.onUpdated();
        });
    }

    setModel(model) {
        this.modelStr = model;
        this.model = ObjModel.parse(model);
        this.resetBones();
        this.assignBoneInfoToGroups();
    }

    resetBones() {
        this.bones = SharedData.createDefaultBones();
        for (let b of this.bones)
            b.groups = [];
        if (this.model !== null) {
            let mainBone = this.bones[1];
            for (let i = 0; i < this.model.objects.length; i++) {
                let object = this.model.objects[i];
                for (let j = 0; j < object.groups.length; j++)
                    mainBone.groups.push([i, j]);
            }
        }
    }

    assignBoneInfoToGroups() {
        for (let i = 0; i < this.model.objects.length; i++) {
            let o = this.model.objects[i];
            o.index = i;
            for (let j = 0; j < o.groups.length; j++) {
                o.groups[j].object = o;
                o.groups[j].index = j;
            }
        }
        for (let b of this.bones) {
            for (let gRef of b.groups) {
                let group = this.model.objects[gRef[0]].groups[gRef[1]];
                group.bone = b;
                group.indexTab = gRef;
            }
        }
    }

    deleteFromLS() {
        localStorage.removeItem("skin." + this.index + ".image");
        localStorage.removeItem("skin." + this.index + ".model");
        localStorage.removeItem("skin." + this.index + ".bones");
    }

    saveImageToLS() {
        if (this.imageUrl !== null)
            localStorage.setItem("skin." + this.index + ".image", this.imageUrl);
    }

    saveModelToLS() {
        if (this.modelStr !== null)
            localStorage.setItem("skin." + this.index + ".model", this.modelStr);
    }

    saveBonesToLS() {
        localStorage.setItem("skin." + this.index + ".bones", JSON.stringify(this.bones));
    }

    postSaveProperties() {
        if (this.savePropertiesRequested)
            return;
        this.savePropertiesRequested = true;
        setTimeout(() => {
            this.saveBonesToLS();
            this.savePropertiesRequested = false;
        }, 1000);
    }

    exportGeometry() {
        if (this.image === null || this.model === null)
            return null;
        let bones = [];
        for (let b of this.bones) {
            let bCopy = Object.assign({}, b);
            delete bCopy["groups"];
            let indices = [];
            for (let gidx of b.groups) {
                let g = this.model.objects[gidx[0]].groups[gidx[1]];
                this.model.getMinecraftIndices(indices, g.start, g.end);
            }
            let mesh = this.model.exportPolyMesh(indices);
            if (mesh !== null)
                bCopy["poly_mesh"] = mesh;
            if (bCopy.hasOwnProperty("pivot"))
                bCopy["pivot"] = [-b.pivot[0], b.pivot[1], b.pivot[2]];
            bones.push(bCopy);
        }
        return {
            "bones": bones,
            "texturewidth": this.image.width,
            "textureheight": this.image.height
        };
    }

    onUpdated() {
        for (let cb of this.updateCb)
            cb(this);
    }

}

class SkinListUi {

    constructor(activeCallback) {
        this.skinList = [];
        this.skinDomList = [];
        this.selectedSkinDom = null;
        this.selectedSkinDoms = new Set();
        this.lastSelectedSkinIndex = null;
        this.container = document.getElementById("skins");
        this.container.tabIndex = 0; // allow keyboard focus for shortcuts
        this.container.addEventListener("click", (ev) => {
            if (ev.target === this.container)
                this.setSelected(null);
            this.container.focus();
        });
        this.container.addEventListener("keydown", (ev) => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "a") {
                ev.preventDefault();
                this.selectAll();
            } else if (ev.key === "Escape") {
                this.setSelected(null);
            }
        });

        this.container.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            const target = ev.target.closest("li.skin");
            for (let dom of this.skinDomList)
                dom.classList.remove("drop-before", "drop-after");
            if (!target || !this.skinDomList.includes(target))
                return;
            const rect = target.getBoundingClientRect();
            const before = (ev.clientY - rect.top) < (rect.height / 2);
            target.classList.add(before ? "drop-before" : "drop-after");
        });

        this.container.addEventListener("dragleave", () => {
            for (let dom of this.skinDomList)
                dom.classList.remove("drop-before", "drop-after");
        });

        this.container.addEventListener("drop", (ev) => {
            ev.preventDefault();
            const fromIndex = parseInt(ev.dataTransfer.getData("text/plain"), 10);
            const target = ev.target.closest("li.skin");
            if (isNaN(fromIndex) || !target)
                return;
            const toIndex = this.skinDomList.indexOf(target);
            if (toIndex === -1)
                return;
            const rect = target.getBoundingClientRect();
            const before = (ev.clientY - rect.top) < (rect.height / 2);
            this.reorderSkins(fromIndex, before ? toIndex : toIndex + 1);
            for (let dom of this.skinDomList)
                dom.classList.remove("drop-before", "drop-after");
        });

        this.renderCanvas = document.createElement("canvas");
        this.renderCanvas.style.display = "none";
        this.renderCanvas.width = 64;
        this.renderCanvas.height = 64;
        this.renderContext = this.renderCanvas.getContext("webgl", { preserveDrawingBuffer: true });
        this.renderer = new Renderer(this.renderCanvas, this.renderContext);
        this.renderer.bgColor = [0, 0, 0, 0];
        this.skinUpdateCb = (skin) => this.redrawSkin(skin);
        this.activeCallback = activeCallback;
    }

    setSkinList(skinList) {
        let exportBtn = document.getElementById("export");
        let addSkinBtn = document.getElementById("addSkin");
        while (this.container.firstChild)
            this.container.removeChild(this.container.lastChild);
        for (let skin of this.skinList)
            skin.updateCb.delete(this.skinUpdateCb);
        this.skinList = skinList;
        this.skinDomList = [];
        this.selectedSkinDom = null;
        this.selectedSkinDoms.clear();
        this.lastSelectedSkinIndex = null;
        for (let skin of skinList) {
            let dom = this.createEntryDOM(skin);
            this.skinDomList.push(dom);
            this.container.appendChild(dom);
            skin.updateCb.add(this.skinUpdateCb);
        }
        this.container.appendChild(addSkinBtn);
        this.container.appendChild(exportBtn);
        for (let skin of skinList)
            this.redrawSkin(skin);
    }

    redrawSkin(skin) {
        if (skin.index >= this.skinList.length || this.skinList[skin.index] !== skin)
            return;
        this.renderer.setModel(skin.model);
        this.renderer.setTexture(skin.image);
        this.renderer.draw();
        console.log(this.renderCanvas.toDataURL());
        this.skinDomList[skin.index].img.src = this.renderCanvas.toDataURL();
    }

    setSelected(skin) {
        if (skin && (skin.index >= this.skinList.length || this.skinList[skin.index] !== skin))
            skin = null;

        this.selectedSkinDoms.clear();
        this.selectedSkinDom = skin ? this.skinDomList[skin.index] : null;
        if (this.selectedSkinDom !== null)
            this.selectedSkinDoms.add(this.selectedSkinDom);
        this.lastSelectedSkinIndex = skin ? skin.index : null;
        this.updateSelectionVisuals();
    }

    selectAll() {
        this.selectedSkinDoms.clear();
        for (let dom of this.skinDomList)
            this.selectedSkinDoms.add(dom);
        if (this.skinDomList.length > 0)
            this.lastSelectedSkinIndex = this.skinDomList.length - 1;
        this.updateSelectionVisuals();
        if (this.skinList.length > 0)
            this.activeCallback(this.skinList[this.lastSelectedSkinIndex]);
    }

    updateSelectionVisuals() {
        for (let dom of this.skinDomList) {
            dom.classList.toggle("selected", this.selectedSkinDoms.has(dom));
        }
    }

    createEntryDOM(skin) {
        let el = document.createElement("li");
        el.classList.add("skin");
        el.setAttribute("draggable", "true");
        el.dataset.skinIndex = this.skinDomList.length;

        let handle = document.createElement("span");
        handle.classList.add("dragHandle");
        handle.title = "Drag to reorder";
        handle.textContent = "☰";
        el.appendChild(handle);

        el.img = document.createElement("img");
        el.appendChild(el.img);

        el.addEventListener("dragstart", (ev) => {
            ev.dataTransfer.setData("text/plain", this.skinDomList.indexOf(el));
            ev.dataTransfer.effectAllowed = "move";
            el.classList.add("dragging");
        });
        el.addEventListener("dragend", () => {
            el.classList.remove("dragging");
        });

        el.addEventListener("click", (ev) => {
            const isCtrl = ev.ctrlKey || ev.metaKey;
            const isShift = ev.shiftKey;
            const index = this.skinDomList.indexOf(el);
            if (isShift && this.lastSelectedSkinIndex !== null) {
                const from = Math.min(this.lastSelectedSkinIndex, index);
                const to = Math.max(this.lastSelectedSkinIndex, index);
                this.selectedSkinDoms.clear();
                for (let i = from; i <= to; i++)
                    this.selectedSkinDoms.add(this.skinDomList[i]);
            } else if (isCtrl) {
                if (this.selectedSkinDoms.has(el))
                    this.selectedSkinDoms.delete(el);
                else
                    this.selectedSkinDoms.add(el);
            } else {
                this.selectedSkinDoms.clear();
                this.selectedSkinDoms.add(el);
            }
            this.lastSelectedSkinIndex = index;
            this.updateSelectionVisuals();
            this.activeCallback(skin);
        });
        return el;
    }

    reorderSkins(fromIndex, toIndex) {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0)
            return;

        const skin = this.skinList.splice(fromIndex, 1)[0];
        const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
        this.skinList.splice(insertIndex, 0, skin);

        // Update indexes and save to localStorage
        for (let i = 0; i < this.skinList.length; i++) {
            this.skinList[i].index = i;
            this.skinList[i].saveImageToLS();
            this.skinList[i].saveModelToLS();
            this.skinList[i].saveBonesToLS();
        }
        localStorage.setItem("skin.count", this.skinList.length);

        // Re-render and keep selection based on skin objects
        const selectedSkins = new Set();
        for (let dom of this.selectedSkinDoms) {
            const idx = this.skinDomList.indexOf(dom);
            if (idx >= 0)
                selectedSkins.add(this.skinList[idx]);
        }

        this.setSkinList(this.skinList);

        this.selectedSkinDoms.clear();
        for (let i = 0; i < this.skinList.length; i++) {
            if (selectedSkins.has(this.skinList[i]))
                this.selectedSkinDoms.add(this.skinDomList[i]);
        }
        this.updateSelectionVisuals();
    }

}

class PropertyManager {

    constructor(editor, pointMover, primaryCanvas) {
        this.editor = editor;
        this.skin = null;
        this.selectionType = null;
        this.selection = null;
        this.boneChangeCallback = null;
        this.pointMover = pointMover;
        this.primaryCanvas = primaryCanvas;
    }

    setSkin(skin) {
        this.skin = skin;
    }

    setSelection(type, what, selectedItems = []) {
        this.selectionType = type;
        this.selection = what;
        this.selectedItems = selectedItems;
    }

    update() {
        this.editor.clear();
        if (this.skin !== null) {
            this.createSkinProperties(this.skin);
        }

        const bones = this.getSelectedBones();
        if (bones.length > 0) {
            this.createBoneProperties(bones);
        }

        const groups = this.getSelectedGroups();
        if (groups.length > 0) {
            this.createGroupProperties(groups);
        }
    }

    getSelectedBones() {
        if (!this.selectedItems)
            return [];
        let bones = [];
        for (let item of this.selectedItems) {
            if (item.type === GroupList.TYPE_BONE) {
                bones.push(item.object);
            } else if (item.type === GroupList.TYPE_GROUP) {
                bones.push(item.bone);
            }
        }
        // keep unique
        return bones.filter((b, i) => bones.indexOf(b) === i);
    }

    getSelectedGroups() {
        if (!this.selectedItems)
            return [];
        return this.selectedItems
            .filter((item) => item.type === GroupList.TYPE_GROUP)
            .map((item) => item.object);
    }

    createSkinProperties(skin) {
    }

    createBoneProperties(bones) {
        let bone = bones[0];
        let updatePoint = null;
        let updateVecF = this.editor.addVecF("Pivot", bone.pivot, (val) => {
            for (let b of bones) {
                b.pivot = val;
            }
            if (updatePoint !== null)
                updatePoint();
            this.skin.postSaveProperties();
        });
        updatePoint = () => this.pointMover.setPoint(bone.pivot, (p) => {
            for (let b of bones) {
                b.pivot = p;
            }
            updateVecF(p);
            this.skin.postSaveProperties();
            this.primaryCanvas.renderer.draw();
        });
        updatePoint();
    }

    createGroupProperties(groups) {
        let boneNames = this.skin.bones.map((b) => b.name);
        let primaryGroup = groups[0];
        let boneName = primaryGroup.bone ? primaryGroup.bone.name : (boneNames[0] || "Unknown");
        this.editor.addDropDown("Bone", boneNames, boneNames, boneName, (newBoneName) => {
            let newBone = this.skin.bones.find((b) => b.name === newBoneName);
            if (!newBone)
                return;

            for (let group of groups) {
                if (!group.bone) continue;
                let oldBone = group.bone;
                let iof = oldBone.groups.indexOf(group.indexTab);
                if (iof !== -1)
                    oldBone.groups.splice(iof, 1);
                group.bone = newBone;
                newBone.groups.push(group.indexTab);
            }
            this.skin.postSaveProperties();
            this.boneChangeCallback();
        });
    }

}

class UiManager {

    constructor() {
        this.skins = [];
        this.activeSkin = null;
        this.primaryCanvas = new PrimaryCanvas();
        this.skinListUi = new SkinListUi((skin) => this.setSkin(skin));
        this.propEditor = new PropertyEditor();
        this.pointMover = new Point3DMover(this.primaryCanvas);
        this.propManager = new PropertyManager(this.propEditor, this.pointMover, this.primaryCanvas);
        this.groupList = new GroupList((type, g, selectedItems) => {
            if (type === GroupList.TYPE_GROUP)
                this.primaryCanvas.setSelectedGroup(g);
            else
                this.primaryCanvas.setSelectedGroup(null);

            this.propManager.setSelection(type, g, selectedItems);
            this.propManager.update();
        });
        this.propManager.boneChangeCallback = () => {
            this.groupList.setObjects(this.activeSkin.model.objects, this.activeSkin.bones);
            this.activeSkin.saveBonesToLS();
        };
        this.defaultImage = null;

        // Use a small local placeholder if no image is provided.
        let placeholder = document.createElement("canvas");
        placeholder.width = 64;
        placeholder.height = 64;
        let ctx = placeholder.getContext("2d");
        ctx.fillStyle = "#333";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#666";
        ctx.fillRect(8, 8, 48, 48);
        this.setDefaultImage(placeholder);

        document.getElementById("uploadModel").addEventListener("click", () => {
            UiHelper.openFile((file) => {
                let reader = new FileReader();
                reader.addEventListener("loadend", () => {
                    if (reader.readyState === FileReader.DONE && this.activeSkin !== null) {
                        this.activeSkin.setModel(reader.result);
                        this.activeSkin.saveModelToLS();
                        this.activeSkin.onUpdated();
                    }
                });
                reader.readAsText(file);
            });
        });
        document.getElementById("uploadTexture").addEventListener("click", () => {
            UiHelper.openFile((file) => {
                let reader = new FileReader();
                reader.addEventListener("loadend", () => {
                    if (reader.readyState === FileReader.DONE && this.activeSkin !== null) {
                        this.activeSkin.setImage(reader.result);
                        this.activeSkin.saveImageToLS();
                    }
                });
                reader.readAsDataURL(file);
            });
        });

        document.getElementById("addSkin").addEventListener("click",
            () => this.setSkin(this.addSkin()));
        document.getElementById("deleteSkin").addEventListener("click",
            () => this.deleteSkin(this.activeSkin));
        document.getElementById("export").addEventListener("click",
            () => {
                const isGeometry = confirm("Export as geometry? (Cancel for full skinpack)");
                this.export(isGeometry);
            });

        this.modelPrompted = false;
        this.loadCurrentSkins((skins) => {
            this.setSkins(skins);
            this.promptForModelIfNeeded();
        });
    }

    setDefaultImage(image) {
        this.defaultImage = image;
        if (this.activeSkin !== null && this.activeSkin.image === null)
            this.setSkin(this.activeSkin);
    }

    setSkin(skin) {
        this.activeSkin = skin;
        if (skin.model !== null) {
            skin.assignBoneInfoToGroups();
            this.groupList.setObjects(skin.model.objects, skin.bones);
        }
        if (skin.image !== null)
            this.primaryCanvas.setTexture(skin.image);
        else
            this.primaryCanvas.setTexture(this.defaultImage);
        this.primaryCanvas.setModel(skin.model);
        this.skinListUi.setSelected(skin);
        this.propManager.setSkin(skin);
        this.propManager.update();
        this.skinListUi.container.focus();
        this.promptForModelIfNeeded();
    }

    createSkin(index) {
        let skin = new Skin(index);
        skin.updateCb.add(() => {
            if (skin === this.activeSkin)
                this.setSkin(this.activeSkin);
        });
        return skin;
    }

    deleteSkin(skin) {
        skin.deleteFromLS();
        this.skins.splice(skin.index, 1);
        for (let i = skin.index; i < this.skins.length; i++) {
            this.skins[i].deleteFromLS();
            this.skins[i].index = i;
            this.skins[i].saveImageToLS();
            this.skins[i].saveModelToLS();
            this.skins[i].saveBonesToLS();
        }
        skin.index = -1;
        localStorage.setItem("skin.count", this.skins.length);
        this.setSkins(this.skins);
    }

    addSkin() {
        let skin = this.createSkin(this.skins.length);
        this.skins.push(skin);
        localStorage.setItem("skin.count", this.skins.length);
        this.skinListUi.setSkinList(this.skins);
        return skin;
    }

    setSkins(skins) {
        this.skins = skins;
        if (this.skins.length === 0) {
            this.setSkin(this.addSkin());
        } else {
            this.skinListUi.setSkinList(this.skins);
            this.setSkin(this.skins[0]);
        }
    }

    promptForModelIfNeeded() {
        if (this.modelPrompted)
            return;
        if (!this.activeSkin || this.activeSkin.model !== null)
            return;
        this.modelPrompted = true;
        UiHelper.openFile((file) => {
            let reader = new FileReader();
            reader.addEventListener("loadend", () => {
                if (reader.readyState === FileReader.DONE && this.activeSkin !== null) {
                    this.activeSkin.setModel(reader.result);
                    this.activeSkin.saveModelToLS();
                    this.activeSkin.onUpdated();
                }
            });
            reader.readAsText(file);
        });
    }

    loadCurrentSkins(callback) {
        let skinCount = localStorage.getItem("skin.count") || 0;
        let skins = [];
        for (let i = 0; i < skinCount; i++) {
            let skin = this.createSkin(i);
            skin.loadFromLS();
            skins.push(skin);
        }
        callback(skins);
    }

    exportManifest() {
        return {
            "format_version": 2,
            "header": {
                "name": "Custom Skin Pack",
                "uuid": UiHelper.generateUUID(),
                "version": [1, 0, 0]
            },
            "modules": [
                {
                    "type": "skin_pack",
                    "uuid": UiHelper.generateUUID(),
                    "version": [1, 0, 0]
                }
            ]
        };
    }

    exportSkinList() {
        let skins = [];
        for (let skin of this.skins) {
            skins.push({
                "localization_name": "Skin #" + skin.index,
                "geometry": "geometry.n" + skin.index,
                "texture": "skin_" + skin.index + ".png",
                "type": "free"
            });
        }
        return {
            "skins": skins,
            "serialize_name": "Custom Skins",
            "localization_name": "Custom Skins"
        };
    }

    exportGeometry() {
        let result = {
            "format_version": "1.8.0"
        };
        for (let skin of this.skins) {
            let geo = skin.exportGeometry();
            if (geo !== null)
                result["geometry.n" + skin.index] = geo;
        }
        return result;
    }

    export(isGeometry = false) {
        if (isGeometry) {
            const geometry = this.exportGeometry();
            const blob = new Blob(
                [JSON.stringify(geometry, null, 2)],
                { type: "application/json" }
            );
            UiHelper.saveBlob(blob, "geometry.json");
        } else {
            zip.createWriter(new zip.BlobWriter("application/zip"), (writer) => {
                console.log("manifest:", this.exportManifest());
                console.log("skins:", this.exportSkinList());
                console.log("geometry:", this.exportGeometry());

                let textFiles = [
                    ["manifest.json", JSON.stringify(this.exportManifest())],
                    ["skins.json", JSON.stringify(this.exportSkinList())],
                    ["geometry.json", JSON.stringify(this.exportGeometry())]
                ];

                let writeText = (idx, cb) => {
                    if (idx >= textFiles.length) {
                        cb();
                    } else {
                        let fi = textFiles[idx];
                        writer.add(fi[0], new zip.TextReader(fi[1]), () => writeText(idx + 1, cb));
                    }
                };
                let writeSkin = (idx, cb) => {
                    if (idx >= this.skins.length) {
                        cb();
                    } else {
                        writer.add("skin_" + this.skins[idx].index + ".png", new zip.Data64URIReader(this.skins[idx].imageUrl), () => writeSkin(idx + 1, cb));
                    }
                };

                writeText(0, () => writeSkin(0, () => writer.close((blob) => {
                    UiHelper.saveBlob(blob, "skinpack.zip");
                })));
            }, (err) => {
                alert("Couldn't create zip writer: " + err);
            });
        }
    }

}