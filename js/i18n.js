// Module Internationalisation (i18n) — Français / Anglais pour CountryDoku

const STORAGE_KEY = 'countrydoku_lang';

export let currentLang = 'fr';

export const translations = {
  fr: {
    // Header & Navigation
    'brand.sub': 'Doku',
    'nav.mode_1v1': '⚔️ Mode 1v1',
    'nav.mode_1v1_short': '1v1',
    'nav.report_bug': 'Signaler un problème',
    'nav.help': 'Règles du jeu',
    'nav.bug_label': 'Bug',
    'nav.rules_label': 'Règles',
    'nav.lang_label': 'Langue',
    'nav.lang_toggle': '🇬🇧 EN',

    // Mode Selector
    'mode.solo_title': 'Mode Solo',
    'mode.solo_desc': '3 vies • Jeu illimité',
    'mode.hardcore_title': 'Mode Hardcore',
    'mode.hardcore_desc': '1 vie • Défi mondial',
    'mode.hardcore_badge': 'DÉFI 🔥',
    'mode.multi_title': 'Multijoueur (1v1)',
    'mode.multi_desc': 'Affrontez vos amis en direct !',
    'mode.multi_badge': 'JOUER À 2 🎮',
    'mode.br_title': 'Battle Royale',
    'mode.br_desc': '3+ joueurs • Survie',
    'mode.br_badge': 'NOUVEAU 🏆',

    // Hardcore Banner
    'hardcore.banner_eyebrow': '🔥 DÉFI MONDIAL HARDCORE',
    'hardcore.lives_one': 'MORT SUBITE (1 VIE)',
    'hardcore.reroll': 'Autre défi',
    'hardcore.reroll_btn': 'Changer le modificateur mondial',

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
    'board.seed_btn': '🌱 Graine',
    'board.propose_grid_btn': 'Proposer une nouvelle grille',
    'board.default_feedback': 'Cliquez sur une case de la grille pour faire votre choix.',
    'board.game_complete': '🎉 Bravo ! Grille entièrement complétée !',
    'board.correct_answer': '✅ Bonne réponse ({country}){pct} !',
    'board.incorrect_answer': '❌ {country} incorrect pour la Case {cell} ({reason}). -1 vie, il vous reste {lives} vie{plural}.',
    'board.game_over': '💔 Défaite ! {country} pour la Case {cell} : {reason}. Vos 3 vies sont épuisées.',
    'board.hardcore_game_over': '💔 Mort Subite ! {country} pour la Case {cell} : {reason}. Votre unique vie est épuisée.',
    'board.mp_wrong_self': '❌ {country} incorrect pour la Case {cell} ({reason}) ! Tour à l\'adversaire.',
    'board.mp_wrong_opp': '❌ L\'adversaire a tenté {country} pour la Case {cell} ({reason}) ! À votre tour de jouer.',
    'board.mp_correct_self': '✅ Vous avez placé {country} sur la Case {cell}{pct} ! Tour à l\'adversaire.',
    'board.mp_correct_opp': '🔵 L\'adversaire a placé {country} sur la Case {cell}{pct} ! C\'est à votre tour.',
    'board.not_your_turn': '⏳ Ce n\'est pas votre tour ! Attendez le coup de l\'adversaire.',
    'board.timeout_loss': '⏱️ Temps écoulé ! Ce n\'est plus votre tour de jouer.',
    'board.timeout_msg': '⏱️ Temps écoulé (30s) pour {player} ! Le tour passe à l\'adversaire.',
    'board.req_sent': '⏳ Demande envoyée à l\'adversaire...',

    // Dialogs: Rules
    'dialog.rules_eyebrow': 'RÈGLES DU JEU',
    'dialog.rules_title': 'Comment jouer à CountryDoku ?',
    'dialog.rule1': '<strong>Le croisement des critères :</strong> Chaque case de la grille 3×3 est à l’intersection d’une ligne et d’une colonne. Le pays choisi doit valider <em>simultanément les deux conditions</em> (ex: <em>En Europe</em> + <em>Drapeau avec du rouge</em>).',
    'dialog.rule2': '<strong>Unicité des pays :</strong> Un même pays ne peut être placé <em>qu’une seule fois</em> par grille. Choisissez bien son emplacement !',
    'dialog.rule3': '<strong>Mode Solo (3 vies) :</strong> Vous disposez de 3 cœurs ❤️. Une erreur ou un pays hors critères fait perdre 1 vie. Complétez les 9 cases pour remporter la victoire.',
    'dialog.rule_hardcore': '<strong>Mode Hardcore (Mort Subite & Défi mondial) :</strong> Une contrainte globale supplémentaire s’applique à l’ensemble de la grille (ex: interdiction du G20, population < 25M, etc.) et vous ne disposez que d’un seul cœur ❤️. Une seule erreur et la partie s’achève !',
    'dialog.rule4': '<strong>Mode Multijoueur 1v1 (30s / tour) :</strong> Affrontez un ami en direct ! Chaque bonne réponse capture une case (🟢 J1 / 🟣 J2). Le premier à aligner 3 cases (ou qui en contrôle le plus à la fin) gagne le match.',
    'dialog.rule5': '<strong>Indices & Statistiques mondiales :</strong> Cliquez sur n’importe quelle carte de critère (ou sur ⓘ) pour lire sa définition sans spoiler. Vos réussites alimentent les pourcentages de popularité mondiaux (📊 %).',
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
    'dialog.mp_hardcore_label': '🔥 Activer le Mode Hardcore',
    'dialog.mp_hardcore_hint': 'Impose un défi mondial contraignant pour les deux joueurs !',
    'dialog.mp_hardcore_active': '🔥 DÉFI 1V1 ACTIF',

    // Dialogs: Seed
    'dialog.seed_eyebrow': 'GRAINE DE GRILLE',
    'dialog.seed_title': 'Partager ou rejouer cette grille',
    'dialog.seed_desc': 'Chaque grille possède une graine unique. Copiez le code ou le lien direct pour y jouer avec un ami, ou collez une graine reçue.',
    'dialog.seed_current_label': 'GRAINE ACTUELLE :',
    'dialog.seed_copy_btn': '📋 Copier le code',
    'dialog.seed_copy_link_btn': '🔗 Copier le lien direct',
    'dialog.seed_import_title': 'CHARGER UNE GRILLE :',
    'dialog.seed_import_placeholder': 'Collez un code graine (ex: CD-12.4.28-15.3.41)...',
    'dialog.seed_load_btn': '🎮 Charger cette grille',
    'dialog.seed_invalid': '⚠️ Code graine invalide ou non reconnu',
    'dialog.seed_copied': '✅ Graine copiée !',
    'dialog.seed_link_copied': '✅ Lien de la graine copié !',
    'dialog.seed_loaded': '🎮 Grille chargée avec succès !',

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
    'dialog.gameover_desc_hardcore': 'Votre unique vie a été perdue face au défi mondial ! Souhaitez-vous retenter ce même défi ou en tirer un nouveau ?',
    'dialog.gameover_retry': 'Réessayer la grille',
    'dialog.gameover_new': 'Nouvelle grille',

    // Dialogs: Bug Report
    'dialog.report_eyebrow': '🐛 SIGNALER UN PROBLÈME',
    'dialog.report_title': 'Signaler une erreur ou un bug',
    'dialog.report_desc': 'Un pays manque ? Un critère semble incorrect ? Décrivez le problème ci-dessous. Le journal de la console sera joint à votre email.',
    'dialog.report_placeholder': 'Décrivez le problème rencontré (ex: pays mal classé, bug d\'affichage)...',
    'dialog.report_logs_label': 'JOURNAL CONSOLE CAPTURÉ (AUTOMATIQUE) :',
    'dialog.report_send_btn': '📧 Envoyer par Email',
    'dialog.report_copy_btn': '📋 Copier le rapport complet',

    // Battle Royale
    'nav.mode_br': '👑 Battle Royale',
    'nav.mode_br_short': 'BR 👑',
    'br.eyebrow': 'ARÈNE MULTIJOUEUR 3+',
    'br.title': 'Battle Royale Géographique',
    'br.desc': 'Défiez vos amis dans une arène de survie : citez des pays selon les conditions avant que le temps ne s\'écoule !',
    'br.pseudo_label': 'VOTRE PSEUDO :',
    'br.pseudo_placeholder': 'Entrez votre pseudo...',
    'br.avatar_label': 'CHOISISSEZ VOTRE DRAPEAU :',
    'br.create_section_title': 'Créer une arène',
    'br.create_section_desc': 'Ouvrez un salon pour 3 à 8 joueurs et choisissez vos règles.',
    'br.join_section_title': 'Rejoindre une arène',
    'br.join_placeholder': 'Code du salon (ex: BR742)...',
    'br.create_btn': '👑 Créer une arène',
    'br.join_btn': '🎮 Rejoindre l\'arène',
    'br.mode_select_label': 'MODE DE JEU :',
    'br.mode_bomb_title': '💣 Bombe Party (1 condition, tours rapides)',
    'br.mode_bomb_desc': 'Chacun votre tour, citez un pays respectant la condition. Erreur ou chrono = vie perdue !',
    'br.mode_waves_title': '🌊 Vagues de Survie (Conditions cumulatives)',
    'br.mode_waves_desc': 'Les conditions s\'accumulent manche après manche. Trouvez un pays unique pour survivre !',
    'br.timer_label': 'DURÉE DU CHRONO :',
    'br.timer_10s': '10 secondes (Extrême 🔥)',
    'br.timer_15s': '15 secondes (Standard ⏱️)',
    'br.timer_20s': '20 secondes (Détente 🧘)',
    'br.lobby_code_label': 'CODE DE L\'ARÈNE',
    'br.lobby_invite_hint': 'Partagez ce code ou ce lien à vos amis pour qu\'ils rejoignent l\'arène :',
    'br.copy_code_btn': '📋 Copier le code',
    'br.copy_link_btn': '🔗 Copier le lien direct',
    'br.players_in_lobby': 'JOUEURS CONNECTÉS ({count}/8) :',
    'br.host_tag': '👑 HÔTE',
    'br.you_tag': 'VOUS',
    'br.waiting_for_host': 'En attente que l\'hôte lance la partie...',
    'br.start_game_btn': '🚀 Lancer la partie ({count} joueurs)',
    'br.need_min_players': '⚠️ Au moins 2 joueurs requis pour démarrer (3+ recommandé).',
    'br.leave_lobby_btn': 'Quitter l\'arène',
    'br.round_badge': 'MANCHE {round}',
    'br.condition_title': 'CONDITION ACTIVE :',
    'br.cumulative_title': 'CONDITIONS CUMULÉES ({count}) :',
    'br.survivors_label': 'SURVIVANTS :',
    'br.your_turn_prompt': '💣 C\'EST À VOTRE TOUR ! Citez un pays valide !',
    'br.waiting_turn_prompt': '⏳ Tour de {player}... Préparez votre réponse !',
    'br.spectator_msg': '👻 Vous êtes éliminé ! Vous observez la fin du match.',
    'br.search_placeholder': 'Tapez le nom d\'un pays...',
    'br.submit_btn': 'Valider',
    'br.used_countries_title': 'PAYS DÉJÀ CITÉS CETTE MANCHE ({count}) :',
    'br.no_used_yet': 'Aucun pays cité pour l\'instant. Soyez le premier !',
    'br.eliminated_badge': 'ÉLIMINÉ 💀',
    'br.eliminated_feed': '💀 {player} a perdu sa dernière vie et est éliminé !',
    'br.lost_life_feed': '💥 {player} perd 1 vie ({reason}) ! Il lui reste {lives} ❤️.',
    'br.correct_feed': '✅ {player} valide "{country}" !',
    'br.winner_title': 'VICTOIRE ROYALE ! 🏆',
    'br.winner_desc': 'Félicitations à {player} qui remporte ce Battle Royale !',
    'br.podium_top1': '🥇 Vainqueur :',
    'br.podium_top2': '🥈 2e Place :',
    'br.podium_top3': '🥉 3e Place :',
    'br.play_again_btn': '🔄 Rejouer dans ce salon',
    'br.back_to_menu': 'Quitter l\'arène',
    'br.err_already_used': '⚠️ Ce pays a déjà été cité dans cette manche !',
    'br.err_not_valid': '❌ Ce pays ne respecte pas les conditions demandées !',
    'br.err_timeout': '⏱️ Temps écoulé !',
    'br.err_empty_input': '⚠️ Veuillez sélectionner un pays.',
    'br.connecting': 'Connexion à l\'arène en cours...',
    'br.finding_room': 'Recherche de l\'arène {code}...',
    'br.disconnected': 'Déconnecté de l\'arène.'
  },
  en: {
    // Header & Navigation
    'brand.sub': 'Doku',
    'nav.mode_1v1': '⚔️ 1v1 Mode',
    'nav.mode_1v1_short': '1v1',
    'nav.report_bug': 'Report an issue',
    'nav.help': 'Game rules',
    'nav.bug_label': 'Bug',
    'nav.rules_label': 'Rules',
    'nav.lang_label': 'Language',
    'nav.lang_toggle': '🇫🇷 FR',

    // Mode Selector
    'mode.solo_title': 'Solo Mode',
    'mode.solo_desc': '3 lives • Unlimited play',
    'mode.hardcore_title': 'Hardcore Mode',
    'mode.hardcore_desc': '1 life • Global challenge',
    'mode.hardcore_badge': 'CHALLENGE 🔥',
    'mode.multi_title': 'Multiplayer (1v1)',
    'mode.multi_desc': 'Play live against friends!',
    'mode.multi_badge': '2 PLAYERS 🎮',
    'mode.br_title': 'Battle Royale',
    'mode.br_desc': '3+ players • Survival',
    'mode.br_badge': 'NEW 🏆',

    // Hardcore Banner
    'hardcore.banner_eyebrow': '🔥 HARDCORE GLOBAL CHALLENGE',
    'hardcore.lives_one': 'SUDDEN DEATH (1 LIFE)',
    'hardcore.reroll': 'Reroll rule',
    'hardcore.reroll_btn': 'Reroll global modifier',

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
    'board.seed_btn': '🌱 Seed',
    'board.propose_grid_btn': 'Propose new grid',
    'board.default_feedback': 'Click a grid cell to make your choice.',
    'board.game_complete': '🎉 Congratulations! Grid fully completed!',
    'board.correct_answer': '✅ Correct answer ({country}){pct}!',
    'board.incorrect_answer': '❌ {country} incorrect for Cell {cell} ({reason}). -1 life, {lives} remaining.',
    'board.game_over': '💔 Game Over! {country} for Cell {cell}: {reason}. All 3 lives spent.',
    'board.hardcore_game_over': '💔 Sudden Death! {country} for Cell {cell}: {reason}. Your only life has ended.',
    'board.mp_wrong_self': '❌ {country} incorrect for Cell {cell} ({reason})! Turn passes to opponent.',
    'board.mp_wrong_opp': '❌ Opponent attempted {country} for Cell {cell} ({reason})! It\'s your turn to play.',
    'board.mp_correct_self': '✅ You placed {country} on Cell {cell}{pct}! Turn passes to opponent.',
    'board.mp_correct_opp': '🔵 Opponent placed {country} on Cell {cell}{pct}! It\'s your turn.',
    'board.not_your_turn': '⏳ It is not your turn! Wait for opponent move.',
    'board.timeout_loss': '⏱️ Time is up! Your turn has passed.',
    'board.timeout_msg': '⏱️ Time up (30s) for {player}! Turn passes to opponent.',
    'board.req_sent': '⏳ Request sent to opponent...',

    // Dialogs: Rules
    'dialog.rules_eyebrow': 'GAME RULES',
    'dialog.rules_title': 'How to play CountryDoku?',
    'dialog.rule1': '<strong>Criteria Intersection:</strong> Each cell in the 3×3 grid sits at the intersection of a row and a column. Your chosen country must satisfy <em>both conditions simultaneously</em> (e.g. <em>In Europe</em> + <em>Flag contains red</em>).',
    'dialog.rule2': '<strong>One use per country:</strong> Each country can only be used <em>once per game</em>. Choose where to place it wisely!',
    'dialog.rule3': '<strong>Solo Mode (3 lives):</strong> You start with 3 hearts ❤️. An invalid guess costs 1 life. Complete all 9 cells to win the game.',
    'dialog.rule_hardcore': '<strong>Hardcore Mode (Sudden Death & Global Challenge):</strong> An extra global constraint applies across all 9 cells (e.g. G20 ban, population < 25M, etc.) and you only have a single heart ❤️. One mistake and the game is over!',
    'dialog.rule4': '<strong>1v1 Multiplayer (30s / turn):</strong> Play live against a friend! Each correct answer claims a cell for your color (🟢 P1 / 🟣 P2). Win by aligning 3 cells (or holding the majority).',
    'dialog.rule5': '<strong>Clues & Global Stats:</strong> Click any criterion card (or ⓘ) to read its exact spoiler-free definition. Your answers contribute to real-time global popularity stats (📊 %).',
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
    'dialog.mp_hardcore_label': '🔥 Enable Hardcore Mode',
    'dialog.mp_hardcore_hint': 'Applies a secret global constraint for both players!',
    'dialog.mp_hardcore_active': '🔥 HARDCORE 1V1 ACTIVE',

    // Dialogs: Seed
    'dialog.seed_eyebrow': 'GRID SEED',
    'dialog.seed_title': 'Share or replay this grid',
    'dialog.seed_desc': 'Each grid has a unique seed. Copy the code or direct link to play it with a friend, or paste an existing seed.',
    'dialog.seed_current_label': 'CURRENT SEED:',
    'dialog.seed_copy_btn': '📋 Copy code',
    'dialog.seed_copy_link_btn': '🔗 Copy direct link',
    'dialog.seed_import_title': 'LOAD A GRID:',
    'dialog.seed_import_placeholder': 'Paste a seed code (e.g. CD-12.4.28-15.3.41)...',
    'dialog.seed_load_btn': '🎮 Load grid',
    'dialog.seed_invalid': '⚠️ Invalid or unrecognized seed code',
    'dialog.seed_copied': '✅ Seed copied!',
    'dialog.seed_link_copied': '✅ Seed link copied!',
    'dialog.seed_loaded': '🎮 Grid loaded successfully!',

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
    'dialog.gameover_desc_hardcore': 'Your only life was lost against the global challenge! Would you like to retry this challenge or draw a new one?',
    'dialog.gameover_retry': 'Retry same grid',
    'dialog.gameover_new': 'New grid',

    // Dialogs: Bug Report
    'dialog.report_eyebrow': '🐛 REPORT AN ISSUE',
    'dialog.report_title': 'Report an error or bug',
    'dialog.report_desc': 'Missing country? Incorrect criterion? Describe the issue below. The browser console log will be attached to your email.',
    'dialog.report_placeholder': 'Describe the problem (e.g. misclassified country, UI bug)...',
    'dialog.report_logs_label': 'AUTOMATIC CONSOLE LOG:',
    'dialog.report_send_btn': '📧 Send by Email',
    'dialog.report_copy_btn': '📋 Copy full report',

    // Battle Royale
    'nav.mode_br': '👑 Battle Royale',
    'nav.mode_br_short': 'BR 👑',
    'br.eyebrow': 'MULTIPLAYER ARENA 3+',
    'br.title': 'Geography Battle Royale',
    'br.desc': 'Challenge your friends in a survival arena: name countries according to active conditions before time runs out!',
    'br.pseudo_label': 'YOUR NICKNAME:',
    'br.pseudo_placeholder': 'Enter nickname...',
    'br.avatar_label': 'CHOOSE YOUR FLAG AVATAR:',
    'br.create_section_title': 'Create an arena',
    'br.create_section_desc': 'Open a room for 3 to 8 players and choose the rules.',
    'br.join_section_title': 'Join an arena',
    'br.join_placeholder': 'Room code (e.g. BR742)...',
    'br.create_btn': '👑 Create arena',
    'br.join_btn': '🎮 Join arena',
    'br.mode_select_label': 'GAME MODE:',
    'br.mode_bomb_title': '💣 Bomb Party (1 condition, fast turns)',
    'br.mode_bomb_desc': 'Take turns naming a country matching the condition. Error or timeout = lost life!',
    'br.mode_waves_title': '🌊 Survival Waves (Cumulative conditions)',
    'br.mode_waves_desc': 'Conditions pile up round after round. Find a unique country to qualify and survive!',
    'br.timer_label': 'TURN DURATION:',
    'br.timer_10s': '10 seconds (Extreme 🔥)',
    'br.timer_15s': '15 seconds (Standard ⏱️)',
    'br.timer_20s': '20 seconds (Chill 🧘)',
    'br.lobby_code_label': 'ARENA CODE',
    'br.lobby_invite_hint': 'Share this code or link with your friends to join:',
    'br.copy_code_btn': '📋 Copy code',
    'br.copy_link_btn': '🔗 Copy direct link',
    'br.players_in_lobby': 'CONNECTED PLAYERS ({count}/8):',
    'br.host_tag': '👑 HOST',
    'br.you_tag': 'YOU',
    'br.waiting_for_host': 'Waiting for the host to start the game...',
    'br.start_game_btn': '🚀 Start Game ({count} players)',
    'br.need_min_players': '⚠️ At least 2 players required to start (3+ recommended).',
    'br.leave_lobby_btn': 'Leave arena',
    'br.round_badge': 'ROUND {round}',
    'br.condition_title': 'ACTIVE CONDITION:',
    'br.cumulative_title': 'CUMULATIVE CONDITIONS ({count}):',
    'br.survivors_label': 'SURVIVORS:',
    'br.your_turn_prompt': '💣 IT\'S YOUR TURN! Submit a valid country!',
    'br.waiting_turn_prompt': '⏳ {player}\'s turn... Prepare your answer!',
    'br.spectator_msg': '👻 You are eliminated! Spectating the rest of the match.',
    'br.search_placeholder': 'Type a country name...',
    'br.submit_btn': 'Submit',
    'br.used_countries_title': 'COUNTRIES PLAYED THIS ROUND ({count}):',
    'br.no_used_yet': 'No country cited yet. Be the first!',
    'br.eliminated_badge': 'ELIMINATED 💀',
    'br.eliminated_feed': '💀 {player} lost their last life and is eliminated!',
    'br.lost_life_feed': '💥 {player} lost 1 life ({reason})! {lives} ❤️ remaining.',
    'br.correct_feed': '✅ {player} validated "{country}"!',
    'br.winner_title': 'VICTORY ROYALE! 🏆',
    'br.winner_desc': 'Congratulations to {player} for winning this Battle Royale!',
    'br.podium_top1': '🥇 Winner:',
    'br.podium_top2': '🥈 2nd Place:',
    'br.podium_top3': '🥉 3rd Place:',
    'br.play_again_btn': '🔄 Play again in this room',
    'br.back_to_menu': 'Leave arena',
    'br.err_already_used': '⚠️ This country has already been used in this round!',
    'br.err_not_valid': '❌ This country does not meet the active conditions!',
    'br.err_timeout': '⏱️ Time is up!',
    'br.err_empty_input': '⚠️ Please select a country.',
    'br.connecting': 'Connecting to the arena...',
    'br.finding_room': 'Looking for arena {code}...',
    'br.disconnected': 'Disconnected from the arena.'
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
