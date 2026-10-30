declare module "indesign" {
  export interface DOMCollection<T> {
    readonly length: number;
    itemByName(name: string): T;
    everyItem(): { getElements(): T[] };
    item(index: number): T;
    add(properties?: Record<string, unknown>): T;
    [index: number]: T;
  }

  export interface ScriptPreferences {
    enableRedraw: boolean;
    userInteractionLevel: number;
  }

  export interface ViewPreferences {
    horizontalMeasurementUnits: MeasurementUnits | number;
    verticalMeasurementUnits: MeasurementUnits | number;
    rulerOrigin: RulerOrigin | number;
  }

  export interface Application {
    readonly version: string;
    readonly documents: DOMCollection<Document>;
    readonly activeDocument: Document;
    readonly selection: any[];
    scriptPreferences: ScriptPreferences;
    findGrepPreferences: any;
    changeGrepPreferences: any;
    findTextPreferences: any;
    changeTextPreferences: any;
    doScript(
      script: (() => void) | string,
      language?: ScriptLanguage,
      args?: any[],
      undoMode?: UndoModes,
      undoName?: string
    ): unknown;
    undo?(): void;
    redo?(): void;
  }

  export enum ScriptLanguage {
    UXP_SCRIPT = 1433299827,
    JAVASCRIPT = 1246973031
  }

  export enum UndoModes {
    ENTIRE_SCRIPT = 1699963765,
    AUTO_UNDO = 1699963745,
    SCRIPT_REQUEST = 1699963762
  }

  export enum RulerOrigin {
    PAGE_ORIGIN = 1380143215,
    SPREAD_ORIGIN = 1380143983
  }

  export enum MeasurementUnits {
    POINTS = 2054188905,
    INCHES = 2053729891,
    MILLIMETERS = 2053991795,
    PICAS = 2054187363
  }

  export enum ColorModel {
    PROCESS = 1886545267,
    SPOT = 1886611056
  }

  export enum ColorSpace {
    CMYK = 1129142603,
    RGB = 1666336572,
    LAB = 1281450594
  }

  export enum NothingEnum {
    NOTHING = 1851876449
  }

  export enum SaveOptions {
    YES = 2003395685,
    NO = 1852776480,
    ASK = 1634954091
  }

  export enum LocationOptions {
    BEFORE = 1650812527,
    AFTER = 1634104421,
    AT_BEGINNING = 1635017319,
    AT_END = 1635018094
  }

  export interface Layer {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    visible: boolean;
    locked: boolean;
  }

  export interface Color {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    model: ColorModel | number;
    space: ColorSpace | number;
    colorValue: number[];
  }

  export interface ParagraphStyle {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    pointSize?: number;
    appliedFont?: unknown;
  }

  export interface ParagraphStyleGroup {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    readonly paragraphStyles: DOMCollection<ParagraphStyle>;
    readonly paragraphStyleGroups: DOMCollection<ParagraphStyleGroup>;
  }

  export interface CharacterStyle {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
  }

  export interface CharacterStyleGroup {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    readonly characterStyles: DOMCollection<CharacterStyle>;
    readonly characterStyleGroups: DOMCollection<CharacterStyleGroup>;
  }

  export interface Story {
    readonly id: number;
    readonly isValid: boolean;
    contents: string;
    locked: boolean;
    readonly textContainers: any[];
    readonly paragraphs: DOMCollection<any>;
    readonly characters: DOMCollection<any>;
    readonly words: DOMCollection<any>;
  }

  export interface TextFrame {
    readonly id: number;
    readonly isValid: boolean;
    name: string;
    contents: string;
    geometricBounds: [number, number, number, number];
    visibleBounds: [number, number, number, number];
    parentStory?: Story;
    overflows: boolean;
    locked: boolean;
    itemLayer?: Layer;
    parent?: any;
    recompose?(): void;
  }

  export interface Page {
    readonly id: number;
    readonly isValid: boolean;
    readonly name: string;
    readonly geometricBounds: [number, number, number, number];
    readonly textFrames: DOMCollection<TextFrame>;
    readonly pageItems: DOMCollection<any>;
  }

  export interface Spread {
    readonly id: number;
    readonly isValid: boolean;
    readonly pages: DOMCollection<Page>;
    readonly pageItems: DOMCollection<any>;
  }

  export interface Document {
    readonly id: number;
    readonly isValid: boolean;
    readonly name?: string;
    zeroPoint: [number, number];
    viewPreferences: ViewPreferences;
    recompose(): void;
    save(): void;
    revert(): void;
    close(saving?: SaveOptions | number): void;
    readonly pages: DOMCollection<Page>;
    readonly spreads: DOMCollection<Spread>;
    readonly colors: DOMCollection<Color>;
    readonly layers: DOMCollection<Layer>;
    readonly paragraphStyles: DOMCollection<ParagraphStyle>;
    readonly paragraphStyleGroups: DOMCollection<ParagraphStyleGroup>;
    readonly characterStyles: DOMCollection<CharacterStyle>;
    readonly characterStyleGroups: DOMCollection<CharacterStyleGroup>;
    readonly objectStyles?: DOMCollection<any>;
    readonly objectStyleGroups?: DOMCollection<any>;
  }

  export const app: Application;
}
