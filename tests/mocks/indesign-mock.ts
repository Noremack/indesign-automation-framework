export class MockCollection<T extends { name?: string; isValid?: boolean }> {
  private items: T[] = [];
  public itemFactory?: (props: any) => T;

  constructor(initialItems: T[] = [], itemFactory?: (props: any) => T) {
    this.items = [...initialItems];
    this.itemFactory = itemFactory;
    for (const item of this.items) {
      this.attachCollectionHooks(item);
    }
    this.updateNumericIndices();
  }

  [index: number]: T;

  public get length(): number {
    return this.items.length;
  }

  public item(index: number): T {
    return this.items[index];
  }

  public itemByName(name: string): T {
    const found = this.items.find(item => item.name === name);
    if (found) return found;
    // InDesign returns an invalid proxy item when not found
    return { name, isValid: false } as unknown as T;
  }

  public everyItem() {
    return {
      getElements: () => [...this.items]
    };
  }

  public removeItem(item: T): boolean {
    const idx = this.items.indexOf(item);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      delete (this as any)[this.items.length];
      this.updateNumericIndices();
      return true;
    }
    return false;
  }

  private attachCollectionHooks(item: T): void {
    if (!item) return;
    if (!(item as any).parentCollections) {
      (item as any).parentCollections = [];
    }
    if (!(item as any).parentCollections.includes(this)) {
      (item as any).parentCollections.push(this);
    }
    (item as any).parentCollection = this;
    const originalRemove = (item as any).remove;
    (item as any).remove = () => {
      if (typeof originalRemove === "function" && originalRemove !== (item as any).remove) {
        try { originalRemove(); } catch (_) {}
      }
      for (const col of [...(item as any).parentCollections]) {
        col.removeItem(item);
      }
      (item as any).isValid = false;
    };
  }

  public add(props: any = {}): T {
    let newItem: T;
    if (this.itemFactory) {
      newItem = this.itemFactory(props);
    } else if (props && typeof props === "object" && props.constructor && props.constructor !== Object) {
      if (props.isValid === undefined) props.isValid = true;
      if (props.id === undefined) props.id = Math.floor(Math.random() * 10000) + 1000;
      newItem = props;
    } else {
      newItem = {
        id: Math.floor(Math.random() * 10000) + 1000,
        isValid: true,
        ...props
      } as unknown as T;
    }
    this.attachCollectionHooks(newItem);
    if (!this.items.includes(newItem)) {
      this.items.push(newItem);
      this.updateNumericIndices();
    }
    return newItem;
  }

  private updateNumericIndices() {
    for (let i = 0; i < this.items.length; i++) {
      (this as any)[i] = this.items[i];
    }
  }
}

export class MockLayer {
  public id = 200;
  public isValid = true;
  public name = "Layer 1";
  public visible = true;
  public locked = false;
  public pageItems = new MockCollection<any>([]);

  constructor(props: Partial<MockLayer> = {}) {
    Object.assign(this, props);
  }

  public move(_to?: any, _reference?: any) {}

  public remove() {
    if ((this as any).parentCollection) {
      (this as any).parentCollection.removeItem(this);
    }
    this.isValid = false;
  }
}

export class MockColor {
  public id = 300;
  public isValid = true;
  public name = "Black";
  public model = 1886545267; // PROCESS
  public space = 1129142603; // CMYK
  public colorValue: number[] = [0, 0, 0, 100];

  constructor(props: Partial<MockColor> = {}) {
    Object.assign(this, props);
  }

  public remove(replacingWith?: any) {
    if ((this as any).parentCollection) {
      (this as any).parentCollection.removeItem(this);
    }
    this.isValid = false;
  }
}

