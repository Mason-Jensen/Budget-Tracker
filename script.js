// =========================================================
// SUPABASE CONNECTION
// =========================================================
const SUPABASE_URL = "https://uirbigmcseyqhnrbdqow.supabase.co";
const SUPABASE_KEY = "sb_publishable_Secc0hTH27nxK_3RPhJGvw_sqtDgiGA";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================
// DATA
// =========================================================
let allTransactions = [];
let currentMonthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

// =========================================================
// GRAB THE PAGE ELEMENTS WE'LL NEED TO UPDATE
// =========================================================
const form = document.getElementById("entry-form");
const ledgerList = document.getElementById("ledger-list");
const summaryBalance = document.getElementById("summary-balance");
const summaryIncome = document.getElementById("summary-income");
const summaryExpenses = document.getElementById("summary-expenses");
const chartCanvas = document.getElementById("category-chart");
const chartEmptyMessage = document.getElementById("chart-empty-message");
const loginScreen = document.getElementById("login-screen");
const appContent = document.getElementById("app-content");
const googleSignInButton = document.getElementById("google-signin");
const signOutButton = document.getElementById("sign-out");
const userEmailLabel = document.getElementById("user-email");

const prevMonthButton = document.getElementById("prev-month");
const nextMonthButton = document.getElementById("next-month");
const monthLabel = document.getElementById("month-label");

const tabLedger = document.getElementById("tab-ledger");
const tabProgress = document.getElementById("tab-progress");
const ledgerView = document.getElementById("ledger-view");
const progressView = document.getElementById("progress-view");

const totalSavedLabel = document.getElementById("total-saved");
const monthChangeLabel = document.getElementById("month-change");
const monthChangeNote = document.getElementById("month-change-note");
const trendCanvas = document.getElementById("trend-chart");
const trendEmptyMessage = document.getElementById("trend-empty-message");

let categoryChart = null;
let trendChart = null;

const CHART_COLORS = ["#A8452F", "#8A6D1F", "#1F4A3D", "#2F6B57", "#5B6156"];

