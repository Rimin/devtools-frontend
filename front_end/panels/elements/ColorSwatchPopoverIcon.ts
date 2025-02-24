// Copyright (c) 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* eslint-disable rulesdir/no_underscored_properties */

import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Root from '../../core/root/root.js';
import * as Bindings from '../../models/bindings/bindings.js';
import * as ColorPicker from '../../ui/legacy/components/color_picker/color_picker.js';
import * as InlineEditor from '../../ui/legacy/components/inline_editor/inline_editor.js';
import * as UI from '../../ui/legacy/legacy.js';

import type {StylePropertyTreeElement} from './StylePropertyTreeElement.js';
import type {StylePropertiesSection, StylesSidebarPane} from './StylesSidebarPane.js';

const UIStrings = {
  /**
  * @description Tooltip text for an icon that opens the cubic bezier editor, which is a tool that
  * allows the user to edit cubic-bezier CSS properties directly.
  */
  openCubicBezierEditor: 'Open cubic bezier editor',
  /**
  * @description Tooltip text for an icon that opens shadow editor. The shadow editor is a tool
  * which allows the user to edit CSS shadow properties.
  */
  openShadowEditor: 'Open shadow editor',
};
const str_ = i18n.i18n.registerUIStrings('panels/elements/ColorSwatchPopoverIcon.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class BezierPopoverIcon {
  _treeElement: StylePropertyTreeElement;
  _swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper;
  _swatch: InlineEditor.Swatches.BezierSwatch;
  _boundBezierChanged: (event: Common.EventTarget.EventTargetEvent) => void;
  _boundOnScroll: (event: Event) => void;
  _bezierEditor?: InlineEditor.BezierEditor.BezierEditor;
  _scrollerElement?: Element;
  _originalPropertyText?: string|null;

  constructor(
      treeElement: StylePropertyTreeElement, swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper,
      swatch: InlineEditor.Swatches.BezierSwatch) {
    this._treeElement = treeElement;
    this._swatchPopoverHelper = swatchPopoverHelper;
    this._swatch = swatch;

    UI.Tooltip.Tooltip.install(this._swatch.iconElement(), i18nString(UIStrings.openCubicBezierEditor));
    this._swatch.iconElement().addEventListener('click', this._iconClick.bind(this), false);
    this._swatch.iconElement().addEventListener('mousedown', (event: Event) => event.consume(), false);

    this._boundBezierChanged = this._bezierChanged.bind(this);
    this._boundOnScroll = this._onScroll.bind(this);
  }

  _iconClick(event: Event): void {
    if (Root.Runtime.experiments.isEnabled('fontEditor')) {
      Host.userMetrics.cssEditorOpened('bezierEditor');
    }
    event.consume(true);
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
      return;
    }

    const cubicBezier = UI.Geometry.CubicBezier.parse(this._swatch.bezierText()) ||
        (UI.Geometry.CubicBezier.parse('linear') as UI.Geometry.CubicBezier);
    this._bezierEditor = new InlineEditor.BezierEditor.BezierEditor(cubicBezier);
    this._bezierEditor.setBezier(cubicBezier);
    this._bezierEditor.addEventListener(InlineEditor.BezierEditor.Events.BezierChanged, this._boundBezierChanged);
    this._swatchPopoverHelper.show(this._bezierEditor, this._swatch.iconElement(), this._onPopoverHidden.bind(this));
    this._scrollerElement = this._swatch.enclosingNodeOrSelfWithClass('style-panes-wrapper');
    if (this._scrollerElement) {
      this._scrollerElement.addEventListener('scroll', this._boundOnScroll, false);
    }

    this._originalPropertyText = this._treeElement.property.propertyText;
    this._treeElement.parentPane().setEditingStyle(true);
    const uiLocation = Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().propertyUILocation(
        this._treeElement.property, false /* forName */);
    if (uiLocation) {
      Common.Revealer.reveal(uiLocation, true /* omitFocus */);
    }
  }

  _bezierChanged(event: Common.EventTarget.EventTargetEvent): void {
    this._swatch.setBezierText((event.data as string));
    this._treeElement.applyStyleText(this._treeElement.renderedPropertyText(), false);
  }

  _onScroll(_event: Event): void {
    this._swatchPopoverHelper.hide(true);
  }

  _onPopoverHidden(commitEdit: boolean): void {
    if (this._scrollerElement) {
      this._scrollerElement.removeEventListener('scroll', this._boundOnScroll, false);
    }

    if (this._bezierEditor) {
      this._bezierEditor.removeEventListener(InlineEditor.BezierEditor.Events.BezierChanged, this._boundBezierChanged);
    }
    this._bezierEditor = undefined;

    const propertyText = commitEdit ? this._treeElement.renderedPropertyText() : this._originalPropertyText || '';
    this._treeElement.applyStyleText(propertyText, true);
    this._treeElement.parentPane().setEditingStyle(false);
    delete this._originalPropertyText;
  }
}

