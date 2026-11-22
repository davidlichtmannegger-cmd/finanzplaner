import './styles/tokens.css';
import './styles/app.css';
import { createNav } from './ui/nav.js';
import { createSheet, createToast } from './ui/sheet.js';
import { overviewPage, expensesPage, goalsPage, profilePage, newExpenseSheet } from './pages.js';
import { connectFirebase, isConfigured } from './firebase.js';

const $ = (selector) => document.querySelector(selector);

const toast = createToast($('#toast'));
const sheet = createSheet({ sheet: $('#sheet'), scrim: $('#scrim'), body: $('#sheet-body') });

const render = (firebase) => {
  $('#page-overview').innerHTML = overviewPage();
  $('#page-expenses').innerHTML = expensesPage();
  $('#page-goals').innerHTML = goalsPage();
  $('#page-profile').innerHTML = profilePage({ firebase });
};

createNav({ pages: $('#pages'), tabs: [...document.querySelectorAll('.tab')] });

$('#plus').addEventListener('click', () => {
  const content = newExpenseSheet();
  content.querySelector('[data-close]').addEventListener('click', sheet.close);
  sheet.open(content);
});

render(false);

if (isConfigured()) {
  connectFirebase()
    .then((services) => {
      render(!!services);
      if (services) toast('Mit Firebase verbunden');
    })
    .catch(() => toast('Firebase nicht erreichbar'));
}