export class MockParagraphStyle {
  public id = 400;
  public isValid = true;
  public name = "[Basic Paragraph]";
  public pointSize = 12;
  public leading = 14;
  public alignToBaseline = false;
  public hyphenation = true;
  public justification: any = 1818584692;
  public composer = "Adobe World-Ready Paragraph Composer";
  public tracking = 0;
  public spaceBefore = 0;
  public spaceAfter = 0;
  public spaceBetweenParagraphsOfSameStyle = 0;
  public spaceBetweenParagraphsForSameStyle = 0;
  public fillColor: any = null;
  public styleExportTagMaps = new MockCollection<any>([]);

  constructor(props: Partial<MockParagraphStyle> = {}) {
    Object.assign(this, props);
  }
}

export class MockParagraphStyleGroup {
  public id = 450;
  public isValid = true;
  public name = "Group 1";
  public paragraphStyles: MockCollection<MockParagraphStyle>;
  public paragraphStyleGroups: MockCollection<MockParagraphStyleGroup>;

  constructor(nameOrProps: string | Partial<MockParagraphStyleGroup> = "Group 1", styles: MockParagraphStyle[] = [], childGroups: MockParagraphStyleGroup[] = []) {
    if (typeof nameOrProps === "object") {
      this.name = nameOrProps.name || "Group 1";
      this.paragraphStyles = nameOrProps.paragraphStyles || new MockCollection<MockParagraphStyle>([]);
      this.paragraphStyleGroups = nameOrProps.paragraphStyleGroups || new MockCollection<MockParagraphStyleGroup>([]);
      Object.assign(this, nameOrProps);
    } else {
      this.name = nameOrProps;
      this.paragraphStyles = new MockCollection<MockParagraphStyle>(styles);
      this.paragraphStyleGroups = new MockCollection<MockParagraphStyleGroup>(childGroups);
    }
    this.paragraphStyleGroups.itemFactory = (p) => new MockParagraphStyleGroup(p);
    this.paragraphStyles.itemFactory = (p) => new MockParagraphStyle(p);
  }
}

export class MockCharacterStyle {
  public id = 500;
  public isValid = true;
  public name = "[None]";
  public fillColor: any = null;
  public styleExportTagMaps = new MockCollection<any>([]);

  constructor(props: Partial<MockCharacterStyle> = {}) {
    Object.assign(this, props);
  }
}

export class MockCharacterStyleGroup {
  public id = 550;
  public isValid = true;
  public name = "CharGroup 1";
  public characterStyles: MockCollection<MockCharacterStyle>;
  public characterStyleGroups: MockCollection<MockCharacterStyleGroup>;

  constructor(nameOrProps: string | Partial<MockCharacterStyleGroup> = "CharGroup 1", styles: MockCharacterStyle[] = [], childGroups: MockCharacterStyleGroup[] = []) {
    if (typeof nameOrProps === "object") {
      this.name = nameOrProps.name || "CharGroup 1";
      this.characterStyles = nameOrProps.characterStyles || new MockCollection<MockCharacterStyle>([]);
      this.characterStyleGroups = nameOrProps.characterStyleGroups || new MockCollection<MockCharacterStyleGroup>([]);
      Object.assign(this, nameOrProps);
    } else {
      this.name = nameOrProps;
      this.characterStyles = new MockCollection<MockCharacterStyle>(styles);
      this.characterStyleGroups = new MockCollection<MockCharacterStyleGroup>(childGroups);
    }
    this.characterStyleGroups.itemFactory = (p) => new MockCharacterStyleGroup(p);
    this.characterStyles.itemFactory = (p) => new MockCharacterStyle(p);
  }
}

export class MockGradientStop {
  public stopColor: any = null;
  public location = 0;
  public midpoint = 50;

  constructor(props: Partial<MockGradientStop> = {}) {
    Object.assign(this, props);
  }
}

export class MockGradient {
  public id = 300;
  public isValid = true;
  public name = "Linear Gradient";
  public type = 1818850926; // LINEAR
  public gradientStops: MockGradientStop[] = [];

