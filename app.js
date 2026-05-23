'use strict';

const TOTAL_ROUNDS = 10;
const STORAGE_KEY = 'skullking_v1';

let state = {
  players: [],
  rounds: [],
  currentRound: 1,
  gameOver: false
};

// === PERSISTENCE ===

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.players) && parsed.players.length >= 2) {
      state = parsed;
      return true;
    }
  } catch (_) {}
  return false;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

// === SCORING ===

function calcRoundScore(bid, taken, bonus, roundNum) {
  bid = Number(bid);
  taken = Number(taken);
  bonus = Number(bonus) || 0;
  roundNum = Number(roundNum);

  if (bid === 0) {
    return taken === 0 ? 10 * roundNum + bonus : -10 * roundNum;
  }
  return taken === bid ? 20 * bid + bonus : -10 * Math.abs(bid - taken);
}

function getTotal(playerIdx) {
  return state.rounds.reduce((sum, r) => sum + (r.scores[playerIdx]?.roundScore ?? 0), 0);
}

// === DOM HELPERS ===

const $ = id => document.getElementById(id);

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// === SETUP ===

let selectedCount = 2;

function initSetup() {
  const countBtnsEl = $('count-btns');

  countBtnsEl.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      countBtnsEl.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCount = parseInt(btn.dataset.n, 10);
      renderNameInputs();
    });
  });

  renderNameInputs();
  $('start-btn').addEventListener('click', startGame);
}

function renderNameInputs() {
  const container = $('name-inputs');
  const existing = Array.from(container.querySelectorAll('.name-input')).map(i => i.value);
  container.innerHTML = '';

  for (let i = 0; i < selectedCount; i++) {
    const row = document.createElement('div');
    row.className = 'name-row';
    row.innerHTML = `
      <label>Player ${i + 1}</label>
      <input type="text" class="name-input" placeholder="Player ${i + 1}" maxlength="16" autocomplete="off" />
    `;
    if (existing[i]) row.querySelector('input').value = existing[i];
    container.appendChild(row);
  }

  // Allow pressing Enter to move to next input or start game
  const inputs = container.querySelectorAll('input');
  inputs.forEach((inp, idx) => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else startGame();
      }
    });
  });

  if (inputs[0] && !inputs[0].value) inputs[0].focus();
}

function startGame() {
  const names = Array.from(document.querySelectorAll('.name-input'))
    .map((inp, i) => inp.value.trim() || `Player ${i + 1}`);

  state = {
    players: names,
    rounds: [],
    currentRound: 1,
    gameOver: false,
    useKraken: $('use-kraken').checked
  };
  saveState();
  switchToGame();
}

// === GAME SCREEN ===

function switchToGame() {
  hide($('setup-screen'));
  show($('game-screen'));
  renderAll();
}

function renderAll() {
  updateRoundBadge();
  renderScoreboard();

  if (state.gameOver) {
    hide($('entry-section'));
    renderGameOver();
    show($('gameover-section'));
  } else {
    renderEntryForm();
    show($('entry-section'));
    hide($('gameover-section'));
  }
}

function updateRoundBadge() {
  $('round-badge').textContent = state.gameOver
    ? 'Game Over'
    : `Round ${state.currentRound} / ${TOTAL_ROUNDS}`;
}

// === SCOREBOARD ===

function renderScoreboard() {
  const table = $('score-table');
  const totals = state.players.map((_, i) => getTotal(i));

  let html = '<thead><tr><th>Round</th>';
  state.players.forEach(p => { html += `<th>${escHtml(p)}</th>`; });
  html += '</tr></thead><tbody>';

  // Score totals row
  html += '<tr class="score-row"><td>Score</td>';
  totals.forEach(t => {
    const cls = t > 0 ? 'pos' : t < 0 ? 'neg' : '';
    html += `<td class="${cls}">${t}</td>`;
  });
  html += '</tr>';

  // All 10 rounds
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const done = state.rounds.find(rd => rd.roundNumber === r);
    const isCurrent = !state.gameOver && r === state.currentRound;
    const krakenIcon = done?.krakenPlayed ? ' &#128027;' : '';
    html += `<tr class="${isCurrent ? 'current-round-row' : ''}"><td class="round-num-cell${isCurrent ? ' current-num' : ''}">${r}${krakenIcon}</td>`;

    state.players.forEach((_, pi) => {
      if (done) {
        const s = done.scores[pi];
        const cls = s.roundScore > 0 ? 'pos' : s.roundScore < 0 ? 'neg' : '';
        const sign = s.roundScore > 0 ? '+' : '';
        html += `<td class="${cls}">${sign}${s.roundScore}</td>`;
      } else {
        html += `<td class="future-cell">-</td>`;
      }
    });

    html += '</tr>';
  }

  html += '</tbody>';
  table.innerHTML = html;
}

// === ROUND ENTRY ===

