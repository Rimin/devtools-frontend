// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/* eslint-disable rulesdir/no_underscored_properties */

import type * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';

const UIStrings = {
  /**
  *@description Text in Node Connections Panel of the Sources panel when debugging a Node.js app
  */
  nodejsDebuggingGuide: 'Node.js debugging guide',
  /**
  *@description Text in Node Connections Panel of the Sources panel when debugging a Node.js app
  *@example {Node.js debugging guide} PH1
  */
  specifyNetworkEndpointAnd:
      'Specify network endpoint and DevTools will connect to it automatically. Read {PH1} to learn more.',
  /**
  *@description Placeholder text content in Node Connections Panel of the Sources panel when debugging a Node.js app
  */
  noConnectionsSpecified: 'No connections specified',
  /**
  *@description Text of add network target button in Node Connections Panel of the Sources panel when debugging a Node.js app
  */
  addConnection: 'Add connection',
  /**
  *@description Text in Node Connections Panel of the Sources panel when debugging a Node.js app
  */
  networkAddressEgLocalhost: 'Network address (e.g. localhost:9229)',
};
const str_ = i18n.i18n.registerUIStrings('entrypoints/node_main/NodeConnectionsPanel.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

let nodeConnectionsPanelInstance: NodeConnectionsPanel;

export class NodeConnectionsPanel extends UI.Panel.Panel {
  _config!: Adb.Config;
  _networkDiscoveryView: NodeConnectionsView;
  private constructor() {
    super('node-connection');
    this.registerRequiredCSS('entrypoints/node_main/nodeConnectionsPanel.css');
    this.contentElement.classList.add('node-panel');

    const container = this.contentElement.createChild('div', 'node-panel-center');

    const image = (container.createChild('img', 'node-panel-logo') as HTMLImageElement);
    image.src = 'https://nodejs.org/static/images/logos/nodejs-new-pantone-black.svg';

    Host.InspectorFrontendHost.InspectorFrontendHostInstance.events.addEventListener(
        Host.InspectorFrontendHostAPI.Events.DevicesDiscoveryConfigChanged, this._devicesDiscoveryConfigChanged, this);

    this.contentElement.tabIndex = 0;
    this.setDefaultFocusedElement(this.contentElement);

    // Trigger notification once.
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.setDevicesUpdatesEnabled(false);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.setDevicesUpdatesEnabled(true);

    this._networkDiscoveryView = new NodeConnectionsView(config => {
      this._config.networkDiscoveryConfig = config;
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.setDevicesDiscoveryConfig(this._config);
    });
    this._networkDiscoveryView.show(container);
  }

  static instance(opts: {
    forceNew: boolean|null,
  } = {forceNew: null}): NodeConnectionsPanel {
    const {forceNew} = opts;
    if (!nodeConnectionsPanelInstance || forceNew) {
      nodeConnectionsPanelInstance = new NodeConnectionsPanel();
    }

    return nodeConnectionsPanelInstance;
  }

  _devicesDiscoveryConfigChanged(event: Common.EventTarget.EventTargetEvent): void {
    this._config = (event.data as Adb.Config);
    this._networkDiscoveryView.discoveryConfigChanged(this._config.networkDiscoveryConfig);
  }
}

export class NodeConnectionsView extends UI.Widget.VBox implements UI.ListWidget.Delegate<Adb.PortForwardingRule> {
  _callback: (arg0: Adb.NetworkDiscoveryConfig) => void;
  _list: UI.ListWidget.ListWidget<Adb.PortForwardingRule>;
  _editor: UI.ListWidget.Editor<Adb.PortForwardingRule>|null;
  _networkDiscoveryConfig: {
    address: string,
  }[];
  constructor(callback: (arg0: Adb.NetworkDiscoveryConfig) => void) {
    super();
    this._callback = callback;
    this.element.classList.add('network-discovery-view');

    const networkDiscoveryFooter = this.element.createChild('div', 'network-discovery-footer');
    const documentationLink =
        UI.XLink.XLink.create('https://nodejs.org/en/docs/inspector/', i18nString(UIStrings.nodejsDebuggingGuide));
    networkDiscoveryFooter.appendChild(
        i18n.i18n.getFormatLocalizedString(str_, UIStrings.specifyNetworkEndpointAnd, {PH1: documentationLink}));

    this._list = new UI.ListWidget.ListWidget(this);
    this._list.registerRequiredCSS('entrypoints/node_main/nodeConnectionsPanel.css');
    this._list.element.classList.add('network-discovery-list');
    const placeholder = document.createElement('div');
    placeholder.classList.add('network-discovery-list-empty');
    placeholder.textContent = i18nString(UIStrings.noConnectionsSpecified);
    this._list.setEmptyPlaceholder(placeholder);
    this._list.show(this.element);
    this._editor = null;

    const addButton = UI.UIUtils.createTextButton(
        i18nString(UIStrings.addConnection), this._addNetworkTargetButtonClicked.bind(this),
        'add-network-target-button', true /* primary */);
    this.element.appendChild(addButton);

    this._networkDiscoveryConfig = [];

    this.element.classList.add('node-frontend');
  }

  _update(): void {
    const config = this._networkDiscoveryConfig.map(item => item.address);
    this._callback.call(null, config);
  }

  _addNetworkTargetButtonClicked(): void {
    this._list.addNewItem(this._networkDiscoveryConfig.length, {address: '', port: ''});
  }

  discoveryConfigChanged(networkDiscoveryConfig: Adb.NetworkDiscoveryConfig): void {
    this._networkDiscoveryConfig = [];
    this._list.clear();
    for (const address of networkDiscoveryConfig) {
      const item = {address: address, port: ''};
      this._networkDiscoveryConfig.push(item);
      this._list.appendItem(item, true);
    }
  }

  renderItem(rule: Adb.PortForwardingRule, _editable: boolean): Element {
    const element = document.createElement('div');
    element.classList.add('network-discovery-list-item');
    element.createChild('div', 'network-discovery-value network-discovery-address').textContent = rule.address;
    return element;
  }

  removeItemRequested(rule: Adb.PortForwardingRule, index: number): void {
    this._networkDiscoveryConfig.splice(index, 1);
    this._list.removeItem(index);
    this._update();
  }

  commitEdit(rule: Adb.PortForwardingRule, editor: UI.ListWidget.Editor<Adb.PortForwardingRule>, isNew: boolean): void {
    rule.address = editor.control('address').value.trim();
    if (isNew) {
      this._networkDiscoveryConfig.push(rule);
    }
    this._update();
  }

  beginEdit(rule: Adb.PortForwardingRule): UI.ListWidget.Editor<Adb.PortForwardingRule> {
    const editor = this._createEditor();
    editor.control('address').value = rule.address;
    return editor;
  }

  _createEditor(): UI.ListWidget.Editor<Adb.PortForwardingRule> {
    if (this._editor) {
      return this._editor;
    }

    const editor = new UI.ListWidget.Editor<Adb.PortForwardingRule>();
    this._editor = editor;
    const content = editor.contentElement();
    const fields = content.createChild('div', 'network-discovery-edit-row');
    const input =
        editor.createInput('address', 'text', i18nString(UIStrings.networkAddressEgLocalhost), addressValidator);
    fields.createChild('div', 'network-discovery-value network-discovery-address').appendChild(input);
    return editor;

    function addressValidator(_rule: Adb.PortForwardingRule, _index: number, input: UI.ListWidget.EditorControl):
        UI.ListWidget.ValidatorResult {
      const match = input.value.trim().match(/^([a-zA-Z0-9\.\-_]+):(\d+)$/);
      if (!match) {
        return {
          valid: false,
          errorMessage: undefined,
        };
      }
      const port = parseInt(match[2], 10);
      return {
        valid: port <= 65535,
        errorMessage: undefined,
      };
    }
  }
}
