/*
 * Copyright (C) 2019 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* eslint-disable rulesdir/no_underscored_properties */

import type * as SDK from '../../core/sdk/sdk.js';

import type {Client} from './TimelineController.js';
import {TimelineController} from './TimelineController.js';  // eslint-disable-line no-unused-vars
import {TimelineUIUtils} from './TimelineUIUtils.js';
import {UIDevtoolsUtils} from './UIDevtoolsUtils.js';

export class UIDevtoolsController extends TimelineController {
  constructor(target: SDK.Target.Target, client: Client) {
    super(target, client);
    TimelineUIUtils.setEventStylesMap(UIDevtoolsUtils.categorizeEvents());
    TimelineUIUtils.setCategories(UIDevtoolsUtils.categories());
    TimelineUIUtils.setTimelineMainEventCategories(UIDevtoolsUtils.getMainCategoriesList());
  }
}