  constructor(props: Partial<MockGradient> = {}) {
    Object.assign(this, props);
    if (!this.gradientStops || this.gradientStops.length === 0) {
      this.gradientStops = [
        new MockGradientStop({ location: 0 }),
        new MockGradientStop({ location: 100 })
      ];
    }
  }
}

export class MockObjectStyle {
  public id = 800;
  public isValid = true;
  public name = "[None]";

  constructor(props: Partial<MockObjectStyle> = {}) {
    Object.assign(this, props);
  }
}

export class MockObjectStyleGroup {
  public id = 850;
  public isValid = true;
  public name = "ObjGroup 1";
  public objectStyles: MockCollection<MockObjectStyle>;
  public objectStyleGroups: MockCollection<MockObjectStyleGroup>;

  constructor(nameOrProps: string | Partial<MockObjectStyleGroup> = "ObjGroup 1", styles: MockObjectStyle[] = [], childGroups: MockObjectStyleGroup[] = []) {
    if (typeof nameOrProps === "object") {
      this.name = nameOrProps.name || "ObjGroup 1";
      this.objectStyles = nameOrProps.objectStyles || new MockCollection<MockObjectStyle>([]);
      this.objectStyleGroups = nameOrProps.objectStyleGroups || new MockCollection<MockObjectStyleGroup>([]);
      Object.assign(this, nameOrProps);
    } else {
      this.name = nameOrProps;
      this.objectStyles = new MockCollection<MockObjectStyle>(styles);
      this.objectStyleGroups = new MockCollection<MockObjectStyleGroup>(childGroups);
    }
    this.objectStyleGroups.itemFactory = (p) => new MockObjectStyleGroup(p);
    this.objectStyles.itemFactory = (p) => new MockObjectStyle(p);
  }
}

export class MockCellStyle {
  public id = 900;
  public isValid = true;
  public name = "[None]";

  constructor(props: Partial<MockCellStyle> = {}) {
    Object.assign(this, props);
  }
}

export class MockCellStyleGroup {
  public id = 950;
  public isValid = true;
  public name = "CellGroup 1";
  public cellStyles: MockCollection<MockCellStyle>;
  public cellStyleGroups: MockCollection<MockCellStyleGroup>;

  constructor(nameOrProps: string | Partial<MockCellStyleGroup> = "CellGroup 1", styles: MockCellStyle[] = [], childGroups: MockCellStyleGroup[] = []) {
    if (typeof nameOrProps === "object") {
      this.name = nameOrProps.name || "CellGroup 1";
      this.cellStyles = nameOrProps.cellStyles || new MockCollection<MockCellStyle>([]);
      this.cellStyleGroups = nameOrProps.cellStyleGroups || new MockCollection<MockCellStyleGroup>([]);
      Object.assign(this, nameOrProps);
    } else {
      this.name = nameOrProps;
      this.cellStyles = new MockCollection<MockCellStyle>(styles);
      this.cellStyleGroups = new MockCollection<MockCellStyleGroup>(childGroups);
    }
    this.cellStyleGroups.itemFactory = (p) => new MockCellStyleGroup(p);
    this.cellStyles.itemFactory = (p) => new MockCellStyle(p);
  }
}

export class MockTableStyle {
  public id = 980;
  public isValid = true;
  public name = "[Basic Table]";

  constructor(props: Partial<MockTableStyle> = {}) {
    Object.assign(this, props);
  }
}

export class MockTableStyleGroup {
  public id = 990;
  public isValid = true;
  public name = "TableGroup 1";
  public tableStyles: MockCollection<MockTableStyle>;
  public tableStyleGroups: MockCollection<MockTableStyleGroup>;

