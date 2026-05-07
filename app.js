// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdOWIyA-rKxlDZJdMbVA4tbM6oBUEFsfk",
  authDomain: "budget-tracker-225b9.firebaseapp.com",
  projectId: "budget-tracker-225b9",
  storageBucket: "budget-tracker-225b9.firebasestorage.app",
  messagingSenderId: "699093977473",
  appId: "1:699093977473:web:22830c4b1ad43b91660080"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Initialize Icons
lucide.createIcons();

// Elements
const balanceEl = document.getElementById('total-balance');
const monthlyIncomeEl = document.getElementById('monthly-income');
const monthlyExpenseEl = document.getElementById('monthly-expense');
const monthlyBalanceEl = document.getElementById('monthly-balance');
const listEl = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const categoryGroup = document.getElementById('category-group');
const subcategoryGroup = document.getElementById('subcategory-group');
const subcategoryInput = document.getElementById('subcategory');
const descriptionInput = document.getElementById('description');
const dateInput = document.getElementById('date');
const typeRadios = document.querySelectorAll('input[name="type"]');
const formTitle = document.getElementById('form-title');
const submitText = document.getElementById('submit-text');
const submitIcon = document.getElementById('submit-icon');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const monthSelector = document.getElementById('month-selector');
const summaryMonthSelector = document.getElementById('summary-month-selector');
const historyMonthSelector = document.getElementById('history-month-selector');
const chartCtx = document.getElementById('expense-chart').getContext('2d');
const chartEmptyState = document.getElementById('chart-empty-state');

// Chart Instance
let expenseChart = null;

monthSelector.addEventListener('change', () => {
  updateChart();
});

if (summaryMonthSelector) {
  summaryMonthSelector.addEventListener('change', () => {
    updateValues();
  });
}

if (historyMonthSelector) {
  historyMonthSelector.addEventListener('change', () => {
    renderTransactions();
  });
}

// Helper: Get Today Local
function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Default Date to Today
dateInput.value = getTodayLocal();

// State Variables
let transactions = [];
let isEditing = false;
let editId = null;
const subcategoriesData = {
  'Transport': [
    { value: 'TTC', label: 'TTC' }
  ],
  'Bills': [
    { value: 'Rent', label: 'Rent' },
    { value: 'Phone', label: 'Phone' },
    { value: 'Utilities', label: 'Utilities' }
  ]
};

// Helper: Format Currency
function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Map Category to Icon
function getCategoryIcon(category) {
  const map = {
    'Dining': 'utensils',
    'Transport': 'car',
    'TTC': 'bus',
    'Bills': 'receipt',
    'Rent': 'home',
    'Phone': 'smartphone',
    'Utilities': 'zap',
    'Shopping': 'shopping-bag',
    'Groceries': 'shopping-cart',
    'Misc.': 'tag',
    'Income': 'dollar-sign'
  };
  return map[category] || 'tag';
}

