(function () {
  'use strict';

  // Inject CSS
  const style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = `
  .baddonz-button { cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, text !important; }
  #baddonz-ax-wnd { width: 110px; min-width: 110px; }
  #baddonz-ax-wnd-settings { width: 250px; min-width: 250px; }
  .baddonz-window-body#ax-wnd-body { padding: 0 5px 5px 5px; gap: 5px; }
  #ax-expanded-controls { display: none; flex-direction: column; }
  #ax-back-controls { display: none; flex-direction: row; align-items: center; gap: 5px; justify-content: flex-start; width: 100%; }
  #ax-walk-btn, #ax-s-walka-btn { width: 100%; }
  .baddonz-setting-row.ax-main-row { gap: 5px; }
  .baddonz-input.ax-small { width: 100%; max-width: 79px; font-size: 11px; height: 20px !important; line-height: 18px; text-align: center; padding: 1px 0px; }
  #baddonz-ax-wnd-settings .baddonz-input { text-align: center; height: 26px !important; }
  .baddonz-input.ax-hotkey { width: 100%; padding: 1px 5px; font-size: 14px; height: 22px !important; line-height: 20px; caret-color: transparent; cursor: url("https://gordion.margonem.pl/img/gui/cursor/5n.png") 4 0, default !important; }
  .baddonz-setting-row .baddonz-input { flex-grow: 1; }
  .baddonz-setting-row span { white-space: nowrap; font-size: 11px; }
  #ax-clan-options, #ax-nick-options { display: none; flex-direction: column; gap: 5px; margin-top: 5px; }
  #ax-clan-options-header, #ax-nick-options-header, #ax-hotkey-options-header { display: flex; align-items: center; gap: 5px; }
  #ax-hotkey-options { display: none; flex-direction: column; gap: 5px; margin-top: 5px; }
  .baddonz-textarea::-webkit-scrollbar { width: 6px; height: 6px; }
  .baddonz-textarea::-webkit-scrollbar-track { background: #1414148f; border-radius: 3px; }
  .baddonz-textarea::-webkit-scrollbar-thumb { background: #505050; border-radius: 3px; }
  .baddonz-textarea::-webkit-scrollbar-thumb:hover { background: #808080; }
  .opacity-0 { opacity: 0.0; }
  .opacity-1 { opacity: 0.25; }
  .opacity-2 { opacity: 0.5; }
  .opacity-3 { opacity: 0.75; }
  .opacity-4 { opacity: 1.0; }
  .active { background: rgba(255,255,255,0.08); outline: 1px solid #303030; }
  .disabled { opacity: 0.6; pointer-events: none; }
  .grabbing { cursor: move; }
  `;
  document.head.appendChild(style);

  if (!window.Engine) return;

  const STORAGE_KEY = 'baddonz-settings-ax';

  // Runtime state
  let enabled = true;
  let walkingEnabled = false;      // enableWalk
  let backEnabled = false;         // enableBack
  let fastFightEnabled = false;    // fastFight
  let walkingOptionEnabled = false;// enableWalkingOption
  let attackFriends = false;
  let attackClan = false;
  let attackWanted = false;
  let nickOptionsEnabled = false;
  let hotkeyAttackEnabled = false;
  let onlyHotkeyAttack = false;

  let expandControls = false;      // isExpanded
  let windowOpacityIndex = 2;      // 0..4
  let settingsOpacityIndex = 2;

  let levelRangeStr = '0-500';
  let levelRange = { min: 0, max: 500 };

  let backCoordsStr = '0-0';
  let backCoords = { x: 0, y: 0 };

  let hotkeyAttackKey = 'z';

  let clanOptionsEnabled = true;
  let ignoreClansStr = '';
  let alwaysAttackClansStr = '';
  let ignoreNicksStr = '';

  let ignoreClansList = [];
  let alwaysAttackClansList = [];
  let ignoreNicksList = [];

  let windowPos = { left: '0px', top: '0px' };
  let settingsPos = { left: '0px', top: '0px' };

  let autoxWnd = null;
  let settingsWnd = null;

  const LOOP_INTERVAL_MS = 50;
  const ATTACK_COOLDOWN_MS = 300;
  const MOVE_MIN_DELAY_MS = 200;
  const MOVE_MAX_DELAY_MS = 800;
  const BACK_DELAY_MS = 3000;

  let attackCooldownTs = 0;
  let moveCooldownTs = 0;

  let loopAttackTimer = null;
  let loopBattleTimer = null;

  let waitingForKey = false;
  let waitingInputId = null;

  let heroId = null;
  let accountId = null;

  const defaultCharSettings = {
    enabled: true,
    levelRange: '0-500',
    enableWalk: false,
    enableBack: false,
    coordsBack: '0-0',
    fastFight: false,
    windowPosition: { left: '0px', top: '0px' },
    isExpanded: false,
    windowOpacity: 2,
    windowSettingsPosition: { left: '0px', top: '0px' },
    showAutoxWindow: true,
    attackFriends: false,
    attackClan: false,
    attackWanted: false,
    windowSettingsOpacity: 2,
    enableWalkingOption: false
  };

  const defaultAccountSettings = {
    enableClanOptions: true,
    ignoreClans: '',
    alwaysAttackClans: '',
    enableNickOptions: false,
    ignoreNicks: '',
    enableAttackHotkey: false,
    hotkeyAttackKey: 'z',
    onlyHotkeyAttack: false
  };

  let storageData = { chars: {}, accounts: {} };

  function loadSettings() {
    if (!heroId || !accountId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) storageData = { chars: {}, accounts: {}, ...JSON.parse(raw) };
    } catch (e) {}

    const char = { ...defaultCharSettings, ...(storageData.chars[heroId] || {}) };
    const acc = { ...defaultAccountSettings, ...(storageData.accounts[accountId] || {}) };

    enabled = char.enabled;
    levelRangeStr = char.levelRange;
    levelRange = parseLevelRange(levelRangeStr) || { min: 0, max: 500 };

    walkingEnabled = char.enableWalk;
    backEnabled = char.enableBack;
    backCoordsStr = char.coordsBack;
    backCoords = parseCoords(backCoordsStr);

    fastFightEnabled = char.fastFight;
    expandControls = char.isExpanded;
    windowOpacityIndex = char.windowOpacity;
    windowPos = char.windowPosition;

    settingsOpacityIndex = char.windowSettingsOpacity;
    settingsPos = char.windowSettingsPosition;

    attackFriends = char.attackFriends;
    attackClan = char.attackClan;
    attackWanted = char.attackWanted;

    walkingOptionEnabled = char.enableWalkingOption;

    clanOptionsEnabled = acc.enableClanOptions;
    ignoreClansStr = acc.ignoreClans;
    alwaysAttackClansStr = acc.alwaysAttackClans;
    nickOptionsEnabled = acc.enableNickOptions;
    ignoreNicksStr = acc.ignoreNicks;

    hotkeyAttackEnabled = acc.enableAttackHotkey;
    hotkeyAttackKey = acc.hotkeyAttackKey || 'z';
    onlyHotkeyAttack = acc.onlyHotkeyAttack;

    ignoreClansList = parseList(ignoreClansStr);
    alwaysAttackClansList = parseList(alwaysAttackClansStr);
    ignoreNicksList = parseListCommas(ignoreNicksStr);
  }

  function saveSettings() {
    if (!heroId || !accountId) return;
    storageData.chars[heroId] = {
      enabled,
      levelRange: levelRangeStr,
      enableWalk: walkingEnabled,
      enableBack: backEnabled,
      coordsBack: backCoordsStr,
      fastFight: fastFightEnabled,
      windowPosition: windowPos,
      isExpanded: expandControls,
      windowOpacity: windowOpacityIndex,
      windowSettingsPosition: settingsPos,
      showAutoxWindow: true,
      attackFriends,
      attackClan,
      attackWanted,
      windowSettingsOpacity: settingsOpacityIndex,
      enableWalkingOption: walkingOptionEnabled
    };
    storageData.accounts[accountId] = {
      enableClanOptions: clanOptionsEnabled,
      ignoreClans: ignoreClansStr,
      alwaysAttackClans: alwaysAttackClansStr,
      enableNickOptions: nickOptionsEnabled,
      ignoreNicks: ignoreNicksStr,
      enableAttackHotkey: hotkeyAttackEnabled,
      hotkeyAttackKey,
      onlyHotkeyAttack
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData)); } catch (e) {}
  }

  function parseLevelRange(str) {
    const m = String(str).match(/^(\d+)-(\d+)$/);
    if (!m) return null;
    const min = parseInt(m[1], 10);
    const max = parseInt(m[2], 10);
    if (min > max) return null;
    return { min, max };
  }

  function parseCoords(str) {
    const [x, y] = String(str).split('-').map(Number);
    return { x: x || 0, y: y || 0 };
  }

  function parseList(str) {
    return String(str || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }

  function parseListCommas(str) {
    return String(str || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  function getHero() {
    return Engine.hero;
  }

  function getEntitiesD() {
    // Original uses Engine.map.getDrawableList().map(e => e.d)
    return Engine.map.getDrawableList().map(e => e.d).filter(Boolean);
  }

  function targetHasBlockingEmo(entity) {
    // Original: returns false when emo.name is 'battle' or 'pvpprotected'
    const emoName = Engine.getOnSelfEmoList(entity.id)?.getDrawableList()?.[0]?.name;
    return emoName === 'battle' || emoName === 'pvpprotected';
  }

  function isValidTarget(entity) {
    if (!entity || typeof entity.relation !== 'number') return false;

    // Ignore own party
    if (Engine.party?.d && Array.isArray(Engine.party.d) && Engine.party.d.some(p => p.id === entity.id)) {
      return false;
    }

    // Nick filter (exact match on nick)
    if (nickOptionsEnabled && ignoreNicksList.includes(entity.nick)) return false;

    // Clan filters
    const clanId = entity.clan && typeof entity.clan === 'object' ? entity.clan.id : (entity.clan || null);
    const clanName = entity.clan && typeof entity.clan === 'object' ? entity.clan.name : (entity.clan || entity.clan);

    const alwaysHit =
      (clanId && alwaysAttackClansList.includes(String(clanId).toUpperCase())) ||
      (clanName && alwaysAttackClansList.includes(String(clanName)));

    const ignoreClan =
      (clanId && ignoreClansList.includes(String(clanId).toUpperCase())) ||
      (clanName && ignoreClansList.includes(String(clanName)));

    if (clanOptionsEnabled) {
      if ((clanId || clanName) && alwaysHit) return true;
      if ((clanId || clanName) && ignoreClan) return false;
    }

    const map = Engine.map?.d;
    if (map && (map.pvp === 2 || map.pvp === 4)) {
      if ([1, 3, 6].includes(entity.relation)) return true;
    } else if (map && map.pvp === 1) {
      if (entity.relation === 3) return true;
      if (entity.wanted && attackWanted) return true;
    } else {
      return false;
    }

    if (entity.relation === 2) return attackFriends;
    if ([4, 7].includes(entity.relation)) return attackClan;

    return false;
  }

  function filterTargets() {
    const lr = levelRange;
    return getEntitiesD()
      .filter(e => isValidTarget(e))
      .filter(e => !e.dead)
      .filter(e => e.lvl >= lr.min && e.lvl <= lr.max)
      .filter(e => !targetHasBlockingEmo(e)); // must NOT have blocking emo
  }

  function nearestTarget() {
    const hero = getHero().d;
    const targets = filterTargets();
    if (!targets.length) return null;
    const list = targets.map(t => ({
      target: t,
      distance: Math.hypot(hero.x - t.x, hero.y - t.y)
    }));
    list.sort((a, b) => a.distance - b.distance);
    return list[0];
  }

  function tryAttackIfInRange(target, distance) {
    const now = Date.now();
    if (now - attackCooldownTs < ATTACK_COOLDOWN_MS) return false;
    const meleeRange = 3;
    if (distance <= meleeRange) {
      // Original endpoint used inside _0x2efa7f: 'fight&a=f' + id
      _g('fight&a=f' + target.id);
      attackCooldownTs = now;
      return true;
    }
    return false;
  }

  function randomMoveDelay(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  function moveHeroTo(x, y, minDelay, maxDelay) {
    const now = Date.now();
    const delay = randomMoveDelay(minDelay, maxDelay);
    if (now - moveCooldownTs < delay) return;
    moveCooldownTs = now;
    Engine.hero.autoGoTo({ x, y });
  }

  let fastFightConsumed = false;
  function autoAttackPulse() {
    if (!enabled) return;

    const map = Engine.map?.d;
    if (!map || (map.pvp !== 2 && map.pvp !== 1 && map.pvp !== 4)) return;

    const nt = nearestTarget();

    if (hotkeyAttackEnabled && onlyHotkeyAttack) {
      // In only-hotkey mode, do nothing here; hotkey triggers singleHotkeyAttackPulse.
      return;
    }

    if (nt) {
      const { target, distance } = nt;

      const didAttack = tryAttackIfInRange(target, distance);

      if (!didAttack && walkingOptionEnabled && walkingEnabled) {
        moveHeroTo(target.x, target.y, MOVE_MIN_DELAY_MS, MOVE_MAX_DELAY_MS);
      }
    } else {
      if (walkingOptionEnabled && backEnabled) {
        moveHeroTo(backCoords.x, backCoords.y, BACK_DELAY_MS, BACK_DELAY_MS);
      }
    }
  }

  function singleHotkeyAttackPulse() {
    if (!enabled) return;

    const map = Engine.map?.d;
    if (!map || (map.pvp !== 2 && map.pvp !== 1 && map.pvp !== 4)) return;

    const nt = nearestTarget();
    if (nt) {
      const { target, distance } = nt;
      tryAttackIfInRange(target, distance);
    }
  }

  function consumeFastFightOnceIfAllowed() {
    // Original toggles a marker when battle in progress and fast-fight enabled; sends once
    if (Engine?.battle?.inBattle && !fastFightConsumed && fastFightEnabled) {
      _g('fight&a=f' + Engine.hero.d.id);
      fastFightConsumed = true;
    }
  }

  function startAttackLoop() {
    stopAttackLoop();
    loopAttackTimer = setInterval(autoAttackPulse, LOOP_INTERVAL_MS);
  }
  function stopAttackLoop() {
    if (loopAttackTimer) clearInterval(loopAttackTimer), (loopAttackTimer = null);
  }
  function startBattleLoop() {
    stopBattleLoop();
    loopBattleTimer = setInterval(consumeFastFightOnceIfAllowed, LOOP_INTERVAL_MS);
  }
  function stopBattleLoop() {
    if (loopBattleTimer) clearInterval(loopBattleTimer), (loopBattleTimer = null);
  }

  function beginWaitingForKey(ev) {
    if (waitingForKey) return;
    waitingForKey = true;
    waitingInputId = ev.target.id;
    ev.target.classList.add('waiting-for-key');
    ev.target.blur();
  }
  function endWaitingForKey() {
    waitingForKey = false;
    waitingInputId = null;
  }
  function onDocumentKeydown(ev) {
    if (!waitingForKey) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = String(ev.key || '').toLowerCase();
      if (enabled && hotkeyAttackEnabled && key === hotkeyAttackKey.toLowerCase()) {
        singleHotkeyAttackPulse();
        ev.preventDefault();
        return;
      }
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();

    const key = String(ev.key || '').toLowerCase();
    const display = key.toUpperCase();
    const inputEl = document.getElementById(waitingInputId);
    if (inputEl) {
      inputEl.value = display;
      if (waitingInputId === 'ax-hotkey-attack-input') {
        hotkeyAttackKey = key;
        saveSettings();
      }
      inputEl.classList.remove('waiting-for-key');
      inputEl.blur();
    }
    endWaitingForKey();
  }

  function buildUI() {
    const html = `
    <div class="baddonz-window" id="baddonz-ax-wnd" style="position: absolute;">
      <div class="baddonz-window-header">
        <div class="baddonz-window-controls left">
          <div class="baddonz-icon baddonz-opacity-button" id="ax-opacity-btn"></div>
          <div class="baddonz-icon baddonz-settings-button" id="ax-settings-btn"></div>
        </div>
        <div class="baddonz-window-title">autox</div>
        <div class="baddonz-window-controls right">
          <div class="baddonz-icon baddonz-collapsed" id="ax-collapsed-btn"></div>
        </div>
      </div>
      <div class="baddonz-window-body baddonz-flex column" id="ax-wnd-body">
        <div id="ax-autox-controls">
          <div class="baddonz-setting-row ax-main-row">
            <div class="baddonz-checkbox" id="ax-enabled-checkbox"></div>
            <input type="text" class="baddonz-input ax-small" id="ax-level-range-input" value="${levelRangeStr}">
          </div>
          <div id="ax-expanded-controls">
            <button class="baddonz-button" id="ax-walk-btn">CHODZENIE</button>
            <button class="baddonz-button" id="ax-s-walka-btn">S.WALKA</button>
          </div>
          <div id="ax-back-controls">
            <div class="baddonz-checkbox" id="ax-back-checkbox"></div>
            <input type="text" class="baddonz-input ax-small" id="ax-coords-input" value="${backCoordsStr}">
          </div>
          <div class="baddonz-setting-row">
            <div class="baddonz-checkbox" id="ax-attack-friends-checkbox"></div>
            <span>Atakuj Przyjaciół</span>
          </div>
          <div class="baddonz-setting-row">
            <div class="baddonz-checkbox" id="ax-attack-clan-checkbox"></div>
            <span>Atakuj Klan/Sojusz</span>
          </div>
          <div class="baddonz-setting-row">
            <div class="baddonz-checkbox" id="ax-attack-wanted-checkbox"></div>
            <span>Atakuj Listy na żółtej</span>
          </div>
        </div>
      </div>
    </div>

    <div class="baddonz-window" id="baddonz-ax-wnd-settings" style="position: absolute; display: none;">
      <div class="baddonz-window-header">
        <div class="baddonz-window-controls left">
          <div class="baddonz-icon baddonz-opacity-button" id="ax-settings-opacity-btn"></div>
        </div>
        <div class="baddonz-window-title">autox - Ustawienia</div>
        <div class="baddonz-window-controls right">
          <div class="baddonz-icon baddonz-close-button" id="ax-settings-close-btn"></div>
        </div>
      </div>
      <div class="baddonz-window-body baddonz-flex column">
        <div class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-show-window-checkbox"></div>
          <span>Pokazuj okienko autox</span>
        </div>
        <div class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-walking-option-checkbox"></div>
          <span>Opcja Chodzenia</span>
        </div>
        <button class="baddonz-button" style="width:100%;" id="ax-reset-pos-btn">Resetuj Pozycje okienka</button>
        <hr style="width: 100%; border-color: #303030; margin-top: 5px; margin-bottom: 5px;">
        <div class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-attack-friends-checkbox-settings"></div>
          <span>Atakuj Przyjaciół</span>
        </div>
        <div class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-attack-clan-checkbox-settings"></div>
          <span>Atakuj Klan/Sojusz</span>
        </div>
        <div class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-attack-wanted-checkbox-settings"></div>
          <span>Atakuj Listy na żółtej</span>
        </div>
        <hr style="width: 100%; border-color: #303030; margin-top: 5px; margin-bottom: 5px;">
        <div id="ax-clan-options-header" class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-enable-clan-options-checkbox"></div>
          <span>Klany</span>
        </div>
        <div id="ax-clan-options">
          <span>Nie atakuj klanów:</span>
          <textarea class="baddonz-textarea" id="ax-ignore-clans-textarea" placeholder="Nazwa klanu, ID klanu">${ignoreClansStr}</textarea>
          <span>Zawsze atakuj klany:</span>
          <textarea class="baddonz-textarea" id="ax-always-attack-clans-textarea" placeholder="Nazwa klanu, ID klanu">${alwaysAttackClansStr}</textarea>
        </div>
        <hr style="width: 100%; border-color: #303030; margin-top: 5px; margin-bottom: 5px;">
        <div id="ax-nick-options-header" class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-enable-nick-options-checkbox"></div>
          <span>Po nickach</span>
        </div>
        <div id="ax-nick-options">
          <span>Nie atakuj graczy:</span>
          <textarea class="baddonz-textarea" id="ax-ignore-nicks-textarea" placeholder="Nick1, Nick2, Nick3">${ignoreNicksStr}</textarea>
        </div>
        <hr style="width: 100%; border-color: #303030; margin-top: 5px; margin-bottom: 5px;">
        <div id="ax-hotkey-options-header" class="baddonz-setting-row">
          <div class="baddonz-checkbox" id="ax-enable-attack-hotkey-checkbox"></div>
          <span>Skrót Ataku</span>
        </div>
        <div id="ax-hotkey-options">
          <input type="text" class="baddonz-input ax-hotkey" id="ax-hotkey-attack-input" value="${hotkeyAttackKey.toUpperCase()}" placeholder="Klawisz">
          <div class="baddonz-setting-row">
            <div class="baddonz-checkbox" id="ax-only-hotkey-attack-checkbox"></div>
            <span>Atakowanie tylko skrótem</span>
          </div>
        </div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);

    autoxWnd = document.getElementById('baddonz-ax-wnd');
    settingsWnd = document.getElementById('baddonz-ax-wnd-settings');

    const autoxHeader = autoxWnd.querySelector('.baddonz-window-title');
    const settingsHeader = settingsWnd.querySelector('.baddonz-window-title');

    const enabledCheckbox = document.getElementById('ax-enabled-checkbox');
    const levelRangeInput = document.getElementById('ax-level-range-input');

    const collapsedBtn = document.getElementById('ax-collapsed-btn');
    const expandedControls = document.getElementById('ax-expanded-controls');

    const walkBtn = document.getElementById('ax-walk-btn');
    const sWalkaBtn = document.getElementById('ax-s-walka-btn');

    const backControls = document.getElementById('ax-back-controls');
    const backCheckbox = document.getElementById('ax-back-checkbox');
    const coordsInput = document.getElementById('ax-coords-input');

    const opacityBtn = document.getElementById('ax-opacity-btn');
    const settingsBtn = document.getElementById('ax-settings-btn');
    const settingsCloseBtn = document.getElementById('ax-settings-close-btn');
    const settingsOpacityBtn = document.getElementById('ax-settings-opacity-btn');

    const showWindowCheckbox = document.getElementById('ax-show-window-checkbox');
    const walkingOptionCheckbox = document.getElementById('ax-walking-option-checkbox');
    const resetPosBtn = document.getElementById('ax-reset-pos-btn');

    const attackFriendsCheckbox = document.getElementById('ax-attack-friends-checkbox');
    const attackClanCheckbox = document.getElementById('ax-attack-clan-checkbox');
    const attackWantedCheckbox = document.getElementById('ax-attack-wanted-checkbox');

    const attackFriendsCheckboxSettings = document.getElementById('ax-attack-friends-checkbox-settings');
    const attackClanCheckboxSettings = document.getElementById('ax-attack-clan-checkbox-settings');
    const attackWantedCheckboxSettings = document.getElementById('ax-attack-wanted-checkbox-settings');

    const clanOptionsHeaderCheckbox = document.getElementById('ax-enable-clan-options-checkbox');
    const clanOptionsContainer = document.getElementById('ax-clan-options');
    const ignoreClansTextarea = document.getElementById('ax-ignore-clans-textarea');
    const alwaysAttackClansTextarea = document.getElementById('ax-always-attack-clans-textarea');

    const nickOptionsHeaderCheckbox = document.getElementById('ax-enable-nick-options-checkbox');
    const nickOptionsContainer = document.getElementById('ax-nick-options');
    const ignoreNicksTextarea = document.getElementById('ax-ignore-nicks-textarea');

    const hotkeyHeaderCheckbox = document.getElementById('ax-enable-attack-hotkey-checkbox');
    const hotkeyOptionsContainer = document.getElementById('ax-hotkey-options');
    const hotkeyInput = document.getElementById('ax-hotkey-attack-input');
    const onlyHotkeyAttackCheckbox = document.getElementById('ax-only-hotkey-attack-checkbox');

    function applyOpacityClass(el, index) {
      if (!el) return;
      const classes = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
      el.classList.remove(...classes);
      if (index !== undefined) el.classList.add(classes[index]);
    }

    autoxWnd.style.left = windowPos.left;
    autoxWnd.style.top = windowPos.top;
    settingsWnd.style.left = settingsPos.left;
    settingsWnd.style.top = settingsPos.top;

    function renderExpanded() {
      if (expandControls) {
        expandedControls.style.display = 'flex';
        collapsedBtn.innerText = 'Zwiń';
      } else {
        expandedControls.style.display = 'none';
        collapsedBtn.innerText = 'Rozwiń';
      }

      if (walkingOptionEnabled) {
        backControls.style.display = 'flex';
        walkBtn.style.display = 'flex';
        sWalkaBtn.style.display = 'block';

        if (walkingEnabled) {
          walkBtn.classList.add('active');
          backCheckbox.classList.remove('disabled');
          coordsInput.classList.remove('disabled');
        } else {
          walkBtn.classList.remove('active');
          backCheckbox.classList.add('disabled');
          coordsInput.classList.add('disabled');
          backEnabled = false;
        }

        if (backEnabled) backCheckbox.classList.add('active'); else backCheckbox.classList.remove('active');
      } else {
        backControls.style.display = 'none';
        walkBtn.style.display = 'none';
        sWalkaBtn.style.display = 'none';
      }

      if (fastFightEnabled) sWalkaBtn.classList.add('active'); else sWalkaBtn.classList.remove('active');
    }

    if (enabled) enabledCheckbox.classList.add('active');
    if (attackFriends) attackFriendsCheckbox.classList.add('active');
    if (attackClan) attackClanCheckbox.classList.add('active');
    if (attackWanted) attackWantedCheckbox.classList.add('active');

    if (attackFriends) attackFriendsCheckboxSettings.classList.add('active');
    if (attackClan) attackClanCheckboxSettings.classList.add('active');
    if (attackWanted) attackWantedCheckboxSettings.classList.add('active');

    if (expandControls) collapsedBtn.classList.add('active');
    if (walkingOptionEnabled) walkingOptionCheckbox.classList.add('active');
    if (backEnabled) backCheckbox.classList.add('active');

    if (clanOptionsEnabled) {
      clanOptionsHeaderCheckbox.classList.add('active');
      clanOptionsContainer.style.display = 'flex';
    } else {
      clanOptionsContainer.style.display = 'none';
    }

    if (nickOptionsEnabled) {
      nickOptionsHeaderCheckbox.classList.add('active');
      nickOptionsContainer.style.display = 'flex';
    } else {
      nickOptionsContainer.style.display = 'none';
    }

    if (hotkeyAttackEnabled) {
      hotkeyHeaderCheckbox.classList.add('active');
      hotkeyOptionsContainer.style.display = 'flex';
    } else {
      hotkeyOptionsContainer.style.display = 'none';
    }

    if (onlyHotkeyAttack) {
      onlyHotkeyAttackCheckbox.classList.add('active');
    }

    applyOpacityClass(autoxWnd, windowOpacityIndex);
    applyOpacityClass(settingsWnd, settingsOpacityIndex);

    collapsedBtn.title = expandControls ? 'Zwiń' : 'Rozwiń';
    settingsBtn.title = 'Ustawienia';
    opacityBtn.title = 'Zmień przezroczystość okienka';
    settingsOpacityBtn.title = 'Zmień przezroczystość okienka';

    // Dragging
    let dragging = false;
    let dragTarget = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    function onDragStart(evt, el) {
      dragging = true;
      dragTarget = el;
      const rect = el.getBoundingClientRect();
      dragOffsetX = evt.clientX - rect.left;
      dragOffsetY = evt.clientY - rect.top;
      el.style.cursor = 'grabbing';
      evt.stopPropagation();
    }
    function onDragEnd() {
      if (dragging) {
        dragging = false;
        if (dragTarget) {
          dragTarget.style.cursor = '';
          if (dragTarget.id === 'baddonz-ax-wnd') {
            windowPos.left = dragTarget.style.left;
            windowPos.top = dragTarget.style.top;
          } else if (dragTarget.id === 'baddonz-ax-wnd-settings') {
            settingsPos.left = dragTarget.style.left;
            settingsPos.top = dragTarget.style.top;
          }
          saveSettings();
        }
        dragTarget = null;
      }
    }
    function onDragMove(evt) {
      if (!dragging || !dragTarget) return;
      const docW = document.documentElement.clientWidth;
      const docH = document.documentElement.clientHeight;
      const elW = dragTarget.offsetWidth;
      const elH = dragTarget.offsetHeight;
      let newLeft = evt.clientX - dragOffsetX;
      let newTop = evt.clientY - dragOffsetY;
      newLeft = Math.max(0, Math.min(newLeft, docW - elW));
      newTop = Math.max(0, Math.min(newTop, docH - elH));
      dragTarget.style.left = `${newLeft}px`;
      dragTarget.style.top = `${newTop}px`;
    }
    autoxHeader.addEventListener('mousedown', e => onDragStart(e, autoxWnd));
    settingsHeader.addEventListener('mousedown', e => onDragStart(e, settingsWnd));
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    collapsedBtn.addEventListener('click', () => {
      expandControls = !expandControls;
      renderExpanded();
      saveSettings();
    });
    opacityBtn.addEventListener('click', () => {
      const cls = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
      autoxWnd.classList.remove(...cls);
      windowOpacityIndex = (windowOpacityIndex + 1) % cls.length;
      autoxWnd.classList.add(cls[windowOpacityIndex]);
      saveSettings();
    });
    settingsBtn.addEventListener('click', () => {
      const isShown = settingsWnd.style.display !== 'none';
      settingsWnd.style.display = isShown ? 'none' : 'flex';
    });
    settingsCloseBtn.addEventListener('click', () => {
      settingsWnd.style.display = 'none';
    });
    settingsOpacityBtn.addEventListener('click', () => {
      const cls = ['opacity-0', 'opacity-1', 'opacity-2', 'opacity-3', 'opacity-4'];
      settingsWnd.classList.remove(...cls);
      settingsOpacityIndex = (settingsOpacityIndex + 1) % cls.length;
      settingsWnd.classList.add(cls[settingsOpacityIndex]);
      saveSettings();
    });

    enabledCheckbox.addEventListener('click', () => {
      const active = enabledCheckbox.classList.toggle('active');
      enabled = active;
      if (enabled) startAttackLoop(); else stopAttackLoop();
      saveSettings();
    });

    levelRangeInput.addEventListener('change', () => {
      const val = levelRangeInput.value;
      const parsed = parseLevelRange(val);
      if (parsed) {
        levelRangeStr = val;
        levelRange = parsed;
        saveSettings();
      } else {
        levelRangeInput.value = levelRangeStr;
        if (window.message) {
          message('message|Błędna wartość lvl. Oczekiwany format: min-max');
        } else if (window._g && typeof _g === 'function') {
          _g('Błędna wartość lvl. Oczekiwany format: min-max');
        }
      }
    });

    walkBtn.addEventListener('click', () => {
      if (!walkingOptionEnabled) return;
      const active = walkBtn.classList.toggle('active');
      walkingEnabled = active;
      renderExpanded();
      saveSettings();
    });

    coordsInput.addEventListener('change', () => {
      backCoordsStr = coordsInput.value;
      backCoords = parseCoords(backCoordsStr);
      saveSettings();
    });

    backCheckbox.addEventListener('click', () => {
      const active = backCheckbox.classList.toggle('active');
      backEnabled = active;
      renderExpanded();
      saveSettings();
    });

    sWalkaBtn.addEventListener('click', () => {
      fastFightEnabled = !fastFightEnabled;
      fastFightConsumed = false;
      renderExpanded();
      saveSettings();
    });

    showWindowCheckbox.addEventListener('click', () => {
      const active = showWindowCheckbox.classList.toggle('active');
      autoxWnd.style.display = active ? 'flex' : 'none';
      saveSettings();
    });

    walkingOptionCheckbox.addEventListener('click', () => {
      const active = walkingOptionCheckbox.classList.toggle('active');
      walkingOptionEnabled = active;
      if (!active) { walkingEnabled = false; backEnabled = false; }
      renderExpanded();
      saveSettings();
    });

    resetPosBtn.addEventListener('click', () => {
      autoxWnd.style.left = '0px';
      autoxWnd.style.top = '0px';
      windowPos.left = '0px';
      windowPos.top = '0px';
      saveSettings();
    });

    attackFriendsCheckbox.addEventListener('click', () => {
      const active = attackFriendsCheckbox.classList.toggle('active');
      attackFriends = active;
      attackFriendsCheckboxSettings.classList.toggle('active', active);
      saveSettings();
    });
    attackClanCheckbox.addEventListener('click', () => {
      const active = attackClanCheckbox.classList.toggle('active');
      attackClan = active;
      attackClanCheckboxSettings.classList.toggle('active', active);
      saveSettings();
    });
    attackWantedCheckbox.addEventListener('click', () => {
      const active = attackWantedCheckbox.classList.toggle('active');
      attackWanted = active;
      attackWantedCheckboxSettings.classList.toggle('active', active);
      saveSettings();
    });

    attackFriendsCheckboxSettings.addEventListener('click', () => {
      const active = attackFriendsCheckboxSettings.classList.toggle('active');
      attackFriends = active;
      attackFriendsCheckbox.classList.toggle('active', active);
      saveSettings();
    });
    attackClanCheckboxSettings.addEventListener('click', () => {
      const active = attackClanCheckboxSettings.classList.toggle('active');
      attackClan = active;
      attackClanCheckbox.classList.toggle('active', active);
      saveSettings();
    });
    attackWantedCheckboxSettings.addEventListener('click', () => {
      const active = attackWantedCheckboxSettings.classList.toggle('active');
      attackWanted = active;
      attackWantedCheckbox.classList.toggle('active', active);
      saveSettings();
    });

    clanOptionsHeaderCheckbox.addEventListener('click', () => {
      const active = clanOptionsHeaderCheckbox.classList.toggle('active');
      clanOptionsEnabled = active;
      clanOptionsContainer.style.display = active ? 'flex' : 'none';
      saveSettings();
    });
    ignoreClansTextarea.addEventListener('change', () => {
      ignoreClansStr = ignoreClansTextarea.value;
      ignoreClansList = parseList(ignoreClansStr);
      saveSettings();
    });
    alwaysAttackClansTextarea.addEventListener('change', () => {
      alwaysAttackClansStr = alwaysAttackClansTextarea.value;
      alwaysAttackClansList = parseList(alwaysAttackClansStr);
      saveSettings();
    });

    nickOptionsHeaderCheckbox.addEventListener('click', () => {
      const active = nickOptionsHeaderCheckbox.classList.toggle('active');
      nickOptionsEnabled = active;
      nickOptionsContainer.style.display = active ? 'flex' : 'none';
      saveSettings();
    });
    ignoreNicksTextarea.addEventListener('change', () => {
      ignoreNicksStr = ignoreNicksTextarea.value;
      ignoreNicksList = parseListCommas(ignoreNicksStr);
      saveSettings();
    });

    hotkeyHeaderCheckbox.addEventListener('click', () => {
      const active = hotkeyHeaderCheckbox.classList.toggle('active');
      hotkeyAttackEnabled = active;
      hotkeyOptionsContainer.style.display = active ? 'flex' : 'none';
      saveSettings();
    });
    hotkeyInput.addEventListener('focus', beginWaitingForKey);
    document.addEventListener('keydown', onDocumentKeydown);
    hotkeyInput.addEventListener('blur', () => { waitingForKey = false; waitingInputId = null; });

    onlyHotkeyAttackCheckbox.addEventListener('click', () => {
      const active = onlyHotkeyAttackCheckbox.classList.toggle('active');
      onlyHotkeyAttack = active;
      saveSettings();
    });

    renderExpanded();
  }

  function hookBattleEnd() {
    if (!Engine || !Engine.battle || !Engine.allInit) return;
    if (typeof Engine.battle.setEndBattle === 'function') {
      const original = Engine.battle.setEndBattle.bind(Engine.battle);
      Engine.battle.setEndBattle = function () {
        original();
        // Reset fast fight marker on battle end (original behavior)
        fastFightConsumed = false;
      };
    }
  }

  function initWhenReady() {
    if (!window.Engine || !Engine.allInit) {
      setTimeout(initWhenReady, 500);
      return;
    }

    hookBattleEnd();

    heroId = window.Engine.hero.d.id;
    // PATCH: original reads account from Engine.others.d.account
    accountId = window.Engine.others?.d?.account || 'default';

    loadSettings();
    buildUI();

    startBattleLoop();
    if (enabled) startAttackLoop();

    autoxWnd.style.left = windowPos.left;
    autoxWnd.style.top = windowPos.top;
    settingsWnd.style.left = settingsPos.left;
    settingsWnd.style.top = settingsPos.top;
  }

  initWhenReady();
})();