  constructor(nameOrProps: string | Partial<MockTableStyleGroup> = "TableGroup 1", styles: MockTableStyle[] = [], childGroups: MockTableStyleGroup[] = []) {
    if (typeof nameOrProps === "object") {
      this.name = nameOrProps.name || "TableGroup 1";
      this.tableStyles = nameOrProps.tableStyles || new MockCollection<MockTableStyle>([]);
      this.tableStyleGroups = nameOrProps.tableStyleGroups || new MockCollection<MockTableStyleGroup>([]);
      Object.assign(this, nameOrProps);
    } else {
      this.name = nameOrProps;
      this.tableStyles = new MockCollection<MockTableStyle>(styles);
      this.tableStyleGroups = new MockCollection<MockTableStyleGroup>(childGroups);
    }
    this.tableStyleGroups.itemFactory = (p) => new MockTableStyleGroup(p);
    this.tableStyles.itemFactory = (p) => new MockTableStyle(p);
  }
}

export class MockParagraph {
  public contents: string;
  public appliedParagraphStyle: any = null;
  public isValid = true;

  constructor(contents: string = "") {
    this.contents = contents;
  }

  public clearOverrides() {}

  public applyParagraphStyle(style: any, _clearOverrides: boolean = false) {
    this.appliedParagraphStyle = style;
  }
}

export class MockCell {
  public contents = "";
  public appliedCellStyle: any = null;
  public isValid = true;

  constructor(contents: string = "") {
    this.contents = contents;
  }

  public clearCellStyleOverrides() {}
}

export class MockRow {
  public cells: MockCell[] = [];

  constructor(cellCount: number = 3) {
    for (let i = 0; i < cellCount; i++) {
      this.cells.push(new MockCell());
    }
  }
}

export class MockColumn {
  public cells: MockCell[] = [];

  constructor(cellCount: number = 4) {
    for (let i = 0; i < cellCount; i++) {
      this.cells.push(new MockCell());
    }
  }
}

export class MockTable {
  public id = 800;
  public isValid = true;
  public headerRowCount = 1;
  public bodyRowCount = 3;
  public columnCount = 3;
  public appliedTableStyle: any = null;
  public rows: MockRow[] = [];
  public columns: MockColumn[] = [];
  public cells: MockCollection<MockCell>;

  constructor(props: any = {}) {
    Object.assign(this, props);
    const totalRows = (this.headerRowCount || 0) + (this.bodyRowCount || 0);
    const colCount = this.columnCount || 3;
    const allCells: MockCell[] = [];

    for (let r = 0; r < totalRows; r++) {
      const row = new MockRow(colCount);
      this.rows.push(row);
      allCells.push(...row.cells);
    }
    for (let c = 0; c < colCount; c++) {
      const col = new MockColumn(totalRows);
      for (let r = 0; r < totalRows; r++) {
        col.cells[r] = this.rows[r].cells[c];
      }
      this.columns.push(col);
    }
    this.cells = new MockCollection<MockCell>(allCells);
  }

  public clearTableStyleOverrides() {}
}

export class MockStory {
  public id = 600;
  public isValid = true;
  public contents = "Mock Story Content";
  public locked = false;
  public appliedParagraphStyle: any = null;
  public textContainers: any[] = [];
  public paragraphs = new MockCollection<any>([]);
  public characters = new MockCollection<any>([]);
  public words = new MockCollection<any>([]);

  constructor(contents: string = "Mock Story Content") {
    this.contents = contents;
  }

  public clearOverrides() {}
}

export class MockTextFrame {
  public id = 700;
  public isValid = true;
  public name = "TextFrame 1";
  private _contents = "Hello InDesign";
  private _paragraphs: MockParagraph[] = [];
  public geometricBounds: [number, number, number, number] = [0, 0, 100, 100];
  public visibleBounds: [number, number, number, number] = [0, 0, 100, 100];
  public parentStory: MockStory;
  public overflows = false;
  public locked = false;
  public itemLayer: MockLayer;
  public parent: any = null;
  public label = "";
  public appliedObjectStyle: any = null;
  public strokeWeight = 0;
  public strokeColor: any = null;
  public fillColor: any = null;
  public textFramePreferences = {
    textColumnCount: 1,
    verticalJustification: 1953723732
  };
  public tables = new MockCollection<MockTable>([]);