function formatMoney(amount) {
  const absolute = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "$" + absolute;
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp);
  const options = { month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

function getTransactionsForMonth(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  return allTransactions.filter((entry) => {
    const entryDate = new Date(entry.created_at);
    return entryDate.getFullYear() === year && entryDate.getMonth() === month;
  });
}

function getNetTotal(transactionList) {
  return transactionList.reduce((total, entry) => total + entry.amount, 0);
}

function renderLedger() {
  const monthTransactions = getTransactionsForMonth(currentMonthDate);
  ledgerList.innerHTML = "";

  if (monthTransactions.length === 0) {
    ledgerList.innerHTML = '<p style="color: var(--ink-soft); padding: 16px 0;">No transactions this month — add your first one above.</p>';
    return;
  }

  monthTransactions.forEach((entry, index) => {
    const isExpense = entry.amount < 0;
    const sign = isExpense ? "\u2212" : "+";
    const amountClass = isExpense ? "expense" : "income";

    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <span class="entry-date">${formatDateLabel(entry.created_at)}</span>
      <span class="entry-desc">${entry.desc}</span>
      <span class="entry-category">${entry.category}</span>
      <span class="entry-amount ${amountClass}">${sign}${formatMoney(entry.amount)}</span>
      <button class="delete-button" data-id="${entry.id}" aria-label="Delete this entry">&times;</button>
    `;
    ledgerList.appendChild(row);

    if (index < monthTransactions.length - 1) {
      const rule = document.createElement("div");
      rule.className = "ledger-rule";
      ledgerList.appendChild(rule);
    }
  });
}

function renderSummary() {
  const monthTransactions = getTransactionsForMonth(currentMonthDate);

  let income = 0;
  let expenses = 0;

  monthTransactions.forEach((entry) => {
    if (entry.amount >= 0) {
      income += entry.amount;
    } else {
      expenses += Math.abs(entry.amount);
    }
  });

  const balance = income - expenses;
  const balanceSign = balance >= 0 ? "+" : "\u2212";

  summaryBalance.textContent = balanceSign + formatMoney(balance);
  summaryIncome.textContent = formatMoney(income);
  summaryExpenses.textContent = formatMoney(expenses);
}

function renderChart() {
  const monthTransactions = getTransactionsForMonth(currentMonthDate);

  const totalsByCategory = {};
  monthTransactions.forEach((entry) => {
    if (entry.amount < 0) {
      const categoryTotal = totalsByCategory[entry.category] || 0;
      totalsByCategory[entry.category] = categoryTotal + Math.abs(entry.amount);
    }
  });

  const labels = Object.keys(totalsByCategory);
  const values = Object.values(totalsByCategory);

  if (labels.length === 0) {
    chartEmptyMessage.style.display = "block";
    chartCanvas.style.display = "none";
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    return;
  }

  chartEmptyMessage.style.display = "none";
  chartCanvas.style.display = "block";

  if (categoryChart) {
    categoryChart.destroy();
  }

  categoryChart = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS,
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            font: { family: "Inter" },
            color: "#23281F",
          },
        },
      },
    },
  });
}

function renderMonthLabel() {
  const options = { month: "long", year: "numeric" };
  monthLabel.textContent = currentMonthDate.toLocaleDateString("en-US", options);
}

function renderProgress() {
  const totalSaved = getNetTotal(allTransactions);
  const totalSign = totalSaved >= 0 ? "+" : "\u2212";
  totalSavedLabel.textContent = totalSign + formatMoney(totalSaved);
  totalSavedLabel.style.color = totalSaved >= 0 ? "var(--forest)" : "var(--rust)";

  const thisMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
  const lastMonthDate = new Date(thisMonthDate.getFullYear(), thisMonthDate.getMonth() - 1, 1);

  const thisMonthNet = getNetTotal(getTransactionsForMonth(thisMonthDate));
  const lastMonthNet = getNetTotal(getTransactionsForMonth(lastMonthDate));
  const change = thisMonthNet - lastMonthNet;

  const changeSign = change >= 0 ? "+" : "\u2212";
  monthChangeLabel.textContent = changeSign + formatMoney(change);
  monthChangeLabel.style.color = change >= 0 ? "var(--forest)" : "var(--rust)";

  if (change > 0) {
    monthChangeNote.textContent = "You saved more than last month — nice work.";
  } else if (change < 0) {
    monthChangeNote.textContent = "You saved less than last month.";
  } else {
    monthChangeNote.textContent = "Same as last month.";
  }

  const monthLabels = [];
  const monthNets = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisMonthDate.getFullYear(), thisMonthDate.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const net = getNetTotal(getTransactionsForMonth(d));
    monthLabels.push(label);
    monthNets.push(net);
  }

  const hasAnyData = monthNets.some((n) => n !== 0);

  if (!hasAnyData) {
    trendEmptyMessage.style.display = "block";
    trendCanvas.style.display = "none";
    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }
    return;
  }

  trendEmptyMessage.style.display = "none";
  trendCanvas.style.display = "block";

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: monthLabels,
      datasets: [
        {
          label: "Net savings",
          data: monthNets,
          borderColor: "#1F4A3D",
          backgroundColor: "rgba(31, 74, 61, 0.1)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#1F4A3D",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => "$" + value,
          },
        },
      },
    },
  });
}

prevMonthButton.addEventListener("click", function () {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
  renderMonthLabel();
  renderLedger();
  renderSummary();
  renderChart();
});

nextMonthButton.addEventListener("click", function () {
  currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
  renderMonthLabel();
  renderLedger();
  renderSummary();
  renderChart();
});

tabLedger.addEventListener("click", function () {
  tabLedger.classList.add("active");
  tabProgress.classList.remove("active");
  ledgerView.style.display = "block";
  progressView.style.display = "none";
});

tabProgress.addEventListener("click", function () {
  tabProgress.classList.add("active");
  tabLedger.classList.remove("active");
  progressView.style.display = "block";
  ledgerView.style.display = "none";
  renderProgress();
});

async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading transactions:", error);
    alert("Couldn't load your transactions. Check the console for details.");
    return;
  }

  allTransactions = data;
  renderMonthLabel();
  renderLedger();
  renderSummary();
  renderChart();

  if (progressView.style.display !== "none") {
    renderProgress();
  }
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const desc = document.getElementById("desc").value.trim();
  const amountInput = document.getElementById("amount").value.trim();
  const category = document.getElementById("category").value;
  const type = document.getElementById("type").value;

  const amountNumber = parseFloat(amountInput);
  if (desc === "" || isNaN(amountNumber) || amountNumber <= 0) {
    alert("Please enter a description and a valid positive amount.");
    return;
  }

  const signedAmount = type === "Expense" ? -amountNumber : amountNumber;

  const { error } = await supabaseClient.from("transactions").insert({
    desc: desc,
    amount: signedAmount,
    category: category,
    type: type,
  });

  if (error) {
    console.error("Error saving transaction:", error);
    alert("Couldn't save that transaction. Check the console for details.");
    return;
  }

  await loadTransactions();
  form.reset();
});

ledgerList.addEventListener("click", async function (event) {
  const button = event.target.closest(".delete-button");
  if (!button) return;

  const confirmed = confirm("Delete this transaction? This can't be undone.");
  if (!confirmed) return;

  const idToDelete = button.getAttribute("data-id");

  const { error } = await supabaseClient
    .from("transactions")
    .delete()
    .eq("id", idToDelete);

  if (error) {
    console.error("Error deleting transaction:", error);
    alert("Couldn't delete that transaction. Check the console for details.");
    return;
  }

  await loadTransactions();
});

googleSignInButton.addEventListener("click", async function () {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://mason-jensen.github.io/Budget-Tracker/",
    },
  });
  if (error) {
    console.error("Error signing in:", error);
    alert("Couldn't sign in with Google. Check the console for details.");
  }
});

signOutButton.addEventListener("click", async function () {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Error signing out:", error);
  }
});

function showLoggedOutScreen() {
  loginScreen.style.display = "flex";
  appContent.style.display = "none";
}

function showLoggedInScreen(user) {
  loginScreen.style.display = "none";
  appContent.style.display = "block";
  userEmailLabel.textContent = user.email;
  loadTransactions();
}

supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    showLoggedInScreen(session.user);
  } else {
    showLoggedOutScreen();
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    showLoggedInScreen(session.user);
  } else {
    showLoggedOutScreen();
  }
});
