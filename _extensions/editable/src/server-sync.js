import { sourceSlideHeadings } from './source-slides.js';

/** Save the extension's cumulative QMD edits to the same-origin deck server. */
export class ServerSaveClient {
  constructor({ serialize, fetcher = (...args) => fetch(...args), onStatus = () => {}, delay = 650 }) {
    this.serialize = serialize;
    this.fetcher = fetcher;
    this.onStatus = onStatus;
    this.delay = delay;
    this.enabled = false;
    this.conflict = false;
    this.pending = false;
    this.dirty = false;
    this.saving = null;
    this.timer = null;
    this.renderTimer = null;
    this.lastSaved = '';
  }

  status(label, error = false, detail = '') {
    this.onStatus({ label, error, detail });
  }

  async connect() {
    try {
      const response = await this.fetcher('/__presentation_editor/state', { cache: 'no-store' });
      if (response.status === 404 || response.status === 501) {
        this.status('Save downloads QMD');
        return null;
      }
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const state = await response.json();
      if (typeof state.content !== 'string' || !state.revision || !state.token) {
        throw new Error('Invalid editor server response');
      }
      this.revision = state.revision;
      this.token = state.token;
      this.lastSaved = state.content;
      this.enabled = true;
      this.status('Autosave on');
      return state;
    } catch (error) {
      this.status('Server unavailable', true, error.message);
      return null;
    }
  }

  schedule() {
    if (!this.enabled || this.conflict) return;
    this.pending = true;
    this.dirty = true;
    this.status('Unsaved changes');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  async flush() {
    if (!this.enabled || this.conflict) return false;
    clearTimeout(this.timer);
    this.timer = null;
    this.pending = true;
    if (this.saving) return this.saving;
    this.saving = this.savePending();
    try {
      return await this.saving;
    } finally {
      this.saving = null;
    }
  }

  async savePending() {
    while (this.pending && !this.conflict) {
      this.pending = false;
      let content;
      try {
        content = this.serialize();
        if (!content) throw new Error('No slide source available');
        if (content === this.lastSaved) {
          this.dirty = false;
          this.status('Saved to server');
          continue;
        }
        this.status('Saving…');
        this.dirty = true;
        const response = await this.fetcher('/__presentation_editor/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Presentation-Editor-Token': this.token,
          },
          body: JSON.stringify({ revision: this.revision, content }),
        });
        const result = await response.json();
        if (!response.ok) {
          this.conflict = response.status === 409;
          throw new Error(result.error || `Save failed (${response.status})`);
        }
        this.revision = result.revision;
        this.lastSaved = content;
        this.dirty = this.pending;
        // Keep _input_file as the original baseline: the extension serializes
        // cumulative modifications and would duplicate additions if rebased.
        this.status('Saved to server');
        this.pollRender();
      } catch (error) {
        this.status(this.conflict ? 'Changed elsewhere: reload before editing' : 'Not saved: click Save to retry', true, error.message);
        return false;
      }
    }
    return true;
  }

  pollRender() {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(async () => {
      try {
        const response = await this.fetcher('/__presentation_editor/status', { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        const render = result.render || result;
        if (render.busy || render.queued) {
          if (!this.unsaved) this.status('Saved; rebuilding slides…');
          this.pollRender();
        } else if (render.error) {
          this.status('Saved; rebuild failed', true, render.error);
        } else if (!this.unsaved) {
          this.status('Saved to server');
        }
      } catch {
        // A successful save stays successful if the subsequent status check
        // cannot connect. Later edits still perform a full checked POST.
      }
    }, 800);
  }

  get unsaved() {
    return this.dirty || this.pending || Boolean(this.saving);
  }
}

/** Match source headings, rather than Reveal's reordered horizontal index. */
export function assignSourceIndices(source, slides) {
  const headings = sourceSlideHeadings(source).map((heading, index) => {
    const attributes = heading.title.match(/\{([^}]*)\}\s*$/)?.[1] || '';
    return {
      index: index + 1,
      id: attributes.match(/(?:^|\s)#([^\s}]+)/)?.[1],
      title: heading.title.replace(/\s*\{[^}]*\}\s*$/, '').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim(),
    };
  });
  for (const slide of slides) {
    const renderedIndex = slide.querySelector('h2')?.dataset?.editableSourceIndex
      || slide.dataset.editableSourceIndex;
    if (/^[1-9]\d*$/.test(renderedIndex || '') && Number(renderedIndex) <= headings.length) {
      slide.dataset.editableSourceIndex = renderedIndex;
      continue;
    }
    const id = slide.dataset.editableSourceId || slide.id;
    const title = slide.querySelector('h2')?.textContent.replace(/\s+/g, ' ').trim();
    const matches = headings.filter(heading => heading.id === id);
    const candidates = matches.length ? matches : headings.filter(heading => heading.title === title);
    if (candidates.length === 1) slide.dataset.editableSourceIndex = String(candidates[0].index);
  }
}

let client = null;
let currentStatus = { label: 'Connecting…', error: false, detail: '' };

function renderStatus(status = currentStatus) {
  currentStatus = status;
  const toolbar = document.querySelector('.editable-toolbar-left');
  if (!toolbar) return;
  let label = toolbar.querySelector('.presentation-save-status');
  if (!label) {
    label = document.createElement('span');
    label.className = 'presentation-save-status';
    label.setAttribute('role', 'status');
    label.setAttribute('aria-live', 'polite');
    toolbar.append(label);
  }
  label.textContent = status.label;
  label.title = status.detail;
  label.classList.toggle('save-error', status.error);
}

export async function initializeServerSaving(serialize) {
  assignSourceIndices(window._input_file || '', document.querySelectorAll('.slides section:not(.stack)'));
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    currentStatus = { label: 'Save downloads QMD', error: false, detail: '' };
    return;
  }
  client = new ServerSaveClient({ serialize, onStatus: renderStatus });
  const state = await client.connect();
  if (state) {
    if (window._presentation_rendered_revision && window._presentation_rendered_revision !== state.revision) {
      client.conflict = true;
      client.status('Source changed: reload after rebuilding', true);
      return;
    }
    window._input_file = state.content;
  }
  assignSourceIndices(window._input_file || '', document.querySelectorAll('.slides section:not(.stack)'));
}

export function startServerSavingEvents() {
  renderStatus();
  if (!client?.enabled) return;
  const queue = () => {
    if (!document.documentElement.classList.contains('presentation-editor-visible')) return;
    requestAnimationFrame(() => client.schedule());
  };
  for (const name of ['mouseup', 'touchend', 'input', 'change', 'keyup', 'focusout', 'click', 'editable-content-restored']) {
    document.addEventListener(name, queue, true);
  }
  window.addEventListener('beforeunload', event => {
    if (!client.unsaved) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

export function saveToServer() {
  return client?.enabled ? client.flush() : null;
}
