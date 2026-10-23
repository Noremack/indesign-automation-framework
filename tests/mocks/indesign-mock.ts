export class MockCollection<T extends { name?: string; isValid?: boolean }> {
  private items: T[] = [];

  constructor(initialItems: T[] = []) {
    this.items = [...initialItems];
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

  public add(props: any = {}): T {
    let newItem: T;
    if (props && typeof props === "object" && props.constructor && props.constructor !== Object) {
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
    this.items.push(newItem);
    this.updateNumericIndices();
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

  constructor(props: Partial<MockLayer> = {}) {
    Object.assign(this, props);
  }
}

export class MockColor {
  public id = 300;
  public isValid = true;
  public name = "Black";
  public model = 1886545267; // PROCESS
  public space = 1129142603; // CMYK
  public colorValue = [0, 0, 0, 100];

  constructor(props: Partial<MockColor> = {}) {
    Object.assign(this, props);
  }
}

export class MockParagraphStyle {
  public id = 400;
  public isValid = true;
  public name = "[Basic Paragraph]";
  public pointSize = 12;

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

  constructor(name: string, styles: MockParagraphStyle[] = [], childGroups: MockParagraphStyleGroup[] = []) {
    this.name = name;
    this.paragraphStyles = new MockCollection<MockParagraphStyle>(styles);
    this.paragraphStyleGroups = new MockCollection<MockParagraphStyleGroup>(childGroups);
  }
}

export class MockCharacterStyle {
  public id = 500;
  public isValid = true;
  public name = "[None]";

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

  constructor(name: string, styles: MockCharacterStyle[] = [], childGroups: MockCharacterStyleGroup[] = []) {
    this.name = name;
    this.characterStyles = new MockCollection<MockCharacterStyle>(styles);
    this.characterStyleGroups = new MockCollection<MockCharacterStyleGroup>(childGroups);
  }
}

export class MockStory {
  public id = 600;
  public isValid = true;
  public contents = "Mock Story Content";
  public locked = false;
  public textContainers: any[] = [];
  public paragraphs = new MockCollection<any>([]);
  public characters = new MockCollection<any>([]);
  public words = new MockCollection<any>([]);

  constructor(contents: string = "Mock Story Content") {
    this.contents = contents;
  }
}

export class MockTextFrame {
  public id = 700;
  public isValid = true;
  public name = "TextFrame 1";
  public contents = "Hello InDesign";
  public geometricBounds: [number, number, number, number] = [0, 0, 100, 100];
  public visibleBounds: [number, number, number, number] = [0, 0, 100, 100];
  public parentStory: MockStory;
  public overflows = false;
  public locked = false;
  public itemLayer: MockLayer;
  public parent: any = null;

  constructor(props: Partial<MockTextFrame> = {}) {
    this.parentStory = new MockStory();
    this.itemLayer = new MockLayer();
    Object.assign(this, props);
    if (!props.parentStory) {
      this.parentStory.textContainers = [this];
    }
  }

  public recompose() {}
}

export class MockDocument {
  public id = 1001;
  public name = "Untitled-1.indd";
  public isValid = true;
  public saved = true;
  public modified = false;
  public zeroPoint: [number, number] = [0, 0];
  public viewPreferences = {
    horizontalMeasurementUnits: 2054188905, // POINTS
    verticalMeasurementUnits: 2054188905,   // POINTS
    rulerOrigin: 1380143215                 // PAGE_ORIGIN
  };

  public colors: MockCollection<MockColor>;
  public layers: MockCollection<MockLayer>;
  public paragraphStyles: MockCollection<MockParagraphStyle>;
  public paragraphStyleGroups: MockCollection<MockParagraphStyleGroup>;
  public characterStyles: MockCollection<MockCharacterStyle>;
  public characterStyleGroups: MockCollection<MockCharacterStyleGroup>;
  public pages: MockCollection<any>;
  public spreads: MockCollection<any>;
  public textFrames: MockCollection<MockTextFrame>;

  constructor() {
    this.colors = new MockCollection<MockColor>([
      new MockColor({ name: "Black", colorValue: [0, 0, 0, 100] }),
      new MockColor({ name: "Registration", colorValue: [100, 100, 100, 100] })
    ]);
    this.layers = new MockCollection<MockLayer>([
      new MockLayer({ name: "Layer 1" })
    ]);
    this.paragraphStyles = new MockCollection<MockParagraphStyle>([
      new MockParagraphStyle({ name: "[Basic Paragraph]" })
    ]);
    this.paragraphStyleGroups = new MockCollection<MockParagraphStyleGroup>([]);
    this.characterStyles = new MockCollection<MockCharacterStyle>([
      new MockCharacterStyle({ name: "[None]" })
    ]);
    this.characterStyleGroups = new MockCollection<MockCharacterStyleGroup>([]);
    this.textFrames = new MockCollection<MockTextFrame>([]);
    this.pages = new MockCollection<any>([{ id: 1, name: "1", isValid: true }]);
    this.spreads = new MockCollection<any>([{ id: 10, isValid: true }]);
  }

  public recompose() {}
  public save() { this.modified = false; this.saved = true; }
  public revert() { this.modified = false; }
  public close() {}
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

  constructor() {
    this.documents = new MockCollection<MockDocument>([new MockDocument()]);
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
  SaveOptions
};