export class ColorSwatchPopoverIcon {
  _treeElement: StylePropertyTreeElement;
  _swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper;
  _swatch: InlineEditor.ColorSwatch.ColorSwatch;
  _contrastInfo: ColorPicker.ContrastInfo.ContrastInfo|null;
  _boundSpectrumChanged: (event: Common.EventTarget.EventTargetEvent) => void;
  _boundOnScroll: (event: Event) => void;
  _spectrum?: ColorPicker.Spectrum.Spectrum;
  _scrollerElement?: Element;
  _originalPropertyText?: string|null;

  constructor(
      treeElement: StylePropertyTreeElement, swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper,
      swatch: InlineEditor.ColorSwatch.ColorSwatch) {
    this._treeElement = treeElement;
    this._swatchPopoverHelper = swatchPopoverHelper;
    this._swatch = swatch;
    this._swatch.addEventListener('swatch-click', this._iconClick.bind(this));
    this._contrastInfo = null;

    this._boundSpectrumChanged = this._spectrumChanged.bind(this);
    this._boundOnScroll = this._onScroll.bind(this);
  }

  _generateCSSVariablesPalette(): ColorPicker.Spectrum.Palette {
    const matchedStyles = this._treeElement.matchedStyles();
    const style = this._treeElement.property.ownerStyle;
    const cssVariables = matchedStyles.availableCSSVariables(style);
    const colors = [];
    const colorNames = [];
    for (const cssVariable of cssVariables) {
      if (cssVariable === this._treeElement.property.name) {
        continue;
      }
      const value = matchedStyles.computeCSSVariable(style, cssVariable);
      if (!value) {
        continue;
      }
      const color = Common.Color.Color.parse(value);
      if (!color) {
        continue;
      }
      colors.push(value);
      colorNames.push(cssVariable);
    }
    return {title: 'CSS Variables', mutable: false, matchUserFormat: true, colors: colors, colorNames: colorNames};
  }

  setContrastInfo(contrastInfo: ColorPicker.ContrastInfo.ContrastInfo): void {
    this._contrastInfo = contrastInfo;
  }

  _iconClick(event: Event): void {
    if (Root.Runtime.experiments.isEnabled('fontEditor')) {
      Host.userMetrics.cssEditorOpened('colorPicker');
    }
    event.consume(true);
    this.showPopover();
  }

  showPopover(): void {
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
      return;
    }

    const color = this._swatch.getColor();
    let format = this._swatch.getFormat();
    if (!color || !format) {
      return;
    }

    if (format === Common.Color.Format.Original) {
      format = color.format();
    }
    this._spectrum = new ColorPicker.Spectrum.Spectrum(this._contrastInfo);
    this._spectrum.setColor(color, format);
    this._spectrum.addPalette(this._generateCSSVariablesPalette());

