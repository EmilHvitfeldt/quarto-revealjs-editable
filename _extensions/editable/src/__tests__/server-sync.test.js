import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignSourceIndices, ServerSaveClient } from '../server-sync.js';

const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const state = { revision: 'r1', token: 'secret', content: 'initial source' };

afterEach(() => vi.useRealTimers());

describe('same-origin server saving', () => {
  it('debounces edits and does not write untouched source', async () => {
    vi.useFakeTimers();
    let source = state.content;
    const fetcher = vi.fn().mockResolvedValueOnce(response(state)).mockResolvedValue(response({ revision: 'r2' }));
    const client = new ServerSaveClient({ serialize: () => source, fetcher });
    await client.connect();
    await client.flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    source = 'moved image';
    client.schedule();
    await vi.advanceTimersByTimeAsync(400);
    source = 'moved and resized image';
    client.schedule();
    await vi.advanceTimersByTimeAsync(649);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ revision: 'r1', content: source });
    expect(fetcher.mock.calls[1][1].headers['X-Presentation-Editor-Token']).toBe('secret');
    expect(client.unsaved).toBe(false);
  });

  it('serializes edits made during an in-flight save using its new revision', async () => {
    let source = 'first edit';
    let finishFirst;
    const fetcher = vi.fn().mockResolvedValueOnce(response(state))
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(response({ revision: 'r3' }));
    const client = new ServerSaveClient({ serialize: () => source, fetcher });
    await client.connect();
    const saving = client.flush();
    source = 'second edit';
    client.schedule();
    finishFirst(response({ revision: 'r2' }));
    await saving;
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ revision: 'r2', content: 'second edit' });
    expect(client.lastSaved).toBe('second edit');
    expect(client.unsaved).toBe(false);
    clearTimeout(client.timer);
    clearTimeout(client.renderTimer);
  });

  it('leaves failed edits dirty and retries them on Save', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(state))
      .mockRejectedValueOnce(new Error('Disconnected'))
      .mockResolvedValue(response({ revision: 'r2' }));
    const status = vi.fn();
    const client = new ServerSaveClient({ serialize: () => 'edit', fetcher, onStatus: status });
    await client.connect();
    expect(await client.flush()).toBe(false);
    expect(client.lastSaved).toBe(state.content);
    expect(client.unsaved).toBe(true);
    expect(status.mock.calls.at(-1)[0].label).toContain('Not saved');
    expect(await client.flush()).toBe(true);
    expect(client.unsaved).toBe(false);
    clearTimeout(client.renderTimer);
  });

  it('never overwrites a newer server revision after a conflict', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(state))
      .mockResolvedValue(response({ error: 'Source changed' }, 409));
    const client = new ServerSaveClient({ serialize: () => 'edit', fetcher });
    await client.connect();
    expect(await client.flush()).toBe(false);
    client.schedule();
    expect(await client.flush()).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(client.unsaved).toBe(true);
  });

  it('uses file saving when served without an editor endpoint', async () => {
    const client = new ServerSaveClient({ serialize: () => 'edit', fetcher: async () => response({}, 404) });
    expect(await client.connect()).toBe(null);
    expect(client.enabled).toBe(false);
  });
});

it('maps nested and cloned slides to their original expanded-source headings', () => {
  const slide = (id, originalId, title) => ({
    id, dataset: { editableSourceId: originalId }, querySelector: () => ({ textContent: title }),
  });
  const nested = slide('clone', 'details', 'Details');
  const main = slide('main', undefined, 'Main');
  assignSourceIndices('## Main {#main}\n\n<!-- include -->\n## Details {#details}\n', [nested, main]);
  expect(nested.dataset.editableSourceIndex).toBe('2');
  expect(main.dataset.editableSourceIndex).toBe('1');
});

it('uses the rendered source index after arbitrary slide reordering and duplicate titles', () => {
  const slide = index => ({
    id: `clone-${index}`,
    dataset: {},
    querySelector: () => ({ textContent: 'Repeat', dataset: { editableSourceIndex: String(index) } }),
  });
  const second = slide(2);
  const first = slide(1);
  assignSourceIndices('## Repeat\n\n## Repeat\n', [second, first]);
  expect(second.dataset.editableSourceIndex).toBe('2');
  expect(first.dataset.editableSourceIndex).toBe('1');
});

it('keeps source indices aligned when a protocol inset contains Markdown headings', () => {
  const next = { id: 'next', dataset: {}, querySelector: () => ({ textContent: 'Next' }) };
  assignSourceIndices('## Instructions {#instructions}\n```markdown\n## Robot CLI\n```\n## Next {#next}\n', [next]);
  expect(next.dataset.editableSourceIndex).toBe('2');
});
