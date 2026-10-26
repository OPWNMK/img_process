window.__ModuleLoader__.load({
  id: '@local/dsh-image-scorer',
  factory(require) {
    const React = require('react');
    const { useCallback, useEffect, useMemo, useRef, useState } = React;
    const h = React.createElement;
    const PANEL_ID = 'image-scorer';
    const API = {
      env: '/api/image-scorer.env',
      browse: '/api/image-scorer.browse',
      load: '/api/image-scorer.load',
      image: '/api/image-scorer.image',
      record: '/api/image-scorer.record',
      discard: '/api/image-scorer.discard',
    };

    const memory = {
      dataset: null,
      records: {},
      view: 'welcome',
      index: 0,
      selection: { winner: null, loser: null },
      rootPath: '',
    };
    const drafts = new Map();

    const ICONS = {
      logo: [
        ['rect', { x: 3, y: 8, width: 5, height: 24, rx: 2.5, fill: 'currentColor', opacity: 0.35 }],
        ['rect', { x: 11, y: 4, width: 5, height: 32, rx: 2.5, fill: 'currentColor', opacity: 0.58 }],
        ['rect', { x: 19, y: 9, width: 5, height: 24, rx: 2.5, fill: 'currentColor' }],
        ['rect', { x: 27, y: 6, width: 5, height: 30, rx: 2.5, fill: 'currentColor', opacity: 0.72 }],
        ['rect', { x: 35, y: 12, width: 3, height: 19, rx: 1.5, fill: 'currentColor', opacity: 0.38 }],
      ],
      folder: [['path', { d: 'M3.5 6.75A2.25 2.25 0 0 1 5.75 4.5h3.1c.6 0 1.17.24 1.6.66l1.05 1.05c.42.42.99.66 1.59.66h5.16a2.25 2.25 0 0 1 2.25 2.25v7.13a2.25 2.25 0 0 1-2.25 2.25H5.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z' }]],
      chevron: [['path', { d: 'm9 6 6 6-6 6' }]],
      left: [['path', { d: 'M19 12H5m0 0 5-5m-5 5 5 5' }]],
      close: [['path', { d: 'm6 6 12 12M18 6 6 18' }]],
      crown: [['path', { d: 'm4 8 4.2 3.2L12 5l3.8 6.2L20 8l-1.4 9H5.4L4 8Z' }], ['path', { d: 'M5.5 20h13' }]],
      down: [['path', { d: 'M12 4.5v14m0 0 5-5m-5 5-5-5' }]],
      up: [['path', { d: 'M12 19V5m0 0-5 5m5-5 5 5' }]],
      trash: [['path', { d: 'M5.5 7.5h13M9.5 7.5V5.7c0-.66.54-1.2 1.2-1.2h2.6c.66 0 1.2.54 1.2 1.2v1.8M7.3 7.5l.7 11.1c.04.75.66 1.4 1.43 1.4h5.14c.77 0 1.39-.65 1.43-1.4l.7-11.1M10 11v5.5M14 11v5.5' }]],
      copy: [['rect', { x: 9, y: 9, width: 10.5, height: 10.5, rx: 2 }], ['path', { d: 'M15 7.5V6.2c0-1.2-1-2.2-2.2-2.2H6.2A2.2 2.2 0 0 0 4 6.2v6.6c0 1.2 1 2.2 2.2 2.2h1.3' }]],
      download: [['path', { d: 'M12 4v10.5m0 0 4-4m-4 4-4-4M4.5 17v2.2c0 .7.58 1.3 1.3 1.3h12.4c.72 0 1.3-.6 1.3-1.3V17' }]],
      check: [['path', { d: 'm5 12.5 4.2 4.2L19 6.8' }]],
      image: [['rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }], ['circle', { cx: 9, cy: 10, r: 1.5, fill: 'currentColor', stroke: 'none' }], ['path', { d: 'm5 17 4.2-4.2 3.1 3.1 2.3-2.3L20 18' }]],
      spark: [['path', { d: 'M12 3.5c.7 4.8 3.7 7.8 8.5 8.5-4.8.7-7.8 3.7-8.5 8.5-.7-4.8-3.7-7.8-8.5-8.5 4.8-.7 7.8-3.7 8.5-8.5Z' }]],
      refresh: [['path', { d: 'M20 7v5h-5M4 17v-5h5' }], ['path', { d: 'M6.1 9A7 7 0 0 1 18.7 7M17.9 15A7 7 0 0 1 5.3 17' }]],
      shield: [['path', { d: 'M12 3.5 19 6v5.4c0 4.1-2.8 7.7-7 9.1-4.2-1.4-7-5-7-9.1V6l7-2.5Z' }], ['path', { d: 'm8.6 12 2.2 2.2 4.7-4.7' }]],
      json: [['path', { d: 'M9 4H6.8C5.8 4 5 4.8 5 5.8v3.1c0 1.2-.6 2.1-1.8 2.6v1c1.2.5 1.8 1.4 1.8 2.6v3.1c0 1 .8 1.8 1.8 1.8H9M15 4h2.2c1 0 1.8.8 1.8 1.8v3.1c0 1.2.6 2.1 1.8 2.6v1c-1.2.5-1.8 1.4-1.8 2.6v3.1c0 1-.8 1.8-1.8 1.8H15' }]],
    };

    function Icon({ name, size = 16 }) {
      const parts = ICONS[name] || [];
      return h('svg', {
        width: size, height: size, viewBox: name === 'logo' ? '0 0 40 40' : '0 0 24 24',
        'aria-hidden': 'true', style: { flex: '0 0 auto' },
      }, parts.map(([tag, props], index) => h(tag, {
        key: index,
        ...props,
        fill: props.fill ?? 'none',
        stroke: props.stroke ?? (props.fill ? 'none' : 'currentColor'),
        strokeWidth: props.strokeWidth ?? 1.7,
        strokeLinecap: props.strokeLinecap ?? 'round',
        strokeLinejoin: props.strokeLinejoin ?? 'round',
      })));
    }

    function useStore() {
      const [dataset, setDataset] = useState(memory.dataset);
      const [records, setRecords] = useState(memory.records);
      const [view, setView] = useState(memory.view);
      const [index, setIndex] = useState(memory.index);
      const [selection, setSelection] = useState(memory.selection);
      const [rootPath, setRootPath] = useState(memory.rootPath);
      const [busy, setBusy] = useState(false);
      const [busyText, setBusyText] = useState('正在读取…');
      const [toast, setToast] = useState(null);
      const toastTimer = useRef(null);
      const stateRef = useRef({});
      stateRef.current = { dataset, records, view, index, selection, rootPath };

      useEffect(() => {
        memory.dataset = dataset;
        memory.records = records;
        memory.view = view;
        memory.index = index;
        memory.selection = selection;
        memory.rootPath = rootPath;
      }, [dataset, records, view, index, selection, rootPath]);

      const showToast = useCallback((message, kind = 'ok') => {
        setToast({ message, kind });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 5000 : 2800);
      }, []);

      useEffect(() => () => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
      }, []);

      return {
        dataset, setDataset,
        records, setRecords,
        view, setView,
        index, setIndex,
        selection, setSelection,
        rootPath, setRootPath,
        busy, setBusy, busyText, setBusyText,
        toast, showToast,
        stateRef,
      };
    }

    async function requestJson(url, options = {}) {
      let response;
      try {
        response = await fetch(url, options);
      } catch {
        throw new Error('无法连接 DSH 图分宝服务，请确认插件已启用。');
      }
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) throw new Error(payload?.error || `请求失败（HTTP ${response.status}）`);
      return payload;
    }

    function post(url, body) {
      return requestJson(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    function basename(value) {
      if (!value) return '';
      return String(value).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value;
    }

    function pad(value) { return String(value).padStart(2, '0'); }

    function folderIndex(group, records, field) {
      const record = records[group.key];
      if (!record) return null;
      const image = group.images.find((item) => item.folder === record[field]);
      return image ? group.images.indexOf(image) : null;
    }

    function sameSelection(a, b) {
      return a.winner === b.winner && a.loser === b.loser;
    }

    function rememberDraft(store) {
      const { dataset, index, selection, records } = store.stateRef.current;
      if (!dataset) return;
      const group = dataset.groups[index];
      if (!group) return;
      const base = records[group.key];
      const baseSelection = {
        winner: base ? folderIndex(group, records, 'win') : null,
        loser: base ? folderIndex(group, records, 'lose') : null,
      };
      if ((selection.winner !== null || selection.loser !== null) && !sameSelection(selection, baseSelection)) {
        drafts.set(group.key, { ...selection });
      } else {
        drafts.delete(group.key);
      }
    }

    function selectionFor(dataset, records, index) {
      const group = dataset.groups[index];
      if (!group) return { winner: null, loser: null };
      const draft = drafts.get(group.key);
      if (draft) return { ...draft };
      return {
        winner: folderIndex(group, records, 'win'),
        loser: folderIndex(group, records, 'lose'),
      };
    }

    function copyText(text, done) {
      const fallback = () => {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();
        try { document.execCommand('copy'); done(); } catch { /* noop */ }
        area.remove();
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    }

    function SidebarIcon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 3.2, y: 5, width: 3.4, height: 14, rx: 1.4, fill: 'currentColor', opacity: 0.45 }),
        h('rect', { x: 8.1, y: 3.4, width: 3.4, height: 17.2, rx: 1.4, fill: 'currentColor', opacity: 0.72 }),
        h('rect', { x: 13, y: 5.8, width: 3.4, height: 12.4, rx: 1.4, fill: 'currentColor' }),
        h('rect', { x: 17.9, y: 7, width: 2.6, height: 10, rx: 1.3, fill: 'currentColor', opacity: 0.55 }),
      );
    }

    function Welcome({ store, env }) {
      const [error, setError] = useState('');
      const [browseOpen, setBrowseOpen] = useState(false);
      const { rootPath, setRootPath, setBusy, setBusyText, setDataset, setRecords, setView, setIndex, setSelection, showToast } = store;
      const pageRef = useRef(null);

      async function load(path = rootPath) {
        const value = String(path ?? '').trim();
        if (!value) {
          setError('请先填写或选择图片根文件夹。');
          return;
        }
        setError('');
        setBusyText('正在扫描 5 个子文件夹…');
        setBusy(true);
        try {
          const data = await post(API.load, { path: value });
          drafts.clear();
          setDataset(data);
          setRecords(data.records || {});
          setIndex(0);
          setSelection(selectionFor(data, data.records || {}, 0));
          setView('scoring');
          setRootPath(data.root);
          try { localStorage.setItem('dsh.imageScorer.root', data.root); } catch { /* noop */ }
          setBrowseOpen(false);
          showToast(`${data.total} 组图片已载入`);
        } catch (loadError) {
          setError(loadError.message);
        } finally {
          setBusy(false);
        }
      }

      useEffect(() => {
        if (!rootPath) {
          try {
            const last = localStorage.getItem('dsh.imageScorer.root');
            if (last) setRootPath(last);
          } catch { /* noop */ }
        }
      }, [rootPath, setRootPath]);

      useEffect(() => {
        if (pageRef.current) pageRef.current.scrollTop = 0;
      }, []);

      const demoPath = env?.demoPath;
      return h('div', { className: 'ifs-page', ref: pageRef },
        h('style', null, CSS),
        h('div', { className: 'ifs-welcome' },
          h('div', { className: 'ifs-hero' },
            h('p', { className: 'ifs-eyebrow' }, h('span'), 'HUMAN PREFERENCE TOOL'),
            h('h1', null, '五张图，', h('br'), h('em', null, '一票定高下。')),
            h('p', { className: 'ifs-lede' }, '把模型效果的主观判断，变成干净、可复用的偏好数据。每次只专注一组，选出胜者与败者。'),
            h('div', { className: 'ifs-flow' },
              flowStep('01', '选定根目录', '5 个等量子文件夹'),
              h('span', { className: 'ifs-flow-line' }),
              flowStep('02', '逐组评判', '各选一张胜者/败者'),
              h('span', { className: 'ifs-flow-line' }),
              flowStep('03', '写入 JSON', '随时中断，进度不丢失'),
            ),
            h('div', { className: 'ifs-privacy' }, Icon({ name: 'shield', size: 14 }), '本地读写 · 图片不离开电脑'),
          ),
          h('div', { className: 'ifs-setup' },
            h('div', { className: 'ifs-setup-top' }, h('span', null, '开始标注'), h('span', { className: 'ifs-version' }, 'DSH PLUGIN')),
            h('label', { className: 'ifs-label', htmlFor: 'ifs-root' }, '图片根文件夹'),
            h('div', { className: 'ifs-pathfield' },
              Icon({ name: 'folder', size: 16 }),
              h('input', {
                id: 'ifs-root', value: rootPath, spellCheck: false, autoComplete: 'off',
                placeholder: '例如 /home/user/datasets/fusion_results',
                onChange: (event) => setRootPath(event.target.value),
                onKeyDown: (event) => { if (event.key === 'Enter') load(); },
              }),
              h('button', { type: 'button', className: 'ifs-browse-inline', onClick: () => setBrowseOpen(true) }, '浏览'),
            ),
            h('p', { className: 'ifs-hint' }, '根目录下需有且仅有 5 个子文件夹，且图片数量相同。'),
            error ? h('p', { className: 'ifs-error' }, error) : null,
            h('button', { type: 'button', className: 'ifs-primary ifs-load', onClick: () => load() },
              '开始评分', Icon({ name: 'up', size: 15 })),
            demoPath ? h('button', { type: 'button', className: 'ifs-demo', onClick: () => { setRootPath(demoPath); load(demoPath); } },
              Icon({ name: 'spark', size: 13 }), '用内置演示数据体验') : null,
            h('div', { className: 'ifs-setup-foot' },
              h('span', null, Icon({ name: 'shield', size: 12 }), '只在本地读写'),
              h('span', null, Icon({ name: 'json', size: 12 }), '输出 scores.json'),
            ),
          ),
        ),
        browseOpen ? h(FolderBrowser, {
          initial: rootPath || env?.home || '',
          env,
          onClose: () => setBrowseOpen(false),
          onChoose: (path) => load(path),
        }) : null,
        store.toast ? h('div', { className: `ifs-toast${store.toast.kind === 'error' ? ' is-error' : ''}` }, store.toast.message) : null,
        store.busy ? h('div', { className: 'ifs-busy' }, h('span', { className: 'ifs-spinner' }), store.busyText) : null,
      );
    }

    function flowStep(number, title, detail) {
      return h('div', { className: 'ifs-flow-step' },
        h('span', { className: 'ifs-step-number' }, number),
        h('span', null, h('strong', null, title), h('small', null, detail)),
      );
    }

    function FolderBrowser({ initial, env, onClose, onChoose }) {
      const [pathValue, setPathValue] = useState(initial || '');
      const [data, setData] = useState(null);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState('');
      const requestRef = useRef(0);

      const browse = useCallback(async (target) => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setError('');
        try {
          const next = await requestJson(`${API.browse}?path=${encodeURIComponent(target || '')}`);
          if (requestId !== requestRef.current) return;
          setData(next);
          setPathValue(next.path);
        } catch (browseError) {
          if (requestId !== requestRef.current) return;
          setError(browseError.message);
        } finally {
          if (requestId === requestRef.current) setLoading(false);
        }
      }, []);

      useEffect(() => { browse(initial); }, [browse, initial]);

      useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      const shortcuts = data?.shortcuts ?? env?.shortcuts ?? [];
      return h('div', { className: 'ifs-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        h('div', { className: 'ifs-modal ifs-browser', role: 'dialog', 'aria-modal': 'true', 'aria-label': '选择图片根文件夹' },
          h('div', { className: 'ifs-modal-head' },
            h('div', null, h('p', { className: 'ifs-eyebrow' }, h('span'), 'SELECT DATASET'), h('h2', null, '选择图片根文件夹')),
            h('button', { type: 'button', className: 'ifs-icon-btn', onClick: onClose, 'aria-label': '关闭' }, Icon({ name: 'close', size: 16 })),
          ),
          h('div', { className: 'ifs-shortcuts' }, shortcuts.map((item) => h('button', {
            key: item.path, type: 'button', className: 'ifs-chip', onClick: () => browse(item.path),
          }, item.name))),
          h('form', { className: 'ifs-picker-path', onSubmit: (event) => { event.preventDefault(); browse(pathValue); } },
            h('button', { type: 'button', className: 'ifs-icon-btn', disabled: !data?.parent, onClick: () => data?.parent && browse(data.parent), 'aria-label': '上一级' }, Icon({ name: 'up', size: 15 })),
            h('input', { value: pathValue, onChange: (event) => setPathValue(event.target.value), spellCheck: false, autoFocus: true }),
            h('button', { type: 'submit', className: 'ifs-small-btn' }, '前往'),
          ),
          h('div', { className: 'ifs-current-path' }, Icon({ name: 'folder', size: 13 }), h('span', null, data?.path ?? '正在读取…')),
          h('div', { className: 'ifs-dir-list' },
            loading ? h('div', { className: 'ifs-empty' }, h('span', { className: 'ifs-spinner' }), '正在读取目录…')
              : (data?.entries?.length
                ? data.entries.map((entry) => h('button', {
                  key: entry.path, type: 'button', className: 'ifs-dir-row', onClick: () => browse(entry.path), title: entry.path,
                },
                Icon({ name: 'folder', size: 16 }),
                h('span', { className: 'ifs-dir-main' }, h('span', { className: 'ifs-dir-name' }, entry.name),
                  h('span', { className: 'ifs-dir-count' }, [
                    entry.imageCount ? `${entry.imageCount} 张图片` : '',
                    entry.subdirCount ? `${entry.subdirCount} 个子文件夹` : '',
                  ].filter(Boolean).join(' · ') || '空文件夹')),
                Icon({ name: 'chevron', size: 14 }),
                ))
                : h('div', { className: 'ifs-empty' }, Icon({ name: 'folder', size: 24 }), '此目录下没有子文件夹')),
          ),
          error ? h('p', { className: 'ifs-error ifs-modal-error' }, error) : null,
          h('div', { className: 'ifs-modal-foot' },
            h('p', null, '请选择包含 ', h('b', null, '5 个子文件夹'), ' 的根目录'),
            h('div', { className: 'ifs-foot-actions' },
              h('button', { type: 'button', className: 'ifs-ghost', onClick: onClose }, '取消'),
              h('button', { type: 'button', className: 'ifs-primary', disabled: !data?.path || loading, onClick: () => data?.path && onChoose(data.path) }, '使用此文件夹'),
            ),
          ),
        ),
      );
    }

    function ImageCard({ image, slot, selection, onVote, onZoom }) {
      const isWinner = selection.winner === slot;
      const isLoser = selection.loser === slot;
      const cardClass = `ifs-card${isWinner ? ' is-winner' : ''}${isLoser ? ' is-loser' : ''}`;
      return h('article', { className: cardClass },
        h('div', { className: 'ifs-frame' },
          h('img', { src: image.url, alt: `${image.folder} 的图片：${image.filename}`, loading: slot < 3 ? 'eager' : 'lazy', onClick: () => onZoom(image) }),
          h('button', { type: 'button', className: 'ifs-zoom', onClick: () => onZoom(image), 'aria-label': '查看大图' }, Icon({ name: 'image', size: 15 })),
          isWinner ? h('span', { className: 'ifs-badge is-win' }, Icon({ name: 'crown', size: 11 }), 'WINNER') : null,
          isLoser ? h('span', { className: 'ifs-badge is-lose' }, Icon({ name: 'down', size: 11 }), 'LOSER') : null,
        ),
        h('div', { className: 'ifs-meta' },
          h('span', { className: 'ifs-index' }, pad(slot + 1)),
          h('h3', { title: image.folder }, image.folder),
          h('p', { title: image.filename }, image.filename),
        ),
        h('div', { className: 'ifs-votes' },
          h('button', {
            type: 'button', className: `ifs-vote is-win${isWinner ? ' is-active' : ''}`,
            'aria-pressed': isWinner, onClick: () => onVote('winner', slot),
          }, Icon({ name: 'crown', size: 14 }), '胜者'),
          h('button', {
            type: 'button', className: `ifs-vote is-lose${isLoser ? ' is-active' : ''}`,
            'aria-pressed': isLoser, onClick: () => onVote('loser', slot),
          }, Icon({ name: 'down', size: 14 }), '败者'),
        ),
      );
    }

    function Scoring({ store }) {
      const {
        dataset, records, setRecords, index, setIndex, selection, setSelection,
        setView, setRootPath, showToast, setBusy, setBusyText, busy, busyText, stateRef,
      } = store;
      const pageRef = useRef(null);
      const [discardOpen, setDiscardOpen] = useState(false);
      const [lightbox, setLightbox] = useState(null);
      const [saving, setSaving] = useState(false);
      if (!dataset) return null;
      const group = dataset.groups[index];
      const base = records[group.key];
      const baseSelection = {
        winner: base ? folderIndex(group, records, 'win') : null,
        loser: base ? folderIndex(group, records, 'lose') : null,
      };
      const dirty = !sameSelection(selection, baseSelection);
      const savedCount = dataset.groups.filter((item) => Object.hasOwn(records, item.key)).length;
      const winnerImage = selection.winner === null ? null : group.images[selection.winner];
      const loserImage = selection.loser === null ? null : group.images[selection.loser];
      const canSave = winnerImage && loserImage && selection.winner !== selection.loser && !saving && !busy;

      function goTo(nextIndex, nextRecords = records) {
        if (nextIndex < 0) return;
        rememberDraft(store);
        if (nextIndex >= dataset.total) {
          setView('finish');
          pageRef.current?.scrollTo({ top: 0 });
          return;
        }
        setIndex(nextIndex);
        setSelection(selectionFor(dataset, nextRecords, nextIndex));
        window.requestAnimationFrame(() => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
      }

      function vote(kind, slot) {
        setSelection((previous) => {
          if (kind === 'winner') {
            return { winner: previous.winner === slot ? null : slot, loser: previous.loser === slot ? null : previous.loser };
          }
          return { winner: previous.winner === slot ? null : previous.winner, loser: previous.loser === slot ? null : slot };
        });
      }

      async function save() {
        if (!canSave) return;
        setSaving(true);
        try {
          const result = await post(API.record, {
            session_id: dataset.session_id,
            key: group.key,
            win: winnerImage.folder,
            lose: loserImage.folder,
          });
          const nextRecords = result.records || records;
          drafts.delete(group.key);
          setRecords(nextRecords);
          showToast(`已记录：${winnerImage.folder} 胜 · ${loserImage.folder} 负`);
          if (index + 1 >= dataset.total) {
            setView('finish');
            pageRef.current?.scrollTo({ top: 0 });
          } else {
            setIndex(index + 1);
            setSelection(selectionFor(dataset, nextRecords, index + 1));
            window.requestAnimationFrame(() => pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
          }
        } catch (error) {
          showToast(error.message, 'error');
        } finally {
          setSaving(false);
        }
      }

      async function performDiscard() {
        setDiscardOpen(false);
        setBusyText('正在丢弃本组…');
        setBusy(true);
        try {
          let nextRecords = records;
          if (Object.hasOwn(records, group.key)) {
            const result = await post(API.discard, { session_id: dataset.session_id, key: group.key });
            nextRecords = result.records || records;
            setRecords(nextRecords);
            showToast('已丢弃本组，并删除原有记录');
          } else {
            showToast('已丢弃本组，不会写入 JSON');
          }
          drafts.delete(group.key);
          if (index + 1 >= dataset.total) {
            setView('finish');
          } else {
            setIndex(index + 1);
            setSelection(selectionFor(dataset, nextRecords, index + 1));
          }
        } catch (error) {
          showToast(error.message, 'error');
        } finally {
          setBusy(false);
        }
      }

      function requestDiscard() {
        if (Object.hasOwn(records, group.key)) setDiscardOpen(true);
        else performDiscard();
      }

      function changeFolder() {
        rememberDraft(store);
        setRootPath(dataset.root);
        setView('welcome');
      }

      const recordState = base && !dirty ? '已记录' : base ? '待更新' : dirty ? '待保存' : '未记录';
      const recordClass = base && !dirty ? ' is-saved' : dirty ? ' is-dirty' : '';

      return h('div', { className: 'ifs-page is-scoring', ref: pageRef },
        h('style', null, CSS),
        h('header', { className: 'ifs-workbar' },
          h('div', { className: 'ifs-dataset' },
            h('span', { className: 'ifs-overline' }, '当前数据集'),
            h('button', { type: 'button', className: 'ifs-root', title: dataset.root, onClick: () => copyText(dataset.root, () => showToast('根目录路径已复制')) },
              basename(dataset.root), Icon({ name: 'copy', size: 12 })),
          ),
          h('div', { className: 'ifs-progress' },
            h('div', { className: 'ifs-progress-copy' },
              h('span', null, h('b', null, index + 1), ' / ', dataset.total, ' 组'),
              h('span', null, '已记录 ', h('b', null, savedCount)),
            ),
            h('div', { className: 'ifs-track' }, h('span', { style: { width: `${((index + 1) / dataset.total) * 100}%` } })),
          ),
          h('div', { className: 'ifs-work-actions' },
            h('button', { type: 'button', className: 'ifs-ghost ifs-small', onClick: () => { rememberDraft(store); setView('finish'); } }, '汇总'),
            h('button', { type: 'button', className: 'ifs-ghost ifs-small', onClick: changeFolder }, '更换文件夹'),
          ),
        ),
        h('div', { className: 'ifs-stage' },
          h('div', { className: 'ifs-group-head' },
            h('div', null,
              h('p', { className: 'ifs-eyebrow' }, h('span'), `GROUP ${pad(index + 1)} / ${pad(dataset.total)}`),
              h('div', { className: 'ifs-title-row' },
                h('h1', null, `第 ${index + 1} 组`),
                h('span', { className: `ifs-record-state${recordClass}` }, recordState),
              ),
            ),
            h('div', { className: 'ifs-keybox' },
              h('span', null, 'JSON 记录名'),
              h('code', null, group.key),
              !group.identical_names ? h('span', { className: 'ifs-key-warning' }, '文件名不一致') : null,
            ),
          ),
          h('div', { className: 'ifs-grid' }, group.images.map((image, slot) => h(ImageCard, {
            key: `${image.folder}-${image.filename}`,
            image, slot, selection, onVote: vote, onZoom: setLightbox,
          }))),
        ),
        h('footer', { className: 'ifs-command' },
          h('div', { className: 'ifs-readouts' },
            readout('胜者 WIN', winnerImage?.folder, 'win'),
            h('span', { className: 'ifs-divider' }),
            readout('败者 LOSE', loserImage?.folder, 'lose'),
            h('span', { className: 'ifs-dirty' }, dirty ? '当前选择尚未写入 JSON' : base ? '已从 scores.json 恢复' : '选出胜者与败者后保存'),
          ),
          h('div', { className: 'ifs-command-actions' },
            h('button', { type: 'button', className: 'ifs-trash', onClick: requestDiscard }, Icon({ name: 'trash', size: 15 }), '丢弃本组'),
            h('span', { className: 'ifs-divider' }),
            h('button', { type: 'button', className: 'ifs-ghost', disabled: index === 0, onClick: () => goTo(index - 1) }, Icon({ name: 'left', size: 15 }), '上一组'),
            h('button', { type: 'button', className: 'ifs-primary ifs-save', disabled: !canSave, onClick: save },
              saving ? '保存中…' : base ? '更新并下一组' : '保存并下一组'),
          ),
        ),
        h('div', { className: 'ifs-toast' + (store.toast?.kind === 'error' ? ' is-error' : ''), style: store.toast ? undefined : { display: 'none' } }, store.toast?.message ?? ''),
        discardOpen ? h('div', { className: 'ifs-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setDiscardOpen(false); } },
          h('div', { className: 'ifs-modal ifs-confirm', role: 'dialog', 'aria-modal': 'true' },
            h('span', { className: 'ifs-confirm-icon' }, Icon({ name: 'trash', size: 20 })),
            h('h2', null, '丢弃这一组？'),
            h('p', null, '本组不会写入 scores.json；已有记录也会被删除。'),
            h('div', { className: 'ifs-confirm-actions' },
              h('button', { type: 'button', className: 'ifs-ghost', onClick: () => setDiscardOpen(false) }, '再想想'),
              h('button', { type: 'button', className: 'ifs-danger', onClick: performDiscard }, '丢弃并下一组'),
            ),
          )) : null,
        lightbox ? h('div', { className: 'ifs-overlay is-lightbox', onMouseDown: (event) => { if (event.target === event.currentTarget) setLightbox(null); } },
          h('div', { className: 'ifs-lightbox' },
            h('button', { type: 'button', className: 'ifs-icon-btn ifs-lightbox-close', onClick: () => setLightbox(null), 'aria-label': '关闭大图' }, Icon({ name: 'close', size: 18 })),
            h('img', { src: lightbox.url, alt: `${lightbox.folder}：${lightbox.filename}` }),
            h('div', { className: 'ifs-lightbox-caption' }, h('b', null, lightbox.folder), lightbox.filename),
          )) : null,
        busy ? h('div', { className: 'ifs-busy' }, h('span', { className: 'ifs-spinner' }), busyText) : null,
      );
    }

    function readout(label, value, kind) {
      return h('div', { className: `ifs-readout is-${kind}${value ? ' has-value' : ''}` },
        h('span', { className: 'ifs-readout-icon' }, Icon({ name: kind === 'win' ? 'crown' : 'down', size: 13 })),
        h('span', null, h('small', null, label), h('strong', null, value || '尚未选择')),
      );
    }

    function Finish({ store }) {
      const { dataset, records, setView, setRootPath, showToast } = store;
      const pageRef = useRef(null);
      if (!dataset) return null;
      const saved = dataset.groups.filter((group) => Object.hasOwn(records, group.key)).length;
      const missing = dataset.total - saved;

      function download() {
        const blob = new Blob([`${JSON.stringify(records, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'scores.json';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('已导出 scores.json');
      }

      function firstUnrecorded() {
        const next = dataset.groups.findIndex((group) => !Object.hasOwn(records, group.key));
        if (next < 0) { showToast('全部图片组都已有记录'); return; }
        setView('scoring');
        setRootPath(dataset.root);
        store.setIndex(next);
        store.setSelection(selectionFor(dataset, records, next));
      }

      return h('div', { className: 'ifs-page is-finish', ref: pageRef },
        h('style', null, CSS),
        h('div', { className: 'ifs-finish' },
          h('div', { className: 'ifs-finish-card' },
            h('div', { className: 'ifs-finish-mark' }, Icon({ name: 'check', size: 28 })),
            h('p', { className: 'ifs-eyebrow centered' }, h('span'), 'SESSION SUMMARY', h('span')),
            h('h1', null, '评判进度已保存。'),
            h('p', { className: 'ifs-lede center' }, '每一个选择都已实时写入 JSON，可以随时关闭页面，下次继续。'),
            h('div', { className: 'ifs-stats' },
              h('div', null, h('strong', null, saved), h('span', null, '组已记录')),
              h('div', null, h('strong', null, missing), h('span', null, '组未记录')),
              h('div', null, h('strong', null, dataset.total), h('span', null, '组总数')),
            ),
            h('div', { className: 'ifs-filebox' },
              h('div', { className: 'ifs-filehead' }, h('span', null, Icon({ name: 'json', size: 12 }), '评分文件'), h('span', { className: 'ifs-file-sync' }, '已同步')),
              h('code', { title: dataset.json_path }, dataset.json_path),
              h('div', { className: 'ifs-file-actions' },
                h('button', { type: 'button', className: 'ifs-ghost ifs-small', onClick: () => copyText(dataset.json_path, () => showToast('JSON 路径已复制')) }, Icon({ name: 'copy', size: 13 }), '复制路径'),
                h('button', { type: 'button', className: 'ifs-ghost ifs-small', onClick: download }, Icon({ name: 'download', size: 13 }), '下载 JSON'),
              ),
            ),
            h('div', { className: 'ifs-finish-actions' },
              h('button', { type: 'button', className: 'ifs-primary', onClick: () => { setView('scoring'); } }, '继续检查'),
              h('button', { type: 'button', className: 'ifs-ghost', onClick: firstUnrecorded }, '跳到未记录组'),
              h('button', { type: 'button', className: 'ifs-trash', onClick: () => { setRootPath(dataset.root); setView('welcome'); } }, '更换文件夹'),
            ),
          ),
        ),
        store.toast ? h('div', { className: 'ifs-toast' + (store.toast.kind === 'error' ? ' is-error' : '') }, store.toast.message) : null,
      );
    }

    function ImageScorerPage() {
      const store = useStore();
      const [env, setEnv] = useState(null);
      useEffect(() => {
        requestJson(API.env).then(setEnv).catch((error) => store.showToast(error.message, 'error'));
      }, [store.showToast]);

      if (store.view === 'scoring' && store.dataset) return h(Scoring, { store });
      if (store.view === 'finish' && store.dataset) return h(Finish, { store });
      return h(Welcome, { store, env });
    }

    const CSS = String.raw`
      .ifs-page {
        position: relative;
        height: 100%;
        min-height: 100%;
        overflow: auto;
        padding: calc(var(--dsh-frame-top-clearance, 0px) + 26px) clamp(18px, 4vw, 52px) 40px;
        color: var(--dsw-alias-label-primary, #f5f5f5);
        background:
          radial-gradient(1200px 500px at 12% -15%, color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 12%, transparent), transparent 70%),
          var(--dsw-alias-bg-base, #111318);
        font-family: inherit;
        scrollbar-color: var(--dsw-alias-border-l3, #3b3e46) transparent;
      }
      .ifs-page *, .ifs-page *::before, .ifs-page *::after { box-sizing: border-box; }
      .ifs-page button, .ifs-page input { font: inherit; }
      .ifs-page ::selection { background: var(--dsw-alias-brand-primary, #4d8dff); color: #fff; }
      .ifs-page :focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d8dff); outline-offset: 2px; }
      .ifs-welcome { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(360px, 440px); gap: clamp(36px, 7vw, 100px); align-items: center; width: min(1240px, 100%); min-height: calc(100vh - 140px); margin: 0 auto; padding: 24px 0 56px; }
      .ifs-hero h1 { margin: 0 0 18px; font-family: var(--dsw-font-family-display, inherit); font-size: clamp(44px, 5.3vw, 76px); font-weight: 650; line-height: 1.06; letter-spacing: -0.055em; }
      .ifs-hero h1 em { color: var(--dsw-alias-brand-primary, #6ea8ff); font-style: normal; }
      .ifs-lede { max-width: 510px; margin: 0; color: var(--dsw-alias-label-tertiary, #9397a0); font-size: 14px; line-height: 1.85; }
      .ifs-eyebrow { display: flex; gap: 9px; align-items: center; margin: 0 0 16px; color: var(--dsw-alias-label-caption, #7c818c); font-family: var(--dsw-font-family-mono, ui-monospace, monospace); font-size: 9px; font-weight: 600; letter-spacing: .17em; }
      .ifs-eyebrow > span { width: 17px; height: 1px; background: currentColor; }
      .ifs-eyebrow.centered { justify-content: center; }
      .ifs-flow { display: flex; align-items: flex-start; max-width: 620px; margin-top: clamp(30px, 5vh, 52px); }
      .ifs-flow-step { display: flex; flex: 0 0 auto; gap: 10px; align-items: flex-start; }
      .ifs-flow-step > span:last-child { display: flex; flex-direction: column; gap: 2px; }
      .ifs-flow-step strong { color: var(--dsw-alias-label-secondary, #c8cad0); font-size: 11px; font-weight: 600; white-space: nowrap; }
      .ifs-flow-step small { color: var(--dsw-alias-label-caption, #777c87); font-size: 9px; white-space: nowrap; }
      .ifs-step-number { display: grid; flex: 0 0 auto; width: 27px; height: 27px; color: var(--dsw-alias-brand-primary, #77b0ff); background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 10%, transparent); border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 23%, transparent); border-radius: 50%; font-family: var(--dsw-font-family-mono, monospace); font-size: 8px; place-items: center; }
      .ifs-flow-line { flex: 1; height: 1px; min-width: 12px; margin: 14px 10px 0; background: var(--dsw-alias-border-l3, #33363e); }
      .ifs-privacy { display: flex; gap: 6px; align-items: center; margin-top: 28px; color: var(--dsw-alias-label-caption, #707580); font-size: 9px; }
      .ifs-setup { position: relative; overflow: hidden; padding: 24px; background: var(--dsw-alias-bg-layer-1, #191b21); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 20px; box-shadow: 0 28px 80px -40px rgba(0,0,0,.75); }
      .ifs-setup::after { position: absolute; top: -100px; left: 20%; width: 320px; height: 180px; pointer-events: none; content: ""; background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 13%, transparent); filter: blur(50px); }
      .ifs-setup > * { position: relative; z-index: 1; }
      .ifs-setup-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; color: var(--dsw-alias-label-caption, #7c818c); font-family: var(--dsw-font-family-mono, monospace); font-size: 9px; letter-spacing: .12em; }
      .ifs-version { padding: 2px 7px; border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 999px; font-size: 8px; }
      .ifs-label { display: block; margin-bottom: 8px; color: var(--dsw-alias-label-secondary, #c7c9ce); font-size: 11px; }
      .ifs-pathfield { display: flex; gap: 7px; align-items: center; height: 46px; padding: 0 6px 0 12px; color: var(--dsw-alias-label-caption, #7d828d); background: var(--dsw-alias-bg-base, #111318); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 10px; transition: border-color .16s ease, box-shadow .16s ease; }
      .ifs-pathfield:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 65%, var(--dsw-alias-border-l2, #30333b)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 10%, transparent); }
      .ifs-pathfield input { flex: 1; min-width: 0; height: 100%; color: var(--dsw-alias-label-primary, #f4f4f5); background: transparent; border: 0; outline: 0; font-family: var(--dsw-font-family-mono, monospace); font-size: 11px; }
      .ifs-pathfield input::placeholder { color: var(--dsw-alias-label-caption, #6f7480); }
      .ifs-browse-inline { flex: 0 0 auto; padding: 5px 9px; color: var(--dsw-alias-label-secondary, #c5c7cc); background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 6px; font-size: 10px; cursor: pointer; }
      .ifs-hint { margin: 8px 1px 0; color: var(--dsw-alias-label-caption, #777c87); font-size: 9px; line-height: 1.7; }
      .ifs-error { margin: 9px 0 0; padding: 8px 10px; color: var(--dsw-alias-state-error-primary, #ff8f8f); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 8%, transparent); border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 22%, transparent); border-radius: 7px; font-size: 10px; line-height: 1.6; }
      .ifs-primary, .ifs-ghost, .ifs-danger, .ifs-trash, .ifs-small-btn { display: inline-flex; gap: 7px; align-items: center; justify-content: center; height: 38px; padding: 0 14px; white-space: nowrap; border: 1px solid transparent; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background .15s ease, border-color .15s ease, opacity .15s ease, transform .15s ease; }
      .ifs-primary { color: #111318; background: var(--dsw-alias-button-primary-fill, #3f7df4); border-color: var(--dsw-alias-button-primary-fill, #3f7df4); }
      .ifs-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover, #5b92ff); }
      .ifs-primary:disabled { cursor: not-allowed; opacity: .38; }
      .ifs-ghost { color: var(--dsw-alias-label-secondary, #c7c9ce); background: transparent; border-color: var(--dsw-alias-border-l2, #30333b); }
      .ifs-ghost:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.055)); color: var(--dsw-alias-label-primary, #fff); }
      .ifs-ghost:disabled { cursor: not-allowed; opacity: .35; }
      .ifs-danger { color: var(--dsw-alias-state-error-primary, #ff9b9b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 15%, transparent); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 34%, transparent); }
      .ifs-danger:hover { background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 24%, transparent); }
      .ifs-trash { color: var(--dsw-alias-label-caption, #858a95); background: transparent; border-color: transparent; }
      .ifs-trash:hover { color: var(--dsw-alias-state-error-primary, #ff9b9b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 7%, transparent); }
      .ifs-load { width: 100%; height: 44px; margin-top: 14px; border-radius: 9px; font-size: 12px; }
      .ifs-load svg { transform: rotate(90deg); }
      .ifs-demo { display: flex; gap: 6px; align-items: center; justify-content: center; width: 100%; margin-top: 10px; padding: 4px; color: var(--dsw-alias-label-caption, #858a95); background: none; border: 0; font-size: 9px; cursor: pointer; }
      .ifs-demo:hover { color: var(--dsw-alias-brand-primary, #7cb0ff); }
      .ifs-setup-foot { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 13px; color: var(--dsw-alias-label-caption, #717681); border-top: 1px solid var(--dsw-alias-border-l2, #2d3037); font-size: 8px; }
      .ifs-setup-foot span { display: inline-flex; gap: 5px; align-items: center; }
      .ifs-small { height: 31px; padding: 0 10px; font-size: 10px; }
      .ifs-icon-btn { display: grid; flex: 0 0 auto; width: 30px; height: 30px; padding: 0; color: var(--dsw-alias-label-tertiary, #a0a4ad); background: transparent; border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 50%; cursor: pointer; place-items: center; }
      .ifs-icon-btn:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.06)); }
      .ifs-icon-btn:disabled { opacity: .3; cursor: not-allowed; }
      .ifs-overlay { position: fixed; inset: 0; z-index: 80; display: grid; padding: 5vh 24px; overflow: auto; background: rgba(4,6,10,.66); backdrop-filter: blur(7px); place-items: center; }
      .ifs-modal { width: min(780px, 94vw); max-height: 86vh; overflow: hidden; color: var(--dsw-alias-label-primary, #f5f5f5); background: var(--dsw-alias-bg-layer-1, #191b21); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 16px; box-shadow: 0 30px 100px -30px rgba(0,0,0,.9); }
      .ifs-modal-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 22px 12px; }
      .ifs-modal-head .ifs-eyebrow { margin-bottom: 5px; font-size: 8px; }
      .ifs-modal-head h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -.02em; }
      .ifs-shortcuts { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 22px 10px; }
      .ifs-chip { padding: 4px 8px; color: var(--dsw-alias-label-tertiary, #a0a4ad); background: transparent; border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 6px; font-size: 9px; cursor: pointer; }
      .ifs-chip:hover { color: var(--dsw-alias-label-primary, #fff); background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.05)); }
      .ifs-picker-path { display: flex; gap: 6px; align-items: center; margin: 0 22px 8px; padding: 4px; background: var(--dsw-alias-bg-base, #111318); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 9px; }
      .ifs-picker-path .ifs-icon-btn { border: 0; border-radius: 6px; }
      .ifs-picker-path input { flex: 1; min-width: 0; height: 28px; padding: 0 6px; color: var(--dsw-alias-label-secondary, #c7c9ce); background: transparent; border: 0; outline: 0; font-family: var(--dsw-font-family-mono, monospace); font-size: 10px; }
      .ifs-small-btn { height: 28px; padding: 0 9px; color: var(--dsw-alias-label-secondary, #c7c9ce); background: transparent; border-color: var(--dsw-alias-border-l2, #30333b); font-size: 9px; }
      .ifs-small-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.05)); }
      .ifs-current-path { display: flex; gap: 6px; align-items: center; padding: 0 24px 8px; overflow: hidden; color: var(--dsw-alias-label-caption, #838893); font-family: var(--dsw-font-family-mono, monospace); font-size: 9px; }
      .ifs-current-path span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-dir-list { min-height: 220px; max-height: 42vh; padding: 4px 14px 10px; overflow: auto; border-top: 1px solid var(--dsw-alias-border-l2, #2b2e35); border-bottom: 1px solid var(--dsw-alias-border-l2, #2b2e35); }
      .ifs-dir-row { display: flex; gap: 9px; align-items: center; width: 100%; padding: 8px 9px; color: var(--dsw-alias-label-secondary, #c7c9ce); background: transparent; border: 0; border-radius: 7px; text-align: left; cursor: pointer; }
      .ifs-dir-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.05)); }
      .ifs-dir-row > svg:first-child { color: var(--dsw-alias-label-caption, #7c818c); }
      .ifs-dir-row > svg:last-child { color: var(--dsw-alias-label-caption, #6f7480); opacity: .6; }
      .ifs-dir-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
      .ifs-dir-name { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-dir-count { color: var(--dsw-alias-label-caption, #747985); font-family: var(--dsw-font-family-mono, monospace); font-size: 8px; }
      .ifs-empty { display: flex; flex-direction: column; gap: 7px; align-items: center; justify-content: center; min-height: 220px; color: var(--dsw-alias-label-caption, #747985); font-size: 10px; text-align: center; }
      .ifs-modal-error { margin: 8px 22px 0; }
      .ifs-modal-foot { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px 22px 16px; }
      .ifs-modal-foot p { margin: 0; color: var(--dsw-alias-label-caption, #747985); font-size: 9px; }
      .ifs-modal-foot p b { color: var(--dsw-alias-label-tertiary, #a0a4ad); }
      .ifs-foot-actions { display: flex; gap: 7px; }
      .ifs-confirm { width: min(400px, 92vw); padding: 28px; text-align: center; overflow: visible; }
      .ifs-confirm-icon { display: grid; width: 46px; height: 46px; margin: 0 auto 14px; color: var(--dsw-alias-state-error-primary, #ff9b9b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff6b6b) 11%, transparent); border-radius: 50%; place-items: center; }
      .ifs-confirm h2 { margin: 0 0 7px; font-size: 20px; }
      .ifs-confirm p { margin: 0; color: var(--dsw-alias-label-tertiary, #969aa4); font-size: 10px; line-height: 1.75; }
      .ifs-confirm-actions { display: flex; gap: 7px; justify-content: center; margin-top: 18px; }
      .ifs-workbar { display: grid; grid-template-columns: minmax(130px, 1fr) minmax(210px, 360px) auto; gap: 22px; align-items: center; padding-bottom: 13px; border-bottom: 1px solid var(--dsw-alias-border-l2, #2c2f36); }
      .ifs-dataset { min-width: 0; }
      .ifs-overline { display: block; margin-bottom: 2px; color: var(--dsw-alias-label-caption, #717681); font-family: var(--dsw-font-family-mono, monospace); font-size: 8px; letter-spacing: .12em; }
      .ifs-root { display: flex; gap: 6px; align-items: center; max-width: 100%; padding: 0; overflow: hidden; color: var(--dsw-alias-label-secondary, #c9cbd0); background: none; border: 0; font-size: 12px; font-weight: 600; cursor: pointer; }
      .ifs-root svg { opacity: 0; }
      .ifs-root:hover svg { opacity: .65; }
      .ifs-progress-copy { display: flex; justify-content: space-between; margin-bottom: 6px; color: var(--dsw-alias-label-caption, #818691); font-size: 9px; }
      .ifs-progress-copy b { color: var(--dsw-alias-label-secondary, #c7c9ce); font-family: var(--dsw-font-family-mono, monospace); font-weight: 500; }
      .ifs-track { height: 3px; overflow: hidden; background: var(--dsw-alias-border-l2, #30333b); border-radius: 99px; }
      .ifs-track span { display: block; height: 100%; background: var(--dsw-alias-brand-primary, #5e9bff); border-radius: inherit; transition: width .3s ease; }
      .ifs-work-actions { display: flex; gap: 6px; }
      .ifs-stage { padding-top: 16px; }
      .ifs-group-head { display: flex; gap: 20px; align-items: flex-end; justify-content: space-between; margin-bottom: 12px; }
      .ifs-group-head .ifs-eyebrow { margin-bottom: 5px; font-size: 8px; }
      .ifs-title-row { display: flex; gap: 10px; align-items: center; }
      .ifs-title-row h1 { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -.03em; }
      .ifs-record-state { padding: 2px 7px; color: var(--dsw-alias-label-caption, #858a95); background: var(--dsw-alias-bg-layer-2, #20232a); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 99px; font-size: 8px; }
      .ifs-record-state.is-saved { color: var(--dsw-alias-state-success-primary, #6ee7a8); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 24%, transparent); }
      .ifs-record-state.is-dirty { color: var(--dsw-alias-state-warn-primary, #f1c46b); border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f1c46b) 24%, transparent); }
      .ifs-keybox { display: flex; gap: 7px; align-items: center; min-width: 0; padding-bottom: 2px; color: var(--dsw-alias-label-caption, #777c87); font-size: 8px; }
      .ifs-keybox code { max-width: 240px; overflow: hidden; padding: 2px 6px; color: var(--dsw-alias-label-secondary, #c7c9ce); background: var(--dsw-alias-bg-layer-2, #20232a); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 4px; font-family: var(--dsw-font-family-mono, monospace); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-key-warning { color: var(--dsw-alias-state-warn-primary, #e8bc66); white-space: nowrap; }
      .ifs-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .ifs-card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--dsw-alias-bg-layer-1, #191b21); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 11px; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
      .ifs-card:hover { background: var(--dsw-alias-bg-layer-2, #1e2128); border-color: var(--dsw-alias-border-l3, #3a3e47); transform: translateY(-1px); }
      .ifs-card.is-winner { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 65%, var(--dsw-alias-border-l2, #30333b)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 14%, transparent); }
      .ifs-card.is-loser { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff7f7f) 60%, var(--dsw-alias-border-l2, #30333b)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff7f7f) 12%, transparent); }
      .ifs-frame { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background-color: var(--dsw-alias-bg-base, #111318); background-image: linear-gradient(45deg, var(--dsw-alias-bg-layer-2, #1c1f26) 25%, transparent 25%), linear-gradient(-45deg, var(--dsw-alias-bg-layer-2, #1c1f26) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--dsw-alias-bg-layer-2, #1c1f26) 75%), linear-gradient(-45deg, transparent 75%, var(--dsw-alias-bg-layer-2, #1c1f26) 75%); background-position: 0 0, 0 9px, 9px -9px, -9px 0; background-size: 18px 18px; }
      .ifs-frame img { width: 100%; height: 100%; padding: 3px; object-fit: contain; cursor: zoom-in; }
      .ifs-zoom { position: absolute; top: 7px; right: 7px; display: grid; width: 26px; height: 26px; padding: 0; color: rgba(255,255,255,.85); background: rgba(8,10,14,.58); border: 1px solid rgba(255,255,255,.16); border-radius: 5px; opacity: 0; cursor: pointer; backdrop-filter: blur(6px); place-items: center; transition: opacity .15s ease; }
      .ifs-card:hover .ifs-zoom, .ifs-zoom:focus-visible { opacity: 1; }
      .ifs-badge { position: absolute; top: 7px; left: 7px; display: inline-flex; gap: 4px; align-items: center; padding: 3px 6px; border: 1px solid; border-radius: 4px; font-family: var(--dsw-font-family-mono, monospace); font-size: 7px; font-weight: 600; letter-spacing: .08em; backdrop-filter: blur(6px); }
      .ifs-badge.is-win { color: var(--dsw-alias-state-success-primary, #b9f9d7); background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2f8f61) 62%, rgba(0,0,0,.5)); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 45%, transparent); }
      .ifs-badge.is-lose { color: #ffe1e1; background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #a54d4d) 65%, rgba(0,0,0,.5)); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff7f7f) 45%, transparent); }
      .ifs-meta { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 7px; align-items: center; min-height: 56px; padding: 9px 10px 8px; }
      .ifs-index { display: grid; grid-row: 1 / span 2; width: 21px; height: 21px; color: var(--dsw-alias-label-caption, #7f848f); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 4px; font-family: var(--dsw-font-family-mono, monospace); font-size: 7px; place-items: center; }
      .ifs-card.is-winner .ifs-index { color: var(--dsw-alias-state-success-primary, #6ee7a8); border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 25%, transparent); }
      .ifs-card.is-loser .ifs-index { color: var(--dsw-alias-state-error-primary, #ff9b9b); border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff7f7f) 24%, transparent); }
      .ifs-meta h3 { margin: 0; overflow: hidden; color: var(--dsw-alias-label-primary, #f2f2f3); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-meta p { margin: 0; overflow: hidden; color: var(--dsw-alias-label-caption, #717681); font-family: var(--dsw-font-family-mono, monospace); font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-votes { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--dsw-alias-border-l2, #2d3037); }
      .ifs-vote { display: flex; gap: 4px; align-items: center; justify-content: center; height: 34px; padding: 0 4px; color: var(--dsw-alias-label-caption, #838893); background: transparent; border: 0; font-size: 9px; cursor: pointer; transition: background .14s ease, color .14s ease; }
      .ifs-vote + .ifs-vote { border-left: 1px solid var(--dsw-alias-border-l2, #2d3037); }
      .ifs-vote:hover { color: var(--dsw-alias-label-secondary, #c7c9ce); background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.04)); }
      .ifs-vote.is-win.is-active { color: var(--dsw-alias-state-success-primary, #6ee7a8); background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 10%, transparent); font-weight: 600; }
      .ifs-vote.is-lose.is-active { color: var(--dsw-alias-state-error-primary, #ff9b9b); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ff7f7f) 9%, transparent); font-weight: 600; }
      .ifs-command { position: sticky; bottom: 0; z-index: 10; display: flex; gap: 16px; align-items: center; justify-content: space-between; margin-top: 14px; padding: 9px 11px 9px 15px; background: color-mix(in srgb, var(--dsw-alias-bg-layer-2, #1e2128) 92%, transparent); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 11px; box-shadow: 0 18px 50px -25px rgba(0,0,0,.85); backdrop-filter: blur(16px); }
      .ifs-readouts { display: flex; gap: 10px; align-items: center; min-width: 0; }
      .ifs-readout { display: flex; gap: 6px; align-items: center; min-width: 0; }
      .ifs-readout > span:last-child { display: flex; flex-direction: column; gap: 0; min-width: 0; }
      .ifs-readout small { color: var(--dsw-alias-label-caption, #777c87); font-family: var(--dsw-font-family-mono, monospace); font-size: 7px; letter-spacing: .06em; }
      .ifs-readout strong { max-width: 114px; overflow: hidden; color: var(--dsw-alias-label-secondary, #a7abb4); font-size: 10px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-readout.is-win.has-value strong { color: var(--dsw-alias-state-success-primary, #6ee7a8); }
      .ifs-readout.is-lose.has-value strong { color: var(--dsw-alias-state-error-primary, #ff9b9b); }
      .ifs-readout-icon { display: grid; width: 25px; height: 25px; border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 5px; place-items: center; }
      .ifs-readout.is-win .ifs-readout-icon { color: var(--dsw-alias-state-success-primary, #6ee7a8); }
      .ifs-readout.is-lose .ifs-readout-icon { color: var(--dsw-alias-state-error-primary, #ff9b9b); }
      .ifs-divider { width: 1px; height: 23px; background: var(--dsw-alias-border-l2, #30333b); }
      .ifs-dirty { overflow: hidden; max-width: 220px; color: var(--dsw-alias-label-caption, #777c87); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-command-actions { display: flex; flex: 0 0 auto; gap: 5px; align-items: center; }
      .ifs-command-actions .ifs-primary, .ifs-command-actions .ifs-ghost, .ifs-command-actions .ifs-trash { height: 34px; font-size: 10px; }
      .ifs-save { min-width: 138px; }
      .ifs-busy { position: fixed; inset: 0; z-index: 120; display: flex; gap: 11px; flex-direction: column; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary, #9aa0aa); background: color-mix(in srgb, var(--dsw-alias-bg-base, #111318) 73%, transparent); backdrop-filter: blur(6px); font-size: 10px; }
      .ifs-spinner { width: 22px; height: 22px; border: 2px solid var(--dsw-alias-border-l2, #30333b); border-top-color: var(--dsw-alias-brand-primary, #6ea8ff); border-radius: 50%; animation: ifs-spin .8s linear infinite; }
      @keyframes ifs-spin { to { transform: rotate(360deg); } }
      .ifs-toast { position: fixed; bottom: 76px; left: 50%; z-index: 130; max-width: 88vw; padding: 8px 13px; color: var(--dsw-alias-label-secondary, #d0d2d7); background: var(--dsw-alias-bg-layer-2, #20232a); border: 1px solid var(--dsw-alias-border-l3, #3a3e47); border-radius: 7px; box-shadow: 0 14px 36px -16px rgba(0,0,0,.8); font-size: 10px; transform: translateX(-50%); animation: ifs-toast .18s ease; }
      .ifs-toast.is-error { color: var(--dsw-alias-state-error-primary, #ff9b9b); }
      @keyframes ifs-toast { from { opacity: 0; transform: translate(-50%, 5px); } }
      .ifs-finish { display: grid; min-height: calc(100vh - 130px); place-items: center; }
      .ifs-finish-card { width: min(640px, 100%); padding: clamp(28px, 5vw, 48px); text-align: center; background: radial-gradient(600px 260px at 50% 0%, color-mix(in srgb, var(--dsw-alias-brand-primary, #4d8dff) 10%, transparent), transparent 70%), var(--dsw-alias-bg-layer-1, #191b21); border: 1px solid var(--dsw-alias-border-l2, #30333b); border-radius: 20px; box-shadow: 0 30px 80px -40px rgba(0,0,0,.8); }
      .ifs-finish-mark { display: grid; width: 60px; height: 60px; margin: 0 auto 18px; color: var(--dsw-alias-label-primary-foreground, #fff); background: var(--dsw-alias-state-success-primary, #3ea974); border-radius: 50%; box-shadow: 0 0 0 8px color-mix(in srgb, var(--dsw-alias-state-success-primary, #6ee7a8) 9%, transparent); place-items: center; }
      .ifs-finish-card h1 { margin: 0 0 10px; font-size: clamp(26px, 3.6vw, 35px); font-weight: 650; letter-spacing: -.04em; }
      .ifs-lede.center { margin: 0 auto; max-width: 420px; font-size: 11px; }
      .ifs-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 25px 0 16px; background: color-mix(in srgb, var(--dsw-alias-bg-base, #111318) 55%, transparent); border: 1px solid var(--dsw-alias-border-l2, #2c2f36); border-radius: 11px; }
      .ifs-stats > div { display: flex; flex-direction: column; gap: 1px; padding: 13px 6px; }
      .ifs-stats > div + div { border-left: 1px solid var(--dsw-alias-border-l2, #2c2f36); }
      .ifs-stats strong { color: var(--dsw-alias-label-primary, #f4f4f5); font-family: var(--dsw-font-family-mono, monospace); font-size: 22px; font-weight: 400; }
      .ifs-stats > div:first-child strong { color: var(--dsw-alias-state-success-primary, #6ee7a8); }
      .ifs-stats span { color: var(--dsw-alias-label-caption, #777c87); font-size: 8px; }
      .ifs-filebox { padding: 11px 12px; text-align: left; background: color-mix(in srgb, var(--dsw-alias-bg-base, #111318) 55%, transparent); border: 1px solid var(--dsw-alias-border-l2, #2c2f36); border-radius: 9px; }
      .ifs-filehead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; color: var(--dsw-alias-label-caption, #858a95); font-size: 8px; }
      .ifs-filehead > span { display: inline-flex; gap: 5px; align-items: center; }
      .ifs-file-sync { color: var(--dsw-alias-state-success-primary, #6ee7a8); font-family: var(--dsw-font-family-mono, monospace); font-size: 7px; }
      .ifs-filebox code { display: block; overflow: hidden; color: var(--dsw-alias-label-secondary, #c0c3c9); font-family: var(--dsw-font-family-mono, monospace); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
      .ifs-file-actions { display: flex; gap: 5px; margin-top: 8px; }
      .ifs-finish-actions { display: flex; gap: 7px; flex-wrap: wrap; justify-content: center; margin-top: 19px; }
      .ifs-lightbox { background: rgba(2,3,5,.9); }
      .ifs-overlay.is-lightbox { display: block; padding: 3vh 3vw; }
      .ifs-lightbox { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; }
      .ifs-lightbox img { max-width: 100%; max-height: calc(100vh - 100px); object-fit: contain; border-radius: 5px; box-shadow: 0 25px 90px rgba(0,0,0,.8); }
      .ifs-lightbox-close { position: absolute; top: 4px; right: 4px; color: #fff; background: rgba(0,0,0,.5); border-color: rgba(255,255,255,.2); }
      .ifs-lightbox-caption { display: flex; gap: 10px; align-items: center; margin-top: 10px; color: rgba(255,255,255,.55); font-family: var(--dsw-font-family-mono, monospace); font-size: 9px; }
      .ifs-lightbox-caption b { color: var(--dsw-alias-brand-primary, #8db9ff); font-weight: 500; }
      @media (max-width: 1120px) {
        .ifs-welcome { grid-template-columns: 1fr; gap: 32px; align-items: start; min-height: 0; }
        .ifs-hero h1 { font-size: clamp(42px, 7vw, 64px); }
        .ifs-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 820px) {
        .ifs-page { padding-left: 16px; padding-right: 16px; }
        .ifs-workbar { grid-template-columns: 1fr auto; }
        .ifs-progress { grid-column: 1 / -1; grid-row: 2; }
        .ifs-work-actions { grid-column: 2; grid-row: 1; }
        .ifs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ifs-command { flex-wrap: wrap; }
        .ifs-readouts { width: 100%; }
        .ifs-command-actions { width: 100%; justify-content: flex-end; padding-top: 7px; border-top: 1px solid var(--dsw-alias-border-l2, #30333b); }
        .ifs-save { flex: 1; max-width: 220px; }
        .ifs-keybox { display: none; }
        .ifs-flow-step small { display: none; }
      }
      @media (max-width: 540px) {
        .ifs-grid { grid-template-columns: 1fr; }
        .ifs-frame { aspect-ratio: 4 / 3; }
        .ifs-dirty { display: none; }
        .ifs-flow { display: none; }
        .ifs-command-actions .ifs-trash { font-size: 0; width: 34px; padding: 0; }
        .ifs-command-actions .ifs-ghost { font-size: 0; width: 34px; padding: 0; }
        .ifs-stat span { font-size: 7px; }
      }
      @media (prefers-reduced-motion: reduce) { .ifs-page *, .ifs-page *::before, .ifs-page *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
    `;

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 18,
          label: '图片评分',
        }, SidebarIcon));
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          label: '图片评分',
        }, ImageScorerPage));
      },
    };
  },
});