    this._spectrum.addEventListener(ColorPicker.Spectrum.Events.SizeChanged, this._spectrumResized, this);
    this._spectrum.addEventListener(ColorPicker.Spectrum.Events.ColorChanged, this._boundSpectrumChanged);
    this._swatchPopoverHelper.show(this._spectrum, this._swatch, this._onPopoverHidden.bind(this));
    this._scrollerElement = this._swatch.enclosingNodeOrSelfWithClass('style-panes-wrapper');
    if (this._scrollerElement) {
      this._scrollerElement.addEventListener('scroll', this._boundOnScroll, false);
    }

    this._originalPropertyText = this._treeElement.property.propertyText;
    this._treeElement.parentPane().setEditingStyle(true);
    const uiLocation = Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().propertyUILocation(
        this._treeElement.property, false /* forName */);
    if (uiLocation) {
      Common.Revealer.reveal(uiLocation, true /* omitFocus */);
    }
  }

  _spectrumResized(_event: Common.EventTarget.EventTargetEvent): void {
    this._swatchPopoverHelper.reposition();
  }

  _spectrumChanged(event: Common.EventTarget.EventTargetEvent): void {
    const color = Common.Color.Color.parse((event.data as string));
    if (!color) {
      return;
    }

    const colorName = this._spectrum ? this._spectrum.colorName() : undefined;
    const text = colorName && colorName.startsWith('--') ? `var(${colorName})` : color.asString();

    this._swatch.renderColor(color);
    const value = this._swatch.firstElementChild;
    if (value) {
      value.remove();
      this._swatch.createChild('span').textContent = text;
    }

    this._treeElement.applyStyleText(this._treeElement.renderedPropertyText(), false);
  }

  _onScroll(_event: Event): void {
    this._swatchPopoverHelper.hide(true);
  }

  _onPopoverHidden(commitEdit: boolean): void {
    if (this._scrollerElement) {
      this._scrollerElement.removeEventListener('scroll', this._boundOnScroll, false);
    }

    if (this._spectrum) {
      this._spectrum.removeEventListener(ColorPicker.Spectrum.Events.ColorChanged, this._boundSpectrumChanged);
    }
    this._spectrum = undefined;

    const propertyText = commitEdit ? this._treeElement.renderedPropertyText() : this._originalPropertyText || '';
    this._treeElement.applyStyleText(propertyText, true);
    this._treeElement.parentPane().setEditingStyle(false);
    delete this._originalPropertyText;
  }
}

export class ShadowSwatchPopoverHelper {
  _treeElement: StylePropertyTreeElement;
  _swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper;
  _shadowSwatch: InlineEditor.Swatches.CSSShadowSwatch;
  _iconElement: HTMLSpanElement;
  _boundShadowChanged: (event: Common.EventTarget.EventTargetEvent) => void;
  _boundOnScroll: (event: Event) => void;
  _cssShadowEditor?: InlineEditor.CSSShadowEditor.CSSShadowEditor;
  _scrollerElement?: Element;
  _originalPropertyText?: string|null;
  constructor(
      treeElement: StylePropertyTreeElement, swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper,
      shadowSwatch: InlineEditor.Swatches.CSSShadowSwatch) {
    this._treeElement = treeElement;
    this._swatchPopoverHelper = swatchPopoverHelper;
    this._shadowSwatch = shadowSwatch;
    this._iconElement = shadowSwatch.iconElement();

    UI.Tooltip.Tooltip.install(this._iconElement, i18nString(UIStrings.openShadowEditor));
    this._iconElement.addEventListener('click', this._iconClick.bind(this), false);
    this._iconElement.addEventListener('mousedown', event => event.consume(), false);

    this._boundShadowChanged = this._shadowChanged.bind(this);
    this._boundOnScroll = this._onScroll.bind(this);
  }

  _iconClick(event: Event): void {
    if (Root.Runtime.experiments.isEnabled('fontEditor')) {
      Host.userMetrics.cssEditorOpened('shadowEditor');
    }
    event.consume(true);
    this.showPopover();
  }

