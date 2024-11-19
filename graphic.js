class Graphic {
  constructor(properties = {}) {
    // private properties
    this.isEditable = false;
    this.controlPoints = {};
    this.controlPointSize = 5;
    // clickable radius ratio
    this.controlPointSensitivity = 2;

    // default properties
    this.properties = {
      p5: null,
      type: null, // type of graphic, rect, ellipse, line, beizer, brush
      mode: null, // referring to ellipseMode, rectMode, defaults follow p5.js
      x: null, // x coordinate of this graphic
      y: null, // y coordinate of this graphic
      w: 0, // width
      h: 0, // height
      angle: 0, // rotating angle around origin (offsetX, offsetY)
      fill: null, // fill color
      stroke: null, // stroke color
      strokeWeight: null, // strokeWeight
      offsetX: 0, // offsetX away from x
      offsetY: 0, // offsetY away from y
      vertices: [], // vertices of polygon, bezier, the same for ellipse, rect, line, each vertex is between (-0.5,-0.5) to (0.5,0.5)
      decimals: 0, // number of decimal digits
      cornerRadii: [0, 0, 0, 0], // only for rectangles, radius for each corner for rounded corners
    };

    // update with user defined properties
    Object.assign(this.properties, properties);

    if (this.properties.vertices.length < 2 && this.properties.type === "line") {
      this.properties.vertices = [this.properties.p5.createVector(-0.5, -0.5), this.properties.p5.createVector(0.5, 0.5)];
    } else if (this.properties.vertices.length < 4 && (this.properties.type === "rect" || this.properties.type === "ellipse" || this.properties.type === "select")) {
      this.properties.vertices = [this.properties.p5.createVector(-0.5, -0.5), this.properties.p5.createVector(0.5, -0.5), this.properties.p5.createVector(0.5, 0.5), this.properties.p5.createVector(-0.5, 0.5)];
    }

    if (this.properties.type === "select") {
      if (this.properties.stroke === null) this.properties.stroke = this.properties.p5.color(100);
      if (this.properties.strokeWeight === null) this.properties.strokeWeight = 1;
    } else if (this.properties.type === "rect" || this.properties.type === "group") {
      this.minCornerControlPointRadius = 20;
    }

    this.spreadProperties();

    this.isComplete = true;
    if (this.type === "bezier" && this.vertices.length < 4) {
      this.isComplete = false;
    }

    this.statements = this.initStatements();

    if (this.properties.vertices.length < 1 && (this.type === "brush" || this.type === "bezier")) {
      this.addVertex(this.x, this.y);
    }
  }

  // this is a bit confusing, should stick with object in future
  // load properties from object
  spreadProperties() {
    this.p5 = this.properties.p5;
    this.type = this.properties.type;
    this.mode = this.properties.mode;
    this.x = this.properties.x;
    this.y = this.properties.y;
    this.w = this.properties.w;
    this.h = this.properties.h;
    this.angle = this.properties.angle;
    this.fill = this.properties.fill;
    this.stroke = this.properties.stroke;
    this.strokeWeight = this.properties.strokeWeight;
    this.offsetX = this.properties.offsetX;
    this.offsetY = this.properties.offsetY;
    this.vertices = [...this.properties.vertices];
    this.cornerRadii = [...this.properties.cornerRadii];
    this.decimals = this.properties.decimals;
  }

  // update object with properties
  getProperties() {
    this.properties.p5 = this.p5;
    this.properties.type = this.type;
    this.properties.mode = this.mode;
    this.properties.x = this.x;
    this.properties.y = this.y;
    this.properties.w = this.w;
    this.properties.h = this.h;
    this.properties.angle = this.angle;
    this.properties.fill = this.fill;
    this.properties.stroke = this.stroke;
    this.properties.strokeWeight = this.strokeWeight;
    this.properties.offsetX = this.offsetX;
    this.properties.offsetY = this.offsetY;
    this.properties.vertices = [...this.vertices];
    this.properties.cornerRadii = [...this.cornerRadii];
    this.properties.decimals = this.decimals;
    return this.properties;
  }

  // return corner vector of bounding box at index
  getCornerVector(idx) {
    // starts from top left as 0, closewise
    let x;
    let y;
    if (idx === 0 || idx === 1) {
      y = this.y - Math.abs(this.h) / 2;
    } else {
      // 2, 3
      y = this.y + Math.abs(this.h) / 2;
    }
    if (idx === 0 || idx === 3) {
      x = this.x - Math.abs(this.w) / 2;
    } else {
      x = this.x + Math.abs(this.w) / 2;
    }
    return this.p5.createVector(x, y);
  }

  copy(modifiedProperties = {}) {
    if (this.isComplete) {
      let properties = this.getProperties();
      // directly modifying original properties, should avoid later
      Object.assign(properties, modifiedProperties);
      let graphicCopy = new Graphic(properties);
      if (this.vertices) {
        // graphicCopy.vertices = [...this.vertices];
        graphicCopy.isComplete = true;
        this.statements[3] = this.getDrawStatement();
      }
      if (this.cornerRadii) {
        for (let i = 0; i < this.cornerRadii.length; i++) {
          graphicCopy.setCornerRadius(this.cornerRadii[i], i);
        }
      }
      graphicCopy.setEditable(this.isEditable);
      return graphicCopy;
    }
    return null;
  }

  initStatements() {
    let statements = new Array(4);

    statements[0] = this.getFillStatement();

    statements[1] = this.getStrokeStatement();

    statements[2] = this.getStrokeWeightStatement();

    statements[3] = this.getDrawStatement();

    return statements;
  }

  // update the number of decimals for all values in an object
  updateValueDecimals(obj, n) {
    for (let k of Object.keys(obj)) {
      obj[k] = parseFloat(obj[k].toFixed(n));
    }
    return obj;
  }

  // returns a parameters object containing all parameters
  getParameters(type) {
    let p = {};
    if (type === "rect") {
      let smallerSide = Math.abs(this.w) > Math.abs(this.h) ? Math.abs(this.h) : Math.abs(this.w);
      let maxRadius = smallerSide / 2;
      p = {
        x: this.x + this.w * this.vertices[0].x,
        y: this.y + this.h * this.vertices[0].y,
        w: this.w,
        h: this.h,
        tl: this.cornerRadii[0] > maxRadius ? maxRadius : this.cornerRadii[0],
        tr: this.cornerRadii[1] > maxRadius ? maxRadius : this.cornerRadii[1],
        bl: this.cornerRadii[2] > maxRadius ? maxRadius : this.cornerRadii[2],
        br: this.cornerRadii[3] > maxRadius ? maxRadius : this.cornerRadii[3],
      };
    } else if (type === "select") {
      p = {
        x: this.x + this.w * this.vertices[0].x,
        y: this.y + this.h * this.vertices[0].y,
        w: this.w,
        h: this.h,
      };
    } else if (type === "ellipse") {
      p = {
        x: this.x,
        y: this.y,
        w: this.w,
        h: this.h,
      };
    } else if (type === "line") {
      p = {
        x1: this.x - this.w / 2,
        y1: this.y - this.h / 2,
        x2: this.x + this.w / 2,
        y2: this.y + this.h / 2,
      };
    } else if (type === "brush") {
      p = {};
      for (let i = 0; i < this.vertices.length; i++) {
        p[`x${i}`] = this.x + this.vertices[i].x * this.w;
        p[`y${i}`] = this.y + this.vertices[i].y * this.h;
        // ensure at least two vertices
        if (i < 1 && this.vertices.length === 1) {
          p[`x${i + 1}`] = p[`x${i}`];
          p[`y${i + 1}`] = p[`y${i}`];
        }
      }
    } else if (type === "bezier") {
      let l = this.vertices.length;
      if (l > 0) {
        p = {
          x0: this.x + this.vertices[0].x * this.w,
          y0: this.y + this.vertices[0].y * this.h,
          x1: this.vertices[1 < l ? 1 : l - 1].x * this.w + this.x,
          y1: this.vertices[1 < l ? 1 : l - 1].y * this.h + this.y,
          x2: this.vertices[2 < l ? 2 : l - 1].x * this.w + this.x,
          y2: this.vertices[2 < l ? 2 : l - 1].y * this.h + this.y,
          x3: this.vertices[3 < l ? 3 : l - 1].x * this.w + this.x,
          y3: this.vertices[3 < l ? 3 : l - 1].y * this.h + this.y,
        };
      }
    }
    this.updateValueDecimals(p, this.decimals);
    if (this.angle !== 0) {
      p.translateX = p.x;
      p.translateY = p.y;
      p.x = 0;
      p.y = 0;
      p.angle = this.angle;
    }
    return p;
  }

  getDrawStatement() {
    // this and display should share exact same values
    let statement = "";
    let p = this.getParameters(this.type);
    if (this.type === "rect") {
      if (this.w === this.h) {
        statement = `square(${p.x},${p.y},${p.w}`;
      } else {
        statement = `rect(${p.x},${p.y},${p.w},${p.h}`;
      }
      if (p.tl && p.tl === p.tr && p.tl === p.bl && p.tl === p.br) {
        statement += `,${p.tl}`;
      } else if (p.tl > 0) {
        statement += `,${p.tl},${p.tr},${p.br},${p.bl}`;
      }
      statement += `);`;
    } else if (this.type === "ellipse") {
      if (this.w === this.h) {
        statement = `circle(${p.x},${p.y},${p.w});`;
      } else {
        statement = `ellipse(${p.x},${p.y},${p.w},${p.h});`;
      }
    } else if (this.type === "line") {
      statement = `line(${p.x1},${p.y1},${p.x2},${p.y2});`;
    } else if (this.type === "brush") {
      statement = `beginShape();\n`;
      for (let i = 0; i < Object.keys(p).length / 2; i++) {
        let x = p[`x${i}`];
        let y = p[`y${i}`];
        statement += `vertex(${x},${y});\n`;
      }
      statement += `endShape();`;
    } else if (this.type === "bezier") {
      if (Object.keys(p).length > 0) {
        statement = `bezier(`;
        for (let i = 0; i < Object.keys(p).length / 2; i++) {
          let x = p[`x${i}`];
          let y = p[`y${i}`];
          statement += `${x},${y}`;
          if (i === 3) {
            statement += `);`;
          } else {
            statement += `,`;
          }
        }
      }
    }
    return statement;
  }

  setFill(col) {
    this.fill = col;
    this.statements[0] = this.getFillStatement();
  }

  setStroke(col) {
    this.stroke = col;
    this.statements[1] = this.getStrokeStatement();
  }

  setStrokeWeight(sw) {
    this.fill = sw;
    this.statements[2] = this.getStrokeWeightStatement();
  }

  getFillStatement() {
    let statement = "";
    if (this.type !== "line") {
      if (this.fill) {
        let p = {
          r: this.p5.red(this.fill),
          g: this.p5.green(this.fill),
          b: this.p5.blue(this.fill),
          a: this.p5.alpha(this.fill),
        };
        this.updateValueDecimals(p, this.decimals);
        statement = `fill(${p.r},${p.g},${p.b},${p.a});`;
      } else if (this.fill === null) {
        statement = "noFill();";
      }
    }
    return statement;
  }

  getStrokeStatement() {
    let statement = "";
    if (this.stroke) {
      let p = {
        r: this.p5.red(this.stroke),
        g: this.p5.green(this.stroke),
        b: this.p5.blue(this.stroke),
        a: this.p5.alpha(this.stroke),
      };
      this.updateValueDecimals(p, this.decimals);
      statement = `stroke(${p.r},${p.g},${p.b},${p.a});`;
    } else if (this.stroke === null) {
      statement = "noStroke();";
    }
    return statement;
  }

  getStrokeWeightStatement() {
    let statement = "";
    statement = `strokeWeight(${this.strokeWeight});`;
    return statement;
  }

  disableActiveControlPoint() {
    this.activeControlPointIndex = null;
  }

  checkBoundingBox(x, y) {
    if (x < this.x + Math.abs(this.w / 2) && x > this.x - Math.abs(this.w / 2) && y < this.y + Math.abs(this.h / 2) && y > this.y - Math.abs(this.h / 2)) {
      // this.activeControlPointIndex = 8;
      return true;
    }
    return false;
  }

  setEditable(isEditable) {
    this.isEditable = isEditable;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    this.statements[3] = this.getDrawStatement();
  }

  // reposition by an offset
  moveBy(offsetX, offsetY) {
    let newX = this.x + offsetX;
    let newY = this.y + offsetY;
    this.setPosition(newX, newY);
  }

  // move vertices while setting (x, y)
  // movePosition(x, y) {
  //   if (this.vertices) {
  //     let diffX = x - this.x;
  //     let diffY = y - this.y;
  //     for (let i = 0; i < this.vertices.length; i++) {
  //       this.vertices[i].x += diffX;
  //       this.vertices[i].y += diffY;
  //     }
  //   }
  //   this.setPosition(x, y);
  // }

  setCornerRadius(radius, idx = null) {
    let maxRadius = Math.abs(this.w) > Math.abs(this.h) ? Math.abs(this.h / 2) : Math.abs(this.w / 2);
    radius = this.p5.constrain(radius, 0, maxRadius);

    // change individual corner radius
    if (typeof idx === "number" && idx >= 0 && idx < this.cornerRadii.length) {
      this.cornerRadii[idx] = radius;
      // change all corner radii
    } else {
      for (let i = 0; i < this.cornerRadii.length; i++) {
        this.cornerRadii[i] = radius;
      }
    }
    if (this.type !== "group") {
      this.statements[3] = this.getDrawStatement();
    }
  }

  setDimensions(w, h) {
    // failed attempt to avoid smaller rect side than corner radius
    // maybe this doesn't need to be fixed, can leave as is
    // if (this.type === 'rect') {
    //   let minSide = Math.max(...this.cornerRadii)*2;
    //   w = w < minSide ? minSide : w;
    //   h = h < minSide ? minSide : h;
    // }
    this.w = w;
    this.h = h;
    this.statements[3] = this.getDrawStatement();
  }

  //   resizeDimensions(w, h) {
  //     this.setPosition(this.x+(w-this.w)/2, this.y+(h-this.h)/2);
  //     this.setDimensions(w, h);
  //   }

  // update dimensions
  updateDimensionsWithout(idx) {
    let updatedW = this.w;
    let updatedH = this.h;
    let updatedX = this.x;
    let updatedY = this.y;
    // if original vertex.x is outside bounds, recalculate positions and dimensions
    if (this.vertices[idx].x >= 0.5) {
      let largestX = -0.5;
      for (let i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].x > largestX && i !== idx) {
          largestX = this.vertices[i].x;
        }
      }
      updatedW = largestX * this.w + this.x - (this.x - this.w / 2);
      updatedX = this.x - this.w / 2 + updatedW / 2;
    } else if (this.vertices[idx].x <= -0.5) {
      let smallestX = 0.5;
      for (let i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].x < smallestX && i !== idx) {
          smallestX = this.vertices[i].x;
        }
      }
      updatedW = this.x + this.w / 2 - (smallestX * this.w + this.x);
      updatedX = this.x + this.w / 2 - updatedW / 2;
    }
    // update all vertices
    if (updatedW !== this.w || updatedX !== this.x) {
      if (this.vertices) {
        // update vertice coordinates accordingly based on updated position and dimensions
        for (let i = 0; i < this.vertices.length; i++) {
          this.vertices[i].x = updatedW === 0 ? 0 : (this.vertices[i].x * this.w + this.x - updatedX) / updatedW;
        }
      }
    }

    // if original vertex.y is outside bounds, recalculate positions and dimensions
    if (this.vertices[idx].y >= 0.5) {
      let largestY = -0.5;
      for (let i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].y > largestY && i !== idx) {
          largestY = this.vertices[i].y;
        }
      }
      updatedH = largestY * this.h + this.y - (this.y - this.h / 2);
      updatedY = this.y - this.h / 2 + updatedH / 2;
    } else if (this.vertices[idx].y <= -0.5) {
      let smallestY = 0.5;
      for (let i = 0; i < this.vertices.length; i++) {
        if (this.vertices[i].y < smallestY && i !== idx) {
          smallestY = this.vertices[i].y;
        }
      }
      updatedH = this.y + this.h / 2 - (smallestY * this.h + this.y);
      updatedY = this.y + this.h / 2 - updatedH / 2;
    }
    // update all vertices
    if (updatedH !== this.h || updatedY != this.y) {
      if (this.vertices) {
        // update vertice coordinates accordingly based on updated position and dimensions
        for (let i = 0; i < this.vertices.length; i++) {
          this.vertices[i].y = updatedH === 0 ? 0 : (this.vertices[i].y * this.h + this.y - updatedY) / updatedH;
        }
      }
    }
    // finally, update position and dimensions based on changes
    this.setPosition(updatedX, updatedY);
    this.setDimensions(updatedW, updatedH);
  }

  // to be simplified
  updateDimensions(x, y, idx = null) {
    if (typeof idx === "number") {
      this.updateDimensionsWithout(idx);
    }
    // updates dimensions when (x,y) goes outside bounds
    let updatedW = this.w;
    let updatedH = this.h;
    let updatedX = this.x;
    let updatedY = this.y;
    if (y > this.y + this.h / 2) {
      updatedH = y - (this.y - this.h / 2);
      updatedY = this.y - this.h / 2 + updatedH / 2;
    } else if (y < this.y - this.h / 2) {
      updatedH = this.y + this.h / 2 - y;
      updatedY = this.y + this.h / 2 - updatedH / 2;
    }
    if (updatedH !== this.h || updatedY != this.y) {
      if (this.vertices) {
        // update vertice coordinates accordingly based on updated position and dimensions
        for (let i = 0; i < this.vertices.length; i++) {
          this.vertices[i].y = (this.vertices[i].y * this.h + this.y - updatedY) / updatedH;
        }
      }
    }
    if (x > this.x + this.w / 2) {
      updatedW = x - (this.x - this.w / 2);
      updatedX = this.x - this.w / 2 + updatedW / 2;
    } else if (x < this.x - this.w / 2) {
      updatedW = this.x + this.w / 2 - x;
      updatedX = this.x + this.w / 2 - updatedW / 2;
    }
    if (updatedW !== this.w || updatedX !== this.x) {
      if (this.vertices) {
        // update vertice coordinates accordingly based on updated position and dimensions
        for (let i = 0; i < this.vertices.length; i++) {
          this.vertices[i].x = (this.vertices[i].x * this.w + this.x - updatedX) / updatedW;
        }
      }
    }
    this.setPosition(updatedX, updatedY);
    this.setDimensions(updatedW, updatedH);
    // print(updatedX, updatedY, updatedW, updatedH);
  }

  addVertex(x, y) {
    this.updateDimensions(x, y);
    // relative to center corner as origin
    let relativeX = this.w === 0 ? 0 : (x - this.x) / this.w;
    let relativeY = this.h === 0 ? 0 : (y - this.y) / this.h;
    if (this.type === "brush" || this.type === "group") {
      this.vertices.push(this.p5.createVector(relativeX, relativeY));
    } else if (this.type === "bezier") {
      this.vertices.push(this.p5.createVector(relativeX, relativeY));
      this.vertices.push(this.p5.createVector(relativeX, relativeY));
      if (this.vertices.length >= 4) {
        this.isComplete = true;
      }
    }
    if (this.type !== "group") {
      this.statements[3] = this.getDrawStatement();
    }
  }

  // so far only for bezier
  updateVertex(x, y, i) {
    this.updateDimensions(x, y, i);
    let relativeX = this.w === 0 ? 0 : (x - this.x) / this.w;
    let relativeY = this.h === 0 ? 0 : (y - this.y) / this.h;
    this.vertices[i] = this.p5.createVector(relativeX, relativeY);
    this.statements[3] = this.getDrawStatement();
  }

  // while creating the shape
  update(x, y, shiftIsDown = false, mouseIsDown = true) {
    // idx
    // top left 0, top right 1, bottom right 2, bottom left 3

    if (this.isEditable === false) {
      if (this.type === "brush") {
        let minDistance = 1;
        let lastVtx = this.vertices[this.vertices.length - 1];
        if (this.p5.dist(lastVtx.x * this.w + this.x, lastVtx.y * this.h + this.y, x, y) > minDistance) {
          this.addVertex(x, y);
        }
        this.isComplete = true;
      } else if (this.type === "bezier") {
        let v = this.p5.createVector(x, y);
        // either update the first or second control point
        this.updateVertex(x, y, this.vertices.length < 3 ? 1 : 2);
        // neither brush or bezier
      } else {
        // vector representing dimension (w,h)
        let dimension = this.p5.createVector(x - this.x + this.w * 0.5, y - this.y + this.h * 0.5);
        // print(v);
        if (shiftIsDown) {
          if (this.type === "line") {
            // round up to integers
            // 24 is the number of even angles to split TWO_PI
            dimension.setHeading((this.p5.TWO_PI / 24) * this.p5.floor((dimension.heading() / this.p5.TWO_PI) * 24 + 0.5));
          } else {
            // rect or ellipse
            dimension.y = dimension.y === 0 ? dimension.x : (dimension.y / Math.abs(dimension.y)) * Math.abs(dimension.x);
          }
        }

        this.setPosition(this.x - this.w * 0.5 + dimension.x * 0.5, this.y - this.h * 0.5 + dimension.y * 0.5);
        this.setDimensions(dimension.x, dimension.y);
        this.isComplete = true;
      }
    } else {
    }
  }

  setFill(c) {
    this.fill = c;
    this.statements[0] = this.getFillStatement();
  }

  setStroke(c) {
    this.stroke = c;
    this.statements[1] = this.getStrokeStatement();
  }

  setStrokeWeight(sw) {
    this.strokeWeight = sw;
    this.statements[2] = this.getStrokeWeightStatement();
  }

  display(graphicOnly = false) {
    let p = this.getParameters(this.type);
    if (p.angle) {
      this.p5.push();
      this.p5.translate(p.translateX, p.translateY);
      this.p5.rotate(p.angle);
    }
    if (!graphicOnly) {
      if (this.fill) {
        this.p5.fill(this.fill);
      } else {
        this.p5.noFill();
      }
      if (this.stroke && this.strokeWeight) {
        this.p5.stroke(this.stroke);
        this.p5.strokeWeight(this.strokeWeight);
      } else {
        this.p5.noStroke();
      }
    }
    // selection box
    if (this.type === "select") {
      this.p5.rectMode(this.mode || this.p5.CORNER);
      this.p5.rect(p.x, p.y, p.w, p.h);
    } else if (this.type === "rect") {
      this.p5.rectMode(this.mode || this.p5.CORNER);
      // parameters
      this.p5.rect(p.x, p.y, p.w, p.h, p.tl, p.tr, p.br, p.bl);
    } else if (this.type === "ellipse") {
      this.p5.ellipseMode(this.mode || this.p5.CENTER);
      this.p5.ellipse(p.x, p.y, p.w, p.h);
    } else if (this.type === "line") {
      this.p5.line(p.x1, p.y1, p.x2, p.y2);
    } else if (this.type === "bezier") {
      this.p5.bezier(p.x0, p.y0, p.x1, p.y1, p.x2, p.y2, p.x3, p.y3);
    } else if (this.type === "brush") {
      this.p5.beginShape();
      for (let i = 0; i < Object.keys(p).length / 2; i++) {
        this.p5.vertex(p[`x${i}`], p[`y${i}`]);
      }
      this.p5.endShape();
    }
    if (p.angle) {
      this.p5.pop();
    }
  }
}

