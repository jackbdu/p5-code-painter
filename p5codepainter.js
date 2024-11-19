class P5CodePainter {
  constructor(w, h, p5) {
    this.width = w;
    this.height = h;

    this.graphics = [];
    this.code = [];
    this.settings = { activeToolIndex: 0, controlPoints: [], selectedGraphicIndexes: [], selectedGraphicGroup: null };
    this.controlPointSize = 5;
    this.controlPointSensitivity = 2;
    this.hoveredControlPointKey = null;
    this.activeControlPointKey = null;
    this.selectionBox = null;

    // this should be rewrote to activeGraphic no need to be indexed
    // only add this to graphics after being created
    this.activeGraphicIndex = null; // graphic in the process of being created

    this.tools = ["rect", "ellipse", "line", "bezier", "brush", "select"];

    //    this.cursors = ['auto', 'crosshair', 'nwse-resize', 'ns-resize', 'nesw-resize', 'ew-resize', 'move', 'grab', 'grabbing'];
    //    this.activeCursorIndex = 0;

    this.snapshots = [];
    this.snapshotIndex = -1;

    this.settingsSaved = false;
    this.clipboard = [];
    this.pressStartedOnCanvas = false;

    let pcp = this;
    this.p5 = new p5((p) => {
      p.setup = () => {
        p.createCanvas(pcp.width, pcp.height).id("p5canvas");
      };

      p.draw = () => {
        p.background(pcp.getBackground());
        //p.cursor(pcp.getCursorName());

        for (let g of pcp.graphics) {
          g.display();
        }

        pcp.endUI();
      };
    }, document.getElementById("p5sketch"));

    this.controllerColor = this.p5.color(80, 160, 255);
    this.settings.pasteOffset = this.p5.createVector(10, 0);
    this.settings.background = this.p5.color(255);
    this.settings.stroke = this.p5.color(0);
    this.settings.fill = this.p5.color(255);
    this.settings.strokeWeight = 1;
    this.setBackground(this.settings.background);
    this.setActiveToolIndex(0);
  }

  getBackground() {
    return this.settings.background;
  }

  getFill() {
    return this.settings.fill;
  }

  getStroke() {
    return this.settings.stroke;
  }

  getStrokeWeight() {
    return this.settings.strokeWeight;
  }

  getActiveToolIndex() {
    return this.settings.activeToolIndex;
  }

  setActiveToolIndex(idx) {
    this.settings.activeToolIndex = idx;
    this.saveSnapshot();
  }

  updateSetting(value, key) {
    // background, stroke, fill, strokeWeight
    this.settings[key] = value;
    if (key === "background") {
      this.setBackground(value);
    } else {
      this.updateSelectedGraphics(value, key);
    }
    this.settingsSaved = false;
    return this;
  }

  updateSelectedGraphics(value, key) {
    if (this.settings.selectedGraphicGroup !== null) {
      if (key === "fill") {
        this.settings.selectedGraphicGroup.setFill(value, this.graphics);
      } else if (key === "stroke") {
        this.settings.selectedGraphicGroup.setStroke(value, this.graphics);
      } else if (key === "strokeWeight") {
        this.settings.selectedGraphicGroup.setStrokeWeight(value, this.graphics);
      }
    }
  }

  setBackground(c) {
    let statement = `background(${this.p5.red(c)},${this.p5.green(c)},${this.p5.blue(c)},${this.p5.alpha(c)});`;
    if (this.code) {
      this.code[0] = [statement];
    } else {
      this.code.push([statement]);
    }
    return this;
  }

  setFill(c) {
    this.settings.fill = c;
  }

  setStroke(c) {
    this.settings.stroke = c;
  }

  setStrokeWeight(sw) {
    this.settings.strokeWeight = sw;
  }

  saveSnapshot() {
    let settingsSnapshot = { ...this.settings };
    let graphicsSnapshot = [];
    let codeSnapshot = [this.code[0]];
    for (let i = 0; i < this.graphics.length; i++) {
      graphicsSnapshot.push(this.graphics[i].copy());
      codeSnapshot.push(graphicsSnapshot[i].statements);
    }
    if (this.settings.selectedGraphicGroup !== null) {
      settingsSnapshot.selectedGraphicGroup = this.settings.selectedGraphicGroup.copy(this.graphics);
    }
    // add new snapshot and remove previous trailing snapshots
    this.snapshots.splice(++this.snapshotIndex, this.snapshots.length, [codeSnapshot, graphicsSnapshot, settingsSnapshot]);
    // temporary fix to avoid losing code
    // print(this.getCodeString());
    this.settingsSaved = true;
    return this;
  }

  loadSnapshot(i) {
    // temporary fix to avoid losing code
    // print(this.getCodeString());
    this.code = [...this.snapshots[i][0]];
    this.graphics = [...this.snapshots[i][1]];
    this.settings = { ...this.snapshots[i][2] };
    this.settingsSaved = true;
    return this;
  }

  undo() {
    if (this.snapshotIndex > 0) {
      this.loadSnapshot(--this.snapshotIndex);
      this.activeGraphicIndex = null; // avoid error if bezier is not done
    }
    return this;
  }

  redo() {
    if (this.snapshotIndex < this.snapshots.length - 1) {
      this.loadSnapshot(++this.snapshotIndex);
    }
    return this;
  }

  copy() {
    // print("copy");
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.clipboard = [];
      for (let i = 0; i < this.settings.selectedGraphicIndexes.length; i++) {
        let idx = this.settings.selectedGraphicIndexes[i];
        this.clipboard.push(this.graphics[idx].copy());
      }
    }
    return this.clipboard;
  }

  paste(offsetX = 0, offsetY = 0, factorW = 1, factorH = 1, lerpAmt = 0, destColor = this.settings.background) {
    // print("paste");
    if (this.clipboard.length > 0) {
      let selectedIndexes = [];
      for (let i = 0; i < this.clipboard.length; i++) {
        if (this.clipboard[i].constructor.name === "Graphic") {
          let properties = this.clipboard[i].getProperties();
          let modifiedProperties = {
            x: properties.x + offsetX,
            y: properties.y + offsetY,
            w: properties.w * factorW,
            h: properties.h * factorH,
          };
          modifiedProperties.stroke = this.p5.lerpColor(properties.stroke, destColor, lerpAmt);
          modifiedProperties.fill = this.p5.lerpColor(properties.fill, destColor, lerpAmt);
          this.graphics.push(this.clipboard[i].copy(modifiedProperties));
          this.code.push(this.graphics[this.graphics.length - 1].statements);
          selectedIndexes.push(this.graphics.length - 1);
        }
      }
      // if clipboard only contains graphics
      this.setSelectedGraphicIndexes(selectedIndexes);
    }
  }

  getCodeString() {
    let stringifiedCode = "";
    // for each statement cluster
    for (let i = 0; i < this.code.length; i++) {
      // for each statement
      for (let j = 0; j < this.code[i].length; j++) {
        let currStatement = this.code[i][j];
        if (currStatement) {
          // starting from the 2nd statement cluster
          // only skip the first three statements (fill, strokeWeight, stroke)
          if (i > 0 && j < 3) {
            let prevStatement = this.code[i - 1][j];
            if (currStatement === prevStatement) {
              continue;
            }
          }
          stringifiedCode += this.code[i][j] + "\n";
        }
      }
    }
    return stringifiedCode;
  }

  updateGraphicEditability() {
    for (let i = 0; i < this.graphics.length; i++) {
      for (let idx of this.settings.selectedGraphicIndexes) {
        if (i === idx) {
          this.graphics[i].setEditable(true);
          break; // get out of for loop
        } else {
          this.graphics[i].setEditable(false);
        }
      }
    }
  }

  updateDrawingUI() {
    if (this.settings.selectedGraphicGroup !== null) {
      if (this.settings.selectedGraphicGroup.fill !== null) this.setFill(this.settings.selectedGraphicGroup.fill);
      if (this.settings.selectedGraphicGroup.stroke !== null) this.setStroke(this.settings.selectedGraphicGroup.stroke);
      if (this.settings.selectedGraphicGroup.strokeWeight !== null) this.setStrokeWeight(this.settings.selectedGraphicGroup.strokeWeight);
    }
  }

  setSelectedGraphicIndexes(indexes) {
    this.settings.selectedGraphicIndexes = [...indexes];
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.settings.selectedGraphicGroup = new GraphicGroup(this.graphics, this.settings.selectedGraphicIndexes);
    } else {
      this.settings.selectedGraphicGroup = null;
    }
    this.updateGraphicEditability();
    this.updateDrawingUI();
    this.saveSnapshot();
    return this.settings.selectedGraphicIndexes;
  }

  setSelectedGraphicIndexesWithBox(box) {
    let selectedIndexes = [];
    for (let i = 0; i < this.graphics.length; i++) {
      for (let j = 0; j < 4; j++) {
        let x = this.graphics[i].getCornerVector(j).x;
        let y = this.graphics[i].getCornerVector(j).y;
        // difference in x or y is less than width/2 or height/2
        if (Math.abs(Math.abs(x) - Math.abs(box.x)) <= Math.abs(box.w / 2) && Math.abs(Math.abs(y) - Math.abs(box.y)) <= Math.abs(box.h / 2)) {
          selectedIndexes.push(i);
          break;
        }
      }
    }
    this.setSelectedGraphicIndexes(selectedIndexes);
  }

  selectAllGraphics() {
    this.setSelectedGraphicIndexes(Array.from(this.graphics, (value, index) => index));
  }

  setSelectedGraphicIndex(idx) {
    let indexes = [];
    if (typeof idx === "number") {
      indexes = [idx];
    }
    return this.setSelectedGraphicIndexes(indexes);
  }

  addSelectedGraphicIndex(index) {
    if (typeof index === "number") {
      // add index
      this.settings.selectedGraphicIndexes = [...this.settings.selectedGraphicIndexes, index];
      if (this.settings.selectedGraphicGroup !== null) {
        this.settings.selectedGraphicGroup.addIndex(this.graphics, index);
      } else {
        this.settings.selectedGraphicGroup = new GraphicGroup(this.graphics, this.settings.selectedGraphicIndexes);
      }
      this.updateGraphicEditability();
      this.updateDrawingUI();
      this.saveSnapshot();
    }
    return this.settings.selectedGraphicIndexes;
  }

  removeSelectedGraphicIndex(index) {
    if (typeof index === "number") {
      let selectedIndexes = [...this.settings.selectedGraphicIndexes];
      selectedIndexes.splice(this.settings.selectedGraphicIndexes.indexOf(index), 1);
      this.setSelectedGraphicIndexes(selectedIndexes);
    }
  }

  updateHoveredControlPointKey(x, y) {
    let hoveredKey = null;
    let closestDistance = this.controlPointSize * this.controlPointSensitivity;
    if (this.settings.selectedGraphicGroup !== null) {
      for (let k of Object.keys(this.settings.selectedGraphicGroup.controlPoints)) {
        let cp = this.settings.selectedGraphicGroup.controlPoints[k];
        // makes sure center & sides don't conflict
        if (k === "c") {
          if (cp.dist(this.p5.createVector(x, y)) <= (this.controlPointSize * this.controlPointSensitivity) / 2) {
            hoveredKey = k;
            break;
          }
        } else if (cp.dist(this.p5.createVector(x, y)) <= closestDistance) {
          hoveredKey = k;
        }
      }
    }
    this.hoveredControlPointKey = hoveredKey;
    return hoveredKey;
  }

  setActiveControlPointKey(key) {
    this.activeControlPointKey = key;
  }

  deactivateControlPointKey() {
    this.activeControlPointKey = null;
    // this normalizes bounding box
    this.setSelectedGraphicIndexes(this.settings.selectedGraphicIndexes);
    this.saveSnapshot();
  }

  // moveActiveControlPointBy(offsetX, offsetY) {
  //   let moveX = null;
  //   let moveY = null;
  //   if (this.activeControlPointKey === 'c') {
  //     moveX = offsetX;
  //     moveY = offsetY;
  //   } else if (this.activeControlPointKey.includes('r')) {
  //     let g = this.graphics[idx];
  //     // let cp = this.settings.controlPoints;
  //     let prevCPW = cp.tr.x - cp.tl.x;
  //     let currCPW = prevCPW + offsetX;
  //     let factorW = currCPW/prevCPW;
  //     let resizedW = g.w * factorW;
  //     moveX = (g.x - cp.tl.x) * (factorW - 1);
  //     moveY = 0;
  //     g.setDimensions(resizedW, g.h);
  //   }
  //   this.settings.selectedGraphicGroup.moveBy(this.graphics, moveX, moveY);
  // }

  mouseMoved(evt) {
    let x = evt.clientX;
    let y = evt.clientY;

    // left mouse button is pressed
    if (evt.buttons === 1) {
      if (this.pressStartedOnCanvas && typeof this.activeGraphicIndex === "number" && this.graphics[this.activeGraphicIndex] && !this.graphics[this.activeGraphicIndex].isEditable) {
        this.graphics[this.activeGraphicIndex].update(x, y, evt.shiftKey);
      } else if (this.activeControlPointKey !== null) {
        this.settings.selectedGraphicGroup.moveControlPoint(this.graphics, this.activeControlPointKey, x, y, evt.shiftKey);
        // selecting tool
      } else if (this.selectionBox) {
        this.selectionBox.update(x, y, evt.shiftKey);
      }
      //this.updateCursorIndex(true);
    }
  }

  mouseClicked(evt) {
    let x = evt.clientX;
    let y = evt.clientY;
    // this.settings.selectedGraphicIndexes.push(this.graphics.length);
  }

  mousePressed(evt) {
    let x = evt.clientX;
    let y = evt.clientY;
    // make sure the event is triggered on the code painter canvas
    if (evt.target.id === this.p5.canvas.id || evt.target.id === "bounding-box-wrapper") {
      this.pressStartedOnCanvas = true;
      // a graphic is in the process of being created
      if (typeof this.activeGraphicIndex === "number" && this.graphics[this.activeGraphicIndex] && !this.graphics[this.activeGraphicIndex].isComplete) {
        this.graphics[this.activeGraphicIndex].addVertex(x, y);
      } else {
        if (!this.settingsSaved) {
          //print("settings saved",this.settingsSaved);
          this.saveSnapshot();
        }
        if (this.settings.activeToolIndex < 5) {
          this.activeGraphicIndex = this.graphics.length;
          let properties = {
            p5: this.p5,
            type: this.tools[this.settings.activeToolIndex],
            x: x,
            y: y,
          };
          this.graphics.push(new Graphic(properties));
          this.graphics[this.activeGraphicIndex].setStroke(this.settings.stroke);
          this.graphics[this.activeGraphicIndex].setFill(this.settings.fill);
          this.graphics[this.activeGraphicIndex].setStrokeWeight(this.settings.strokeWeight);
          this.code.push(this.graphics[this.activeGraphicIndex].statements);
        } else if (this.tools[this.settings.activeToolIndex] === "select") {
          let selectedIndex = null;
          // start from last graphic (top layer)
          for (let i = this.graphics.length - 1; i > -1; i--) {
            if (this.graphics[i].checkBoundingBox(x, y)) {
              selectedIndex = i;
              break;
            }
          }
          if (selectedIndex !== null && evt.shiftKey) {
            if (this.settings.selectedGraphicIndexes.includes(selectedIndex)) {
              this.removeSelectedGraphicIndex(selectedIndex);
            } else {
              this.addSelectedGraphicIndex(selectedIndex);
            }
          } else if (selectedIndex !== null && !evt.shiftKey) {
            this.setSelectedGraphicIndex(selectedIndex);
          } else if (selectedIndex === null) {
            let properties = {
              p5: this.p5,
              type: this.tools[this.settings.activeToolIndex],
              x: x,
              y: y,
            };
            this.selectionBox = new Graphic(properties);
          }
        }
      }
    } else if (evt.target.classList.contains("control-point")) {
      console.log("control-point " + evt.target.id);
      this.setActiveControlPointKey(evt.target.id);
    }
    //this.updateCursorIndex(true);
  }

  mouseReleased(evt) {
    let x = evt.clientX;
    let y = evt.clientY;
    if (this.pressStartedOnCanvas && typeof this.activeGraphicIndex === "number" && this.graphics[this.activeGraphicIndex] && !this.graphics[this.activeGraphicIndex].isEditable) {
      this.graphics[this.activeGraphicIndex].update(x, y, evt.shiftKey);
      if (this.graphics[this.activeGraphicIndex].isComplete) {
        this.setSelectedGraphicIndexes([this.activeGraphicIndex]);
        this.graphics[this.activeGraphicIndex].setEditable(true);
        this.activeGraphicIndex = null;
      }
    }
    if (this.activeControlPointKey) {
      this.deactivateControlPointKey();
    }
    if (this.selectionBox) {
      this.setSelectedGraphicIndexesWithBox(this.selectionBox);
      this.selectionBox = null;
    }
    if (this.settings.selectedGraphicGroup !== null) {
      this.settings.selectedGraphicGroup.updateAspectRatio();
    }
    this.pressStartedOnCanvas = false;
    //this.updateCursorIndex(false);
  }

  // remove selected graphics
  remove() {
    if (this.settings.selectedGraphicIndexes.length > 0) {
      // sort indexes in descending order, in order to splice graphics with larger index, which doesn't affect smaller index after removed
      for (let idx of this.settings.selectedGraphicIndexes.sort(function (a, b) {
        return b - a;
      })) {
        this.graphics.splice(idx, 1);
        this.code.splice(idx + 1, 1);
      }
      this.setSelectedGraphicIndex(null);
      this.saveSnapshot();
    }
  }

  moveUp(amt = 1) {
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.settings.selectedGraphicGroup.moveBy(0, -amt, this.graphics);
      this.saveSnapshot();
    }
  }

  moveDown(amt = 1) {
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.settings.selectedGraphicGroup.moveBy(0, amt, this.graphics);
      this.saveSnapshot();
    }
  }

  moveLeft(amt = 1) {
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.settings.selectedGraphicGroup.moveBy(-amt, 0, this.graphics);
      this.saveSnapshot();
    }
  }

  moveRight(amt = 1) {
    if (this.settings.selectedGraphicIndexes.length > 0) {
      this.settings.selectedGraphicGroup.moveBy(amt, 0, this.graphics);
      this.saveSnapshot();
    }
  }

  activateShift() {
    // shift for proportion
    if (typeof this.activeGraphicIndex === "number" && this.graphics[this.activeGraphicIndex]) {
      this.graphics[this.activeGraphicIndex].update(this.p5.mouseX, this.p5.mouseY, true);
    } else if (this.activeControlPointKey !== null) {
      this.settings.selectedGraphicGroup.moveControlPoint(this.graphics, this.activeControlPointKey, this.p5.mouseX, this.p5.mouseY, true);
      // selecting tool
    }
  }

  deactivateShift() {
    if (typeof this.activeGraphicIndex === "number" && this.graphics[this.activeGraphicIndex]) {
      this.graphics[this.activeGraphicIndex].update(this.p5.mouseX, this.p5.mouseY, false);
    } else if (this.activeControlPointKey !== null) {
      this.settings.selectedGraphicGroup.moveControlPoint(this.graphics, this.activeControlPointKey, this.p5.mouseX, this.p5.mouseY, false);
      // selecting tool
    }
  }

  keyPressed(evt) {
    this.updateHoveredControlPointKey(this.p5.mouseX, this.p5.mouseY);
    //this.updateCursorIndex();
  }

  keyReleased(evt) {
    //this.updateCursorIndex();
  }

  beginUI() {}

  endUI() {
    // to take rotation into consideration, all corners should be checked for rectangles, ellipses may be calculated based on simplified polygon, checking all pixels might be too power-consuming
    if (this.settings.selectedGraphicGroup !== null) {
      this.settings.selectedGraphicGroup.display(this.graphics);
    }
    // highlight graphic being created
    if (this.activeGraphicIndex !== null) {
      this.p5.noFill();
      this.p5.strokeWeight(1);
      this.p5.stroke(this.controllerColor);
      this.graphics[this.activeGraphicIndex].display(true);
    }
    if (this.selectionBox) {
      this.selectionBox.display();
    }
  }
}
