'use strict';

/* Systemika Studio update notification.
 *
 * WebApp builds discover a newer deployment from the page that is already
 * running. Desktop builds use the canonical public WebApp deployment at
 * https://systemika.no/studio/app/. The WebApp root contains the generated
 * update manifest and versioned HTML, so publishing one complete WebApp build
 * also publishes the metadata used by desktop update checks.
 */
(function (root) {
  const DEFAULT_DOWNLOAD_URL = 'https://systemika.no/download/';
  const CANONICAL_WEBAPP_ROOT = 'https://systemika.no/studio/app/';
  const CANONICAL_UPDATE_MANIFEST_URLS = [
    `${CANONICAL_WEBAPP_ROOT}systemika-update.json`,
    `${CANONICAL_WEBAPP_ROOT}update.json`, // backward-compatible alias
  ];
  const CANONICAL_RELEASE_PAGE_URLS = [
    `${CANONICAL_WEBAPP_ROOT}MultiSimulationAnalyser/index.html`,
    `${CANONICAL_WEBAPP_ROOT}OpenSystemDynamics/src/index.html`,
  ];
  let checkInProgress = null;
  let startupCheckStarted = false;

  function versionParts(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/^v/i, '')
      .split(/[+-]/, 1)[0]
      .split('.')
      .map(part => {
        const match = String(part).match(/^\d+/);
        return match ? Number(match[0]) : 0;
      });
  }

  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }



  function currentVersion() {
    return root.systemika && root.systemika.version ? String(root.systemika.version) : '';
  }

  function documentMeta(name) {
    try {
      const element = root.document && root.document.querySelector
        ? root.document.querySelector(`meta[name="${name}"]`)
        : null;
      return element ? String(element.getAttribute('content') || '').trim() : '';
    } catch (error) {
      return '';
    }
  }

  function currentBuildId() {
    try {
      const url = new URL(root.location.href);
      const fromQuery = String(url.searchParams.get('b') || '').trim();
      if (fromQuery) return fromQuery;
    } catch (error) {
      // Fall through to the release marker embedded in generated HTML.
    }
    return documentMeta('systemika-build');
  }

  function cacheBustedUrl(value) {
    const url = new URL(value, root.location && root.location.href ? root.location.href : DEFAULT_DOWNLOAD_URL);
    url.searchParams.set('_', String(Date.now()));
    return url.toString();
  }

  function normalizedRoot(value) {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.toString();
  }

  function currentDeploymentRoot() {
    try {
      const url = new URL(root.location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      const markers = ['/OpenSystemDynamics/', '/MultiSimulationAnalyser/'];
      for (const marker of markers) {
        const index = url.pathname.indexOf(marker);
        if (index >= 0) {
          url.pathname = url.pathname.slice(0, index + 1);
          url.search = '';
          url.hash = '';
          return normalizedRoot(url.toString());
        }
      }
      url.pathname = url.pathname.replace(/[^/]*$/, '');
      url.search = '';
      url.hash = '';
      return normalizedRoot(url.toString());
    } catch (error) {
      return '';
    }
  }

  function updateRoots() {
    const local = currentDeploymentRoot();
    return local ? [local] : [];
  }

  function rootFileUrl(base, parts) {
    return cacheBustedUrl(new URL(parts.join('/'), normalizedRoot(base)).toString());
  }

  function currentDocumentUrl() {
    try {
      const url = new URL(root.location.href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      url.search = '';
      url.hash = '';
      return cacheBustedUrl(url.toString());
    } catch (error) {
      return '';
    }
  }

  function metaValueFromHtml(source, metaName) {
    const tags = String(source == null ? '' : source).match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
      const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
      if (!nameMatch || nameMatch[1].toLowerCase() !== String(metaName).toLowerCase()) continue;
      const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
      if (contentMatch) return contentMatch[1].trim();
    }
    return '';
  }

  function manifestFromReleaseHtml(html, sourceName = 'html') {
    const source = String(html == null ? '' : html);
    const explicitVersion = metaValueFromHtml(source, 'systemika-version');
    const explicitBuild = metaValueFromHtml(source, 'systemika-build');
    if (explicitVersion) {
      return {
        version: explicitVersion,
        buildId: explicitBuild,
        downloadUrl: DEFAULT_DOWNLOAD_URL,
        source: sourceName,
      };
    }

    const refPattern = /(?:MultiSimulationAnalyser\/index\.html|OpenSystemDynamics\/src\/index\.html|opensystemdynamics(?:\.min)?\.js|multisimulationanalyser(?:\.min)?\.js)[^"'<>]*[?&]v=([^&"'<>\s]+)/i;
    const versionMatch = source.match(refPattern);
    if (!versionMatch) throw new Error('Release metadata was not found in this page.');
    const buildMatch = source.match(/(?:MultiSimulationAnalyser\/index\.html|OpenSystemDynamics\/src\/index\.html|opensystemdynamics(?:\.min)?\.js|multisimulationanalyser(?:\.min)?\.js)[^"'<>]*[?&]b=([^&"'<>\s]+)/i);
    return {
      version: decodeURIComponent(versionMatch[1]),
      buildId: buildMatch ? decodeURIComponent(buildMatch[1]) : '',
      downloadUrl: DEFAULT_DOWNLOAD_URL,
      source: sourceName,
    };
  }

  function manifestFromBuildInfo(text, sourceName = 'build info') {
    const source = String(text == null ? '' : text);
    const versionMatch = source.match(/Systemika\s+Studio\s+WebApp\s+([^\s]+)/i);
    if (!versionMatch) throw new Error('Release metadata was not found in the build information.');
    const buildMatch = source.match(/Build\s+ID:\s*([^\s]+)/i);
    return {
      version: versionMatch[1].trim(),
      buildId: buildMatch ? buildMatch[1].trim() : '',
      downloadUrl: DEFAULT_DOWNLOAD_URL,
      source: sourceName,
    };
  }

  async function fetchJsonManifest(url) {
    const response = await root.fetch(cacheBustedUrl(url), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    if (!manifest || typeof manifest.version !== 'string' || !manifest.version.trim()) {
      throw new Error('Manifest has no release version.');
    }
    return {
      ...manifest,
      version: manifest.version.trim(),
      downloadUrl: String(manifest.downloadUrl || DEFAULT_DOWNLOAD_URL),
    };
  }

  async function fetchReleaseHtml(url, sourceName) {
    const response = await root.fetch(url, { cache: 'no-store', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`${sourceName}: HTTP ${response.status}`);
    return manifestFromReleaseHtml(await response.text(), sourceName);
  }

  async function fetchBuildInfo(url, sourceName) {
    const response = await root.fetch(url, { cache: 'no-store', headers: { Accept: 'text/plain' } });
    if (!response.ok) throw new Error(`${sourceName}: HTTP ${response.status}`);
    return manifestFromBuildInfo(await response.text(), sourceName);
  }



  async function readManifest() {
    if (root.electronAPI && typeof root.electronAPI.checkForUpdates === 'function') {
      const result = await root.electronAPI.checkForUpdates();
      if (!result || !result.ok) {
        throw new Error(result && result.error ? result.error : 'The Systemika update service is currently unavailable. Please try again later.');
      }
      const manifest = { ...(result.manifest || {}) };
      manifest.installedBuildId = String(result.currentBuildId || '').trim();
      return manifest;
    }

    const diagnostics = [];
    const currentDoc = currentDocumentUrl();
    if (currentDoc) {
      try {
        return await fetchReleaseHtml(currentDoc, 'Current Systemika editor');
      } catch (error) {
        diagnostics.push(error && error.message ? error.message : String(error));
      }
    }

    const localRoot = currentDeploymentRoot();
    if (localRoot) {
      const localAttempts = [
        () => fetchJsonManifest(rootFileUrl(localRoot, ['systemika-update.json'])),
        () => fetchJsonManifest(rootFileUrl(localRoot, ['update.json'])),
        () => fetchBuildInfo(rootFileUrl(localRoot, ['WEB_BUILD_INFO.txt']), 'Systemika build information'),
      ];
      for (const attempt of localAttempts) {
        try {
          return await attempt();
        } catch (error) {
          diagnostics.push(error && error.message ? error.message : String(error));
        }
      }
    }

    for (const url of CANONICAL_UPDATE_MANIFEST_URLS) {
      try {
        return await fetchJsonManifest(url);
      } catch (error) {
        diagnostics.push(error && error.message ? error.message : String(error));
      }
    }

    for (const url of CANONICAL_RELEASE_PAGE_URLS) {
      try {
        return await fetchReleaseHtml(cacheBustedUrl(url), 'Canonical Systemika WebApp');
      } catch (error) {
        diagnostics.push(error && error.message ? error.message : String(error));
      }
    }

    if (root.console && typeof root.console.warn === 'function') {
      root.console.warn('Systemika update check diagnostics:', diagnostics.join(' '));
    }
    throw new Error('The Systemika update service is currently unavailable. Please try again later.');
  }

  function isElectron() {
    return Boolean(root.electronAPI && root.electronAPI.isElectron);
  }

  function sameReleaseButDifferentBuild(manifest, installedVersion) {
    const latestBuild = String(manifest && manifest.buildId ? manifest.buildId : '').trim();
    if (!latestBuild || compareVersions(String(manifest.version || ''), installedVersion) !== 0) return false;
    if (isElectron()) {
      const installedBuild = String(manifest && manifest.installedBuildId ? manifest.installedBuildId : '').trim();
      return Boolean(installedBuild && latestBuild !== installedBuild);
    }
    const installedBuild = currentBuildId();
    return !installedBuild || latestBuild !== installedBuild;
  }

  function openAvailableUpdate(manifest) {
    const latest = String(manifest.version || '').trim();
    const latestBuild = String(manifest.buildId || '').trim();
    if (!isElectron()) {
      try {
        const deploymentRoot = currentDeploymentRoot();
        if (!deploymentRoot) throw new Error('No WebApp deployment root');
        const launcher = new URL('index.html', deploymentRoot);
        launcher.searchParams.set('update', [latest, latestBuild || Date.now()].filter(Boolean).join('-'));
        root.top.location.assign(launcher.toString());
        return;
      } catch (error) {
        root.location.reload();
        return;
      }
    }

    const downloadUrl = String(manifest.downloadUrl || DEFAULT_DOWNLOAD_URL);
    if (root.electronAPI && typeof root.electronAPI.openExternal === 'function') {
      root.electronAPI.openExternal(downloadUrl);
    }
  }

  function notifyAvailable(manifest, sameVersionBuildUpdate) {
    const installed = currentVersion() || 'unknown';
    const latest = String(manifest.version || '').trim();
    const heading = sameVersionBuildUpdate
      ? `A refreshed Systemika Studio ${latest} build is available.`
      : 'A newer version of Systemika Studio is available.';
    const versionLines = sameVersionBuildUpdate ? `Version: ${latest}` : `Installed: ${installed}\nLatest: ${latest}`;
    const action = isElectron() ? 'Open the Systemika download page now?' : 'Reload Systemika Studio now?';
    if (root.confirm(`${heading}\n\n${versionLines}\n\n${action}`)) {
      openAvailableUpdate(manifest);
    }
  }

  async function checkForUpdates(options = {}) {
    const manual = Boolean(options.manual);
    if (checkInProgress) return checkInProgress;

    checkInProgress = (async () => {
      try {
        const manifest = await readManifest();
        const installed = currentVersion();
        const latest = String(manifest && manifest.version ? manifest.version : '').trim();
        if (!installed || !latest) throw new Error('The update source does not contain a valid version.');

        const versionComparison = compareVersions(latest, installed);
        const sameVersionBuildUpdate = sameReleaseButDifferentBuild(manifest, installed);
        if (versionComparison > 0 || sameVersionBuildUpdate) {
          notifyAvailable(manifest, sameVersionBuildUpdate);
          return { updateAvailable: true, sameVersionBuildUpdate, installed, latest, manifest };
        }
        if (manual) root.alert(`Systemika Studio is up to date.\n\nInstalled version: ${installed}`);
        return { updateAvailable: false, installed, latest, manifest };
      } catch (error) {
        if (manual) {
          root.alert(`Systemika Studio could not check for updates.\n\n${error && error.message ? error.message : error}`);
        } else if (root.console && typeof root.console.warn === 'function') {
          root.console.warn('Systemika update check skipped:', error);
        }
        return { updateAvailable: false, error };
      } finally {
        checkInProgress = null;
      }
    })();

    return checkInProgress;
  }

  function init() {
    const button = root.document.getElementById('btn_check_updates');
    if (button) button.addEventListener('click', () => { void checkForUpdates({ manual: true }); });
    if (!startupCheckStarted) {
      startupCheckStarted = true;
      root.setTimeout(() => { void checkForUpdates({ manual: false }); }, 1200);
    }
  }

  root.SystemikaUpdate = {
    checkForUpdates,
    compareVersions,
    manifestFromReleaseHtml,
    manifestFromBuildInfo,
    currentBuildId,
    currentDeploymentRoot,
    updateRoots,
    CANONICAL_WEBAPP_ROOT,
    CANONICAL_UPDATE_MANIFEST_URLS,
    CANONICAL_RELEASE_PAGE_URLS,
  };
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