function renderEntryForm() {
  $('entry-round-num').textContent = state.currentRound;
  const container = $('player-entries');
  container.innerHTML = '';

  state.players.forEach((player, i) => {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.dataset.playerIdx = i;
    card.innerHTML = `
      <div class="entry-player-name">${escHtml(player)}</div>
      <div class="entry-fields">
        <div class="entry-field">
          <label>Bid</label>
          <input class="entry-input bid-input" type="number" min="0" max="${state.currentRound}" inputmode="numeric" placeholder="0" />
        </div>
        <div class="entry-field">
          <label>Tricks</label>
          <input class="entry-input taken-input" type="number" min="0" max="${state.currentRound}" inputmode="numeric" placeholder="0" />
        </div>
        <div class="entry-field bonus-field field-disabled">
          <label>Bonus</label>
          <input class="entry-input bonus-input" type="number" min="0" value="0" inputmode="numeric" disabled />
        </div>
        <div class="entry-field preview-field">
          <label>Score</label>
          <span class="score-preview">—</span>
        </div>
      </div>
    `;

    const bidEl = card.querySelector('.bid-input');
    const takenEl = card.querySelector('.taken-input');
    const bonusEl = card.querySelector('.bonus-input');
    const bonusField = card.querySelector('.bonus-field');
    const previewEl = card.querySelector('.score-preview');

    function updatePreview() {
      const bidVal = bidEl.value;
      const takenVal = takenEl.value;
      const bonusApplies = bidVal !== '' && takenVal !== ''
        && ((Number(bidVal) > 0 && Number(bidVal) === Number(takenVal))
          || (Number(bidVal) === 0 && Number(takenVal) === 0));

      bonusEl.disabled = !bonusApplies;
      bonusField.classList.toggle('field-disabled', !bonusApplies);

      if (bidVal === '' || takenVal === '') {
        previewEl.textContent = '—';
        previewEl.className = 'score-preview';
        return;
      }

      const score = calcRoundScore(bidVal, takenVal, bonusApplies ? bonusEl.value : 0, state.currentRound);
      previewEl.textContent = (score > 0 ? '+' : '') + score;
      previewEl.className = 'score-preview ' + (score > 0 ? 'pos' : score < 0 ? 'neg' : '');
    }

    bidEl.addEventListener('input', updatePreview);
    takenEl.addEventListener('input', updatePreview);
    bonusEl.addEventListener('input', updatePreview);

    container.appendChild(card);
  });

  // Show/hide kraken checkbox
  const krakenRow = $('kraken-row');
  if (state.useKraken) {
    show(krakenRow);
    $('kraken-played-cb').checked = false;
  } else {
    hide(krakenRow);
  }

  // Focus first bid input
  const firstBid = container.querySelector('.bid-input');
  if (firstBid) firstBid.focus();
}

// === SCORE ROUND ===

function scoreRound() {
  const cards = document.querySelectorAll('.entry-card');
  const scores = [];
  let firstError = null;
  let valid = true;
  const tricksErrorEl = $('tricks-error');

  cards.forEach(card => {
    const bidEl = card.querySelector('.bid-input');
    const takenEl = card.querySelector('.taken-input');
    const bonusEl = card.querySelector('.bonus-input');

    const bidVal = bidEl.value.trim();
    const takenVal = takenEl.value.trim();

    if (bidVal === '' || takenVal === '') {
      card.classList.add('error');
      if (!firstError) firstError = card;
      valid = false;
      return;
    }
    card.classList.remove('error');

    const bid = Number(bidVal);
    const taken = Number(takenVal);
    const bonusApplies = (bid > 0 && bid === taken) || (bid === 0 && taken === 0);
    const roundScore = calcRoundScore(bid, taken, bonusApplies ? bonusEl.value : 0, state.currentRound);

    scores.push({
      bid,
      taken,
      bonus: Number(bonusEl.value) || 0,
      roundScore
    });
  });

  if (!valid) {
    tricksErrorEl.classList.add('hidden');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const krakenPlayed = state.useKraken && ($('kraken-played-cb')?.checked ?? false);
  const totalTaken = scores.reduce((sum, s) => sum + s.taken, 0);
  const validTotals = krakenPlayed
    ? [state.currentRound, state.currentRound - 1]
    : [state.currentRound];

  if (!validTotals.includes(totalTaken)) {
    const expected = krakenPlayed
      ? `${state.currentRound} or ${state.currentRound - 1} (Kraken)`
      : `${state.currentRound}`;
    tricksErrorEl.textContent = `Tricks must add up to ${expected}. Currently: ${totalTaken}.`;
    tricksErrorEl.classList.remove('hidden');
    tricksErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  tricksErrorEl.classList.add('hidden');

  state.rounds.push({ roundNumber: state.currentRound, scores, krakenPlayed });

  if (state.currentRound >= TOTAL_ROUNDS) {
    state.gameOver = true;
  } else {
    state.currentRound++;
  }

  saveState();
  renderAll();

  // Scroll to top of page so scoreboard is visible
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === GAME OVER ===

function renderGameOver() {
  const ranked = state.players
    .map((name, i) => ({ name, total: getTotal(i) }))
    .sort((a, b) => b.total - a.total);

  $('winner-display').innerHTML = `
    <div class="winner-name">&#127942; ${escHtml(ranked[0].name)}</div>
    <div class="winner-label">wins with ${ranked[0].total} points!</div>
  `;

  $('final-standings').innerHTML = ranked.map((p, i) => `
    <li>
      <span class="place-num">${i + 1}.</span>
      <span class="standing-name">${escHtml(p.name)}</span>
      <span class="standing-score">${p.total}</span>
    </li>
  `).join('');
}

// === INIT ===

function initGameControls() {
  $('score-round-btn').addEventListener('click', scoreRound);

  $('new-game-btn').addEventListener('click', () => {
    if (confirm('Start a new game? Current scores will be lost.')) {
      clearState();
      location.reload();
    }
  });

  $('play-again-btn').addEventListener('click', () => {
    clearState();
    location.reload();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initGameControls();

  if (loadState() && state.players.length >= 2) {
    switchToGame();
  } else {
    initSetup();
    show($('setup-screen'));
  }
});