  public get contents(): string {
    return this._contents;
  }

  public set contents(val: string) {
    this._contents = val;
    const lines = String(val).split(/\r\n|\r|\n/);
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    this._paragraphs = lines.map(line => new MockParagraph(line));
  }

  public get paragraphs(): any {
    return new MockCollection<MockParagraph>(this._paragraphs);
  }

  public get insertionPoints(): any {
    const self = this;
    return {
      lastItem: () => ({
        contents: "",
        tables: {
          add: (props: any) => {
            const tbl = new MockTable(props);
            self.tables.add(tbl);
            return tbl;
          }
        }
      })
    };
  }

  constructor(props: Partial<MockTextFrame> = {}) {
    this.parentStory = new MockStory();
    this.itemLayer = new MockLayer();
    Object.assign(this, props);
    if (props.contents !== undefined) {
      this.contents = props.contents;
    }
    if (!props.parentStory) {
      this.parentStory.textContainers = [this];
    }
  }

  public recompose() {}

  public clearOverrides() {}

  public applyParagraphStyle(style: any, _clearOverrides: boolean = false) {
    this.parentStory.appliedParagraphStyle = style;
  }
}

export class MockMarginPreferences {
  public top: number | string = "12mm";
  public bottom: number | string = "12mm";
  public left: number | string = "12mm";
  public right: number | string = "12mm";
  public columnGutter: number | string = "5mm";

  public get properties(): any {
    return {
      top: this.top,
      bottom: this.bottom,
      left: this.left,
      right: this.right,
      columnGutter: this.columnGutter
    };
  }

  public set properties(props: any) {
    Object.assign(this, props);
  }
}

export class MockRectangle {
  public id = Math.floor(Math.random() * 10000) + 1000;
  public isValid = true;
  public name = "";
  public label = "";
  public geometricBounds: [number, number, number, number] = [0, 0, 0, 0];
  public fillColor: any = null;
  public strokeColor: any = null;
  public strokeWeight = 0;
  public appliedObjectStyle: any = null;
  public itemLayer: any = null;
  public locked = false;
  public visible = true;
  public topLeftCornerOption: any = null;
  public topRightCornerOption: any = null;
  public bottomLeftCornerOption: any = null;
  public bottomRightCornerOption: any = null;
  public topLeftCornerRadius = 0;
  public topRightCornerRadius = 0;
  public bottomLeftCornerRadius = 0;
  public bottomRightCornerRadius = 0;

  constructor(props: Partial<MockRectangle> = {}) {
    Object.assign(this, props);
  }
}

export class MockPage {
  public id = 100;
  public isValid = true;
  public name = "1";
  public side: any = "right";
  public bounds: [number, number, number, number] = [0, 0, 841.89, 595.28]; // A4 in points (297x210 mm)
  public appliedMaster: any = null;
  public marginPreferences = new MockMarginPreferences();
  public pageItems = new MockCollection<any>([]);
  public textFrames = new MockCollection<MockTextFrame>([]);
  public rectangles = new MockCollection<MockRectangle>([]);

  constructor(props: Partial<MockPage> = {}) {
    Object.assign(this, props);
    this.textFrames.itemFactory = (p) => {
      let frame: MockTextFrame;
      if (p instanceof MockTextFrame) {
        frame = p;
      } else if (p && typeof p === "object" && (p as any).name && (p as any).locked !== undefined && !(p as any).parentStory) {
        frame = new MockTextFrame({ itemLayer: p });
      } else {
        frame = new MockTextFrame(p);
      }
      this.pageItems.add(frame);
      return frame;
    };
    this.rectangles.itemFactory = (p) => {
      let rect: MockRectangle;
      if (p instanceof MockRectangle) {
        rect = p;
      } else {
        rect = new MockRectangle(p);
      }
      this.pageItems.add(rect);
      return rect;
    };
  }
}