class GraphicGroup extends Graphic {
  constructor(graphics, indexes) {
    let properties = graphics[indexes[0]].getProperties();
    let groupProperties = {
      p5: properties.p5,
      type: "group",
      mode: null,
      x: properties.x,
      y: properties.y,
      w: 0,
      h: 0,
      angle: 0,
      fill: properties.fill,
      stroke: properties.stroke,
      strokeWeight: properties.strokeWeight,
      offsetX: 0,
      offsetY: 0,
      vertices: [],
      decimals: properties.decimals,
      cornerRadii: [], // only for rectangles
    };
    // if there's only one rectange within group
    if (indexes.length === 1 && graphics[indexes[0]].type === "rect") {
      groupProperties.cornerRadii = graphics[indexes[0]].cornerRadii;
    }
    super(groupProperties);
    this.originalAspectRatio = null;
    this.indexes = [];
    for (let i = 0; i < indexes.length; i++) {
      this.addIndex(graphics, indexes[i]);
    }
  }

  setFill(col, graphics) {
    this.fill = col;
    for (let idx of this.indexes) {
      graphics[idx].setFill(col);
    }
  }

  setStroke(col, graphics) {
    this.stroke = col;
    for (let idx of this.indexes) {
      graphics[idx].setStroke(col);
    }
  }

