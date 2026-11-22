import { planGoals, potBalance, nextOccurrence, monthlySum } from './schedule.js';

export function derive(snap, todayYmd) {
  const balance = potBalance(snap.ledger || []);
  const plan = planGoals({ balance, todayYmd, rules: snap.savingsRules || [], goals: snap.goals || [] });
  const month = todayYmd.slice(0, 7);
  const monthExpenses = (snap.expenses || []).filter((e) => e.datum?.startsWith(month));
  const incomeSum = monthlySum(snap.income || [], todayYmd);
  const fixedSum = monthlySum(snap.fixed || [], todayYmd);
  const savingsSum = monthlySum(snap.savingsRules || [], todayYmd);
  return {
    balance,
    plan,
    nextGoal: plan[0] || null,
    reached: (snap.goals || []).filter((g) => g.erreichtAm).sort((a, b) => (a.erreichtAm < b.erreichtAm ? 1 : -1)),
    nextPayday: nextOccurrence(snap.income || [], todayYmd),
    nextTransfer: nextOccurrence(snap.savingsRules || [], todayYmd),
    monthSpent: Math.round(monthExpenses.reduce((s, e) => s + (e.betrag || 0), 0) * 100) / 100,
    monthCount: monthExpenses.length,
    reweCount: monthExpenses.filter((e) => /rewe/i.test(e.haendler || '')).length,
    impulseCount: monthExpenses.filter((e) => e.impuls).length,
    incomeSum,
    fixedSum,
    savingsSum,
    frei: Math.round((incomeSum - fixedSum - savingsSum) * 100) / 100
  };
}