export class MockMasterSpread {
  public id = 200;
  public isValid = true;
  public namePrefix = "A";
  public baseName = "Master";
  public pages: MockCollection<MockPage>;
  public pageItems = new MockCollection<any>([]);

  public get name(): string {
    return `${this.namePrefix}-${this.baseName}`;
  }

  public set name(val: string) {
    const parts = val.split("-");
    if (parts.length > 1) {
      this.namePrefix = parts[0];
      this.baseName = parts.slice(1).join("-");
    } else {
      this.baseName = val;
    }
  }

  constructor(props: Partial<MockMasterSpread> = {}) {
    Object.assign(this, props);
    this.pages = new MockCollection<MockPage>([
      new MockPage({ name: "A", bounds: [0, 0, 841.89, 595.28] })
    ]);
    this.pages.itemFactory = (p) => new MockPage(p);
  }
}

export class MockDocument {
  public id = 1001;
  public name = "Untitled-1.indd";
  public isValid = true;
  public saved = true;
  public modified = false;
  public zeroPoint: [number, number] = [0, 0];
  public documentPreferences: any = {
    pageWidth: 595.28,  // 210mm in points
    pageHeight: 841.89, // 297mm in points
    intent: 1886547822  // PRINT_INTENT
  };
  public transparencyPreferences: any = {
    blendingSpace: 1129142603 // CMYK
  };
  public viewPreferences = {
    horizontalMeasurementUnits: 2054188905, // POINTS
    verticalMeasurementUnits: 2054188905,   // POINTS
    rulerOrigin: 1380143215                 // PAGE_ORIGIN
  };

  public colors: MockCollection<MockColor>;
  public gradients: MockCollection<MockGradient>;
  public layers: MockCollection<MockLayer>;
  public paragraphStyles: MockCollection<MockParagraphStyle>;
  public paragraphStyleGroups: MockCollection<MockParagraphStyleGroup>;
  public characterStyles: MockCollection<MockCharacterStyle>;
  public characterStyleGroups: MockCollection<MockCharacterStyleGroup>;
  public objectStyles: MockCollection<MockObjectStyle>;
  public objectStyleGroups: MockCollection<MockObjectStyleGroup>;
  public cellStyles: MockCollection<MockCellStyle>;
  public cellStyleGroups: MockCollection<MockCellStyleGroup>;
  public tableStyles: MockCollection<MockTableStyle>;
  public tableStyleGroups: MockCollection<MockTableStyleGroup>;
  public masterSpreads: MockCollection<MockMasterSpread>;
  public pages: MockCollection<MockPage>;
  public spreads: MockCollection<any>;
  public textFrames: MockCollection<MockTextFrame>;

