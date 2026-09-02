// Module Internationalisation (i18n) — Français / Anglais pour CountryDoku

const STORAGE_KEY = 'countrydoku_lang';

export let currentLang = 'fr';

export const translations = {
  fr: {
    // Header & Navigation
    'brand.sub': 'Doku',
    'nav.mode_1v1': '⚔️ Mode 1v1',
    'nav.report_bug': 'Signaler un problème',
    'nav.help': 'Règles du jeu',
    'nav.lang_toggle': '🇬🇧 EN',

    // Mode Selector
    'mode.solo_title': 'Mode Solo',
    'mode.solo_desc': '3 vies • Jeu illimité',
    'mode.multi_title': 'Multijoueur (1v1)',
    'mode.multi_desc': 'Affrontez vos amis en direct !',
    'mode.multi_badge': 'JOUER À 2 🎮',

    // 1v1 Bar & Status
    'mp.live_badge': '● EN DIRECT',
    'mp.code_label': 'CODE : ',
    'mp.copy_link': '📋 Copier le lien',
    'mp.copied': '✅ Copié !',
    'mp.link_copied': '✅ Lien copié !',
    'mp.player_host': 'Joueur 1',
    'mp.player_guest': 'Joueur 2',
    'mp.leave_btn': 'Quitter 1v1',
    'mp.your_turn_banner': '🎲 C\'EST À VOTRE TOUR DE JOUER !',
    'mp.opponent_turn_banner': '⏳ TOUR DE L\'ADVERSAIRE',
    'mp.feed_title': '📢 JOURNAL DE LA PARTIE EN DIRECT',
    'mp.feed_started': '🎮 Le match 1v1 commence ! Joueur 1 a la main.',
    'mp.guest_connected': '🎮 Joueur 2 connecté ! Le match commence.',
    'mp.disconnected': '🔌 L\'adversaire s\'est déconnecté.',
    'mp.conn_lost': '🔌 Connexion perdue avec l\'adversaire.',
    'mp.connecting': '⚙️ Connexion au serveur de signalisation...',
    'mp.ready_wait': '🟢 Salon prêt ! Code : {code}. En attente de l\'adversaire...',
    'mp.finding_room': '🤝 Recherche du salon {code}...',
    'mp.connected': '🟢 Connecté au salon !',
    'mp.player2_detected': '🤝 Joueur 2 détecté ! Connexion en cours...',

    // Intro & Stats
    'intro.title': 'Reliez les pays aux critères',
    'intro.desc': 'Cliquez sur une case pour choisir le pays correspondant. Cliquez sur {badge} pour voir les explications des critères.',
    'stats.lives': 'VIES',
    'stats.progress': 'PROGRESSION',

    // Board & Feedback
    'board.clue_tooltip': 'Explication',
    'board.choose': '🔍 Choisir',
    'board.see_solutions': '💡 Voir solutions',
    'board.reset_btn': 'Nouvelle grille',
    'board.propose_grid_btn': 'Proposer une nouvelle grille',
    'board.default_feedback': 'Cliquez sur une case de la grille pour faire votre choix.',
    'board.game_complete': '🎉 Bravo ! Grille entièrement complétée !',
    'board.correct_answer': '✅ Bonne réponse ({country}){pct} !',
    'board.incorrect_answer': '❌ {country} incorrect ({reason}). -1 vie, il vous reste {lives}.',
    'board.game_over': '💔 Défaite ! {country} : {reason}. Vos 3 vies sont épuisées.',
    'board.not_your_turn': '⏳ Ce n\'est pas votre tour ! Attendez le coup de l\'adversaire.',
    'board.timeout_loss': '⏱️ Temps écoulé ! Ce n\'est plus votre tour de jouer.',
    'board.timeout_msg': '⏱️ Temps écoulé (30s) pour {player} ! Le tour passe à l\'adversaire.',
    'board.req_sent': '⏳ Demande envoyée à l\'adversaire...',

    // Dialogs: Rules
    'dialog.rules_eyebrow': 'RÈGLES DU JEU',
    'dialog.rules_title': 'Comment jouer à CountryDoku ?',
    'dialog.rule1': '<strong>Mode Solo :</strong> Complétez les 9 cases de la grille avec 3 vies maximum.',
    'dialog.rule2': '<strong>Mode 1v1 (30s / tour) :</strong> Vous avez 30 secondes par tour. Chaque bonne réponse capture une case. Le premier qui aligne 3 cases (🟢 J1 / 🔵 J2) gagne !',
    'dialog.rule3': '<strong>Info-bulles (ⓘ) :</strong> Cliquez sur le symbole ⓘ à côté d\'un critère pour voir son explication exacte.',
    'dialog.rules_close': 'J\'ai compris, jouer !',

    // Dialogs: Tooltip
    'dialog.tooltip_eyebrow': 'EXPLICATION DU CRITÈRE',
    'dialog.tooltip_close': 'J\'ai compris',

    // Dialogs: Search
    'dialog.search_title': 'Choisissez un pays',
    'dialog.search_solutions_title': '💡 Solutions pour la Case {cell}',
    'dialog.search_clues_prefix': 'Critères : ',
    'dialog.search_placeholder': 'Tapez le nom d\'un pays (ex: France, Japon)...',
    'dialog.search_valid_count': '💡 {count} pays possibles',
    'dialog.search_solutions_count': '💡 {count} solution(s)',
    'dialog.search_no_results': 'Aucun pays trouvé.',
    'dialog.search_used': '(Déjà placé)',
    'dialog.cell_tag': 'CASE {cell}',
    'dialog.capital_label': 'Capitale : ',
    'dialog.inhabitants': 'hab.',

    // Dialogs: Room 1v1
    'dialog.room_eyebrow': 'MODE MULTIJOUEUR 1V1',
    'dialog.room_title': 'Morpion Géographique (Tic-Tac-Toe)',
    'dialog.room_rules_title': '📜 Règles du Mode 1v1 (Morpion Géographique) :',
    'dialog.room_rule1': '🎯 <strong>Objectif</strong> : Aligner 3 cases de votre couleur (🟢 J1 ou 🔵 J2) pour gagner le match.',
    'dialog.room_rule2': '⏱️ <strong>Minuteur 30s</strong> : Vous avez 30 secondes par tour pour choisir un pays. En cas de dépassement, le tour passe à l\'adversaire.',
    'dialog.room_rule3': '❌ <strong>Erreur = Tour suivant</strong> : Tenter un pays incorrect fait immédiatement passer la main à votre adversaire.',
    'dialog.room_rule4': '🔄 <strong>Équité</strong> : Le joueur qui débute la partie alterne automatiquement à chaque revanche ou nouveau match.',
    'dialog.room_create_title': 'Créer un salon',
    'dialog.room_create_desc': 'Générez un code et envoyez le lien d\'invitation à un ami.',
    'dialog.room_create_btn': 'Créer un salon 1v1',
    'dialog.room_or': 'OU',
    'dialog.room_join_title': 'Rejoindre avec un code',
    'dialog.room_join_placeholder': 'Code du salon (ex: 8X42K)...',
    'dialog.room_join_btn': 'Rejoindre le salon',
    'dialog.room_ready_eyebrow': 'SALON PRÊT',
    'dialog.room_ready_title': 'Envoyez ce lien à votre ami',
    'dialog.room_code_label': 'CODE DU SALON',
    'dialog.room_copy_link_btn': '📋 Copier le lien d\'invitation',
    'dialog.room_status_ready': 'Prêt à démarrer une partie 1v1...',

    // Dialogs: Confirm Leave
    'dialog.leave_eyebrow': '🚪 QUITTER LE SALON',
    'dialog.leave_title': 'Quitter le salon 1v1 ?',
    'dialog.leave_desc': 'Êtes-vous sûr de vouloir fermer ce salon ? La partie en cours avec votre adversaire sera interrompue.',
    'dialog.leave_stay': 'Rester dans le salon',
    'dialog.leave_confirm': 'Quitter le salon',

    // Dialogs: Grid Proposal
    'dialog.proposal_eyebrow': 'DEMANDE DE RELANCE',
    'dialog.proposal_title': 'Proposition de l\'adversaire',
    'dialog.proposal_desc_rematch': 'L\'adversaire propose de rejouer sur la même grille.',
    'dialog.proposal_desc_new': 'L\'adversaire propose de jouer sur une nouvelle grille.',
    'dialog.proposal_rematch_btn': 'Revanche (Même grille)',
    'dialog.proposal_new_btn': 'Nouveau Match (Nouvelle grille)',
    'dialog.proposal_decline': 'Refuser la demande',

    // Dialogs: Victory
    'dialog.victory_eyebrow': 'PARTIE TERMINÉE',
    'dialog.victory_title': 'Victoire ! 🎉',
    'dialog.victory_desc': 'Vous avez aligné 3 cases et remporté ce match de Tic-Tac-Toe !',
    'dialog.defeat_title': 'Défaite !',
    'dialog.defeat_desc': 'L\'adversaire a aligné 3 cases et remporte ce match !',
    'dialog.draw_title': 'Match Nul ! 🤝',
    'dialog.draw_desc': 'Toutes les cases sont remplies sans alignement de 3.',
    'dialog.victory_rematch': 'Revanche (Même grille)',
    'dialog.victory_new': 'Nouveau Match',
    'dialog.victory_board': '🔍 Examiner la grille jouée',

    // Dialogs: Game Over Solo
    'dialog.gameover_eyebrow': 'FIN DE PARTIE',
    'dialog.gameover_title': 'Plus de vies restantes ! 💔',
    'dialog.gameover_desc': 'Vous avez épuisé vos 3 essais sur cette grille. Souhaitez-vous réessayer la même grille ou en générer une nouvelle ?',
    'dialog.gameover_retry': 'Réessayer la grille',
    'dialog.gameover_new': 'Nouvelle grille',

    // Dialogs: Bug Report
    'dialog.report_eyebrow': '🐛 SIGNALER UN PROBLÈME',
    'dialog.report_title': 'Signaler une erreur ou un bug',
    'dialog.report_desc': 'Un pays manque ? Un critère semble incorrect ? Décrivez le problème ci-dessous. Le journal de la console sera joint à votre email.',
    'dialog.report_placeholder': 'Décrivez le problème rencontré (ex: pays mal classé, bug d\'affichage)...',
    'dialog.report_logs_label': 'JOURNAL CONSOLE CAPTURÉ (AUTOMATIQUE) :',
    'dialog.report_send_btn': '📧 Envoyer par Email',
    'dialog.report_copy_btn': '📋 Copier le rapport complet'
  },
  en: {
    // Header & Navigation
    'brand.sub': 'Doku',
    'nav.mode_1v1': '⚔️ 1v1 Mode',
    'nav.report_bug': 'Report an issue',
    'nav.help': 'Game rules',
    'nav.lang_toggle': '🇫🇷 FR',

    // Mode Selector
    'mode.solo_title': 'Solo Mode',
    'mode.solo_desc': '3 lives • Unlimited play',
    'mode.multi_title': 'Multiplayer (1v1)',
    'mode.multi_desc': 'Play live against friends!',
    'mode.multi_badge': '2 PLAYERS 🎮',

    // 1v1 Bar & Status
    'mp.live_badge': '● LIVE',
    'mp.code_label': 'CODE: ',
    'mp.copy_link': '📋 Copy link',
    'mp.copied': '✅ Copied!',
    'mp.link_copied': '✅ Link copied!',
    'mp.player_host': 'Player 1',
    'mp.player_guest': 'Player 2',
    'mp.leave_btn': 'Leave 1v1',
    'mp.your_turn_banner': '🎲 IT\'S YOUR TURN TO PLAY!',
    'mp.opponent_turn_banner': '⏳ OPPONENT\'S TURN',
    'mp.feed_title': '📢 LIVE MATCH LOG',
    'mp.feed_started': '🎮 The 1v1 match has started! Player 1 goes first.',
    'mp.guest_connected': '🎮 Player 2 connected! Game starts.',
    'mp.disconnected': '🔌 The opponent disconnected.',
    'mp.conn_lost': '🔌 Connection with opponent lost.',
    'mp.connecting': '⚙️ Connecting to signaling server...',
    'mp.ready_wait': '🟢 Room ready! Code: {code}. Waiting for opponent...',
    'mp.finding_room': '🤝 Finding room {code}...',
    'mp.connected': '🟢 Connected to room!',
    'mp.player2_detected': '🤝 Player 2 detected! Connecting...',

    // Intro & Stats
    'intro.title': 'Match countries with criteria',
    'intro.desc': 'Click a cell to choose the matching country. Click {badge} to read criteria details.',
    'stats.lives': 'LIVES',
    'stats.progress': 'PROGRESS',

    // Board & Feedback
    'board.clue_tooltip': 'Explanation',
    'board.choose': '🔍 Choose',
    'board.see_solutions': '💡 See solutions',
    'board.reset_btn': 'New grid',
    'board.propose_grid_btn': 'Propose new grid',
    'board.default_feedback': 'Click a grid cell to make your choice.',
    'board.game_complete': '🎉 Congratulations! Grid fully completed!',
    'board.correct_answer': '✅ Correct answer ({country}){pct}!',
    'board.incorrect_answer': '❌ {country} incorrect ({reason}). -1 life, {lives} remaining.',
    'board.game_over': '💔 Defeat! {country}: {reason}. All 3 lives spent.',
    'board.not_your_turn': '⏳ It is not your turn! Wait for opponent move.',
    'board.timeout_loss': '⏱️ Time is up! Your turn has passed.',
    'board.timeout_msg': '⏱️ Time up (30s) for {player}! Turn passes to opponent.',
    'board.req_sent': '⏳ Request sent to opponent...',

    // Dialogs: Rules
    'dialog.rules_eyebrow': 'GAME RULES',
    'dialog.rules_title': 'How to play CountryDoku?',
    'dialog.rule1': '<strong>Solo Mode:</strong> Complete all 9 grid cells with a maximum of 3 lives.',
    'dialog.rule2': '<strong>1v1 Mode (30s / turn):</strong> You have 30 seconds per turn. Each correct answer claims a cell. First to align 3 cells (🟢 P1 / 🔵 P2) wins!',
    'dialog.rule3': '<strong>Info Tooltips (ⓘ):</strong> Click the ⓘ icon next to any criterion to see its exact description.',
    'dialog.rules_close': 'Got it, let\'s play!',

    // Dialogs: Tooltip
    'dialog.tooltip_eyebrow': 'CRITERION EXPLANATION',
    'dialog.tooltip_close': 'Got it',

    // Dialogs: Search
    'dialog.search_title': 'Choose a country',
    'dialog.search_solutions_title': '💡 Solutions for Cell {cell}',
    'dialog.search_clues_prefix': 'Criteria: ',
    'dialog.search_placeholder': 'Type a country name (e.g. France, Japan)...',
    'dialog.search_valid_count': '💡 {count} valid countries',
    'dialog.search_solutions_count': '💡 {count} solution(s)',
    'dialog.search_no_results': 'No countries found.',
    'dialog.search_used': '(Already placed)',
    'dialog.cell_tag': 'CELL {cell}',
    'dialog.capital_label': 'Capital: ',
    'dialog.inhabitants': 'inh.',

    // Dialogs: Room 1v1
    'dialog.room_eyebrow': '1V1 MULTIPLAYER MODE',
    'dialog.room_title': 'Geographic Tic-Tac-Toe',
    'dialog.room_rules_title': '📜 1v1 Rules (Geographic Tic-Tac-Toe):',
    'dialog.room_rule1': '🎯 <strong>Goal</strong>: Align 3 cells of your color (🟢 P1 or 🔵 P2) to win the match.',
    'dialog.room_rule2': '⏱️ <strong>30s Timer</strong>: 30 seconds per turn to pick a country. Exceeding time passes the turn to the opponent.',
    'dialog.room_rule3': '❌ <strong>Error = Next Turn</strong>: Choosing an incorrect country immediately passes the turn to your opponent.',
    'dialog.room_rule4': '🔄 <strong>Fairness</strong>: The starting player automatically alternates after every rematch or new match.',
    'dialog.room_create_title': 'Create a room',
    'dialog.room_create_desc': 'Generate a code and send the invitation link to a friend.',
    'dialog.room_create_btn': 'Create 1v1 Room',
    'dialog.room_or': 'OR',
    'dialog.room_join_title': 'Join with a code',
    'dialog.room_join_placeholder': 'Room code (e.g. 8X42K)...',
    'dialog.room_join_btn': 'Join Room',
    'dialog.room_ready_eyebrow': 'ROOM READY',
    'dialog.room_ready_title': 'Send this link to your friend',
    'dialog.room_code_label': 'ROOM CODE',
    'dialog.room_copy_link_btn': '📋 Copy invitation link',
    'dialog.room_status_ready': 'Ready to start a 1v1 match...',

    // Dialogs: Confirm Leave
    'dialog.leave_eyebrow': '🚪 LEAVE ROOM',
    'dialog.leave_title': 'Leave 1v1 room?',
    'dialog.leave_desc': 'Are you sure you want to leave? The ongoing game with your opponent will be stopped.',
    'dialog.leave_stay': 'Stay in room',
    'dialog.leave_confirm': 'Leave room',

    // Dialogs: Grid Proposal
    'dialog.proposal_eyebrow': 'REMATCH REQUEST',
    'dialog.proposal_title': 'Opponent proposal',
    'dialog.proposal_desc_rematch': 'Opponent proposes to play again on the same grid.',
    'dialog.proposal_desc_new': 'Opponent proposes to play on a new grid.',
    'dialog.proposal_rematch_btn': 'Rematch (Same grid)',
    'dialog.proposal_new_btn': 'New Match (New grid)',
    'dialog.proposal_decline': 'Decline request',

    // Dialogs: Victory
    'dialog.victory_eyebrow': 'MATCH OVER',
    'dialog.victory_title': 'Victory! 🎉',
    'dialog.victory_desc': 'You aligned 3 cells and won this Tic-Tac-Toe match!',
    'dialog.defeat_title': 'Defeat!',
    'dialog.defeat_desc': 'Opponent aligned 3 cells and won the match!',
    'dialog.draw_title': 'Draw! 🤝',
    'dialog.draw_desc': 'All cells are filled without a line of 3.',
    'dialog.victory_rematch': 'Rematch (Same grid)',
    'dialog.victory_new': 'New Match',
    'dialog.victory_board': '🔍 Inspect completed grid',

    // Dialogs: Game Over Solo
    'dialog.gameover_eyebrow': 'GAME OVER',
    'dialog.gameover_title': 'No lives remaining! 💔',
    'dialog.gameover_desc': 'You exhausted all 3 attempts on this grid. Would you like to retry the same grid or generate a new one?',
    'dialog.gameover_retry': 'Retry same grid',
    'dialog.gameover_new': 'New grid',

    // Dialogs: Bug Report
    'dialog.report_eyebrow': '🐛 REPORT AN ISSUE',
    'dialog.report_title': 'Report an error or bug',
    'dialog.report_desc': 'Missing country? Incorrect criterion? Describe the issue below. The browser console log will be attached to your email.',
    'dialog.report_placeholder': 'Describe the problem (e.g. misclassified country, UI bug)...',
    'dialog.report_logs_label': 'AUTOMATIC CONSOLE LOG:',
    'dialog.report_send_btn': '📧 Send by Email',
    'dialog.report_copy_btn': '📋 Copy full report'
  }
};