// Map Category to Color
function getCategoryColor(category) {
  const map = {
    'Dining': { text: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' },
    'Transport': { text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    'TTC': { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'Bills': { text: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    'Rent': { text: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
    'Phone': { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    'Utilities': { text: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    'Shopping': { text: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
    'Groceries': { text: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    'Misc.': { text: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
    'Income': { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' }
  };
  return map[category] || { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
}

// Format Date
function formatDate(dateStr) {
  // Fix timezone offset issue by treating the date literally at noon local time
  const safeDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(safeDateStr).toLocaleDateString('en-US', options);
}

// Replace init() with renderTransactions(), called by Firebase
function renderTransactions() {
  listEl.innerHTML = '';
  
  let targetTransactions = transactions;
  
  if (historyMonthSelector) {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthStr = (historyMonthSelector.value && historyMonthSelector.value !== "current") 
                           ? historyMonthSelector.value 
                           : currentMonthStr;
    targetTransactions = transactions.filter(t => t.date && t.date.startsWith(targetMonthStr));
  }
  
  if (targetTransactions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <p>No transactions yet.</p>
      </div>
    `;
    lucide.createIcons();
  } else {
    // Sort transactions by date descending
    const sorted = [...targetTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let lastDate = null;
    sorted.forEach(t => {
      if (t.date !== lastDate) {
        const dBreak = document.createElement('div');
        dBreak.style.fontSize = '0.8rem';
        dBreak.style.color = 'var(--text-secondary)';
        dBreak.style.margin = lastDate === null ? '0.25rem 0 0.25rem 0.25rem' : '0.75rem 0 0.25rem 0.25rem';
        dBreak.style.fontWeight = '600';
        dBreak.style.textTransform = 'uppercase';
        dBreak.style.letterSpacing = '0.05em';
        dBreak.style.display = 'flex';
        dBreak.style.alignItems = 'center';
        dBreak.style.gap = '0.75rem';
        
        dBreak.innerHTML = `
          <span>${formatDate(t.date)}</span>
          <div style="flex: 1; height: 1px; background: var(--card-border);"></div>
        `;
        
        listEl.appendChild(dBreak);
        lastDate = t.date;
      }
      addTransactionDOM(t);
    });
    lucide.createIcons();
  }
  updateValues();
  updateMonthsDropdown();
  updateChart();
}

// Real-time listener
db.collection("transactions").onSnapshot((snapshot) => {
  transactions = [];
  snapshot.forEach((doc) => {
    transactions.push({ id: doc.id, ...doc.data() });
  });
  renderTransactions();
});

// Add transaction to DOM
function addTransactionDOM(transaction) {
  const isIncome = transaction.type === 'income';
  const sign = isIncome ? '+' : '-';
  
  const { text: catColor, bg: catBg } = getCategoryColor(transaction.category);

  const div = document.createElement('div');
  div.classList.add('transaction-item');
  div.style.borderLeft = `4px solid ${catColor}`;
  
  div.innerHTML = `
    <div class="transaction-info">
      <div class="transaction-icon" style="color: ${catColor}; background: ${catBg}">
        <i data-lucide="${getCategoryIcon(transaction.category)}"></i>
      </div>
      <div class="transaction-details">
        <h4>${transaction.description || transaction.category}</h4>
        <p>${transaction.category} • ${formatDate(transaction.date)}</p>
      </div>
    </div>
    <div class="transaction-amount">
      <span style="color: ${catColor}">${sign}${formatMoney(Math.abs(transaction.amount))}</span>
      <div style="display:flex; gap: 0.25rem;">
        <button class="action-btn edit-btn" onclick="editTransaction('${transaction.id}')" title="Edit">
          <i data-lucide="edit-2"></i>
        </button>
        <button class="action-btn delete-btn" 
          onmousedown="startDeleteTimer('${transaction.id}', this)" 
          onmouseup="cancelDeleteTimer(this)" 
          onmouseleave="cancelDeleteTimer(this)"
          ontouchstart="startDeleteTimer('${transaction.id}', this)"
          ontouchend="cancelDeleteTimer(this)"
          ontouchcancel="cancelDeleteTimer(this)"
          title="Hold 1s to Delete">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `;
  
  listEl.appendChild(div);
}

// Chart Logic
function updateMonthsDropdown() {
  const months = new Set();
  transactions.forEach(t => {
     if (t.date) {
        const d = new Date(t.date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        months.add(`${yyyy}-${mm}`);
     }
  });

  const sortedMonths = Array.from(months).sort().reverse();
  
  const currentSelection = monthSelector.value;
  monthSelector.innerHTML = '';
  
  let currentSummarySelection = "current";
  if (summaryMonthSelector) {
     currentSummarySelection = summaryMonthSelector.value;
     summaryMonthSelector.innerHTML = '';
  }
  
  let currentHistorySelection = "current";
  if (historyMonthSelector) {
     currentHistorySelection = historyMonthSelector.value;
     historyMonthSelector.innerHTML = '';
  }
  
  const today = new Date();
  const currentYyyyMm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  let foundSelected = false;
  let foundSummarySelected = false;
  let foundHistorySelected = false;
  
  sortedMonths.forEach(mStr => {
     const [y, m] = mStr.split('-');
     const d = new Date(y, m - 1);
     const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
     
     const opt = document.createElement('option');
     opt.value = mStr;
     opt.innerText = label;
     if (mStr === currentSelection) foundSelected = true;
     monthSelector.appendChild(opt);
     
     if (summaryMonthSelector) {
         const opt2 = document.createElement('option');
         opt2.value = mStr;
         opt2.innerText = mStr === currentYyyyMm ? "Current Month" : label;
         if (mStr === currentSummarySelection) foundSummarySelected = true;
         summaryMonthSelector.appendChild(opt2);
     }
     
     if (historyMonthSelector) {
         const opt3 = document.createElement('option');
         opt3.value = mStr;
         opt3.innerText = mStr === currentYyyyMm ? "Current Month" : label;
         if (mStr === currentHistorySelection) foundHistorySelected = true;
         historyMonthSelector.appendChild(opt3);
     }
  });
  
  if (sortedMonths.length === 0) {
     const opt = document.createElement('option');
     opt.value = currentYyyyMm;
     opt.innerText = today.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
     monthSelector.appendChild(opt);
     
     if (summaryMonthSelector) {
         const opt2 = document.createElement('option');
         opt2.value = currentYyyyMm;
         opt2.innerText = "Current Month";
         summaryMonthSelector.appendChild(opt2);
     }
     
     if (historyMonthSelector) {
         const opt3 = document.createElement('option');
         opt3.value = currentYyyyMm;
         opt3.innerText = "Current Month";
         historyMonthSelector.appendChild(opt3);
     }
  }
  
  if (foundSelected) {
     monthSelector.value = currentSelection;
  } else if (sortedMonths.includes(currentYyyyMm)) {
     monthSelector.value = currentYyyyMm;
  } else if (sortedMonths.length > 0) {
     monthSelector.value = sortedMonths[0];
  }
  
  if (summaryMonthSelector) {
      if (foundSummarySelected) {
         summaryMonthSelector.value = currentSummarySelection;
      } else if (sortedMonths.includes(currentYyyyMm)) {
         summaryMonthSelector.value = currentYyyyMm;
      } else if (sortedMonths.length > 0) {
         summaryMonthSelector.value = sortedMonths[0];
      }
  }
  
  if (historyMonthSelector) {
      if (foundHistorySelected) {
         historyMonthSelector.value = currentHistorySelection;
      } else if (sortedMonths.includes(currentYyyyMm)) {
         historyMonthSelector.value = currentYyyyMm;
      } else if (sortedMonths.length > 0) {
         historyMonthSelector.value = sortedMonths[0];
      }
  }
}

function updateChart() {
  const targetMonth = monthSelector.value;
  const expT = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(targetMonth));
  
  const aggs = {};
  expT.forEach(t => {
     aggs[t.category] = (aggs[t.category] || 0) + Math.abs(t.amount);
  });
  
  const originalLabels = Object.keys(aggs);
  const formatChartMoney = (amt) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(amt));
  const labels = originalLabels.map(cat => `${cat} (${formatChartMoney(aggs[cat])})`);
  const data = Object.values(aggs);
  
  if (labels.length === 0) {
     document.getElementById('expense-chart').style.display = 'none';
     chartEmptyState.style.display = 'block';
  } else {
     document.getElementById('expense-chart').style.display = 'block';
     chartEmptyState.style.display = 'none';
  }
  
  const bgColors = originalLabels.map(l => getCategoryColor(l).text);

  const isMobile = window.innerWidth <= 768;
  const chartRadius = isMobile ? '60%' : '80%';

  if (expenseChart) {
     expenseChart.data.labels = labels;
     expenseChart.data.datasets[0].data = data;
     expenseChart.data.datasets[0].backgroundColor = bgColors;
     expenseChart.options.radius = chartRadius;
     expenseChart.update();
  } else {
     Chart.defaults.color = '#94a3b8';
     Chart.defaults.font.family = "'Outfit', sans-serif";
     
     expenseChart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
           labels: labels,
           datasets: [{
              data: data,
              backgroundColor: bgColors,
              borderColor: '#1e293b',
              borderWidth: 2,
              hoverOffset: 4
           }]
        },
        options: {
           radius: chartRadius,
           layout: {
             padding: { left: 0, right: 15, top: 0, bottom: 0 }
           },
           responsive: true,
           maintainAspectRatio: false,
           cutout: '65%',
           plugins: {
              legend: {
                 position: 'right',
                 labels: { boxWidth: 10, padding: 10 }
              },
              tooltip: {
                 callbacks: {
                    label: function(context) {
                       const roundedVal = Math.round(context.raw);
                       return ' ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(roundedVal);
                    }
                 }
              }
           }
        }
     });
  }
}

// Update Balance, Income & Expenses
function updateValues() {
  const amounts = transactions.map(t => t.type === 'income' ? t.amount : -t.amount);
  
  const total = amounts.reduce((acc, item) => (acc += item), 0);
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const targetMonthStr = (summaryMonthSelector && summaryMonthSelector.value && summaryMonthSelector.value !== "current")
                         ? summaryMonthSelector.value 
                         : currentMonthStr;
  
  const monthlyTransactions = transactions.filter(t => t.date && t.date.startsWith(targetMonthStr));
  
  const monthlyIncome = monthlyTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
    
  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const monthlyBalance = monthlyIncome - monthlyExpense;

  balanceEl.innerText = formatMoney(total);
  if (monthlyIncomeEl) monthlyIncomeEl.innerText = formatMoney(monthlyIncome);
  if (monthlyExpenseEl) monthlyExpenseEl.innerText = formatMoney(monthlyExpense);
  if (monthlyBalanceEl) {
     monthlyBalanceEl.innerText = formatMoney(monthlyBalance);
     if (monthlyBalance > 0) {
        monthlyBalanceEl.style.color = 'var(--success-color)';
     } else if (monthlyBalance < 0) {
        monthlyBalanceEl.style.color = 'var(--danger-color)';
     } else {
        monthlyBalanceEl.style.color = 'var(--text-primary)';
     }
  }
}

// Add Transaction Logic
async function addTransaction(e) {
  e.preventDefault();

  const type = document.querySelector('input[name="type"]:checked').value;
  const amount = Number(amountInput.value);
  const baseCategory = categoryInput.value;
  const subCategory = subcategoryGroup.style.display !== 'none' ? subcategoryInput.value : '';
  const description = descriptionInput.value;
  const date = dateInput.value;

  if (!amount || !date) {
    alert('Please fill in all required fields');
    return;
  }
  
  let category = 'Income';
  if (type === 'expense') {
    const baseCategory = categoryInput.value;
    const subCategory = subcategoryGroup.style.display !== 'none' ? subcategoryInput.value : '';
    
    if (!baseCategory) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (subcategoryGroup.style.display !== 'none' && !subCategory) {
      alert('Please select a subcategory');
      return;
    }
    
    category = subCategory || baseCategory;
  }

  const transactionData = {
    type,
    amount,
    category,
    description,
    date,
    createdAt: new Date().toISOString()
  };

  if (isEditing) {
    try {
      await db.collection("transactions").doc(editId).update(transactionData);
      resetFormState();
    } catch (err) {
      console.error("Error updating: ", err);
      alert('Failed to update transaction');
    }
  } else {
    try {
      await db.collection("transactions").add(transactionData);
      
      // Reset form but keep date
      const prevDate = dateInput.value;
      form.reset();
      dateInput.value = prevDate;
      categoryInput.style.color = '';
      subcategoryInput.style.color = '';
    } catch (err) {
      console.error("Error adding document: ", err);
      alert('Failed to save transaction');
    }
  }
}

// Edit Transaction
window.editTransaction = function(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  isEditing = true;
  editId = id;

  const typeRadio = document.getElementById(`type-${transaction.type}`);
  typeRadio.checked = true;
  typeRadio.dispatchEvent(new Event('change'));

  amountInput.value = transaction.amount;
  descriptionInput.value = transaction.description || '';
  dateInput.value = transaction.date;

  if (transaction.type === 'expense') {
    let isSub = false;
    for (const [base, subs] of Object.entries(subcategoriesData)) {
      if (subs.find(s => s.value === transaction.category)) {
        categoryInput.value = base;
        categoryInput.dispatchEvent(new Event('change'));
        subcategoryInput.value = transaction.category;
        subcategoryInput.dispatchEvent(new Event('change'));
        isSub = true;
        break;
      }
    }
    if (!isSub) {
      categoryInput.value = transaction.category;
      categoryInput.dispatchEvent(new Event('change'));
    }
  }

  formTitle.innerText = 'Edit Transaction';
  submitText.innerText = 'Save Changes';
  submitIcon.setAttribute('data-lucide', 'save');
  cancelEditBtn.style.display = 'block';
  lucide.createIcons();
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormState() {
  isEditing = false;
  editId = null;
  form.reset();
  
  dateInput.value = getTodayLocal();
  formTitle.innerText = 'Add New Transaction';
  submitText.innerText = 'Add Transaction';
  submitIcon.setAttribute('data-lucide', 'plus-circle');
  cancelEditBtn.style.display = 'none';
  categoryInput.style.color = '';
  subcategoryInput.style.color = '';
  
  const typeExp = document.getElementById('type-expense');
  typeExp.checked = true;
  typeExp.dispatchEvent(new Event('change'));
  
  lucide.createIcons();
}

cancelEditBtn.addEventListener('click', resetFormState);

// Hold to Delete Logic
let deleteTimer = null;

window.startDeleteTimer = function(id, btn) {
  if (deleteTimer) clearTimeout(deleteTimer);
  
  btn.style.color = 'var(--danger-color)';
  btn.style.transform = 'scale(0.85)';
  
  deleteTimer = setTimeout(async () => {
    try {
      await db.collection("transactions").doc(id).delete();
    } catch (err) {
      console.error("Error removing document: ", err);
      alert('Failed to delete transaction');
    }
  }, 1000);
}

window.cancelDeleteTimer = function(btn) {
  if (deleteTimer) {
    clearTimeout(deleteTimer);
    deleteTimer = null;
  }
  btn.style.color = '';
  btn.style.transform = '';
}

// Event Listeners
form.addEventListener('submit', addTransaction);

typeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'income') {
      categoryGroup.style.display = 'none';
      subcategoryGroup.style.display = 'none';
      categoryInput.required = false;
      subcategoryInput.required = false;
    } else {
      categoryGroup.style.display = 'block';
      categoryInput.required = true;
      const cat = categoryInput.value;
      if (subcategoriesData[cat]) {
        subcategoryGroup.style.display = 'block';
        subcategoryInput.required = true;
      }
    }
  });
});

categoryInput.addEventListener('change', (e) => {
  if (amountInput.value === '3.30' || amountInput.value === '52.38' || amountInput.value === '1495' || amountInput.value === '1495.00') {
    amountInput.value = '';
  }

  const cat = e.target.value;
  categoryInput.style.color = cat ? getCategoryColor(cat).text : '';
  
  if (subcategoriesData[cat]) {
    subcategoryGroup.style.display = 'block';
    subcategoryInput.required = true;
    subcategoryInput.innerHTML = '<option value="" disabled selected>Select subcategory</option>';
    subcategoriesData[cat].forEach(sub => {
      const colorOption = getCategoryColor(sub.value).text;
      subcategoryInput.innerHTML += `<option value="${sub.value}" style="color: ${colorOption};">${sub.label}</option>`;
    });
    subcategoryInput.style.color = '';
  } else {
    subcategoryGroup.style.display = 'none';
    subcategoryInput.required = false;
    subcategoryInput.innerHTML = '';
    subcategoryInput.style.color = '';
  }
});

subcategoryInput.addEventListener('change', (e) => {
  const sub = e.target.value;
  subcategoryInput.style.color = sub ? getCategoryColor(sub).text : '';

  if (sub === 'TTC') {
    amountInput.value = '3.30';
    document.getElementById('type-expense').checked = true;
  } else if (sub === 'Phone') {
    amountInput.value = '52.38';
    document.getElementById('type-expense').checked = true;
  } else if (sub === 'Rent') {
    amountInput.value = '1495';
    document.getElementById('type-expense').checked = true;
  } else {
    if (amountInput.value === '3.30' || amountInput.value === '52.38' || amountInput.value === '1495' || amountInput.value === '1495.00') {
      amountInput.value = '';
    }
  }
});