  constructor() {
    this.colors = new MockCollection<MockColor>([
      new MockColor({ name: "Black", space: 1129142603, colorValue: [0, 0, 0, 100] }),
      new MockColor({ name: "Paper", space: 1129142603, colorValue: [0, 0, 0, 0] }),
      new MockColor({ name: "Registration", space: 1129142603, colorValue: [100, 100, 100, 100] })
    ]);
    this.gradients = new MockCollection<MockGradient>([]);
    this.gradients.itemFactory = (p) => new MockGradient(p);
    this.layers = new MockCollection<MockLayer>([
      new MockLayer({ name: "Layer 1" })
    ]);
    this.layers.itemFactory = (p) => new MockLayer(p);
    this.paragraphStyles = new MockCollection<MockParagraphStyle>([
      new MockParagraphStyle({ name: "[Basic Paragraph]" })
    ]);
    this.paragraphStyles.itemFactory = (p) => new MockParagraphStyle(p);
    this.paragraphStyleGroups = new MockCollection<MockParagraphStyleGroup>([]);
    this.paragraphStyleGroups.itemFactory = (p) => new MockParagraphStyleGroup(p);
    this.characterStyles = new MockCollection<MockCharacterStyle>([
      new MockCharacterStyle({ name: "[None]" })
    ]);
    this.characterStyles.itemFactory = (p) => new MockCharacterStyle(p);
    this.characterStyleGroups = new MockCollection<MockCharacterStyleGroup>([]);
    this.characterStyleGroups.itemFactory = (p) => new MockCharacterStyleGroup(p);
    this.objectStyles = new MockCollection<MockObjectStyle>([
      new MockObjectStyle({ name: "[None]" })
    ]);
    this.objectStyles.itemFactory = (p) => new MockObjectStyle(p);
    this.objectStyleGroups = new MockCollection<MockObjectStyleGroup>([]);
    this.objectStyleGroups.itemFactory = (p) => new MockObjectStyleGroup(p);
    this.cellStyles = new MockCollection<MockCellStyle>([
      new MockCellStyle({ name: "[None]" })
    ]);
    this.cellStyles.itemFactory = (p) => new MockCellStyle(p);
    this.cellStyleGroups = new MockCollection<MockCellStyleGroup>([]);
    this.cellStyleGroups.itemFactory = (p) => new MockCellStyleGroup(p);
    this.tableStyles = new MockCollection<MockTableStyle>([
      new MockTableStyle({ name: "[Basic Table]" })
    ]);
    this.tableStyles.itemFactory = (p) => new MockTableStyle(p);
    this.tableStyleGroups = new MockCollection<MockTableStyleGroup>([]);
    this.tableStyleGroups.itemFactory = (p) => new MockTableStyleGroup(p);
    this.masterSpreads = new MockCollection<MockMasterSpread>([
      new MockMasterSpread({ namePrefix: "A", baseName: "Master" })
    ]);
    this.masterSpreads.itemFactory = (p) => new MockMasterSpread(p);
    this.textFrames = new MockCollection<MockTextFrame>([]);
    this.pages = new MockCollection<MockPage>([new MockPage({ id: 1, name: "1", isValid: true })]);
    this.pages.itemFactory = (p) => new MockPage(p);
    this.spreads = new MockCollection<any>([{ id: 10, isValid: true }]);
  }

  public get swatches(): MockCollection<any> {
    const list: any[] = [];
    list.push(new MockColor({ name: "[None]", id: 1 }));
    list.push(new MockColor({ name: "None", id: 2 }));
    list.push(new MockColor({ name: "Paper", id: 3 }));
    list.push(...this.colors.everyItem().getElements());
    list.push(...this.gradients.everyItem().getElements());
    return new MockCollection<any>(list);
  }

  public get activeLayer(): MockLayer {
    return this.layers[0];
  }

  public recompose() {}
  public save() { this.modified = false; this.saved = true; }
  public revert() { this.modified = false; }
  public close() {}
}

export class MockDialogControl {
  public checkedState = true;
  public staticLabel: string = "";
  public selectedIndex = 0;
  constructor(props: any = {}) {
    if (props.checkedState !== undefined) this.checkedState = props.checkedState;
    if (props.staticLabel !== undefined) this.staticLabel = props.staticLabel;
    if (props.selectedIndex !== undefined) this.selectedIndex = props.selectedIndex;
  }
}

export class MockDialogRow {
  public controls: MockDialogControl[] = [];
  public staticTexts = {
    add: (props: any = {}) => {
      const c = new MockDialogControl(props);
      this.controls.push(c);
      return c;
    }
  };
  public checkboxControls = {
    add: (props: any = {}) => {
      const c = new MockDialogControl(props);
      this.controls.push(c);
      return c;
    }
  };
  public dropdowns = {
    add: (props: any = {}) => {
      const c = new MockDialogControl(props);
      this.controls.push(c);
      return c;
    }
  };
}

