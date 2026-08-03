const rowClues = [
  { label: "Pays où l'espagnol est langue officielle", type: "language" },
  { label: "Ancienne colonie britannique", type: "history" },
  { label: "Membre du G20", type: "economy" },
];
const columnClues = [
  { label: "Dans les Amériques", type: "geography" },
  { label: "En Afrique", type: "geography" },
  { label: "En Asie", type: "geography" },
];
const countries = [
  { name:"Colombie", flag:"🇨🇴", cells:[0] }, { name:"Guinée équatoriale", flag:"🇬🇶", cells:[1] },
  { name:"Philippines", flag:"🇵🇭", cells:[2] }, { name:"Canada", flag:"🇨🇦", cells:[3] },
  { name:"Kenya", flag:"🇰🇪", cells:[4] }, { name:"Malaisie", flag:"🇲🇾", cells:[5] },
  { name:"Brésil", flag:"🇧🇷", cells:[6] }, { name:"Afrique du Sud", flag:"🇿🇦", cells:[7] },
  { name:"Japon", flag:"🇯🇵", cells:[8] }, { name:"Chili", flag:"🇨🇱", cells:[] },
  { name:"Nigeria", flag:"🇳🇬", cells:[] }, { name:"Corée du Sud", flag:"🇰🇷", cells:[] },
];
let selectedCell = null;
let answers = Array(9).fill(null);
const board = document.querySelector('#board');
const countriesEl = document.querySelector('#countries');
const feedback = document.querySelector('#feedback');

function clue(text, type, row = false) { return `<div class="clue ${row ? 'row' : ''}"><span class="dot ${type}"></span>${text}</div>`; }
function renderBoard() {
  board.innerHTML = '<div class="corner"></div>' + columnClues.map(c => clue(c.label,c.type)).join('');
  rowClues.forEach((row, r) => {
    board.insertAdjacentHTML('beforeend', clue(row.label,row.type,true));
    for (let c=0;c<3;c++) {
      const id=r*3+c, answer=answers[id];
      board.insertAdjacentHTML('beforeend', `<button class="cell ${selectedCell===id?'selected':''} ${answer?.correct?'correct':''}" data-cell="${id}" role="gridcell"><span class="cell-number">${id+1}</span>${answer ? `<span class="answer">${answer.flag} ${answer.name}<small>Bonne réponse</small></span>` : ''}</button>`);
    }
  });
  board.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', () => {
    const id=Number(cell.dataset.cell); if (answers[id]) return;
    selectedCell=id; feedback.textContent='Choisissez un pays ci-dessous.'; renderBoard(); renderCountries();
  }));
}
function renderCountries() {
  const used = answers.filter(Boolean).map(a=>a.name);
  countriesEl.innerHTML = countries.map(country => `<button class="country" data-country="${country.name}" ${used.includes(country.name)?'disabled':''}>${country.flag} ${country.name}</button>`).join('');
  countriesEl.querySelectorAll('.country').forEach(button => button.addEventListener('click', () => choose(button.dataset.country)));
}
function choose(name) {
  if (selectedCell === null) { feedback.textContent='Sélectionnez d’abord une case dans la grille.'; return; }
  const country=countries.find(c=>c.name===name);
  if (!country.cells.includes(selectedCell)) { feedback.textContent=`${country.name} ne correspond pas à ces deux critères. Essayez une autre case ou un autre pays.`; return; }
  answers[selectedCell]={...country,correct:true}; selectedCell=null;
  const count=answers.filter(Boolean).length;
  feedback.textContent=count===9 ? 'Bravo ! Vous avez complété le CountryDoku du jour.' : 'Bien joué ! Continuez.';
  document.querySelector('#progress').textContent=count; renderBoard(); renderCountries();
}
document.querySelector('#reset-button').addEventListener('click',()=>{answers=Array(9).fill(null);selectedCell=null;feedback.textContent='La grille a été réinitialisée.';document.querySelector('#progress').textContent='0';renderBoard();renderCountries();});
const help=document.querySelector('#help-dialog');
document.querySelector('#help-button').addEventListener('click',()=>help.showModal());
document.querySelector('#close-help').addEventListener('click',()=>help.close());
document.querySelector('#start-button').addEventListener('click',()=>help.close());
document.querySelector('#puzzle-date').textContent=`DÉFI DU ${new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date()).toUpperCase()}`;
renderBoard(); renderCountries();