  setStrokeWeight(sw, graphics) {
    this.fill = sw;
    for (let idx of this.indexes) {
      graphics[idx].setStrokeWeight(sw);
    }
  }

  updateAspectRatio() {
    if (this.w !== 0 && this.h !== 0) {
      this.originalAspectRatio = this.w / this.h;
    }
  }

  moveBy(offsetX, offsetY, graphics) {
    let newX = this.x + offsetX;
    let newY = this.y + offsetY;
    this.setPosition(newX, newY);
    for (let i = 0; i < this.indexes.length; i++) {
      let idx = this.indexes[i];
      graphics[idx].moveBy(offsetX, offsetY);
    }
  }

  copy(graphics) {
    let graphicGroupCopy = new GraphicGroup(graphics, this.indexes);
    return graphicGroupCopy;
  }

  addIndex(graphics, index) {
    let vertices = [this.p5.createVector(0, 0), this.p5.createVector(-0.5, -0.5), this.p5.createVector(0.5, -0.5), this.p5.createVector(0.5, 0.5), this.p5.createVector(-0.5, 0.5)];
    for (let i = 0; i < vertices.length; i++) {
      let x = graphics[index].x + vertices[i].x * graphics[index].w;
      let y = graphics[index].y + vertices[i].y * graphics[index].h;
      this.addVertex(x, y);
    }
    this.indexes.push(index);
    // update drawing properties
    if (graphics[index].fill !== this.fill) this.fill = null;
    if (graphics[index].stroke !== this.stroke) this.stroke = null;
    if (graphics[index].strokeWeight !== this.strokeWeight) this.strokeWeight = null;
    if (this.indexes.length > 1) {
      this.cornerRadii = [];
      delete this.controlPoints.tlr;
      delete this.controlPoints.trr;
      delete this.controlPoints.brr;
      delete this.controlPoints.blr;
    }
    this.updateAspectRatio();
  }