export class MockDialogColumn {
  public rows: MockDialogRow[] = [];
  public panels: MockBorderPanel[] = [];
  public dialogRows = {
    add: () => {
      const r = new MockDialogRow();
      this.rows.push(r);
      return r;
    }
  };
  public borderPanels = {
    add: () => {
      const p = new MockBorderPanel();
      this.panels.push(p);
      return p;
    }
  };
}

export class MockBorderPanel {
  public columns: MockDialogColumn[] = [];
  public dialogColumns = {
    add: () => {
      const c = new MockDialogColumn();
      this.columns.push(c);
      return c;
    }
  };
}

export class MockDialog {
  public name: string;
  public canCancel: boolean;
  public columns: MockDialogColumn[] = [];
  public panels: MockBorderPanel[] = [];
  public dialogColumns = {
    add: () => {
      const c = new MockDialogColumn();
      this.columns.push(c);
      return c;
    }
  };
  public borderPanels = {
    add: () => {
      const p = new MockBorderPanel();
      this.panels.push(p);
      return p;
    }
  };
  public showResult = true;
  constructor(props: any = {}) {
    this.name = props.name || "Dialog";
    this.canCancel = props.canCancel ?? true;
  }
  public show(): boolean {
    return this.showResult;
  }
  public destroy() {}
}

export class MockApplication {
  public version = "19.0";
  public documents: MockCollection<MockDocument>;
  public selection: any[] = [];
  public scriptPreferences = {
    enableRedraw: true,
    userInteractionLevel: 1699640946
  };
  public findGrepPreferences: any = null;
  public changeGrepPreferences: any = null;
  public findTextPreferences: any = null;
  public changeTextPreferences: any = null;
  public dialogs: {
    add: (props?: any) => MockDialog;
  };
  public books: MockCollection<any>;
  public activeBook: any = null;

  constructor() {
    this.documents = new MockCollection<MockDocument>([new MockDocument()], () => new MockDocument());
    this.books = new MockCollection<any>([]);
    this.dialogs = {
      add: (props?: any) => new MockDialog(props)
    };
  }

  public get activeDocument(): MockDocument {
    return this.documents[0];
  }

  public doScript(
    action: (() => void) | string,
    language?: any,
    args?: any[],
    undoMode?: any,
    undoName?: string
  ): any {
    if (typeof action === "function") {
      return action();
    }
    return undefined;
  }
}

export const mockApp = new MockApplication();
export const app = mockApp;

export const ScriptLanguage = {
  UXP_SCRIPT: 1433299827,
  JAVASCRIPT: 1246973031
};

export const UndoModes = {
  ENTIRE_SCRIPT: 1699963765,
  AUTO_UNDO: 1699963745,
  SCRIPT_REQUEST: 1699963762
};

export const RulerOrigin = {
  PAGE_ORIGIN: 1380143215,
  SPREAD_ORIGIN: 1380143983
};

export const MeasurementUnits = {
  POINTS: 2054188905,
  INCHES: 2053729891,
  MILLIMETERS: 2053991795,
  PICAS: 2054187363
};

export const ColorModel = {
  PROCESS: 1886545267,
  SPOT: 1886611056
};

export const ColorSpace = {
  CMYK: 1129142603,
  RGB: 1666336572,
  LAB: 1281450594
};

export const NothingEnum = {
  NOTHING: 1851876449
};

export const SaveOptions = {
  YES: 2003395685,
  NO: 1852776480,
  ASK: 1634954091
};

export const LocationOptions = {
  BEFORE: 1650812527,
  AFTER: 1634104421,
  AT_BEGINNING: 1635017319,
  AT_END: 1635018094
};

export default {
  app,
  mockApp,
  ScriptLanguage,
  UndoModes,
  RulerOrigin,
  MeasurementUnits,
  ColorModel,
  ColorSpace,
  NothingEnum,
  SaveOptions,
  LocationOptions
};