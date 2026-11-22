import { planGoals, potBalance, nextOccurrence, monthlySum } from './schedule.js';
import { levelFor, totalXp, streak, dailyQuests, weekChallenge, pendingConfirmations, taschengeld, achievementState, daysSinceRewe, isRewe, weekStart } from './rewards.js';

export function derive(snap, todayYmd, { hour = 12, visitedGoals = false } = {}) {
  const balance = potBalance(snap.ledger || []);
  const plan = planGoals({ balance, todayYmd, rules: snap.savingsRules || [], goals: snap.goals || [] });
  const month = todayYmd.slice(0, 7);
  const expenses = snap.expenses || [];
  const monthExpenses = expenses.filter((e) => e.datum?.startsWith(month));
  const incomeSum = monthlySum(snap.income || [], todayYmd);
  const fixedSum = monthlySum(snap.fixed || [], todayYmd);
  const savingsSum = monthlySum(snap.savingsRules || [], todayYmd);
  const reached = (snap.goals || []).filter((g) => g.erreichtAm).sort((a, b) => (a.erreichtAm < b.erreichtAm ? 1 : -1));
  const xp = totalXp(snap.xpLog);
  const level = levelFor(xp);
  const currentStreak = streak(expenses, snap.profile?.startDatum, todayYmd);
  const week = weekStart(todayYmd);
  const questsDone = (snap.xpLog || []).filter((e) => e.id?.startsWith('quest-') || e.id?.startsWith('week-')).length;
  const achievements = achievementState(
    {
      expenses,
      ledger: snap.ledger || [],
      streak: currentStreak,
      balance,
      reachedSum: reached.reduce((s, g) => s + (g.kosten || 0), 0),
      reached: reached.length,
      daysSinceRewe: daysSinceRewe(expenses, snap.profile?.startDatum, todayYmd),
      questsDone,
      level: level.level
    },
    new Set((snap.achievements || []).map((a) => a.id))
  );
  return {
    balance,
    plan,
    nextGoal: plan[0] || null,
    reached,
    nextPayday: nextOccurrence(snap.income || [], todayYmd),
    nextTransfer: nextOccurrence(snap.savingsRules || [], todayYmd),
    monthSpent: Math.round(monthExpenses.reduce((s, e) => s + (e.betrag || 0), 0) * 100) / 100,
    monthCount: monthExpenses.length,
    reweCount: monthExpenses.filter(isRewe).length,
    reweWeek: expenses.filter((e) => e.datum >= week && e.datum <= todayYmd && isRewe(e)).length,
    impulseCount: monthExpenses.filter((e) => e.impuls).length,
    incomeSum,
    fixedSum,
    savingsSum,
    frei: Math.round((incomeSum - fixedSum - savingsSum) * 100) / 100,
    xp,
    level,
    streak: currentStreak,
    quests: dailyQuests({ todayYmd, hour, expenses, xpLog: snap.xpLog, visitedGoals }),
    week: weekChallenge({ todayYmd, expenses, xpLog: snap.xpLog, startDatum: snap.profile?.startDatum }),
    pending: pendingConfirmations(snap.ledger || [], todayYmd),
    taschengeld: taschengeld(level.level, expenses),
    achievements
  };
}