  showPopover(): void {
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
      return;
    }

    this._cssShadowEditor = new InlineEditor.CSSShadowEditor.CSSShadowEditor();
    this._cssShadowEditor.setModel(this._shadowSwatch.model());
    this._cssShadowEditor.addEventListener(InlineEditor.CSSShadowEditor.Events.ShadowChanged, this._boundShadowChanged);
    this._swatchPopoverHelper.show(this._cssShadowEditor, this._iconElement, this._onPopoverHidden.bind(this));
    this._scrollerElement = this._iconElement.enclosingNodeOrSelfWithClass('style-panes-wrapper');
    if (this._scrollerElement) {
      this._scrollerElement.addEventListener('scroll', this._boundOnScroll, false);
    }

    this._originalPropertyText = this._treeElement.property.propertyText;
    this._treeElement.parentPane().setEditingStyle(true);
    const uiLocation = Bindings.CSSWorkspaceBinding.CSSWorkspaceBinding.instance().propertyUILocation(
        this._treeElement.property, false /* forName */);
    if (uiLocation) {
      Common.Revealer.reveal(uiLocation, true /* omitFocus */);
    }
  }

  _shadowChanged(event: Common.EventTarget.EventTargetEvent): void {
    this._shadowSwatch.setCSSShadow((event.data as InlineEditor.CSSShadowModel.CSSShadowModel));
    this._treeElement.applyStyleText(this._treeElement.renderedPropertyText(), false);
  }

  _onScroll(_event: Event): void {
    this._swatchPopoverHelper.hide(true);
  }

  _onPopoverHidden(commitEdit: boolean): void {
    if (this._scrollerElement) {
      this._scrollerElement.removeEventListener('scroll', this._boundOnScroll, false);
    }

    if (this._cssShadowEditor) {
      this._cssShadowEditor.removeEventListener(
          InlineEditor.CSSShadowEditor.Events.ShadowChanged, this._boundShadowChanged);
    }
    this._cssShadowEditor = undefined;

    const propertyText = commitEdit ? this._treeElement.renderedPropertyText() : this._originalPropertyText || '';
    this._treeElement.applyStyleText(propertyText, true);
    this._treeElement.parentPane().setEditingStyle(false);
    delete this._originalPropertyText;
  }
}

export class FontEditorSectionManager {
  _treeElementMap: Map<string, StylePropertyTreeElement>;
  _swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper;
  _section: StylePropertiesSection;
  _parentPane: StylesSidebarPane|null;
  _fontEditor: InlineEditor.FontEditor.FontEditor|null;
  _scrollerElement: Element|null;
  _boundFontChanged: (event: Common.EventTarget.EventTargetEvent) => void;
  _boundOnScroll: () => void;
  _boundResized: () => void;
  constructor(
      swatchPopoverHelper: InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper, section: StylePropertiesSection) {
    this._treeElementMap = new Map();

    this._swatchPopoverHelper = swatchPopoverHelper;

    this._section = section;

    this._parentPane = null;

    this._fontEditor = null;

    this._scrollerElement = null;

    this._boundFontChanged = this._fontChanged.bind(this);
    this._boundOnScroll = this._onScroll.bind(this);
    this._boundResized = this._fontEditorResized.bind(this);
  }

  _fontChanged(event: Common.EventTarget.EventTargetEvent): void {
    const {propertyName, value} = event.data;
    const treeElement = this._treeElementMap.get(propertyName);
    this._updateFontProperty(propertyName, value, treeElement);
  }

