// =========================================================
// SUPABASE CONNECTION
// These two values connect our app to YOUR Supabase project.
// The "publishable" key is safe to use here in the browser —
// it's designed for exactly this. (Never put a "secret" key
// in front-end code like this.)
// =========================================================
const SUPABASE_URL = "https://uirbigmcseyqhnrbdqow.supabase.co";
const SUPABASE_KEY = "sb_publishable_Secc0hTH27nxK_3RPhJGvw_sqtDgiGA";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================
// DATA
// This array holds the transactions currently shown on screen.
// It gets filled from Supabase when the page loads, and
// updated whenever we add a new entry.
// =========================================================
let transactions = [];

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

// Keeps track of the current Chart.js chart instance, so we can
// destroy it before drawing a new one (otherwise old charts pile
// up on top of each other every time data changes)
let categoryChart = null;

// A small set of colors pulled from our own palette, used in order
// as we draw slices for each category
const CHART_COLORS = ["#A8452F", "#8A6D1F", "#1F4A3D", "#2F6B57", "#5B6156"];

// =========================================================
// HELPER: format a number as money, e.g. 1234.5 -> "$1,234.50"
// =========================================================
function formatMoney(amount) {
  const absolute = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "$" + absolute;
}

// =========================================================
// HELPER: turn a database timestamp into a short label
// like "Jul 22"
// =========================================================
function formatDateLabel(timestamp) {
  const date = new Date(timestamp);
  const options = { month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

// =========================================================
// RENDER: rebuild the ledger list on screen from the
// `transactions` array.
// =========================================================
function renderLedger() {
  ledgerList.innerHTML = "";

  if (transactions.length === 0) {
    ledgerList.innerHTML = '<p style="color: var(--ink-soft); padding: 16px 0;">No transactions yet — add your first one above.</p>';
    return;
  }

  transactions.forEach((entry, index) => {
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
    `;
    ledgerList.appendChild(row);

    if (index < transactions.length - 1) {
      const rule = document.createElement("div");
      rule.className = "ledger-rule";
      ledgerList.appendChild(rule);
    }
  });
}

// =========================================================
// RENDER: recalculate and display the summary card totals
// =========================================================
function renderSummary() {
  let income = 0;
  let expenses = 0;

  transactions.forEach((entry) => {
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

// =========================================================
// RENDER: build (or rebuild) the spending-by-category chart
// =========================================================
function renderChart() {
  const totalsByCategory = {};
  transactions.forEach((entry) => {
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

// =========================================================
// LOAD: fetch all transactions from Supabase, newest first
// =========================================================
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

  transactions = data;
  renderLedger();
  renderSummary();
  renderChart();
}

// =========================================================
// EVENT: when the form is submitted, save a new transaction
// to Supabase, then reload the list
// =========================================================
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

// =========================================================
// AUTH: sign in with Google
// =========================================================
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

// =========================================================
// AUTH: sign out
// =========================================================
signOutButton.addEventListener("click", async function () {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Error signing out:", error);
  }
});

// =========================================================
// AUTH: show the right screen based on whether someone is
// logged in, and load their data if so
// =========================================================
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