// Initialisation de la langue
export function initLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') {
      currentLang = saved;
    } else {
      const browserLang = navigator.language || navigator.userLanguage || '';
      currentLang = browserLang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    }
  } catch (e) {
    currentLang = 'fr';
  }
  document.documentElement.lang = currentLang;
  return currentLang;
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'fr' && lang !== 'en') return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {}
  document.documentElement.lang = currentLang;
  
  // Callback d'écouteurs de changement
  listeners.forEach(fn => {
    try { fn(currentLang); } catch (e) { console.error(e); }
  });
}

const listeners = new Set();
export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Fonction de traduction
export function t(key, params = {}) {
  const dict = translations[currentLang] || translations.fr;
  let text = dict[key] || translations.fr[key] || key;
  
  Object.keys(params).forEach(param => {
    text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });
  
  return text;
}

// Nom de pays selon la langue courante
export function getCountryName(country) {
  if (!country) return '';
  if (currentLang === 'en' && country.nameEnglish) {
    return country.nameEnglish;
  }
  return country.name || country.code;
}

// Libellé et description d'un critère selon la langue courante
export function getCriterionLabel(item) {
  if (!item) return '';
  if (typeof item.label === 'object') {
    return item.label[currentLang] || item.label.fr || item.label.en || '';
  }
  return item.label || '';
}

export function getCriterionDesc(item) {
  if (!item) return '';
  if (typeof item.description === 'object') {
    return item.description[currentLang] || item.description.fr || item.description.en || '';
  }
  return item.description || '';
}
