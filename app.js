import { ref } from "vue";

export default {
  data() {
    return {
      pcp: "",
      editor: ref(null),
      activeToolIndex: "",
      tools: "",
      code: "",
      hideStrokeWeightSlider: true,
      isMac: navigator.appVersion.indexOf("Mac") !== -1,
      activeCursor: "",
    };
  },
  mounted() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("click", this.handleClick);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    this.pcp = new P5CodePainter(2048, 2048, p5);
    this.setActiveToolIndex(0);
    this.tools = this.pcp.tools;
    this.code = this.pcp.getCodeString();
    this.loadSettings();
  },
  beforeUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("click", this.handleClick);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
  },
  updated() {
    // scroll to bottom of textarea
    editor.scrollTop = editor.scrollHeight;
  },
  computed: {
    boundingBox() {
      let para = {
        active: false,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      };
      if (this.pcp.settings && this.pcp.settings.selectedGraphicGroup) {
        para = this.pcp.settings.selectedGraphicGroup.getParameters("group");
        para.w = Math.abs(para.w);
        para.h = Math.abs(para.h);
        para.active = true;
      }
      return para;
    },
  },
  methods: {
    loadSettings() {
      document.getElementById("fl-picker").value = this.pcp.getFill().toString("#rrggbb");
      document.getElementById("st-picker").value = this.pcp.getStroke().toString("#rrggbb");
      document.getElementById("sw-slider").value = this.pcp.getStrokeWeight();
    },
    setColor(hexValue, key) {
      this.pcp.updateSetting(this.pcp.p5.color(hexValue), key);
    },
    setStrokeWeight(stringValue, key) {
      this.pcp.updateSetting(parseInt(stringValue), key);
    },
    setActiveToolIndex(index) {
      this.pcp.setActiveToolIndex(index);
      this.activeToolIndex = this.pcp.getActiveToolIndex();
      if (this.activeToolIndex < 5) {
        this.activeCursor = "crosshair";
      } else {
        this.activeCursor = "auto";
      }
    },
    handleMouseUp(evt) {
      this.pcp.mouseReleased(evt);
      this.code = this.pcp.getCodeString();
    },
    handleMouseDown(evt) {
      this.pcp.mousePressed(evt);
      this.loadSettings();
      this.code = this.pcp.getCodeString();
    },
    handleMouseMove(evt) {
      this.pcp.mouseMoved(evt);
      this.code = this.pcp.getCodeString();
    },
    handleClick(evt) {
      this.pcp.mouseClicked(evt);
      this.loadSettings();
      this.code = this.pcp.getCodeString();
    },
    handleKeyUp(evt) {
      if (evt.key === "Shift") {
        this.pcp.deactivateShift();
      }
      this.pcp.keyReleased(evt);
      this.loadSettings();
      this.code = this.pcp.getCodeString();
    },
    handleKeyDown(evt) {
      if ((this.isMac && evt.metaKey) || (!this.isMac && evt.ctrlKey)) {
        if (evt.code === "KeyX") {
          // evt.preventDefault();
          this.pcp.copy();
          this.pcp.remove();
        } else if (evt.code === "KeyC") {
          // evt.preventDefault();
          this.pcp.copy();
        } else if (evt.code === "KeyV") {
          // evt.preventDefault();
          this.pcp.paste(0, 0);
        } else if (evt.code === "KeyD") {
          // duplicate with an offset
          evt.preventDefault();
          this.pcp.copy();
          this.pcp.paste(this.pcp.settings.pasteOffset.x, this.pcp.settings.pasteOffset.y);
        } else if (evt.code === "KeyZ" && evt.shiftKey) {
          evt.preventDefault();
          this.pcp.redo();
        } else if (evt.code === "KeyZ") {
          evt.preventDefault();
          this.pcp.undo();
        } else if (evt.code === "KeyA") {
          evt.preventDefault();
          this.pcp.selectAllGraphics();
        }
        // to be added later, must not be typing (aka, only do this when canvas is active, rather than text editor for instance)
      } else if (evt.code === "KeyV") {
        // select
        this.setActiveToolIndex(5);
      } else if (evt.code === "KeyR") {
        // rect
        this.setActiveToolIndex(0);
      } else if (evt.code === "KeyE") {
        // ellipse
        this.setActiveToolIndex(1);
      } else if (evt.code === "KeyL") {
        // line
        this.setActiveToolIndex(2);
      } else if (evt.code === "KeyC") {
        // bezier (c for curve)
        this.setActiveToolIndex(3);
      } else if (evt.code === "KeyB") {
        // brush
        this.setActiveToolIndex(4);
      } else if (evt.code === "Backspace") {
        this.pcp.remove();
      } else if (evt.key === "Shift") {
        this.pcp.activateShift();
      } else if (evt.code === "ArrowUp") {
        this.pcp.moveUp();
      } else if (evt.code === "ArrowDown") {
        this.pcp.moveDown();
      } else if (evt.code === "ArrowLeft") {
        this.pcp.moveLeft();
      } else if (evt.code === "ArrowRight") {
        this.pcp.moveRight();
      }
      this.loadSettings();
      this.code = this.pcp.getCodeString();
      this.pcp.keyPressed(evt);
    },
  },
  template: `
    <div id="p5sketch"
      :style="{ cursor: activeCursor }">
      <svg
        id="bounding-box-wrapper"
        :class="{active: boundingBox.active}"
        :style="{ left: boundingBox.x + 'px', top: boundingBox.y + 'px', width: boundingBox.w + 'px', height: boundingBox.h + 'px' }">
        <rect
          class="bounding-box"
          :x="0" :y="0"
          :width="boundingBox.w"
          :height="boundingBox.h">
        </rect>
        <rect id="tl" class="control-point top left"
          :x="-3" :y="-3">
        </rect>
        <rect id="tc" class="control-point top center"
          :x="boundingBox.w/2-3" :y="-3">
        </rect>
        <rect id="tr" class="control-point top right"
          :x="boundingBox.w-3" :y="-3">
        </rect>
        <rect id="rc" class="control-point right center"
          :x="boundingBox.w-3" :y="boundingBox.h/2-3">
        </rect>
        <rect id="br" class="control-point bottom right"
          :x="boundingBox.w-3" :y="boundingBox.h-3">
        </rect>
        <rect id="bc" class="control-point bottom center"
          :x="boundingBox.w/2-3" :y="boundingBox.h-3">
        </rect>
        <rect id="bl" class="control-point bottom left"
          :x="-3" :y="boundingBox.h-3">
        </rect>
        <rect id="lc" class="control-point left center"
          :x="-3" :y="boundingBox.h/2-3">
        </rect>
        <circle id="c" class="control-point center"
          :cx="boundingBox.w/2" :cy="boundingBox.h/2" r="3">
        </circle>
      </svg>
    </div>
    <ul id="tools">
      <li v-for="(tool, index) in tools">
        <button
            class="tool"
            :class="{active: activeToolIndex === index}"
            @click="setActiveToolIndex(index)">{{ tool }}</button>
      </li>
    </ul>
    <div id="instructions">
      <p>p5.js Code Painter by <a href="https://jackbdu.com/about/" target="_blank">Jack B. Du</a>. This is an experimental painting app that translates your painting into p5.js code.</p>
      <p>Shortcuts: Ctrl/⌘ + X (Cut), Ctrl/⌘ + C (Copy), Ctrl/⌘ + V (Paste), Ctrl/⌘ + D (Duplicate), Ctrl/⌘ + Z (Undo), Ctrl/⌘ + ⇧ + Z (Redo), Ctrl/⌘ + A (Select All), Backspace (Remove Selection), Arrow Keys (Move Selection)</p>
      <p>To run your code, copy entire code in the text area, paste it between the curly braces "{}" that comes after draw() in <a href="https://editor.p5js.org/" target="_blank">p5.js Web Editor</a>, and finally, click the play button to see the results.</p>
    </div>
    <div id='settings'>
      <div id='color-pickers'>
        <input
            type="color"
            id="bg-picker"
            value="#ffffff"
            @input="event => setColor(event.target.value, 'background')">
        <input
            type="color"
            id="st-picker"
            value="#000000"
            @mouseover="hideStrokeWeightSlider = false"
            @input="event => setColor(event.target.value, 'stroke')">
        <input
            type="color"
            id="fl-picker"
            value="#ffffff"
            @input="event => setColor(event.target.value, 'fill')">
      </div>
      <input
          type="range"
          :class="{hide: hideStrokeWeightSlider}"
          id="sw-slider"
          max="28"
          step="1"
          @mouseout="hideStrokeWeightSlider = true"
          @input="event => setStrokeWeight(event.target.value, 'strokeWeight')">
    </div>
    <textarea ref="editor" id="editor">{{ code }}</textarea>
  `,
};