  getParameters(type) {
    let p = {};
    if (type === "group") {
      p = {
        x: this.x,
        y: this.y,
        w: this.w,
        h: this.h,
      };
    }
    this.updateValueDecimals(p, this.decimals);
    return p;
  }

  moveControlPoint(graphics, cpKey, x, y, shiftIsDown = false) {
    if (cpKey.length === 1 && cpKey === "c") {
      this.setPosition(x, y);
    } else if (cpKey.length === 2) {
      let newW = this.w;
      let newH = this.h;
      let newX = this.x;
      let newY = this.y;
      if (cpKey.includes("r")) {
        newW = x - (this.x - this.w / 2);
        newX = x - newW / 2;
      } else if (cpKey.includes("l")) {
        newW = this.x + this.w / 2 - x;
        newX = x + newW / 2;
      }
      // shift is not down
      if (!shiftIsDown) {
        if (cpKey.includes("t")) {
          newH = this.y + this.h / 2 - y;
          newY = y + newH / 2;
        } else if (cpKey.includes("b")) {
          newH = y - (this.y - this.h / 2);
          newY = y - newH / 2;
        }
      } else if (this.originalAspectRatio) {
        newH = newW / this.originalAspectRatio;
        if (cpKey.includes("t")) {
          newY = this.y - (newH - this.h) / 2;
        } else if (cpKey.includes("b")) {
          newY = this.y + (newH - this.h) / 2;
        }
      }
      // hacky way to avoid 0 width or height
      // if (newW !== 0 && newH !==0) {
      this.setDimensions(newW, newH);
      this.setPosition(newX, newY);
      // }
    } else if (cpKey.length === 3 && this.indexes.length === 1) {
      let radius = 0;
      // only if within bounding box
      if (this.checkBoundingBox(x, y)) {
        let respectiveCorner = this.controlPoints[cpKey.slice(0, -1)];
        // calculate radius based on distance from corner the adjusted by sqrt(2) to match control point position
        // ideally this should be distance between (x, y) and the perpendicular line across corner
        radius = respectiveCorner.dist(this.p5.createVector(x, y)) / Math.sqrt(2);
      }
      this.setCornerRadius(radius);
      graphics[this.indexes[0]].setCornerRadius(radius);
    }
    for (let i = 0; i < this.indexes.length; i++) {
      let idx = this.indexes[i];
      let x = this.x + this.vertices[i * 5].x * this.w;
      let y = this.y + this.vertices[i * 5].y * this.h;
      let w = this.w * (this.vertices[i * 5 + 2].x - this.vertices[i * 5 + 1].x);
      let h = this.h * (this.vertices[i * 5 + 3].y - this.vertices[i * 5 + 2].y);
      graphics[idx].setPosition(x, y);
      graphics[idx].setDimensions(w, h);
    }
  }

  display(graphics) {
    let p = this.getParameters(this.type);
    if (this.type === "group") {
      this.p5.noFill();
      this.p5.stroke(80, 160, 255);
      this.p5.strokeWeight(1);
      for (let idx of this.indexes) {
        graphics[idx].display(true);
      }
      /*
      this.p5.rectMode(this.p5.CENTER);
      // parameters
      this.p5.rect(p.x, p.y, p.w, p.h);

      for (let k of Object.keys(this.controlPoints)) {
        let pt = this.controlPoints[k];
        if (k.length === 2) { // corners
          this.p5.fill(255);
          this.p5.square(pt.x, pt.y, this.controlPointSize);
        } else if (k.length === 1) { // center
          this.p5.fill(80,160,255);
          this.p5.circle(pt.x, pt.y, this.controlPointSize);
        } else if (k.length === 3) { // corner raidus
          this.p5.noFill();
          this.p5.circle(pt.x, pt.y, this.controlPointSize*1.5);
          this.p5.fill(150,150,255);
          this.p5.circle(pt.x, pt.y, this.controlPointSize/2);
        }
      }
      */
    }
  }
}