  async _updateFontProperty(propertyName: string, value: string, treeElement?: StylePropertyTreeElement):
      Promise<void> {
    if (treeElement && treeElement.treeOutline && treeElement.valueElement && treeElement.property.parsedOk &&
        treeElement.property.range) {
      let elementRemoved = false;
      treeElement.valueElement.textContent = value;
      treeElement.property.value = value;
      let styleText;
      const propertyName = treeElement.property.name;
      if (value.length) {
        styleText = treeElement.renderedPropertyText();
      } else {
        styleText = '';
        elementRemoved = true;
        this._fixIndex(treeElement.property.index);
      }
      this._treeElementMap.set(propertyName, treeElement);
      await treeElement.applyStyleText(styleText, true);
      if (elementRemoved) {
        this._treeElementMap.delete(propertyName);
      }
    } else if (value.length) {
      const newProperty = this._section.addNewBlankProperty();
      if (newProperty) {
        newProperty.property.name = propertyName;
        newProperty.property.value = value;
        newProperty.updateTitle();
        await newProperty.applyStyleText(newProperty.renderedPropertyText(), true);
        this._treeElementMap.set(newProperty.property.name, newProperty);
      }
    }
    this._section.onpopulate();
    this._swatchPopoverHelper.reposition();
    return;
  }

  _fontEditorResized(): void {
    this._swatchPopoverHelper.reposition();
  }

  _fixIndex(removedIndex: number): void {
    for (const treeElement of this._treeElementMap.values()) {
      if (treeElement.property.index > removedIndex) {
        treeElement.property.index -= 1;
      }
    }
  }

  _createPropertyValueMap(): Map<string, string> {
    const propertyMap = new Map<string, string>();
    for (const fontProperty of this._treeElementMap) {
      const propertyName = (fontProperty[0] as string);
      const treeElement = fontProperty[1];
      if (treeElement.property.value.length) {
        propertyMap.set(propertyName, treeElement.property.value);
      } else {
        this._treeElementMap.delete(propertyName);
      }
    }
    return propertyMap;
  }

  registerFontProperty(treeElement: StylePropertyTreeElement): void {
    const propertyName = treeElement.property.name;
    if (this._treeElementMap.has(propertyName)) {
      const treeElementFromMap = this._treeElementMap.get(propertyName);
      if (!treeElement.overloaded() || (treeElementFromMap && treeElementFromMap.overloaded())) {
        this._treeElementMap.set(propertyName, treeElement);
      }
    } else {
      this._treeElementMap.set(propertyName, treeElement);
    }
  }

  async showPopover(iconElement: Element, parentPane: StylesSidebarPane): Promise<void> {
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
      return;
    }
    this._parentPane = parentPane;
    const propertyValueMap = this._createPropertyValueMap();
    this._fontEditor = new InlineEditor.FontEditor.FontEditor(propertyValueMap);
    this._fontEditor.addEventListener(InlineEditor.FontEditor.Events.FontChanged, this._boundFontChanged);
    this._fontEditor.addEventListener(InlineEditor.FontEditor.Events.FontEditorResized, this._boundResized);
    this._swatchPopoverHelper.show(this._fontEditor, iconElement, this._onPopoverHidden.bind(this));
    this._scrollerElement = iconElement.enclosingNodeOrSelfWithClass('style-panes-wrapper');
    if (this._scrollerElement) {
      this._scrollerElement.addEventListener('scroll', this._boundOnScroll, false);
    }

    this._parentPane.setEditingStyle(true);
  }

  _onScroll(): void {
    this._swatchPopoverHelper.hide(true);
  }

  _onPopoverHidden(): void {
    if (this._scrollerElement) {
      this._scrollerElement.removeEventListener('scroll', this._boundOnScroll, false);
    }
    this._section.onpopulate();
    if (this._fontEditor) {
      this._fontEditor.removeEventListener(InlineEditor.FontEditor.Events.FontChanged, this._boundFontChanged);
    }
    this._fontEditor = null;
    if (this._parentPane) {
      this._parentPane.setEditingStyle(false);
    }
    this._section.resetToolbars();
    this._section.onpopulate();
  }

  // TODO(crbug.com/1172300) Ignored during the jsdoc to ts migration
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static readonly _treeElementSymbol = Symbol('FontEditorSectionManager._treeElementSymbol');
}
